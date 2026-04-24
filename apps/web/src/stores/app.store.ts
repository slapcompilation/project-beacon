import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

/** Entity types that can be inspected in the sliding ObjectPanel */
export type ObjectPanelEntity =
  | 'variant'
  | 'product'
  | 'supplier'
  | 'restock_request'
  | 'stock_log'
  | 'alert'
  | 'purchase_order'
  | 'shift_handover'

export type ContextPanelTab = 'detail' | 'copilot' | 'graph'

interface AppState {
  theme: Theme
  /** null = use hotel from auth session; set by hotel switcher for owners */
  activeHotelId: string | null
  /** Whether the notifications slide-over panel is open */
  notifPanelOpen: boolean

  // ─── Context Panel (three-zone layout) ──────────────────────────────────────
  /** Whether the right context panel is visible */
  contextPanelOpen: boolean
  /** Active tab in the context panel */
  contextPanelTab: ContextPanelTab
  /** Entity currently shown in the Detail tab — null = no entity selected */
  contextEntity: { type: ObjectPanelEntity; id: string } | null

  // Actions
  setTheme: (theme: Theme) => void
  setActiveHotelId: (id: string | null) => void
  setNotifPanelOpen: (open: boolean) => void
  // Context Panel actions
  setContextPanelOpen: (open: boolean) => void
  setContextPanelTab: (tab: ContextPanelTab) => void
  /** Opens context panel with Detail tab showing the given entity */
  openEntityContext: (entityType: ObjectPanelEntity, entityId: string) => void
  /** Toggles context panel with Copilot tab */
  toggleCopilot: () => void

  // ─── Command Bar ────────────────────────────────────────────────────────────
  /** Whether the command bar dialog is open */
  commandBarOpen: boolean
  setCommandBarOpen: (open: boolean) => void
  toggleCommandBar: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      activeHotelId: null,
      notifPanelOpen: false,
      contextPanelOpen: false,
      contextPanelTab: 'detail' as ContextPanelTab,
      contextEntity: null,
      setTheme: (theme) => set({ theme }),
      setActiveHotelId: (activeHotelId) => set({ activeHotelId }),
      setNotifPanelOpen: (notifPanelOpen) => set({ notifPanelOpen }),
      setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),
      setContextPanelTab: (contextPanelTab) => set({ contextPanelTab }),
      openEntityContext: (entityType, entityId) =>
        set({
          contextPanelOpen: true,
          contextPanelTab: 'detail',
          contextEntity: { type: entityType, id: entityId },
          notifPanelOpen: false,
        }),
      commandBarOpen: false,
      setCommandBarOpen: (commandBarOpen) => set({ commandBarOpen }),
      toggleCommandBar: () => set((s) => ({ commandBarOpen: !s.commandBarOpen })),
      toggleCopilot: () => {
        const s = get()
        if (s.contextPanelOpen && s.contextPanelTab === 'copilot') {
          set({ contextPanelOpen: false })
        } else {
          set({ contextPanelOpen: true, contextPanelTab: 'copilot', notifPanelOpen: false })
        }
      },
    }),
    {
      name: 'beacon-app',
      // Ephemeral state is never persisted
      partialize: (state) => ({
        theme: state.theme,
        activeHotelId: state.activeHotelId,
      }),
    }
  )
)
