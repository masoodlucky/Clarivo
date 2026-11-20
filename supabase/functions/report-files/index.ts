  // Clarivo — report file broker (Supabase Edge Function)
  //
  // The "reports" bucket is private and has NO storage policies, so the browser can
  // never read or write it directly. This function is the only gate:
  //   1. Verifies the caller's Firebase ID token (signature, issuer, audience, expiry).
  //   2. Reads the caller's /userIndex/{uid} from Firestore *using the caller's own token*,
  //      so Firestore rules stay the single source of truth for tenant membership.
  //   3. Issues a short-lived signed upload/download URL, only for paths inside the
  //      caller's own tenant folder: tenants/{tenantId}/reports/{reportId}/{fileName}.
  //
  // Deploy with JWT verification OFF (the token is a Firebase token, not a Supabase one):
  //   supabase functions deploy report-files --no-verify-jwt
  // Secrets: FIREBASE_PROJECT_ID, ALLOWED_ORIGINS (comma-separated).
  // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

  import { createClient } from 'npm:@supabase/supabase-js@2'
  import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5'

  const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID') ?? ''
  const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173')
    .split(',').map((s) => s.trim()).filter(Boolean)
  const BUCKET = 'reports'
  const DOWNLOAD_TTL_SECONDS = 60 * 60

  const FIREBASE_JWKS = createRemoteJWKSet(new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ))

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const ID_RE = /^[A-Za-z0-9_-]{1,128}$/
  const PATH_RE = /^tenants\/([A-Za-z0-9_-]{1,128})\/reports\/[A-Za-z0-9_-]{1,128}\/[A-Za-z0-9._-]{1,200}$/

  function corsHeaders(origin: string | null): Record<string, string> {
    const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
    return {
      'Access-Control-Allow-Origin': allowed,
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin',
    }
  }

  function json(body: unknown, status: number, origin: string | null) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }

  function safeFileName(name: string): string {
    const cleaned = name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^\.+/, '').slice(-200)
    return cleaned || 'file'
  }

  async function lookupMembership(uid: string, idToken: string) {
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}` +
      `/databases/(default)/documents/userIndex/${encodeURIComponent(uid)}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } })
    if (!res.ok) return null
    const doc = await res.json()
    const f = doc.fields ?? {}
    return {
      tenantId: (f.tenantId?.stringValue as string | undefined) ?? null,
      isSuperAdmin: f.accountType?.stringValue === 'super_admin',
    }
  }

  Deno.serve(async (req) => {
    const origin = req.headers.get('Origin')
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
    if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, origin)
    if (!FIREBASE_PROJECT_ID) return json({ error: 'server_misconfigured' }, 500, origin)

    // 1. Verify Firebase ID token
    const idToken = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    let uid: string
    try {
      const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
        issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
        audience: FIREBASE_PROJECT_ID,
      })
      if (!payload.sub) throw new Error('no sub')
      uid = payload.sub
    } catch {
      return json({ error: 'unauthenticated' }, 401, origin)
    }

    // 2. Tenant membership from Firestore
    const member = await lookupMembership(uid, idToken)
    if (!member) return json({ error: 'forbidden' }, 403, origin)

    let body: { action?: string; reportId?: string; fileName?: string; path?: string }
    try { body = await req.json() } catch { return json({ error: 'bad_request' }, 400, origin) }

    // 3a. Upload: always into the caller's own tenant folder
    if (body.action === 'upload') {
      if (!member.tenantId) return json({ error: 'forbidden' }, 403, origin)
      if (!body.reportId || !ID_RE.test(body.reportId) || !body.fileName) {
        return json({ error: 'bad_request' }, 400, origin)
      }
      const path = `tenants/${member.tenantId}/reports/${body.reportId}/${safeFileName(body.fileName)}`
      const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error) return json({ error: 'storage_error' }, 500, origin)
      return json({ path: data.path, token: data.token }, 200, origin)
    }

    // 3b. Download: only paths inside the caller's tenant (super admins: any tenant)
    if (body.action === 'download') {
      const m = body.path ? PATH_RE.exec(body.path) : null
      if (!m) return json({ error: 'bad_request' }, 400, origin)
      if (!member.isSuperAdmin && m[1] !== member.tenantId) return json({ error: 'forbidden' }, 403, origin)
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(body.path!, DOWNLOAD_TTL_SECONDS)
      if (error) return json({ error: 'not_found' }, 404, origin)
      return json({ url: data.signedUrl }, 200, origin)
    }

    return json({ error: 'bad_request' }, 400, origin)
  })
