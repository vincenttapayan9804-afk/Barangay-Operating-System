import { Languages } from 'lucide-react'
import { useTranslation, LANGUAGES, type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  /** 'compact' cycles through languages with one click (sidebar footer).
   *  'full' shows all three as a segmented control (Settings, login page). */
  variant?: 'compact' | 'full'
  className?: string
}

export function LanguageSwitcher({ variant = 'full', className }: LanguageSwitcherProps) {
  const { language, setLanguage } = useTranslation()

  if (variant === 'compact') {
    function cycle() {
      const idx = LANGUAGES.findIndex((l) => l.code === language)
      const next = LANGUAGES[(idx + 1) % LANGUAGES.length]
      setLanguage(next.code)
    }

    return (
      <button
        type="button"
        onClick={cycle}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-full border border-border bg-background text-[10px] font-semibold uppercase text-muted-foreground shadow-sm transition-all duration-200 hover:bg-accent hover:text-foreground active:scale-90',
          className,
        )}
        aria-label={`Language: ${language}. Tap to change.`}
        title={LANGUAGES.find((l) => l.code === language)?.label}
      >
        {language}
      </button>
    )
  }

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-full border border-border bg-background p-1', className)}>
      <Languages className="ml-1.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      {LANGUAGES.map((l: { code: Language; label: string }) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLanguage(l.code)}
          className={cn(
            'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
            language === l.code
              ? 'bg-mint-deep text-white'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          aria-pressed={language === l.code}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
