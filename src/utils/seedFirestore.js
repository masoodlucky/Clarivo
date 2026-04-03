/**
 * Clarivo Firestore Seed Script
 * Creates tenant, users, and mock report data for development.
 *
 * Usage: Call importSeedData() once from the Login page dev button.
 *        Uses Firebase Auth for user creation + Firestore for profiles.
 *
 * NOTE: Make sure Firestore security rules allow writes, or use:
 *   rules_version = '2';
 *   service cloud.firestore {
 *     match /databases/{database}/documents {
 *       match /{document=**} {
 *         allow read, write: if request.auth != null;
 *       }
 *     }
 *   }
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '../config/firebase'
import { ROLES } from '../config/roles'
import { MOCK_REPORT, MOCK_DASHBOARD_STATS } from '../data/mockData'

// ─── Seed Config ────────────────────────────────────────────

const TENANT_FIRM = {
  id: 'prudentbit',
  name: 'PrudentBit Cybersecurity',
  type: 'firm',
  plan: 'enterprise',
  domain: 'prudentbit.com',
  logoUrl: null,
  deploymentMode: 'cloud',
  isActive: true,
}

const TENANT_CLIENT = {
  id: 'acme-corp',
  name: 'Acme Corp',
  type: 'client',
  plan: 'standard',
  domain: 'acme.com',
  logoUrl: null,
  deploymentMode: 'cloud',
  isActive: true,
  parentFirmId: 'prudentbit',
}

const SEED_USERS = [
  {
    email: 'admin@prudentbit.com',
    password: 'Demo@1234',
    displayName: 'Masood Aslam',
    role: ROLES.FIRM_ADMIN,
    tenantId: 'prudentbit',
  },
  {
    email: 'analyst@prudentbit.com',
    password: 'Demo@1234',
    displayName: 'Arjun Sharma',
    role: ROLES.ANALYST,
    tenantId: 'prudentbit',
  },
  {
    email: 'client-admin@acme.com',
    password: 'Demo@1234',
    displayName: 'Rahul Kumar',
    role: ROLES.CLIENT_ADMIN,
    tenantId: 'acme-corp',
  },
  {
    email: 'ceo@acme.com',
    password: 'Demo@1234',
    displayName: 'Neha Gupta',
    role: ROLES.CLIENT_VIEWER,
    tenantId: 'acme-corp',
  },
]

// ─── Helpers ────────────────────────────────────────────────

/** Wrap a promise with a timeout to prevent indefinite hangs */
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} took > ${ms}ms`)), ms),
    ),
  ])
}

/** Write a Firestore doc with timeout + error handling */
async function safeSetDoc(docRef, data, onProgress) {
  try {
    await withTimeout(
      setDoc(docRef, data, { merge: true }),
      10000,
      `setDoc(${docRef.path})`,
    )
    return true
  } catch (err) {
    onProgress?.(
      `⚠ Firestore write failed for ${docRef.path}: ${err.message}`,
    )
    onProgress?.(
      `  → Check Firestore rules in Firebase Console. Set: allow read, write: if request.auth != null;`,
    )
    return false
  }
}

/** Create or retrieve a Firebase Auth user */
async function ensureAuthUser(userData, onProgress) {
  try {
    // Try creating the user
    const cred = await createUserWithEmailAndPassword(
      auth,
      userData.email,
      userData.password,
    )
    onProgress?.(`✓ Created auth user: ${userData.email}`)
    return { uid: cred.user.uid, isNew: true }
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      // Already exists — sign in to get uid
      try {
        const cred = await signInWithEmailAndPassword(
          auth,
          userData.email,
          userData.password,
        )
        onProgress?.(`⟳ Auth user exists: ${userData.email}`)
        return { uid: cred.user.uid, isNew: false }
      } catch (signInErr) {
        onProgress?.(`✗ Cannot sign in ${userData.email}: ${signInErr.message}`)
        return null
      }
    }
    onProgress?.(`✗ Auth failed for ${userData.email}: ${err.message}`)
    return null
  }
}

// ─── Main Seed Function ─────────────────────────────────────

/**
 * Import all seed data into Firebase Auth + Firestore.
 * Safe to call multiple times (idempotent).
 *
 * Phase 1: Create all Auth users (no Firestore rules needed)
 * Phase 2: Write Firestore documents (needs rules configured)
 *
 * @param {function} onProgress - Callback for progress messages
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function importSeedData(onProgress = console.log) {
  const userMap = [] // { uid, userData }

  try {
    onProgress('━━━ Seeding Clarivo Demo Data ━━━')

    // ── Phase 1: Create Auth Users ─────────────────────────
    onProgress('\n👤 Phase 1 — Creating Auth users...')

    for (const userData of SEED_USERS) {
      const result = await ensureAuthUser(userData, onProgress)
      if (result) {
        userMap.push({ uid: result.uid, ...userData })
      }
    }

    if (userMap.length === 0) {
      onProgress('\n✗ No users created. Check Firebase Auth configuration.')
      return { success: false, message: 'No auth users could be created.' }
    }

    onProgress(`\n✓ ${userMap.length}/${SEED_USERS.length} auth users ready`)

    // Sign out before writing Firestore docs (to use last-created user's session)
    // Actually, we need to be signed in for Firestore rules. Sign in as first user.
    try {
      await signOut(auth)
      await signInWithEmailAndPassword(
        auth,
        SEED_USERS[0].email,
        SEED_USERS[0].password,
      )
      onProgress('✓ Signed in as admin for Firestore writes')
    } catch {
      onProgress('⚠ Could not sign in for Firestore — writes may fail')
    }

    // ── Phase 2: Write Firestore Documents ─────────────────
    onProgress('\n📁 Phase 2 — Writing Firestore data...')
    let firestoreOk = true

    // Tenants
    onProgress('  Creating tenants...')
    const t1 = await safeSetDoc(
      doc(db, 'tenants', TENANT_FIRM.id),
      { ...TENANT_FIRM, createdAt: serverTimestamp() },
      onProgress,
    )
    const t2 = await safeSetDoc(
      doc(db, 'tenants', TENANT_CLIENT.id),
      { ...TENANT_CLIENT, createdAt: serverTimestamp() },
      onProgress,
    )
    if (t1) onProgress(`  ✓ Tenant: ${TENANT_FIRM.name}`)
    if (t2) onProgress(`  ✓ Tenant: ${TENANT_CLIENT.name}`)
    firestoreOk = t1 && t2

    // User profiles under tenants
    onProgress('  Creating user profiles...')
    for (const u of userMap) {
      const ok = await safeSetDoc(
        doc(db, 'tenants', u.tenantId, 'users', u.uid),
        {
          email: u.email,
          displayName: u.displayName,
          role: u.role,
          tenantId: u.tenantId,
          mfaEnabled: false,
          isActive: true,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        },
        onProgress,
      )
      if (ok) onProgress(`  ✓ Profile: ${u.email} → ${u.role}`)
      else firestoreOk = false
    }

    // Report + findings + xai
    onProgress('  Creating report data...')
    const { findings, xai, ...reportMeta } = MOCK_REPORT
    const reportId = MOCK_REPORT.id

    const r1 = await safeSetDoc(
      doc(db, 'tenants', 'prudentbit', 'reports', reportId),
      { ...reportMeta, clientTenantId: 'acme-corp', createdAt: serverTimestamp(), updatedAt: serverTimestamp() },
      onProgress,
    )
    if (r1) onProgress(`  ✓ Report: ${reportMeta.title}`)

    for (const finding of findings) {
      await safeSetDoc(
        doc(db, 'tenants', 'prudentbit', 'reports', reportId, 'findings', finding.id),
        { ...finding, createdAt: serverTimestamp() },
        onProgress,
      )
    }
    onProgress(`  ✓ ${findings.length} findings seeded`)

    await safeSetDoc(
      doc(db, 'tenants', 'prudentbit', 'reports', reportId, 'xaiResults', 'latest'),
      { ...xai, generatedAt: serverTimestamp() },
      onProgress,
    )
    onProgress('  ✓ XAI results + NVD verification')

    // Dashboard stats
    await safeSetDoc(
      doc(db, 'tenants', 'prudentbit', 'dashboardStats', 'current'),
      { ...MOCK_DASHBOARD_STATS, updatedAt: serverTimestamp() },
      onProgress,
    )
    onProgress('  ✓ Dashboard stats')

    // Sign out so the user can log in fresh
    await signOut(auth)

    if (firestoreOk) {
      onProgress('\n━━━ ✅ Seed complete! You can now log in. ━━━')
      return { success: true, message: 'All demo data seeded successfully.' }
    } else {
      onProgress(
        '\n━━━ ⚠ Auth users created but some Firestore writes failed. ━━━',
      )
      onProgress('    Login should still work. Firestore data may be partial.')
      onProgress('    Fix Firestore rules and re-seed if needed.')
      return {
        success: true,
        message: 'Auth users created. Some Firestore writes failed — check rules.',
      }
    }
  } catch (err) {
    onProgress(`\n✗ Seed error: ${err.message}`)
    return { success: false, message: err.message }
  }
}

/**
 * Demo user credentials for quick login buttons
 */
export const DEMO_CREDENTIALS = {
  FIRM_ADMIN: { email: 'admin@prudentbit.com', password: 'Demo@1234' },
  ANALYST: { email: 'analyst@prudentbit.com', password: 'Demo@1234' },
  CLIENT_ADMIN: { email: 'client-admin@acme.com', password: 'Demo@1234' },
  CLIENT_VIEWER: { email: 'ceo@acme.com', password: 'Demo@1234' },
}
