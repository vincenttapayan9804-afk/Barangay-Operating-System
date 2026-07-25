import { Navigate } from 'react-router'
import { isAuthenticated, hasRole, getCurrentUser, type Role } from './session'

interface GuardProps {
  children: React.ReactNode
  roles?: Role[]
}

export function RequireAuth({ children }: GuardProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export function RequireRole({ children, roles }: GuardProps) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }
  if (roles && !hasRole(...roles)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function RedirectIfAuth({ children }: GuardProps) {
  if (isAuthenticated()) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function useUserRole(): Role | null {
  return getCurrentUser()?.role ?? null
}
