// Favorites (stars) — Foundry's cross-cutting star system. Starred objects (and
// apps) appear in the sidebar's Files section + its collapsed popover. Persisted
// per-browser (there is no server favorites table yet); keyed by a stable id.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { IconName } from '@blueprintjs/icons'

export interface FavoriteItem {
  /** Stable unique id, e.g. `variant:<uuid>`. */
  id: string
  label: string
  /** Route to open on click. */
  path: string
  icon: IconName
  /** Optional secondary line (e.g. product name). */
  subtitle?: string
}

interface FavoritesState {
  favorites: FavoriteItem[]
  isFavorite: (id: string) => boolean
  toggle: (item: FavoriteItem) => void
  remove: (id: string) => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      isFavorite: (id) => get().favorites.some((f) => f.id === id),
      toggle: (item) =>
        set((s) =>
          s.favorites.some((f) => f.id === item.id)
            ? { favorites: s.favorites.filter((f) => f.id !== item.id) }
            : { favorites: [item, ...s.favorites] },
        ),
      remove: (id) => set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) })),
    }),
    { name: 'beacon-favorites' },
  ),
)
