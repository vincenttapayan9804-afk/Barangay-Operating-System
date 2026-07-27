import { HttpError } from './http.ts'

export interface AuthedUser {
  id: string
  barangayId: string | null
  role: string | null
  isPlatformAdmin: boolean
}

// Validates the caller's bearer token against GoTrue's own /user endpoint —
// same rationale as the WebAuthn sidecar's getUserFromToken and the
// PocketBase routes' e.auth: reuse the auth service's own token
// verification rather than re-implementing JWT validation here.
//
// barangay_id/role/is_platform_admin come straight from the token's
// app_metadata — already populated by custom_access_token_hook
// (migrations/0003_custom_access_token_hook.sql) at login time — so this
// is a single network call, not a database round trip, and is at least as
// trustworthy as PocketBase's e.auth.get(...) was (both ultimately trust
// whatever the auth service put in the session at login).
//
// SUPABASE_URL and SUPABASE_ANON_KEY are auto-injected into every Edge
// Function by the platform — not secrets this deployment sets itself.
export async function requireUser(req: Request): Promise<AuthedUser> {
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!token) throw new HttpError(401, 'Authentication required.')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey ?? '', Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new HttpError(401, 'Authentication required.')

  const user = await res.json()
  const appMeta = user.app_metadata || {}
  return {
    id: user.id,
    barangayId: appMeta.barangay_id ?? null,
    role: appMeta.role ?? null,
    isPlatformAdmin: appMeta.is_platform_admin === true,
  }
}
