import { useEffect } from 'react'
import { useAppStore } from '@/stores/app.store'

/**
 * Reads the theme from the persisted app store and applies it to <html>.
 * When theme is 'system', follows the OS preference and updates on change.
 *
 * Also syncs Blueprint's `bp5-dark` class onto <body> whenever Tailwind's
 * `dark` class is on <html>. Blueprint's components branch on `bp5-dark`
 * for their dark-mode treatment; without this, Blueprint widgets render
 * with their light-mode palette inside our dark theme.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    const apply = (dark: boolean) => {
      document.documentElement.classList.toggle('dark', dark)
      document.body.classList.toggle('bp5-dark', dark)
    }

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
