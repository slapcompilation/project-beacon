// Phase F2 — single-hotel zone map. Aggregates per-location variant counts +
// at-risk counts so the operator can see stock pressure across zones at a
// glance from Canvas. Future F3 (observations layer) will overlay proposals
// and alerts on top of these tiles.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

export interface HotelMapZone {
  id:          string
  name:        string
  parent_id:   string | null
  variants:    number
  at_risk:     number
  /** at_risk / variants — 0..1. Empty zones get null. */
  pressure:    number | null
}

interface LocationQueryRow {
  id:        string
  name:      string
  parent_id: string | null
  product_variants: { id: string; current_stock: number; low_stock_threshold: number | null; enabled: boolean }[] | null
}

async function fetchHotelMap(hotelId: string): Promise<HotelMapZone[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, parent_id, product_variants(id, current_stock, low_stock_threshold, enabled)')
    .eq('hotel_id', hotelId)
    .order('name') as unknown as { data: LocationQueryRow[] | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return (data ?? []).map((loc) => {
    const enabled = (loc.product_variants ?? []).filter((v) => v.enabled)
    const atRisk = enabled.filter((v) =>
      (v.low_stock_threshold ?? 0) > 0 && v.current_stock <= (v.low_stock_threshold ?? 0),
    )
    const pressure = enabled.length > 0 ? atRisk.length / enabled.length : null
    return {
      id:        loc.id,
      name:      loc.name,
      parent_id: loc.parent_id,
      variants:  enabled.length,
      at_risk:   atRisk.length,
      pressure,
    }
  })
}

export function useHotelMap() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['canvas', 'hotel-map', hotelId ?? ''] as const,
    queryFn:   () => fetchHotelMap(hotelId ?? ''),
    enabled:   !!hotelId,
    staleTime: 60_000,
  })
}
