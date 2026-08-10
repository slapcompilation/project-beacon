// Session and UI state for the shell. Nothing here is server data — that lives
// in TanStack Query.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

const RECENT_LIMIT = 8

interface AppState {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** The platform sidebar collapsed to its icon rail (Ctrl+O). */
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  /** Paths visited, newest first. Titles are resolved at render, so a renamed
   *  surface never shows up here under its old name. */
  recents: string[]
  pushRecent: (path: string) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => { set({ theme }) },
      sidebarCollapsed: false,
      toggleSidebar: () => { set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })) },
      recents: [],
      pushRecent: (path) => {
        set((s) => ({ recents: [path, ...s.recents.filter((p) => p !== path)].slice(0, RECENT_LIMIT) }))
      },
    }),
    { name: 'beacon-app' },
  ),
)
