import { FunctionsHttpError } from '@supabase/supabase-js'
import { getSupabase } from './supabaseClient'

// Security Phase 6: talks to backend/supabase/functions/login-gate, the
// server-side proxy for the password grant. This replaces a direct
// supabase.auth.signInWithPassword() call for email+password sign-in
// (see auth/session.ts's login()) specifically so a failed attempt is
// counted from GoTrue's own authoritative response, not a client-reported
// one — a modified client can lie about what it observed, but it can't
// make login-gate see a password grant succeed that didn't.

export class LoginGateError extends Error {
  status?: number
  locked?: boolean
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'LoginGateError'
    this.status = status
    this.locked = status === 423
  }
}

interface LoginGateResponse {
  access_token?: string
  refresh_token?: string
  faceVerificationRequired?: boolean
  challengeId?: string
}

async function invokeLoginGate(body: Record<string, unknown>): Promise<LoginGateResponse> {
  const { data, error } = await getSupabase().functions.invoke<LoginGateResponse>('login-gate', { body })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => ({}))
      throw new LoginGateError(body?.error || 'Sign-in failed.', error.context.status)
    }
    throw new LoginGateError(error.message || 'Sign-in failed.')
  }
  if (!data) throw new LoginGateError('Sign-in failed.')
  return data
}

export function attemptPasswordLogin(email: string, password: string) {
  return invokeLoginGate({ action: 'password', email, password })
}

export function verifyFaceLogin(challengeId: string, image: string) {
  return invokeLoginGate({ action: 'verify-face', challengeId, image })
}
