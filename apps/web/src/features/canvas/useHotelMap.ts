// Phase F2/F3 — single-hotel zone map. Aggregates per-location variant
// counts + at-risk + observation counts (pending proposals + unread
// notifications) so the operator can see stock pressure + AIP activity
// across zones at a glance from Canvas.

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
  /** Pending Proposal rows targeting variants in this zone. */
  proposals:   number
  /** Unread notifications targeting variants in this zone. */
  alerts:      number
}

interface LocationQueryRow {
  id:        string
  name:      string
  parent_id: string | null
  product_variants: { id: string; current_stock: number; low_stock_threshold: number | null; enabled: boolean }[] | null
}

async function fetchHotelMap(hotelId: string): Promise<HotelMapZone[]> {
  // 1) Zones + their variants (one round-trip via PostgREST embed).
  const { data: locRows, error: locErr } = await supabase
    .from('locations')
    .select('id, name, parent_id, product_variants(id, current_stock, low_stock_threshold, enabled)')
    .eq('hotel_id', hotelId)
    .order('name') as unknown as { data: LocationQueryRow[] | null; error: { message: string } | null }
  if (locErr) throw new Error(locErr.message)
  const locs = locRows ?? []

  // Build variant→zone map for the observation-count rollups.
  const variantToZone = new Map<string, string>()
  for (const l of locs) {
    for (const v of l.product_variants ?? []) variantToZone.set(v.id, l.id)
  }
  const variantIds = Array.from(variantToZone.keys())

  // 2) Pending proposals targeting any of those variants. F3 observation layer.
  const proposalsByZone = new Map<string, number>()
  if (variantIds.length > 0) {
    const { data: props } = await supabase
      .from('proposals')
      .select('action_payload')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .in('action_payload->>variantId', variantIds)
    for (const row of (props ?? []) as { action_payload: Record<string, unknown> }[]) {
      const vid = row.action_payload.variantId as string | undefined
      const zid = vid ? variantToZone.get(vid) : undefined
      if (zid) proposalsByZone.set(zid, (proposalsByZone.get(zid) ?? 0) + 1)
    }
  }

  // 3) Unread notifications for any of those variants.
  const alertsByZone = new Map<string, number>()
  if (variantIds.length > 0) {
    const { data: notifs } = await supabase
      .from('notifications')
      .select('variant_id')
      .eq('hotel_id', hotelId)
      .eq('read', false)
      .in('variant_id', variantIds)
    for (const row of (notifs ?? []) as { variant_id: string | null }[]) {
      const zid = row.variant_id ? variantToZone.get(row.variant_id) : undefined
      if (zid) alertsByZone.set(zid, (alertsByZone.get(zid) ?? 0) + 1)
    }
  }

  return locs.map((loc) => {
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
      proposals: proposalsByZone.get(loc.id) ?? 0,
      alerts:    alertsByZone.get(loc.id)    ?? 0,
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

// Hotel-wide stock rollup — the fallback the map shows when no variants are
// tagged to a zone yet (so it's a real breakdown, never a bare "0 variants").
export interface HotelStockSummary { tracked: number; lowStock: number; outOfStock: number }

async function fetchHotelStockSummary(hotelId: string): Promise<HotelStockSummary> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('current_stock, low_stock_threshold, products!inner(hotel_id)')
    .eq('products.hotel_id', hotelId)
    .eq('enabled', true) as unknown as {
      data: { current_stock: number; low_stock_threshold: number | null }[] | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  const rows = data ?? []
  const lowStock = rows.filter((r) => (r.low_stock_threshold ?? 0) > 0 && r.current_stock <= (r.low_stock_threshold ?? 0)).length
  const outOfStock = rows.filter((r) => r.current_stock <= 0).length
  return { tracked: rows.length, lowStock, outOfStock }
}

export function useHotelStockSummary() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['canvas', 'hotel-stock-summary', hotelId ?? ''] as const,
    queryFn:   () => fetchHotelStockSummary(hotelId ?? ''),
    enabled:   !!hotelId,
    staleTime: 60_000,
  })
}
