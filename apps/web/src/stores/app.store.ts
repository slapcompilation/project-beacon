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
  | 'location'

export type ContextPanelTab = 'detail' | 'copilot' | 'graph'

/**
 * Scope mode (Phase R1, Network tier).
 * 'hotel'        — operator views ONE property at a time. activeHotelId selects which.
 * 'organization' — operator views the WHOLE PORTFOLIO. activeOrgId selects which.
 *                  Hotel-scoped queries return all hotels in that org via
 *                  hotel_is_in_user_scope() RLS extension.
 */
export type ScopeMode = 'hotel' | 'organization'

interface AppState {
  theme: Theme
  /** null = use hotel from auth session; set by hotel switcher for owners */
  activeHotelId: string | null
  /** Currently selected organization (when scopeMode='organization' or as fallback). */
  activeOrgId: string | null
  /** Whether the operator is viewing one property or the full portfolio. */
  scopeMode: ScopeMode
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
  setActiveOrgId: (id: string | null) => void
  setScopeMode: (mode: ScopeMode) => void
  /** Switch to portfolio view: scopeMode='organization', preserves activeOrgId. */
  enterOrgScope: (orgId: string) => void
  /** Switch back to a single property: scopeMode='hotel', sets activeHotelId. */
  enterHotelScope: (hotelId: string) => void
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
      activeOrgId: null,
      scopeMode: 'hotel' as ScopeMode,
      notifPanelOpen: false,
      contextPanelOpen: false,
      contextPanelTab: 'detail' as ContextPanelTab,
      contextEntity: null,
      setTheme: (theme) => set({ theme }),
      setActiveHotelId: (activeHotelId) => set({ activeHotelId }),
      setActiveOrgId: (activeOrgId) => set({ activeOrgId }),
      setScopeMode: (scopeMode) => set({ scopeMode }),
      enterOrgScope: (orgId) => set({ scopeMode: 'organization', activeOrgId: orgId }),
      enterHotelScope: (hotelId) => set({ scopeMode: 'hotel', activeHotelId: hotelId }),
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
        activeOrgId: state.activeOrgId,
        scopeMode: state.scopeMode,
      }),
    }
  )
)
