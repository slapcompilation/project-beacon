import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface AppState {
  theme: Theme
  /** null = use hotel from auth session; set by hotel switcher for owners */
  activeHotelId: string | null
  /** Whether the notifications slide-over panel is open */
  notifPanelOpen: boolean
  // Actions
  setTheme: (theme: Theme) => void
  setActiveHotelId: (id: string | null) => void
  setNotifPanelOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      activeHotelId: null,
      notifPanelOpen: false,
      setTheme: (theme) => set({ theme }),
      setActiveHotelId: (activeHotelId) => set({ activeHotelId }),
      setNotifPanelOpen: (notifPanelOpen) => set({ notifPanelOpen }),
    }),
    {
      name: 'beacon-app',
      // notifPanelOpen is ephemeral — never persisted
      partialize: (state) => ({
        theme: state.theme,
        activeHotelId: state.activeHotelId,
      }),
    }
  )
)
