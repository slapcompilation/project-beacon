// The per-item signal spine: one batched
// round-trip that tells every list row whether the agent has a take on its
// variant — open proposals, a paused action awaiting sign-off, an open Case.
// Backed by the aip_signals_for_variants RPC (migration 199); rows without a
// signal are simply absent from the map, so `useVariantSignals(ids).get(id)`
// is undefined when there's nothing to show.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

export interface VariantSignal {
  openProposals:    number
  pendingApprovals: number
  openCaseId:       string | null
  /** True when anything on this variant wants the operator's eye. */
  hasSignal:        boolean
}

interface RpcRow {
  variant_id:        string
  open_proposals:    number
  pending_approvals: number
  open_case_id:      string | null
}

export type VariantSignalMap = Map<string, VariantSignal>

/** Stable-ish key: the sorted id set, so re-renders with the same rows don't
 *  refetch. Callers pass the ids visible on the current list. */
export function useVariantSignals(variantIds: string[]): VariantSignalMap {
  const hotelId = useActiveHotelId()
  const ids = [...new Set(variantIds.filter(Boolean))].sort()

  const { data } = useQuery({
    queryKey: ['aip-variant-signals', hotelId ?? '', ids.join(',')],
    queryFn: async (): Promise<VariantSignalMap> => {
      if (!hotelId || ids.length === 0) return new Map()
      const { data: rows, error } = await supabase.rpc('aip_signals_for_variants', {
        p_hotel_id: hotelId,
        p_variant_ids: ids,
      }) as unknown as { data: RpcRow[] | null; error: { message: string } | null }
      if (error) throw new Error(error.message)
      const map: VariantSignalMap = new Map()
      for (const r of rows ?? []) {
        map.set(r.variant_id, {
          openProposals:    r.open_proposals,
          pendingApprovals: r.pending_approvals,
          openCaseId:       r.open_case_id,
          hasSignal:        r.open_proposals > 0 || r.pending_approvals > 0 || r.open_case_id != null,
        })
      }
      return map
    },
    enabled:         !!hotelId && ids.length > 0,
    staleTime:       30_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  })

  return data ?? new Map<string, VariantSignal>()
}
