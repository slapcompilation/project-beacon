// Active access purpose (purpose-based controls). The user declares WHY they're
// working — the purpose narrows what sensitive data they see, via the
// x-beacon-purpose header the Supabase client attaches. Persisted per-browser;
// the header ref is re-synced on rehydrate so the first request after a reload
// already carries it.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setActivePurposeHeader } from '@/lib/supabase/purposeHeader'

interface PurposeState {
  /** null = no purpose declared (role clearance governs alone). */
  activePurpose: string | null
  setPurpose: (purpose: string | null) => void
}

export const usePurposeStore = create<PurposeState>()(
  persist(
    (set) => ({
      activePurpose: null,
      setPurpose: (purpose) => {
        setActivePurposeHeader(purpose)
        set({ activePurpose: purpose })
      },
    }),
    {
      name: 'beacon.purpose',
      onRehydrateStorage: () => (state) => {
        if (state) setActivePurposeHeader(state.activePurpose)
      },
    },
  ),
)
