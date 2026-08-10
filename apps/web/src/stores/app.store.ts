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
  /** Starred applications, by path — the sidebar's section ③. Files favourites
   *  (④) have no star surface yet, so there is no second list. */
  favoriteApps: string[]
  toggleFavoriteApp: (path: string) => void
  /** Which ontology Ontology Manager is pointed at. The id only — the row is
   *  server state and gets resolved from it. */
  omaOntologyId: string | null
  setOmaOntology: (id: string) => void
  /** Object types whose detail was opened, newest first — Discover's
   *  "Recently viewed object types". Same pattern as `recents`, its own list
   *  because it is the application's history, not the platform's. */
  omaRecentTypes: string[]
  pushOmaRecentType: (id: string) => void
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
      favoriteApps: [],
      toggleFavoriteApp: (path) => {
        set((s) => ({
          favoriteApps: s.favoriteApps.includes(path)
            ? s.favoriteApps.filter((p) => p !== path)
            : [...s.favoriteApps, path],
        }))
      },
      omaOntologyId: null,
      setOmaOntology: (id) => { set({ omaOntologyId: id }) },
      omaRecentTypes: [],
      pushOmaRecentType: (id) => {
        set((s) => ({ omaRecentTypes: [id, ...s.omaRecentTypes.filter((x) => x !== id)].slice(0, RECENT_LIMIT) }))
      },
    }),
    { name: 'beacon-app' },
  ),
)
