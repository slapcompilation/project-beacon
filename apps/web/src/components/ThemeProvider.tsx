import { useEffect } from 'react'
import { useAppStore } from '@/stores/app.store'

/**
 * Reads the theme from the persisted app store and applies it to <html>.
 * When theme is 'system', follows the OS preference and updates on change.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const apply = (dark: boolean) =>
      document.documentElement.classList.toggle('dark', dark)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => { mq.removeEventListener('change', handler); }
    }

    apply(theme === 'dark')
  }, [theme])

  return <>{children}</>
}
