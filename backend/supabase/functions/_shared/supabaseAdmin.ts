// Service-role helpers shared by login-gate and enroll-face — the same
// three operations backend/webauthn-service/server.mjs already needed
// (a service-role PostgREST call, a GoTrue admin-API call, and minting a
// fresh session for an already-verified user without a password), just
// ported to this Deno Edge Function runtime instead of a standalone Node
// sidecar. SUPABASE_URL/SUPABASE_ANON_KEY are auto-injected into every Edge
// Function by the platform; SUPABASE_SERVICE_ROLE_KEY is set explicitly in
// docker-compose.yml, same as every other function here that needs it.

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

export async function restRequest(path: string, opts: { method?: string; body?: unknown; prefer?: string } = {}) {
  const { method = 'GET', body, prefer } = opts
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`PostgREST ${method} ${path} failed: ${res.status} ${detail}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export async function authAdminRequest(path: string, opts: { method?: string; body?: unknown } = {}) {
  const { method = 'POST', body } = opts
  const res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`GoTrue admin ${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`)
  return json
}

// Attempts the actual password grant against GoTrue, server-side — this is
// the "proxy the GoTrue password grant" the Security Roadmap calls for, so
// a failure is counted from GoTrue's own authoritative response rather than
// a client-reported one. Returns null (not a thrown error) on invalid
// credentials — a wrong password is an expected, non-exceptional outcome
// here, not a server fault.
export async function passwordGrant(email: string, password: string): Promise<{ user: { id: string; email: string } } | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token) return null
  return json
}

// Mints a real GoTrue session for an already-verified user with no
// password re-entry — identical technique to
// backend/webauthn-service/server.mjs's mintSessionForUser: an admin
// magiclink is generated server-side and immediately redeemed via
// /auth/v1/verify using its email_otp code (the one redeemable path that
// returns access_token/refresh_token directly in a JSON body, not a
// browser-redirect URL fragment GoTrue's server never sees).
export async function mintSessionForUser(email: string) {
  const link = await authAdminRequest('/admin/generate_link', {
    body: { type: 'magiclink', email },
  })
  const res = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email, token: link.email_otp }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.access_token || !json?.refresh_token) {
    throw new Error(`session mint did not return both tokens: ${res.status} ${JSON.stringify(json)}`)
  }
  return json
}
