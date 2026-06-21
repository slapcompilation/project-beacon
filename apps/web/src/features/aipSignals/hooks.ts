// One round-trip for the topbar AIP counter strip. Replaces three separate
// hot queries (pending proposals + pending approvals + entity-link
// suggestions) with a single aip_signal_counts() RPC, server-aggregated
// under the caller's RLS.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

export interface AipSignalCounts {
  queue:        number
  approvals:    number
  entityLinks:  number
  casesOpen:    number
}

interface RpcRow {
  queue_pending:        number
  approvals_pending:    number
  entity_links_pending: number
  cases_open:           number
}

const EMPTY: AipSignalCounts = { queue: 0, approvals: 0, entityLinks: 0, casesOpen: 0 }

export function useAipSignalCounts() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['aip-signal-counts', hotelId ?? ''],
    queryFn:  async (): Promise<AipSignalCounts> => {
      if (!hotelId) return EMPTY
      const { data, error } = await supabase.rpc('aip_signal_counts', { p_hotel_id: hotelId }) as unknown as {
        data: RpcRow[] | null; error: { message: string } | null
      }
      if (error) throw new Error(error.message)
      const row = data && data.length > 0 ? data[0] : null
      if (!row) return EMPTY
      return {
        queue:       row.queue_pending,
        approvals:   row.approvals_pending,
        entityLinks: row.entity_links_pending,
        casesOpen:   row.cases_open,
      }
    },
    enabled:         !!hotelId,
    staleTime:       30_000,
    refetchInterval: 30_000,
  })
}
