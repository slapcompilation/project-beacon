import { supabase } from '@/lib/supabase/client'
import type { Location, LocationInventoryRow } from '@beacon/types'

export async function fetchLocations(hotelId: string): Promise<Location[]> {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('name')

  if (error) throw new Error(error.message)
  return data as Location[]
}

export async function createLocation(
  hotelId: string,
  input: { name: string; parent_id?: string | null }
): Promise<Location> {
  const result = await supabase
    .from('locations')
    .insert({ hotel_id: hotelId, name: input.name, parent_id: input.parent_id ?? null })
    .select('*')
    .single()
  const { error } = result
  const data = result.data as Location

  if (error) throw new Error(error.message)
  return data
}

export async function updateLocation(
  id: string,
  input: { name?: string; parent_id?: string | null }
): Promise<void> {
  const { error } = await supabase.from('locations').update(input).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteLocation(id: string): Promise<void> {
  const { error } = await supabase.from('locations').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Low-stock by location report ────────────────────────────────────────────

export interface LowStockByLocation {
  variant_id: string
  product_name: string
  variant_name: string
  sku: string
  current_stock: number
  low_stock_threshold: number
  location_id: string | null
  location_name: string | null
  location_path: string | null
}

export async function fetchLowStockByLocation(): Promise<LowStockByLocation[]> {
  const result = await supabase.rpc('get_low_stock_by_location') as { data: LowStockByLocation[] | null; error: { message: string } | null }
  const { data, error } = result
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Full inventory by location (Sprint 25) ───────────────────────────────────

export async function fetchInventoryByLocation(): Promise<LocationInventoryRow[]> {
  const result = await supabase.rpc('get_inventory_by_location') as unknown as { data: LocationInventoryRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function reassignVariantLocation(
  variantId: string,
  locationId: string | null,
): Promise<void> {
  const result = await supabase.rpc('reassign_variant_location', {
    p_variant_id:  variantId,
    p_location_id: locationId,
  }) as unknown as { error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
}
