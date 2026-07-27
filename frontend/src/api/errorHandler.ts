import { DemoResponseError } from './mockPocketBase'
import { AuthError } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabaseClient'

export class ApiError extends Error {
  status?: number
  original?: unknown

  constructor(message: string, status?: number, original?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.original = original
  }
}

// PostgREST's error shape (returned in `{ data, error }`, not thrown) —
// duck-typed since @supabase/supabase-js doesn't export a class for it the
// way it does for AuthError.
interface PostgrestLikeError {
  message: string
  code: string
  details?: string | null
  hint?: string | null
}

function isPostgrestError(err: unknown): err is PostgrestLikeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string'
  )
}

export function handleApiError(err: unknown): ApiError {
  // Demo mode (mockPocketBase.ts throws these).
  if (err instanceof DemoResponseError) {
    const status = err.status
    let message = err.message ?? 'Unknown API error'

    if (status === 429) {
      message = 'Rate limit exceeded. Please wait before retrying.'
    } else if (status === 403) {
      message = 'You do not have permission to perform this action.'
    } else if (status === 401) {
      message = 'Your session has expired. Please sign in again.'
    } else if (status === 400) {
      const response = err.data ?? {}
      const fieldErrors: string[] = []
      const data = response.data ?? {}
      for (const [field, detail] of Object.entries(data)) {
        const d = detail as { code?: string; message?: string }
        if (d?.message) fieldErrors.push(`${field}: ${d.message}`)
      }
      if (fieldErrors.length > 0) {
        message = `Validation failed: ${fieldErrors.join('; ')}`
      }
    }

    return new ApiError(message, status, err)
  }

  // Real backend, GoTrue auth errors (login, token refresh, factor enrollment, ...).
  if (err instanceof AuthError) {
    let message = err.message || 'Authentication error'
    if (err.status === 401 || err.code === 'session_not_found' || err.code === 'refresh_token_not_found') {
      getSupabase().auth.signOut()
      message = 'Your session has expired. Please sign in again.'
    } else if (err.status === 429) {
      message = 'Rate limit exceeded. Please wait before retrying.'
    }
    return new ApiError(message, err.status, err)
  }

  // Real backend, PostgREST errors (table CRUD via supabase.from(...)) — Postgres
  // error codes, not HTTP status codes. See https://postgrest.org/en/stable/references/errors.html
  if (isPostgrestError(err)) {
    let message = err.message || 'Unknown API error'
    if (err.code === '42501') {
      message = 'You do not have permission to perform this action.'
    } else if (err.code === 'PGRST301' || err.code === 'PGRST303') {
      getSupabase().auth.signOut()
      message = 'Your session has expired. Please sign in again.'
    } else if (err.code.startsWith('23')) {
      // Constraint violations (unique, not-null, check, fk) — Postgres's own
      // message is already specific; surface its detail if present.
      message = `Validation failed: ${err.details || err.message}`
    }
    return new ApiError(message, undefined, err)
  }

  if (err instanceof TypeError && err.message === 'Failed to fetch') {
    return new ApiError('Network error. Operation will be queued offline.')
  }

  return new ApiError(
    err instanceof Error ? err.message : 'Unknown error',
    undefined,
    err,
  )
}

export function shouldRetry(err: ApiError): boolean {
  if (err.status === 429) return true
  if (err.status === 503) return true
  return false
}

export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30000)
}
