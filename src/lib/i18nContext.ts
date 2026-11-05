import { createContext } from 'react'
import type { Lang, MessageKey } from './i18n'

// Kept in its own module so hot-reloading the translations doesn't create a new
// context (which would disconnect the running app from its provider).
export interface I18n {
  lang: Lang
  setLang: (lang: Lang) => void
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
  locale: string
  monthName: (month: number) => string
  formatNumber: (n: number) => string
  formatPeriod: (year: number, month: number) => string
  relativeTime: (timestamp: number) => string
}

export const I18nContext = createContext<I18n | null>(null)
