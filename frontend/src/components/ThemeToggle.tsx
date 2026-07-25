import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/lib/theme'

export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-90"
      aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
      title={theme === 'light' ? 'Dark mode' : 'Light mode'}
    >
      {theme === 'light' ? (
        <Moon key="moon" className="size-3.5 theme-icon-enter" />
      ) : (
        <Sun key="sun" className="size-3.5 theme-icon-enter" />
      )}
    </button>
  )
}
