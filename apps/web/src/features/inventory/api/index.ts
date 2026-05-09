import { supabase } from '@/lib/supabase/client'
import type { ProductVariant, ProductWithVariants, StockLog, StockoutProbabilityRow, VariantCostHistory, ExpiryBatchRow, FefoBatchRow } from '@beacon/types'

// ─── Expiry ───────────────────────────────────────────────────────────────────

export interface ExpiringVariant extends ProductVariant {
  products: { name: string; enabled: boolean } | null
}

export async function fetchExpiringVariants(hotelId: string, daysAhead = 30): Promise<ExpiringVariant[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + daysAhead)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data, error } = (await supabase
    .from('product_variants')
    .select('*, products!inner(name, enabled, hotel_id)')
    .eq('products.hotel_id', hotelId)
    .not('expiry_date', 'is', null)
    .lte('expiry_date', cutoffStr)
    .order('expiry_date')) as unknown as { data: ExpiringVariant[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  // Exclude variants belonging to disabled (soft-deleted) products
  return (data ?? []).filter((v) => v.products?.enabled !== false)
}

// ─── Batch expiry tracking ────────────────────────────────────────────────────

export async function fetchExpiryBatches(daysAhead = 90): Promise<ExpiryBatchRow[]> {
  const result = await supabase.rpc('get_expiring_batches', { p_days_ahead: daysAhead }) as unknown as {
    data: ExpiryBatchRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

export async function discardBatch(
  batchId: string,
  reason = 'Expired — written off',
): Promise<{ logId: string; newBalance: number }> {
  const result = await supabase.rpc('discard_batch', {
    p_batch_id: batchId,
    p_reason: reason,
  }) as unknown as {
    data: { log_id: string; new_balance: number }[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  const row = (result.data ?? [])[0]
  return { logId: row.log_id, newBalance: row.new_balance }
}

// ─── Products ─────────────────────────────────────────────────────────────────

export async function fetchProducts(hotelId: string): Promise<ProductWithVariants[]> {
  const { data, error } = (await supabase
    .from('products')
    .select('*, product_variants(*), categories(id, name, require_photo_for_removal_over)')
    .eq('hotel_id', hotelId)
    .eq('enabled', true)
    .order('name')) as unknown as { data: ProductWithVariants[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  // Filter out soft-deleted variants client-side (PostgREST nested filter is limited)
  return (data ?? []).map((p) => ({
    ...p,
    product_variants: p.product_variants.filter((v) => v.enabled),
  }))
}

export interface CreateProductInput {
  name: string
  sku: string
  description?: string
  cost: number
  category_id?: string | null
  image_url?: string | null
  tags?: string[]
  /** Initial stock to set on the default "Standard" variant. Creates an audit log entry. */
  initial_stock?: number
}

/**
 * Upload a product image to the `product-images` bucket and return the public URL.
 *
 * Throws on failure — callers can surface the error message via toast. Previously
 * this swallowed all errors and returned null, which silently dropped images
 * when storage RLS blocked the upsert (see migration 125 / Bug A2).
 */
export async function uploadProductImage(file: File): Promise<string> {
  const id   = crypto.randomUUID()
  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${id}.${ext}`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true })

  if (error) {
    throw new Error(`Image upload failed: ${error.message}`)
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  if (!data.publicUrl) {
    throw new Error('Image upload succeeded but public URL was empty')
  }
  return data.publicUrl
}

export async function createProduct(
  hotelId: string,
  input: CreateProductInput
): Promise<ProductWithVariants> {
  const { data, error } = (await supabase
    .from('products')
    .insert({
      hotel_id: hotelId,
      name: input.name,
      sku: input.sku,
      description: input.description ?? null,
      cost: input.cost,
      category_id: input.category_id ?? null,
      image_url: input.image_url ?? null,
      tags: input.tags ?? [],
    })
    .select('*, product_variants(*), categories(id, name, require_photo_for_removal_over)')
    .single()) as unknown as { data: ProductWithVariants | null; error: { code: string; message: string } | null }

  if (error) {
    if (error.code === '23505') throw new Error('A product with this SKU already exists.')
    throw new Error(error.message)
  }

  // Create a default "Standard" variant automatically
  const { data: variantData, error: variantError } = (await supabase
    .from('product_variants')
    .insert({
      product_id: (data as ProductWithVariants).id,
      name: 'Standard',
      sku: input.sku,
      current_stock: 0,
      cost: input.cost,
    })
    .select('id')
    .single()) as unknown as { data: { id: string } | null; error: { message: string } | null }

  if (variantError) throw new Error(variantError.message)

  // If initial stock was specified, create an audit-trail entry via the RPC
  if (input.initial_stock && input.initial_stock > 0 && variantData?.id) {
    await supabase.rpc('adjust_stock', {
      p_variant_id: variantData.id,
      p_delta: input.initial_stock,
      p_reason: 'Initial stock',
      p_photo_url: null,
      p_removal_category: null,
    })
  }

  // Re-fetch with variants included
  const { data: full, error: fetchError } = (await supabase
    .from('products')
    .select('*, product_variants(*), categories(id, name, require_photo_for_removal_over)')
    .eq('id', (data as ProductWithVariants).id)
    .single()) as unknown as { data: ProductWithVariants | null; error: { message: string } | null }

  if (fetchError) throw new Error(fetchError.message)
  return full as ProductWithVariants
}

export async function updateProduct(
  id: string,
  input: Partial<CreateProductInput>
): Promise<void> {
  const { error } = await supabase.from('products').update(input).eq('id', id)
  if (error) {
    if (error.code === '23505') throw new Error('A product with this SKU already exists.')
    throw new Error(error.message)
  }
}

export async function deleteProduct(id: string): Promise<void> {
  // Soft delete — set enabled = false to preserve stock log history
  const { error } = await supabase.from('products').update({ enabled: false }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Stock logs ───────────────────────────────────────────────────────────────

export async function fetchStockLogs(variantId: string): Promise<StockLog[]> {
  const { data, error } = (await supabase
    .from('stock_logs')
    .select('*')
    .eq('variant_id', variantId)
    .order('timestamp', { ascending: false })
    .limit(100)) as unknown as { data: StockLog[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Stock adjustment (via atomic RPC) ────────────────────────────────────────

export async function adjustStock(
  variantId: string,
  delta: number,
  reason: string,
  photoFile?: File | null,
  removalCategory?: string | null
): Promise<{ logId: string; newBalance: number }> {
  // Upload photo first (before RPC, since stock_logs are immutable after insert)
  let photoUrl: string | null = null
  if (photoFile) {
    try {
      const id = crypto.randomUUID()
      const ext = photoFile.name.split('.').pop() ?? 'jpg'
      const { error: uploadError } = await supabase.storage
        .from('stock-photos')
        .upload(`${id}.${ext}`, photoFile, { upsert: true })
      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('stock-photos')
          .getPublicUrl(`${id}.${ext}`)
        photoUrl = urlData.publicUrl
      }
    } catch {
      // Photo upload failure does not fail the stock adjustment
    }
  }

  const { data, error } = (await supabase.rpc('adjust_stock', {
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: reason,
    p_photo_url: photoUrl,
    p_removal_category: removalCategory ?? null,
  })) as unknown as { data: Array<{ log_id: string; new_balance: number }> | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  const row = (data as Array<{ log_id: string; new_balance: number }>)[0]
  return { logId: row.log_id, newBalance: row.new_balance }
}

export async function undoStockAdjustment(
  logId: string
): Promise<{ newLogId: string; newBalance: number }> {
  const { data, error } = (await supabase.rpc('undo_stock_adjustment', {
    p_log_id: logId,
  })) as unknown as { data: Array<{ new_log_id: string; new_balance: number }> | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  const row = (data as Array<{ new_log_id: string; new_balance: number }>)[0]
  return { newLogId: row.new_log_id, newBalance: row.new_balance }
}

// ─── Variant CRUD ──────────────────────────────────────────────────────────────

// ─── Date Reminders ───────────────────────────────────────────────────────────

export interface ReminderVariant extends ProductVariant {
  products: { name: string; enabled: boolean } | null
}

export async function fetchUpcomingReminders(
  hotelId: string,
  daysAhead = 30,
): Promise<ReminderVariant[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() + daysAhead)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const { data, error } = (await supabase
    .from('product_variants')
    .select('*, products!inner(name, enabled, hotel_id)')
    .eq('products.hotel_id', hotelId)
    .not('reminder_date', 'is', null)
    .lte('reminder_date', cutoffStr)
    .order('reminder_date')) as unknown as { data: ReminderVariant[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return (data ?? []).filter((v) => v.products?.enabled !== false)
}

// ─── Variant CRUD ──────────────────────────────────────────────────────────────

export interface VariantInput {
  name: string
  sku: string
  barcode?: string | null
  cost: number
  low_stock_threshold: number
  location_id?: string | null
  expiry_date?: string | null
  lot_number?: string | null
  reminder_date?: string | null
  reminder_label?: string | null
}

export async function createVariant(
  productId: string,
  input: VariantInput
): Promise<ProductVariant> {
  const { data, error } = (await supabase
    .from('product_variants')
    .insert({
      product_id: productId,
      name: input.name,
      sku: input.sku,
      barcode: input.barcode ?? null,
      cost: input.cost,
      low_stock_threshold: input.low_stock_threshold,
      location_id: input.location_id ?? null,
      expiry_date: input.expiry_date ?? null,
      lot_number: input.lot_number ?? null,
      reminder_date: input.reminder_date ?? null,
      reminder_label: input.reminder_label ?? null,
      current_stock: 0,
    })
    .select('*')
    .single()) as unknown as { data: ProductVariant | null; error: { code: string; message: string } | null }

  if (error) {
    if (error.code === '23505') throw new Error('A variant with this SKU already exists.')
    throw new Error(error.message)
  }
  return data as ProductVariant
}

export async function updateVariant(
  id: string,
  input: Partial<VariantInput>
): Promise<void> {
  const { error } = await supabase.from('product_variants').update(input).eq('id', id)
  if (error) {
    if (error.code === '23505') throw new Error('A variant with this SKU already exists.')
    throw new Error(error.message)
  }
}

export async function softDeleteVariant(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_variants')
    .update({ enabled: false })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function setVariantActive(id: string, active: boolean): Promise<void> {
  const { error } = await supabase.from('product_variants').update({ active }).eq('id', id)
  if (error) throw new Error(error.message)
}

// ─── Batch stocktake ──────────────────────────────────────────────────────────

export async function batchAdjustStock(
  adjustments: Array<{ variant_id: string; delta: number; reason: string }>
): Promise<void> {
  const { error } = await supabase.rpc('batch_stocktake', {
    p_adjustments: adjustments,
  })
  if (error) throw new Error(error.message)
}

// ─── Barcode lookup ───────────────────────────────────────────────────────────

export interface BarcodeMatch {
  variantId: string
  productId: string
  variantName: string
  productName: string
  sku: string
  currentStock: number
}

interface BarcodeVariantRow {
  id: string
  name: string
  sku: string
  current_stock: number
  products: { id: string; name: string; hotel_id: string; enabled: boolean }
}

export async function lookupVariantByBarcode(
  hotelId: string,
  barcode: string
): Promise<BarcodeMatch | null> {
  // Try barcode field first, fall back to SKU match
  for (const field of ['barcode', 'sku'] as const) {
    const { data, error } = (await supabase
      .from('product_variants')
      .select('id, name, sku, current_stock, products!inner(id, name, hotel_id, enabled)')
      .eq(field, barcode)
      .eq('products.hotel_id', hotelId)
      .eq('products.enabled', true)
      .eq('enabled', true)
      .maybeSingle()) as unknown as { data: BarcodeVariantRow | null; error: { message: string } | null }

    if (error) throw new Error(error.message)
    if (!data) continue

    const p = data.products
    return {
      variantId: data.id,
      productId: p.id,
      variantName: data.name,
      productName: p.name,
      sku: data.sku,
      currentStock: data.current_stock,
    }
  }
  return null
}

// ─── Cost history ─────────────────────────────────────────────────────────────

export async function fetchCostHistory(variantId: string): Promise<VariantCostHistory[]> {
  const { data, error } = (await supabase
    .from('variant_cost_history')
    .select('*')
    .eq('variant_id', variantId)
    .order('effective_from', { ascending: false })) as unknown as { data: VariantCostHistory[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Forecast ────────────────────────────────────────────────────────────────
// Returns a map of variantId → estimated days until stock runs out,
// based on average daily consumption over the last 30 days.

interface ForecastRow {
  variant_id: string
  quantity_change: number
}

export async function fetchForecast(hotelId: string): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = (await supabase
    .from('stock_logs')
    .select('variant_id, quantity_change')
    .eq('hotel_id', hotelId)
    .lt('quantity_change', 0)
    .gte('timestamp', since)
    .eq('is_revert', false)) as unknown as { data: ForecastRow[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)

  // Sum removals per variant
  const consumptionMap = new Map<string, number>()
  for (const row of data ?? []) {
    const prev = consumptionMap.get(row.variant_id) ?? 0
    consumptionMap.set(row.variant_id, prev + Math.abs(row.quantity_change))
  }

  // Convert to days-left (caller must cross-reference with current_stock)
  const forecastMap = new Map<string, number>()
  for (const [variantId, total] of consumptionMap) {
    forecastMap.set(variantId, total / 30) // avg daily consumption
  }

  return forecastMap
}

// ─── Set variant stock (cycle-count / bulk import) ────────────────────────────
// Sets absolute stock level, computing delta server-side and creating an audit log.

export async function setVariantStock(
  variantId: string,
  newStock: number,
  note = 'Bulk import update'
): Promise<number> {
  const result = await supabase.rpc('set_variant_stock', {
    p_variant_id: variantId,
    p_new_stock: newStock,
    p_note: note,
  }) as unknown as { data: number | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? 0
}

// ─── Bulk update by SKU ──────────────────────────────────────────────────────
// Looks up each variant by SKU within the hotel and applies updates.
// Returns per-row results.

export interface BulkUpdateItem {
  sku: string
  current_stock?: number
  /** Relative stock adjustment (positive = add, negative = subtract). Mutually exclusive with current_stock. */
  stock_delta?: number
  cost?: number
  description?: string
}

export interface BulkUpdateResult {
  sku: string
  status: 'updated' | 'not_found' | 'error'
  message?: string
}

export async function bulkUpdateBySku(
  hotelId: string,
  items: BulkUpdateItem[]
): Promise<BulkUpdateResult[]> {
  // ── Step 1: batch-lookup all SKUs in a single query ──────────────────────
  const allSkus = items.map((i) => i.sku)
  const { data: variants, error: lookupErr } = (await supabase
    .from('product_variants')
    .select('id, sku, current_stock, products!inner(id, hotel_id)')
    .in('sku', allSkus)
    .eq('products.hotel_id', hotelId)
    .eq('enabled', true)) as unknown as {
      data: Array<{ id: string; sku: string; current_stock: number; products: { id: string; hotel_id: string } }> | null
      error: { message: string } | null
    }

  if (lookupErr) throw new Error(lookupErr.message)

  const variantBySku = new Map((variants ?? []).map((v) => [v.sku, v]))

  // ── Step 2: process updates concurrently per item ────────────────────────
  const results = await Promise.all(items.map(async (item): Promise<BulkUpdateResult> => {
    try {
      const variant = variantBySku.get(item.sku)
      if (!variant) return { sku: item.sku, status: 'not_found' }

      // Fire stock, cost, and description updates concurrently per item
      const ops: Promise<void>[] = []

      if (item.stock_delta != null) {
        ops.push(Promise.resolve(supabase.rpc('adjust_stock', {
          p_variant_id: variant.id,
          p_delta: item.stock_delta,
          p_reason: 'Smart import adjustment',
          p_photo_url: null,
          p_removal_category: null,
        })).then(({ error }) => { if (error) throw new Error(error.message) }))
      } else if (item.current_stock != null) {
        ops.push(setVariantStock(variant.id, item.current_stock, 'Bulk import cycle count').then(() => {}))
      }
      if (item.cost != null) {
        ops.push(Promise.resolve(supabase.from('product_variants').update({ cost: item.cost }).eq('id', variant.id))
          .then(({ error }) => { if (error) throw new Error(error.message) }))
      }
      if (item.description != null) {
        ops.push(Promise.resolve(supabase.from('products').update({ description: item.description }).eq('id', variant.products.id))
          .then(({ error }) => { if (error) throw new Error(error.message) }))
      }

      await Promise.all(ops)
      return { sku: item.sku, status: 'updated' }
    } catch (e) {
      return { sku: item.sku, status: 'error', message: e instanceof Error ? e.message : 'Unknown error' }
    }
  }))

  return results
}

// ─── Procurement Proposals ────────────────────────────────────────────────────
// Layer: Mind — Predictive Procurement Engine
// Calls get_procurement_proposals() RPC which ranks variants by urgency score.

export interface ProcurementProposalRow {
  signal_type: 'below_par' | 'depletion_risk' | 'both'
  variant_id: string
  product_name: string
  variant_name: string
  sku: string
  current_stock: number
  par_level: number
  suggested_qty: number
  urgency_score: number
  days_until_zero: number | null
  avg_daily: number | null
  preferred_supplier_id: string | null
  preferred_supplier_name: string | null
  avg_lead_days: number | null
  has_open_request: boolean
  unit_cost: number
  reasoning: string
}

export async function fetchProcurementProposals(): Promise<ProcurementProposalRow[]> {
  const result = await supabase.rpc('get_procurement_proposals') as unknown as { data: ProcurementProposalRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Bulk restock requests ────────────────────────────────────────────────────
// Layer: Mind — Place multiple restock requests in a single insert.

export async function createBulkRestockRequests(
  items: { variantId: string; quantityNeeded: number; supplier?: string; notes?: string }[]
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const hotelIdResult = await supabase.rpc('auth_hotel_id') as unknown as { data: string | null; error: { message: string } | null }
  if (hotelIdResult.error) throw new Error(hotelIdResult.error.message)
  const hotelId = hotelIdResult.data
  if (!hotelId) throw new Error('No active hotel')

  const rows = items.map((item) => ({
    hotel_id: hotelId,
    variant_id: item.variantId,
    quantity_needed: item.quantityNeeded,
    supplier: item.supplier ?? null,
    status: 'pending' as const,
    requestor_id: user.id,
    notes: item.notes ?? null,
  }))

  const { error } = await supabase.from('restock_requests').insert(rows)
  if (error) throw new Error(error.message)
}

// ─── Probabilistic Intelligence ──────────────────────────────────────────────
// Layer: Eye — returns per-variant stockout probability + confidence score.
// Powered by compute_stockout_probability() which models daily consumption as
// N(μ, σ²) and computes P(stockout within T days) via the normal CDF.

export async function fetchStockoutProbabilities(): Promise<StockoutProbabilityRow[]> {
  const result = await supabase.rpc('compute_stockout_probability') as unknown as {
    data: StockoutProbabilityRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── FEFO batch map ───────────────────────────────────────────────────────────
// Returns the earliest-expiring active batch per variant for the whole hotel.
// Used by PickListsPage to show "Use Lot X (exp date)" inline per item.

export async function fetchFefoBatchMap(): Promise<Map<string, FefoBatchRow>> {
  const result = await supabase.rpc('get_fefo_batch_map') as unknown as {
    data: FefoBatchRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return new Map((result.data ?? []).map((r) => [r.variant_id, r]))
}
