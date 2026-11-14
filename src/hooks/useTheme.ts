import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

export type ThemeChoice = 'system' | 'light' | 'dark'
const KEY = 'dpdc-bill-check:theme'
const ORDER: ThemeChoice[] = ['system', 'light', 'dark']
const QUERY = '(prefers-color-scheme: dark)'

function initial(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* ignore */
  }
  return 'system'
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeChoice>(initial)
  const systemDark = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
  const resolved: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme, resolved])

  const cycle = useCallback(() => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]), [])
  return { theme, resolved, cycle }
}
