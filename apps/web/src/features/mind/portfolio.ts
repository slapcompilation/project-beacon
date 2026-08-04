// Portfolio Command data layer. The single round-trip per-hotel rollup the
// org-director / owner sees in Mind → Portfolio. Backed by
// get_portfolio_signals() (migration 150) — admin/owner gated server-side.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'

export interface PortfolioHotelSignal {
  hotel_id:             string
  hotel_name:           string
  queue_pending:        number
  approvals_pending:    number
  entity_links_pending: number
  cases_open:           number
  last_cycle_at:        string | null
  last_cycle_auto:      number
  last_cycle_queued:    number
  /** Split from the hotel's geopoint `location`; null when it has none. */
  lat:                  number | null
  lng:                  number | null
}

async function fetchPortfolioSignals(): Promise<PortfolioHotelSignal[]> {
  const result = await supabase.rpc('get_portfolio_signals') as unknown as {
    data:  PortfolioHotelSignal[] | null
    error: { message: string; code?: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export function usePortfolioSignals() {
  const role = useAuthStore((s) => s.role)
  const enabled = role === 'admin' || role === 'owner'
  return useQuery({
    queryKey: ['mind', 'portfolio-signals'] as const,
    queryFn:  fetchPortfolioSignals,
    enabled,
    staleTime:       60_000,
    refetchInterval: 60_000,
  })
}
