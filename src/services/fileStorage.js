/**
 * Clarivo report file storage (Supabase Storage, brokered).
 *
 * The browser never gets direct bucket access. It asks the `report-files` Edge
 * Function (authenticated with the user's Firebase ID token) for a short-lived
 * signed URL, which only works for files inside the user's own tenant.
 */

import { createClient } from '@supabase/supabase-js'
import { auth } from '../config/firebase'

// Keep only the origin, e.g. "https://<ref>.supabase.co" — tolerates a pasted "/rest/v1/" suffix.
const SUPABASE_URL = (() => {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL).origin } catch { return '' }
})()
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const BUCKET = 'reports'

let client = null
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('File storage is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env')
  }
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

async function callBroker(payload) {
  getClient() // validates config
  const user = auth.currentUser
  if (!user) throw new Error('You must be signed in.')
  const idToken = await user.getIdToken()

  const res = await fetch(`${SUPABASE_URL}/functions/v1/report-files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`File storage error (${data.error || res.status})`)
  return data
}

/**
 * Upload a report file into the current user's tenant folder.
 * @returns {Promise<string>} the storage path to save on the report document
 */
export async function uploadReportFile(reportId, file) {
  const { path, token } = await callBroker({ action: 'upload', reportId, fileName: file.name })
  const { error } = await getClient().storage.from(BUCKET).uploadToSignedUrl(path, token, file, {
    contentType: file.type || 'application/octet-stream',
  })
  if (error) throw new Error(error.message)
  return path
}

/**
 * Get a short-lived (1 hour) download URL for a stored report file.
 */
export async function getReportFileUrl(path) {
  const { url } = await callBroker({ action: 'download', path })
  return url
}

/**
 * Resolve a viewable URL for a report document: Supabase path if present,
 * otherwise a legacy Firebase Storage `fileUrl`.
 */
export async function resolveReportFileUrl(report) {
  if (report?.storagePath) return getReportFileUrl(report.storagePath)
  return report?.fileUrl || null
}
