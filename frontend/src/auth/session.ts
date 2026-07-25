import { ClientResponseError } from 'pocketbase'
import { getClient } from '@/api/client'

export type Role = 'admin' | 'staff' | 'viewer'

export interface AuthUser {
  id: string
  email: string
  role: Role
  name?: string
  barangay_id: string
  is_platform_admin?: boolean
}

export function getCurrentUser(): AuthUser | null {
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

export function isPlatformAdmin(): boolean {
  return getCurrentUser()?.is_platform_admin === true
}

export function isAuthenticated(): boolean {
  return getClient().authStore.isValid
}

export async function verifyAuth(): Promise<boolean> {
  const pb = getClient()
  if (!pb.authStore.isValid) return false
  try {
    await pb.collection('users').authRefresh()
    return true
  } catch {
    pb.authStore.clear()
    return false
  }
}

export function hasRole(...roles: Role[]): boolean {
  const user = getCurrentUser()
  if (!user) return false
  return roles.includes(user.role)
}

// Admin accounts require a second factor (see 1785000029_admin_mfa.js). When
// that's the case, the first password call fails with a 401 whose body is
// `{ mfaId }` instead of a normal error — that's not a failed login, it's a
// request to complete the next step. Non-admin accounts (mfa.rule doesn't
// match) log in normally on the first call.
export interface MfaRequired {
  mfaRequired: true
  mfaId: string
}

export async function login(email: string, password: string): Promise<MfaRequired | { mfaRequired: false }> {
  try {
    await getClient().collection('users').authWithPassword(email, password)
    return { mfaRequired: false }
  } catch (err) {
    const mfaId = err instanceof ClientResponseError ? (err.data as { mfaId?: string })?.mfaId : undefined
    if (mfaId) return { mfaRequired: true, mfaId }
    throw err
  }
}

export function requestLoginOtp(email: string) {
  return getClient().collection('users').requestOTP(email)
}

export function completeMfaLogin(otpId: string, code: string, mfaId: string) {
  return getClient().collection('users').authWithOTP(otpId, code, { mfaId })
}

export function logout(): void {
  getClient().authStore.clear()
}
