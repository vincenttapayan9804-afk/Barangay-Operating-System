import { Suspense, useState, useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { Menu, LogOut } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import OfflineIndicator from '@/offline/OfflineIndicator'
import { Toaster } from '@/components/ui/toast'
import { Spinner } from '@/components/ui/spinner'
import { getAllSettings } from '@/api/settings'
import { ClustrMark } from '@/components/ClustrLogo'
import { isDemoModeEnabled, exitDemoMode } from '@/lib/demoAccounts'
import { logout } from '@/auth/session'

const STORAGE_KEY = 'barangayos-sidebar-pinned'

export default function Layout() {
  const [pinned, setPinned] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored !== null ? stored === 'true' : true
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const [settings, setSettings] = useState<Record<string, any>>({})

  useEffect(() => {
    getAllSettings().then(setSettings).catch(() => {})
  }, [])

  function togglePinned() {
    setPinned((prev) => {
      const next = !prev
      localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  const brgyName = settings.barangay_name ?? ''
  const municipality = settings.municipality_city ?? ''
  const province = settings.province ?? ''
  const region = settings.region ?? ''

  const isDemo = isDemoModeEnabled()

  function handleExitDemo() {
    exitDemoMode()
    logout()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Demo-mode banner — outside the grid so it never overlaps any content */}
      {isDemo && (
        <div className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gradient-to-r from-red-700 via-red-600 to-red-700 px-4 py-2.5 text-center text-xs sm:text-sm font-semibold text-white shadow-md">
          <span>⚠️&nbsp; DEMO MODE — This is sample data stored only in your browser. Do not enter real personal information.</span>
          <button
            type="button"
            onClick={handleExitDemo}
            className="inline-flex items-center gap-1 rounded-full border border-white/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors hover:bg-white/10"
          >
            <LogOut className="size-3" />
            Exit &amp; reset demo
          </button>
        </div>
      )}
      <div className="grid flex-1 grid-cols-[auto_1fr]">
      <header className="sticky top-0 z-50 col-span-full flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="Open sidebar"
        >
          <Menu className="size-5" />
        </button>
        <ClustrMark className="size-8 shrink-0" />
        <span className="font-display text-sm font-semibold">CLUSTR</span>
      </header>

      <Sidebar pinned={pinned} onTogglePin={togglePinned} mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <main className="col-start-2 flex min-w-0 flex-col">
        {/* Desktop sticky header strip */}
        {brgyName && (
          <div className="sticky top-0 z-30 hidden border-b bg-card px-5 py-2 md:flex md:items-center motion-fade-in">
            <img
              src={`${import.meta.env.BASE_URL}standard-logo.png`}
              alt=""
              className="h-10 w-auto object-contain shrink-0"
            />
            <h1 className="flex-1 text-center font-display text-sm font-semibold text-muted-foreground tracking-tight">
              Barangay {brgyName}
              {municipality && (
                <span className="mx-1.5 font-normal text-muted-foreground/60">|</span>
              )}
              <span className="text-sm font-semibold text-muted-foreground">
                {[municipality, province].filter(Boolean).join(', ')}
              </span>
              {region && (
                <>
                  <span className="mx-1.5 font-normal text-muted-foreground/40">·</span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    {region}
                  </span>
                </>
              )}
            </h1>
            <div className="flex items-center justify-end gap-2.5 shrink-0">
              <a
                href="https://github.com/rodneydelacruz/barangayos/blob/main/docs/PRIVACY_NOTICE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 underline decoration-blue-600/30 transition-colors hover:text-blue-800 hover:decoration-blue-800 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:text-blue-300 dark:hover:decoration-blue-300"
              >
                Privacy Notice
              </a>
              <span className="text-xs text-muted-foreground/40">·</span>
              <a
                href="https://github.com/rodneydelacruz/barangayos/blob/main/docs/TERMS_OF_USE.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 underline decoration-blue-600/30 transition-colors hover:text-blue-800 hover:decoration-blue-800 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:text-blue-300 dark:hover:decoration-blue-300"
              >
                Terms of Use
              </a>
              <span className="text-xs text-muted-foreground/40">·</span>
              <a
                href="https://github.com/rodneydelacruz/barangayos/blob/main/docs/DATA_PROCESSING_AGREEMENT.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-blue-600 underline decoration-blue-600/30 transition-colors hover:text-blue-800 hover:decoration-blue-800 dark:text-blue-400 dark:decoration-blue-400/30 dark:hover:text-blue-300 dark:hover:decoration-blue-300"
              >
                DPA
              </a>
            </div>
          </div>
        )}
        <div key={location.pathname} className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8 motion-fade-in motion-slide-up">
          <Suspense
            fallback={
              <div className="flex h-[60vh] items-center justify-center">
                <Spinner size="lg" />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
        <OfflineIndicator />
        <Toaster position="bottom-right" richColors closeButton />
      </main>
    </div>
    {/* closes the outer flex container */}
  </div>
  )
}
