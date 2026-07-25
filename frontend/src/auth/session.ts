import { getClient } from '@/api/client'

export type Role = 'admin' | 'staff' | 'viewer'

export interface AuthUser {
  id: string
  email: string
  role: Role
  name?: string
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
  }
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

export function login(email: string, password: string) {
  return getClient().collection('users').authWithPassword(email, password)
}

export function logout(): void {
  getClient().authStore.clear()
}
