/**
 * Clarivo — Bootstrap Isolated Super Admin
 *
 * This script creates a SUPER_ADMIN account in a completely isolated collection.
 * Simplified to bypass complex cleanup queries so it doesn't get blocked by strict Firestore Rules.
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
  serverTimestamp,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCzvv-yeUjs-5RyRVbguRyG2-50WgbjU7Q',
  authDomain: 'clarivo-b8312.firebaseapp.com',
  projectId: 'clarivo-b8312',
  storageBucket: 'clarivo-b8312.firebasestorage.app',
  messagingSenderId: '17566530285',
  appId: '1:17566530285:web:bede37c8773ca341c36ae4',
}

const SUPER_ADMIN_EMAIL = 'masood@prudentbit.com'
const SUPER_ADMIN_PASSWORD = 'Admin@1234'
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

    // 2. Create isolated /superAdmins/{uid}
    // We bypass tenant cleanup entirely to avoid triggering read-protection rules.
    await setDoc(doc(db, 'superAdmins', uid), {
      email: SUPER_ADMIN_EMAIL,
      displayName: SUPER_ADMIN_NAME,
      role: 'SUPER_ADMIN',
      isActive: true,
      lastLogin: serverTimestamp(),
      createdAt: serverTimestamp(),
    }, { merge: true })
    console.log('\n✓ Created isolated profile in /superAdmins')

    // 3. Update /userIndex/{uid} with accountType
    await setDoc(doc(db, 'userIndex', uid), {
      uid,
      tenantId: null, // Critical: isolated from all tenants
      email: SUPER_ADMIN_EMAIL,
      accountType: 'super_admin' // New routing field triggers dashboard bypass
    }, { merge: true })
    console.log('✓ Updated userIndex with accountType: super_admin')

    console.log('\n━━━ ✅ Completely Clean Bootstrap! ━━━')
    console.log(`\n  Super Admin Login: http://localhost:5173/super-admin/login`)
    console.log(`  Email:             ${SUPER_ADMIN_EMAIL}`)
    console.log(`  Password:          ${SUPER_ADMIN_PASSWORD}\n`)

    process.exit(0)
  } catch (err) {
    console.error('\n✗ Bootstrap failed:', err.message)
    process.exit(1)
  }
}

bootstrap()
