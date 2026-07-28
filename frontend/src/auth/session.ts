import type { User as SupabaseUser } from '@supabase/supabase-js'
import { getClient, getMockUsersCollection } from '@/api/client'
import { getSupabase } from '@/lib/supabaseClient'
import { isDemoModeEnabled } from '@/lib/demoAccounts'
import { attemptPasswordLogin, verifyFaceLogin } from '@/lib/loginGate'

export type Role = 'admin' | 'staff' | 'viewer'

export interface AuthUser {
  id: string
  email: string
  role: Role
  name?: string
  barangay_id: string
  is_platform_admin?: boolean
}

// Real-mode session cache — supabase-js's own session lookups are async, but
// every call site here expects getCurrentUser()/isAuthenticated() to answer
// synchronously (same as PocketBase's authStore did). initAuthSession() (see
// App.tsx) hydrates this once at boot; onAuthStateChange keeps it current
// after that (login, logout, token refresh, MFA challenge verified, ...).
let cachedUser: AuthUser | null = null
let listenerAttached = false

function userFromSupabaseUser(user: SupabaseUser | null | undefined): AuthUser | null {
  if (!user) return null
  const meta = (user.app_metadata ?? {}) as Record<string, unknown>
  return {
    id: user.id,
    email: user.email ?? '',
    role: meta.role as Role,
    name: (meta.name as string | undefined) ?? (user.user_metadata?.name as string | undefined),
    barangay_id: meta.barangay_id as string,
    is_platform_admin: meta.is_platform_admin as boolean | undefined,
  }
}

/** Hydrates the session cache once at boot. Call and await before rendering routes. */
export async function initAuthSession(): Promise<void> {
  if (isDemoModeEnabled()) return
  try {
    const supabase = getSupabase()
    const { data } = await supabase.auth.getSession()
    cachedUser = userFromSupabaseUser(data.session?.user)
    if (!listenerAttached) {
      listenerAttached = true
      supabase.auth.onAuthStateChange((_event, session) => {
        cachedUser = userFromSupabaseUser(session?.user)
      })
    }
  } catch {
    // No real backend configured yet (e.g. VITE_API_URL unset) — getSupabase()
    // throws synchronously in that case (supabase-js validates the URL at
    // construction time). Nothing to hydrate; the login page's demo-mode
    // buttons must still work with zero .env, so this can't be a fatal boot
    // error — App.tsx awaits initAuthSession() before rendering anything.
    cachedUser = null
  }
}

function getCurrentUserDemo(): AuthUser | null {
  const pb = getClient()
  if (!pb.authStore.isValid) return null
  const record = pb.authStore.record
  if (!record) return null
  return {
    id: record.id,
    email: record.email as string,
    role: record.role as Role,
    name: record.name as string | undefined,
    barangay_id: record.barangay_id as string,
    is_platform_admin: record.is_platform_admin as boolean | undefined,
  }
}

export function getCurrentUser(): AuthUser | null {
  return isDemoModeEnabled() ? getCurrentUserDemo() : cachedUser
}

export function isPlatformAdmin(): boolean {
  return getCurrentUser()?.is_platform_admin === true
}

export function isAuthenticated(): boolean {
  return isDemoModeEnabled() ? getClient().authStore.isValid : cachedUser !== null
}

export async function verifyAuth(): Promise<boolean> {
  if (isDemoModeEnabled()) {
    const pb = getClient()
    if (!pb.authStore.isValid) return false
    try {
      await getMockUsersCollection().authRefresh()
      return true
    } catch {
      pb.authStore.clear()
      return false
    }
  }

  try {
    const { data, error } = await getSupabase().auth.getSession()
    if (error || !data.session) {
      cachedUser = null
      return false
    }
    cachedUser = userFromSupabaseUser(data.session.user)
    return true
  } catch {
    // Same reasoning as initAuthSession() above — getSupabase() throws
    // synchronously when no real backend is configured, which must not
    // leave RootGate's "loading" state stuck forever (see routes/index.tsx).
    cachedUser = null
    return false
  }
}

export function hasRole(...roles: Role[]): boolean {
  const user = getCurrentUser()
  if (!user) return false
  return roles.includes(user.role)
}

// Admin (and, per barangays.require_staff_mfa, sometimes staff) accounts
// require a second factor. Unlike PocketBase's email-OTP flow, Supabase's
// MFA (Phase 2's TOTP decision) doesn't block sign-in itself — GoTrue always
// issues a valid (aal1) session on a correct password, then RLS refuses
// tenant data until the session reaches aal2. login() checks the
// post-sign-in assurance level itself and surfaces a challenge when aal2 is
// required, so the caller can prompt for an authenticator code before
// treating the user as fully signed in.
export interface MfaRequired {
  mfaRequired: true
  factorId: string
  challengeId: string
}

// Security Phase 6: an account that hit login-gate's 3-failed-attempt
// threshold on a previous try must pass a CompreFace face match on this
// login before a session is issued, even with the correct password —
// signaled by login-gate's { faceVerificationRequired: true, challengeId }
// response instead of tokens. LoginPage.tsx renders a camera-capture step
// for this the same way it already does for the TOTP `MfaRequired` step.
export interface FaceVerificationRequired {
  mfaRequired: false
  faceVerificationRequired: true
  challengeId: string
}

export interface LoginSuccess {
  mfaRequired: false
  faceVerificationRequired: false
}

export type LoginOutcome = MfaRequired | FaceVerificationRequired | LoginSuccess

// Adopts a freshly-issued session (from either login-gate's password step
// or its face-verification step) and checks whether this account also
// needs the existing TOTP aal2 step-up — unchanged from before Phase 6,
// just factored out so both entry points share it.
async function finishSessionAndCheckMfa(accessToken: string, refreshToken: string): Promise<LoginOutcome> {
  const supabase = getSupabase()
  const { error: setError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (setError) throw setError

  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalError) throw aalError

  if (aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel) {
    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) throw factorsError
    const totp = factorsData.totp.find((f) => f.status === 'verified')
    if (!totp) {
      throw new Error('MFA is required for this account, but no authenticator app is enrolled yet. Contact your barangay admin.')
    }
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: totp.id })
    if (challengeError) throw challengeError
    return { mfaRequired: true, factorId: totp.id, challengeId: challenge.id }
  }

  return { mfaRequired: false, faceVerificationRequired: false }
}

export async function login(email: string, password: string): Promise<LoginOutcome> {
  if (isDemoModeEnabled()) {
    await getMockUsersCollection().authWithPassword(email, password)
    return { mfaRequired: false, faceVerificationRequired: false }
  }

  // Proxies the password grant through login-gate (Security Phase 6)
  // instead of calling supabase.auth.signInWithPassword() directly, so a
  // failed attempt is counted server-side, authoritatively.
  const result = await attemptPasswordLogin(email, password)
  if (result.faceVerificationRequired) {
    return { mfaRequired: false, faceVerificationRequired: true, challengeId: result.challengeId as string }
  }

  return finishSessionAndCheckMfa(result.access_token as string, result.refresh_token as string)
}

/** Completes the face-verification step-up challenge from login()'s FaceVerificationRequired outcome. */
export async function completeFaceLogin(challengeId: string, imageDataUrl: string): Promise<LoginOutcome> {
  const result = await verifyFaceLogin(challengeId, imageDataUrl)
  return finishSessionAndCheckMfa(result.access_token as string, result.refresh_token as string)
}

/** Issues a fresh challenge for the same factor — used for a "my code expired" retry, not a resend (no code is emailed; TOTP codes come from the user's own authenticator app). */
export async function requestNewMfaChallenge(factorId: string): Promise<string> {
  const { data, error } = await getSupabase().auth.mfa.challenge({ factorId })
  if (error) throw error
  return data.id
}

export async function completeMfaLogin(factorId: string, challengeId: string, code: string): Promise<void> {
  const { error } = await getSupabase().auth.mfa.verify({ factorId, challengeId, code })
  if (error) throw error
}

export function logout(): void {
  if (isDemoModeEnabled()) {
    getClient().authStore.clear()
    return
  }
  cachedUser = null
  void getSupabase().auth.signOut()
}
