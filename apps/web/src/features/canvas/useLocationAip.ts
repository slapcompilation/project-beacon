// Phase F5 — fetch the AIP-shaped slice for one zone: variants in it,
// pending proposals targeting those variants, and unread notifications.
// Powers the DetailTab when contextEntity.type === 'location'.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'

export interface ZoneVariant {
  id:                   string
  name:                 string
  current_stock:        number
  low_stock_threshold:  number | null
  at_risk:              boolean
  product_name:         string | null
}

export interface ZoneProposal {
  id:           string
  variant_id:   string
  variant_name: string | null
  agent_name:   string
  action_type:  string
  confidence:   number
  reasoning:    string
  created_at:   string
}

export interface ZoneAlert {
  id:           string
  variant_id:   string | null
  type:         string
  created_at:   string
}

export interface LocationAip {
  variants:  ZoneVariant[]
  proposals: ZoneProposal[]
  alerts:    ZoneAlert[]
}

async function fetchLocationAip(hotelId: string, locationId: string): Promise<LocationAip> {
  // Variants in this zone (with product name).
  const { data: vRows } = await supabase
    .from('product_variants')
    .select('id, name, current_stock, low_stock_threshold, enabled, products!inner(name)')
    .eq('location_id', locationId)
    .eq('enabled', true)
    .order('name')

  type VRow = { id: string; name: string; current_stock: number; low_stock_threshold: number | null; products: { name: string } | { name: string }[] | null }
  const variants: ZoneVariant[] = ((vRows ?? []) as VRow[]).map((v) => {
    const p = Array.isArray(v.products) ? v.products[0] : v.products
    return {
      id:                  v.id,
      name:                v.name,
      current_stock:       v.current_stock,
      low_stock_threshold: v.low_stock_threshold,
      at_risk:             (v.low_stock_threshold ?? 0) > 0 && v.current_stock <= (v.low_stock_threshold ?? 0),
      product_name:        p?.name ?? null,
    }
  })

  const variantIds = variants.map((v) => v.id)
  const variantById = new Map(variants.map((v) => [v.id, v]))

  // Pending proposals targeting those variants.
  let proposals: ZoneProposal[] = []
  if (variantIds.length > 0) {
    const { data: pRows } = await supabase
      .from('proposals')
      .select('id, agent_name, action_type, action_payload, confidence, reasoning, created_at')
      .eq('hotel_id', hotelId)
      .eq('status', 'pending')
      .in('action_payload->>variantId', variantIds)
      .order('created_at', { ascending: false })
      .limit(20)
    type PRow = { id: string; agent_name: string; action_type: string; action_payload: Record<string, unknown>; confidence: number; reasoning: string; created_at: string }
    proposals = ((pRows ?? []) as PRow[]).map((p) => {
      const vid = (p.action_payload.variantId as string | undefined) ?? ''
      return {
        id:           p.id,
        variant_id:   vid,
        variant_name: variantById.get(vid)?.name ?? null,
        agent_name:   p.agent_name,
        action_type:  p.action_type,
        confidence:   p.confidence,
        reasoning:    p.reasoning,
        created_at:   p.created_at,
      }
    })
  }

  // Unread notifications for those variants.
  let alerts: ZoneAlert[] = []
  if (variantIds.length > 0) {
    const { data: nRows } = await supabase
      .from('notifications')
      .select('id, variant_id, type, created_at')
      .eq('hotel_id', hotelId)
      .eq('read', false)
      .in('variant_id', variantIds)
      .order('created_at', { ascending: false })
      .limit(20)
    type NRow = { id: string; variant_id: string | null; type: string; created_at: string }
    alerts = ((nRows ?? []) as NRow[]).map((n) => ({
      id: n.id, variant_id: n.variant_id, type: n.type, created_at: n.created_at,
    }))
  }

  return { variants, proposals, alerts }
}

export function useLocationAip(locationId: string | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['canvas', 'location-aip', hotelId ?? '', locationId ?? ''] as const,
    queryFn:   () => fetchLocationAip(hotelId ?? '', locationId ?? ''),
    enabled:   !!hotelId && !!locationId,
    staleTime: 30_000,
  })
}
