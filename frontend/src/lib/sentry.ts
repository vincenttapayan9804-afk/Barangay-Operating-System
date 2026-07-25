import * as Sentry from '@sentry/react'

// No-op until VITE_SENTRY_DSN is set (see .env.example) — safe to ship
// without an account; error tracking just switches on once a DSN exists.
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  })
}
