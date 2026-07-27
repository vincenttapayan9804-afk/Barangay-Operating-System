import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router'
import { LucideProvider } from 'lucide-react'
import { ThemeProvider } from '@/lib/theme'
import { LanguageProvider } from '@/lib/i18n'
import { resolveApiUrl, isFallbackMode } from '@/lib/apiConfig'
import AppRoutes from '@/routes'
import { initAuthSession } from '@/auth/session'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    resolveApiUrl().then(async () => {
      // Hydrates auth/session.ts's session cache once, synchronously
      // available (getCurrentUser()/isAuthenticated()) for the rest of the
      // app's lifetime from here on — mirrors PocketBase's authStore, which
      // loaded its persisted session synchronously in its constructor.
      await initAuthSession()
      setReady(true)
    })
  }, [])

  if (!ready) return null

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* Slightly lighter stroke than lucide's 2px default reads as more
          refined/premium at the sizes used throughout the dashboard. */}
      <LucideProvider strokeWidth={1.75}>
        <ThemeProvider>
          <LanguageProvider>
            {isFallbackMode() && (
              <div className="fixed bottom-4 left-4 z-50 rounded bg-amber-100 px-3 py-1.5 text-xs text-amber-800 shadow">
                Using remote — local server unreachable
              </div>
            )}
            <AppRoutes />
          </LanguageProvider>
        </ThemeProvider>
      </LucideProvider>
    </BrowserRouter>
  )
}
