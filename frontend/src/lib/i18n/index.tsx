import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { translations, type Language, type TranslationKey } from './translations'

export type { Language, TranslationKey } from './translations'
export { LANGUAGES } from './translations'

const STORAGE_KEY = 'clustr-language'

function getInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en' || stored === 'tl' || stored === 'ceb' ? stored : 'en'
}

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage)

  const setLanguage = useCallback((lang: Language) => {
    localStorage.setItem(STORAGE_KEY, lang)
    setLanguageState(lang)
  }, [])

  const t = useCallback(
    (key: TranslationKey) => translations[language][key] ?? translations.en[key] ?? key,
    [language],
  )

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useTranslation must be used within a LanguageProvider')
  return ctx
}
