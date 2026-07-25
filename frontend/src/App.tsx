import { useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router'
import { ThemeProvider } from '@/lib/theme'
import { resolveApiUrl, isFallbackMode } from '@/lib/apiConfig'
import AppRoutes from '@/routes'
import { getClient } from '@/api/client'

export default function App() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    resolveApiUrl().then(() => {
      // Re-initialize client with the resolved URL
      // (already handled by getClient() reading getApiUrl())
      getClient()
      setReady(true)
    })
  }, [])

  if (!ready) return null

  return (
    <BrowserRouter>
      <ThemeProvider>
        {isFallbackMode() && (
          <div className="fixed bottom-4 left-4 z-50 rounded bg-amber-100 px-3 py-1.5 text-xs text-amber-800 shadow">
            Using remote — local server unreachable
          </div>
        )}
        <AppRoutes />
      </ThemeProvider>
    </BrowserRouter>
  )
}
