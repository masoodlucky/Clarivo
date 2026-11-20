import { createContext, useContext, useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { isFirmRole, ROLES } from '../config/roles'

const AuthContext = createContext(null)

// ─── Friendly Error Messages ───────────────────────────────

function getFriendlyAuthError(code) {
  switch (code) {
    case 'auth/user-not-found':
      return 'Account not found. Check your email or register.'
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a few minutes.'
    case 'auth/user-disabled':
      return 'This account has been suspended. Contact your administrator.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/invalid-email':
      return 'Please enter a valid email address.'
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    default:
      return 'Authentication failed. Please try again.'
  }
}

// ─── AuthProvider ──────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)        // Firebase Auth user
  const [profile, setProfile] = useState(null)   // Firestore /tenants/{tid}/users/{uid}
  const [tenant, setTenant] = useState(null)     // Firestore /tenants/{tid}
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Session Persistence via onAuthStateChanged ──────────

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        try {
          await resolveProfile(firebaseUser)
        } catch (err) {
          console.error('Profile resolution failed:', err)
          // Auth user exists but profile couldn't be loaded
          setProfile(null)
          setTenant(null)
        }
      } else {
        setUser(null)
        setProfile(null)
        setTenant(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // ── Profile Resolution & Routing via userIndex ───────────

  async function resolveProfile(firebaseUser) {
    // Step 1: Read /userIndex/{uid} to route auth flow
    const indexRef = doc(db, 'userIndex', firebaseUser.uid)
    const indexSnap = await getDoc(indexRef)

    let indexData = indexSnap.exists() ? indexSnap.data() : null

    // If userIndex is missing or has no accountType, check /superAdmins/{uid} as fallback
    // IMPORTANT: Always check superAdmins when accountType is missing, even if tenantId exists.
    // A user might have been registered as a firm admin first and then bootstrapped as super admin.
    if (!indexData || !indexData.accountType) {
      const superRef = doc(db, 'superAdmins', firebaseUser.uid)
      const superSnap = await getDoc(superRef)
      if (superSnap.exists()) {
        // Auto-heal: set/fix the userIndex entry to super_admin
        const healedIndex = {
          uid: firebaseUser.uid,
          tenantId: null,
          email: firebaseUser.email,
          accountType: 'super_admin'
        }
        await setDoc(indexRef, healedIndex, { merge: true })
        indexData = healedIndex
      } else if (!indexData) {
        console.warn('No userIndex entry for', firebaseUser.uid)
        setProfile(null)
        setTenant(null)
        return
      }
    }

    // Step 2: Route Super Admin (based on accountType)
    if (indexData.accountType === 'super_admin') {
      const superRef = doc(db, 'superAdmins', firebaseUser.uid)
      const superSnap = await getDoc(superRef)
      
      if (!superSnap.exists()) {
        // Self-heal: create the superAdmins profile if missing
        await setDoc(superRef, {
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email,
          role: 'SUPER_ADMIN',
          isActive: true,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        })
      }
      
      const p = { 
        ...(superSnap.exists() ? superSnap.data() : { role: 'SUPER_ADMIN', isActive: true }), 
        uid: firebaseUser.uid, 
        accountType: 'super_admin' 
      }
      setProfile(p)
      setTenant(null)
      setDoc(superRef, { lastLogin: serverTimestamp() }, { merge: true }).catch(() => {})
      return
    }

    // Step 3: Route Tenant User
    const tenantId = indexData.tenantId
    if (!tenantId) {
      setProfile(null)
      setTenant(null)
      return
    }

    const userRef = doc(db, 'tenants', tenantId, 'users', firebaseUser.uid)
    const userSnap = await getDoc(userRef)

    if (!userSnap.exists()) {
      console.warn('No user profile for', firebaseUser.uid, 'in tenant', tenantId)
      setProfile(null)
      setTenant(null)
      return
    }

    const userProfile = { ...userSnap.data(), uid: firebaseUser.uid, accountType: 'tenant_user' }
    
    const tenantRef = doc(db, 'tenants', tenantId)
    const tenantSnap = await getDoc(tenantRef)
    const tenantData = tenantSnap.exists()
      ? { ...tenantSnap.data(), id: tenantId }
      : { id: tenantId, name: 'Unknown' }

    setProfile(userProfile)
    setTenant(tenantData)
    setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true }).catch(() => {})
  }

  // ─── Login ───────────────────────────────────────────────

  const login = async (email, password) => {
    setError(null)
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      // onAuthStateChanged handles profile resolution
      return result.user
    } catch (err) {
      const msg = getFriendlyAuthError(err.code)
      setError(msg)
      throw new Error(msg)
    }
  }

  // ─── Register (New Firm) ─────────────────────────────────

  const registerFirm = async ({ firmName, fullName, email, password }) => {
    setError(null)
    try {
      // 1. Create Firebase Auth user
      const result = await createUserWithEmailAndPassword(auth, email, password)
      const uid = result.user.uid

      // 2. Send email verification
      await sendEmailVerification(result.user)

      // 3. Generate tenantId
      const slug = firmName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const tenantId = `${slug}-${randomSuffix}`

      // 4. Create tenant document
      await setDoc(doc(db, 'tenants', tenantId), {
        name: firmName,
        plan: 'free',
        deploymentMode: 'cloud',
        piiScrubberEnabled: true,
        lofiModeActive: false,
        isActive: true,
        ollamaModel: 'mistral:7b',
        ollamaEndpoint: 'http://localhost:11434',
        createdAt: serverTimestamp(),
      })

      // 5. Create user profile under tenant
      await setDoc(doc(db, 'tenants', tenantId, 'users', uid), {
        email,
        displayName: fullName,
        role: ROLES.FIRM_ADMIN,
        clientOrgId: null,
        tenantId,
        isActive: true,
        mfaEnabled: false,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      })

      // 6. Create userIndex entry
      await setDoc(doc(db, 'userIndex', uid), {
        uid,
        tenantId,
        email,
      })

      // Sign out so user must verify email first
      await signOut(auth)

      return { success: true, tenantId }
    } catch (err) {
      const msg = getFriendlyAuthError(err.code)
      setError(msg)
      throw new Error(msg)
    }
  }

  // ─── Password Reset ─────────────────────────────────────

  const resetPassword = async (email) => {
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email)
      return true
    } catch (err) {
      const msg = getFriendlyAuthError(err.code)
      setError(msg)
      throw new Error(msg)
    }
  }

  // ─── Logout ──────────────────────────────────────────────

  const logout = async () => {
    try {
      await signOut(auth)
      // onAuthStateChanged clears state automatically
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  // ─── Force Profile Re-resolution ─────────────────────────
  // Used by SuperAdminLogin after verifying credentials to ensure
  // the profile is correctly resolved before navigating.

  const forceResolveProfile = async () => {
    const currentUser = auth.currentUser
    if (!currentUser) return
    try {
      await resolveProfile(currentUser)
    } catch (err) {
      console.error('Force profile resolution failed:', err)
    }
  }

  // ─── Role-based Redirect Helper ──────────────────────────

  const getDefaultRoute = (role, accountType) => {
    if (accountType === 'super_admin' || role === ROLES.SUPER_ADMIN) return '/super-admin/dashboard'
    if (!role) return '/login'
    if (isFirmRole(role)) return '/dashboard/firm'
    return '/dashboard/client'
  }

  // ─── Context Value ──────────────────────────────────────

  const value = {
    user,
    profile,
    tenant,
    loading,
    error,
    setError,
    login,
    registerFirm,
    resetPassword,
    logout,
    getDefaultRoute,
    forceResolveProfile,
    isAuthenticated: !!user && !!profile,
    role: profile?.role || null,
    tenantId: profile?.tenantId || tenant?.id || null,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ─── Hook ──────────────────────────────────────────────────

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
