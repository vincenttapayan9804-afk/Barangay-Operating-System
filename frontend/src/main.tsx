import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import '@/index.css'
import App from '@/App'
import { initSentry } from '@/lib/sentry'

initSentry()

// A render error anywhere in the tree must never fall through to React's
// default behavior of unmounting to a blank page (dev) or printing a raw
// component stack (would leak internals in prod if ever surfaced). This
// fallback is deliberately generic — no error message/stack is rendered to
// the user; Sentry.ErrorBoundary still reports the real error when
// VITE_SENTRY_DSN is configured.
function ErrorFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <p className="font-display text-sm font-semibold">Something went wrong.</p>
        <p className="mt-1 text-xs text-muted-foreground">Please reload the page. If this keeps happening, contact your barangay admin.</p>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
