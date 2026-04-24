// Layer: Floor (ingestion health) · Eye (COGS + variance) · Mind (menu setup)
// F&B + POS Intelligence API — all DB access for the F&B feature set.

import { supabase } from '@/lib/supabase/client'
import type {
  MenuItemWithIngredients,
  POSHealthRow,
  COGSByItemRow,
  POSVarianceRow,
} from '@beacon/types'

// ─── Menu items ───────────────────────────────────────────────────────────────

export async function fetchMenuItems(): Promise<MenuItemWithIngredients[]> {
  const { data, error } = await supabase
    .from('menu_items')
    .select(`
      *,
      menu_item_ingredients (
        *,
        product_variants (
          id, name, sku, cost,
          products ( name )
        )
      )
    `)
    .eq('is_active', true)
    .order('category', { ascending: true })
    .order('name',     { ascending: true })

  if (error) throw new Error(error.message)
  return data as unknown as MenuItemWithIngredients[]
}

export async function createMenuItem(payload: {
  name:        string
  category:    string | null
  sell_price:  number | null
}): Promise<string> {
  const { data, error } = await supabase
    .from('menu_items')
    .insert(payload)
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return (data as { id: string }).id
}

export async function updateMenuItem(
  id: string,
  patch: Partial<{ name: string; category: string | null; sell_price: number | null; is_active: boolean }>,
): Promise<void> {
  const { error } = await supabase.from('menu_items').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteMenuItem(id: string): Promise<void> {
  // Soft-delete: deactivate rather than hard delete to preserve pos_sales history
  const { error } = await supabase.from('menu_items').update({ is_active: false }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Menu item ingredients ────────────────────────────────────────────────────

export async function addIngredient(payload: {
  menu_item_id:  string
  variant_id:    string
  qty_per_serve: number
  unit:          string | null
}): Promise<void> {
  const { error } = await supabase.from('menu_item_ingredients').insert(payload)
  if (error) throw new Error(error.message)
}

export async function updateIngredient(
  id: string,
  patch: Partial<{ qty_per_serve: number; unit: string | null }>,
): Promise<void> {
  const { error } = await supabase.from('menu_item_ingredients').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function removeIngredient(id: string): Promise<void> {
  const { error } = await supabase.from('menu_item_ingredients').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── POS health ───────────────────────────────────────────────────────────────

export async function fetchPOSHealth(): Promise<POSHealthRow[]> {
  const result = await supabase.rpc('get_pos_health') as unknown as {
    data: POSHealthRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── COGS ────────────────────────────────────────────────────────────────────

export async function fetchCOGSByItem(days = 30): Promise<COGSByItemRow[]> {
  const result = await supabase.rpc('get_cogs_by_item', { p_days: days }) as unknown as {
    data: COGSByItemRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Variance ────────────────────────────────────────────────────────────────

export async function fetchPOSVariance(days = 30, thresholdPct = 15): Promise<POSVarianceRow[]> {
  const result = await supabase.rpc('get_pos_variance', {
    p_days:          days,
    p_threshold_pct: thresholdPct,
  }) as unknown as {
    data: POSVarianceRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}
