/**
 * Clarivo — Bootstrap Isolated Super Admin
 *
 * This script creates a SUPER_ADMIN account in a completely isolated collection.
 * It also cleans up the old tenant-based masood@prudentbit.com account if it exists.
 *
 * Usage:
 *   node src/scripts/createSuperAdmin.mjs
 */

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore'

// ─── Config — copy from your .env ────────────────────────────
const firebaseConfig = {
  apiKey: 'AIzaSyCzvv-yeUjs-5RyRVbguRyG2-50WgbjU7Q',
  authDomain: 'clarivo-b8312.firebaseapp.com',
  projectId: 'clarivo-b8312',
  storageBucket: 'clarivo-b8312.firebasestorage.app',
  messagingSenderId: '17566530285',
  appId: '1:17566530285:web:bede37c8773ca341c36ae4',
}

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD
if (!SUPER_ADMIN_EMAIL || !SUPER_ADMIN_PASSWORD) {
  console.error('Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD environment variables first.')
  process.exit(1)
}
const SUPER_ADMIN_NAME = 'Masood Aslam'

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

async function bootstrap() {
  console.log('\n━━━ Clarivo Isolated Super Admin Bootstrap ━━━\n')

  try {
    // 1. Setup Firebase Auth
    let uid
    try {
      const cred = await createUserWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
      uid = cred.user.uid
      console.log('✓ Created Firebase Auth account:', SUPER_ADMIN_EMAIL)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        console.log('⟳ Auth account exists, signing in...')
        const cred = await signInWithEmailAndPassword(auth, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
        uid = cred.user.uid
        console.log('✓ Signed in as:', SUPER_ADMIN_EMAIL, '(uid:', uid, ')')
      } else {
        throw err
      }
    }

    // 2. Clean up Old Tenant-Based Admin
    console.log('\n[Cleanup] Looking for old tenant deployments...')
    const tenantsSnap = await getDocs(collection(db, 'tenants'))
    for (const tenantDoc of tenantsSnap.docs) {
      const oldUserRef = doc(db, 'tenants', tenantDoc.id, 'users', uid)
      try {
        await deleteDoc(oldUserRef)
        console.log(`✓ Deleted old user doc from tenant: ${tenantDoc.id}`)
      } catch (e) {
        // Might not exist or permission denied
      }
    }

    // 3. Create isolated /superAdmins/{uid}
    await setDoc(doc(db, 'superAdmins', uid), {
      email: SUPER_ADMIN_EMAIL,
      displayName: SUPER_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      isActive: true,
      lastLogin: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true })
    console.log('\n✓ Created isolated profile in /superAdmins')

    // 4. Update /userIndex/{uid} with accountType
    await setDoc(doc(db, 'userIndex', uid), {
      uid,
      tenantId: null, // Critical: isolated from all tenants
      email: SUPER_ADMIN_EMAIL,
      accountType: 'super_admin' // New routing field
    }, { merge: true })
    console.log('✓ Updated userIndex with accountType: super_admin')

    console.log('\n━━━ ✅ Completely Clean Bootstrap! ━━━')
    console.log(`\n  Super Admin Login: http://localhost:5173/super-admin/login`)
    console.log(`  Email:             ${SUPER_ADMIN_EMAIL}`)
    console.log(`  Password:          (value of SUPER_ADMIN_PASSWORD)\n`)

    process.exit(0)
  } catch (err) {
    console.error('\n✗ Bootstrap failed:', err.message)
    process.exit(1)
  }
}

bootstrap()
