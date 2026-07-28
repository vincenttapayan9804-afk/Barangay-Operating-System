// Security Phase 6 (biometric step-up authentication): the server-side
// proxy for the password grant the Security Roadmap calls for. Frontend
// code no longer calls supabase.auth.signInWithPassword() directly for
// email+password sign-in (frontend/src/auth/session.ts's login()) — it
// calls this function instead, so a failed attempt is counted from GoTrue's
// own authoritative response, not a client-reported one a modified client
// could simply skip.
//
// Two actions, one function (mirrors the plan's wording — "a login-gate
// Edge Function"):
//
//   { action: 'password', email, password }
//     -> { access_token, refresh_token, user }              (ordinary login)
//     -> { faceVerificationRequired: true, challengeId }     (account was
//          already step-up-locked from 3 prior failures; password was
//          correct, but a face match is required before a session issues)
//     -> 400/423 error                                       (wrong
//          password, or locked with no face enrolled — fails closed)
//
//   { action: 'verify-face', challengeId, image }
//     -> { access_token, refresh_token, user }               (face matched;
//          resets the failure counter and mints a fresh session)
//     -> 400/401 error                                       (expired
//          challenge, or no match)
//
// Deliberately unauthenticated (no requireUser call) — this runs before any
// session exists, same as the WebAuthn sidecar's own /login/* routes.
import { corsHeaders } from '../_shared/cors.ts'
import { json, errorResponse, HttpError } from '../_shared/http.ts'
import { restRequest, authAdminRequest, passwordGrant, mintSessionForUser } from '../_shared/supabaseAdmin.ts'
import { verifyFaceMatchesSubject, CompreFaceNotConfigured } from '../_shared/compreface.ts'

const CHALLENGE_TTL_MS = 2 * 60 * 1000
const LOCKOUT_THRESHOLD = 3

async function lookupUserIdByEmail(email: string): Promise<string | null> {
  const id = await restRequest('rpc/lookup_user_id_by_email', {
    method: 'POST',
    body: { p_email: email },
  })
  return (id as string | null) || null
}

async function getProfileBarangayId(userId: string): Promise<string | null> {
  const rows = await restRequest(`profiles?id=eq.${userId}&select=barangay_id`)
  return (rows as { barangay_id: string }[])[0]?.barangay_id ?? null
}

interface LoginAttemptsRow {
  failed_count: number
  locked_at: string | null
}

async function getLoginAttempts(userId: string): Promise<LoginAttemptsRow | null> {
  const rows = await restRequest(`login_attempts?user_id=eq.${userId}&select=failed_count,locked_at`)
  return (rows as LoginAttemptsRow[])[0] ?? null
}

async function upsertLoginAttempts(userId: string, barangayId: string, failedCount: number, locked: boolean) {
  await restRequest('login_attempts?on_conflict=user_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: { user_id: userId, barangay_id: barangayId, failed_count: failedCount, locked_at: locked ? new Date().toISOString() : null },
  })
}

async function recordFailedAttempt(userId: string) {
  const barangayId = await getProfileBarangayId(userId)
  if (!barangayId) return // orphaned profile — nothing sensible to track
  const existing = await getLoginAttempts(userId)
  const next = (existing?.failed_count ?? 0) + 1
  await upsertLoginAttempts(userId, barangayId, next, next >= LOCKOUT_THRESHOLD)
}

async function hasFaceEnrollment(userId: string): Promise<boolean> {
  const rows = await restRequest(`face_enrollments?user_id=eq.${userId}&select=user_id`)
  return (rows as unknown[]).length > 0
}

async function createFaceChallenge(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString()
  const [row] = await restRequest('login_face_challenges', {
    method: 'POST',
    prefer: 'return=representation',
    body: { user_id: userId, expires_at: expiresAt },
  }) as { id: string }[]
  return row.id
}

async function getUserEmailById(userId: string): Promise<string> {
  const user = await authAdminRequest(`/admin/users/${userId}`, { method: 'GET' })
  return user.email
}

async function handlePassword(email: string, password: string) {
  if (!email || !password) throw new HttpError(400, 'Email and password are required.')

  const userId = await lookupUserIdByEmail(email)
  const grant = await passwordGrant(email, password)

  if (!grant) {
    if (userId) await recordFailedAttempt(userId)
    throw new HttpError(400, 'Invalid email or password.')
  }
  if (!userId) throw new HttpError(500, 'Could not resolve this account.')

  const attempts = await getLoginAttempts(userId)
  if (!attempts?.locked_at) {
    const barangayId = await getProfileBarangayId(userId)
    if (barangayId) await upsertLoginAttempts(userId, barangayId, 0, false)
    return json({ access_token: grant.access_token, refresh_token: grant.refresh_token, user: grant.user })
  }

  // Correct password, but this account hit the failure threshold on a
  // previous attempt — the next login (this one) must also pass a face
  // match before a session is issued, regardless of the password.
  if (!(await hasFaceEnrollment(userId))) {
    throw new HttpError(
      423,
      'Too many failed attempts. This account requires face verification, but none is enrolled — ask your barangay admin to unlock it.',
    )
  }

  const challengeId = await createFaceChallenge(userId)
  return json({ faceVerificationRequired: true, challengeId })
}

async function handleVerifyFace(challengeId: string, image: string) {
  if (!challengeId || !image) throw new HttpError(400, 'Missing verification challenge or image.')

  const rows = await restRequest(`login_face_challenges?id=eq.${challengeId}&select=user_id,expires_at`) as
    { user_id: string; expires_at: string }[]
  const challenge = rows[0]
  const expired = !challenge || new Date(challenge.expires_at).getTime() < Date.now()
  if (expired) {
    if (challenge) await restRequest(`login_face_challenges?id=eq.${challengeId}`, { method: 'DELETE', prefer: 'return=minimal' })
    throw new HttpError(400, 'Your verification session expired. Please try signing in again.')
  }

  let matched: boolean
  try {
    matched = await verifyFaceMatchesSubject(image, challenge.user_id)
  } catch (err) {
    if (err instanceof CompreFaceNotConfigured) throw new HttpError(503, err.message)
    throw err
  }
  if (!matched) throw new HttpError(401, 'Could not verify your face. Please try again with better lighting.')

  await restRequest(`login_face_challenges?id=eq.${challengeId}`, { method: 'DELETE', prefer: 'return=minimal' })
  const barangayId = await getProfileBarangayId(challenge.user_id)
  if (barangayId) await upsertLoginAttempts(challenge.user_id, barangayId, 0, false)

  const email = await getUserEmailById(challenge.user_id)
  const session = await mintSessionForUser(email)
  return json({ access_token: session.access_token, refresh_token: session.refresh_token, user: session.user })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    if (action === 'password') {
      return await handlePassword(String(body.email || '').trim(), String(body.password || ''))
    }
    if (action === 'verify-face') {
      return await handleVerifyFace(String(body.challengeId || ''), String(body.image || ''))
    }
    throw new HttpError(400, "action must be 'password' or 'verify-face'.")
  } catch (err) {
    return errorResponse(err)
  }
})
