import { supabase } from '@/lib/supabase/client'

export interface StockMovementRow {
  id: string
  variant_id: string
  product_name: string
  variant_name: string
  sku: string
  category_name: string | null
  quantity_change: number
  balance_after: number
  reason: string
  timestamp: string
  is_revert: boolean
  removal_category: string | null
}

export interface AuditLogRow extends StockMovementRow {
  user_id: string | null
  photo_url: string | null
  was_offline: boolean
  revert_of: string | null
}

interface StockLogQueryRow {
  id: string
  variant_id: string
  quantity_change: number
  balance_after: number
  reason: string
  timestamp: string
  is_revert: boolean
  removal_category: string | null
  product_variants: {
    name: string
    sku: string
    products: { name: string; categories: { name: string } | null }
  }
}

interface AuditLogQueryRow extends StockLogQueryRow {
  user_id: string | null
  photo_url: string | null
  was_offline: boolean
  revert_of: string | null
}

function mapRow(row: StockLogQueryRow): StockMovementRow {
  return {
    id: row.id,
    variant_id: row.variant_id,
    product_name: row.product_variants.products.name,
    variant_name: row.product_variants.name,
    sku: row.product_variants.sku,
    category_name: row.product_variants.products.categories?.name ?? null,
    quantity_change: row.quantity_change,
    balance_after: row.balance_after,
    reason: row.reason,
    timestamp: row.timestamp,
    is_revert: row.is_revert,
    removal_category: row.removal_category,
  }
}

const MOVEMENT_SELECT = `
  id, variant_id, quantity_change, balance_after, reason, timestamp, is_revert, removal_category,
  product_variants!inner(
    name, sku,
    products!inner(name, categories(name))
  )
`

// Waste-specific select includes user_id for operator correlation
const WASTE_SELECT = `
  id, variant_id, quantity_change, balance_after, reason, timestamp, is_revert, removal_category, user_id,
  product_variants!inner(
    name, sku,
    products!inner(name, categories(name))
  )
`

/** Extends StockMovementRow with the operator who logged the waste event. */
export interface WasteEventRow extends StockMovementRow {
  user_id: string | null
}

export async function fetchRecentActivity(limit = 20): Promise<StockMovementRow[]> {
  const { data, error } = (await supabase
    .from('stock_logs')
    .select(MOVEMENT_SELECT)
    .order('timestamp', { ascending: false })
    .limit(limit)) as unknown as { data: StockLogQueryRow[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

/** Fetches waste-only events with user_id for cross-domain synthesis. */
export async function fetchWasteReport(
  dateFrom?: string,
  dateTo?: string,
): Promise<WasteEventRow[]> {
  let query = supabase
    .from('stock_logs')
    .select(WASTE_SELECT)
    .not('removal_category', 'is', null)
    .lt('quantity_change', 0)
    .eq('is_revert', false)
    .order('timestamp', { ascending: false })
    .limit(2000)

  if (dateFrom) query = query.gte('timestamp', `${dateFrom}T00:00:00`)
  if (dateTo)   query = query.lte('timestamp', `${dateTo}T23:59:59`)

  const { data, error } = (await query) as unknown as {
    data: (StockLogQueryRow & { user_id: string | null })[] | null
    error: { message: string } | null
  }
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({ ...mapRow(row), user_id: row.user_id }))
}

export async function fetchStockMovementReport(
  dateFrom?: string,
  dateTo?: string
): Promise<StockMovementRow[]> {
  let query = supabase
    .from('stock_logs')
    .select(MOVEMENT_SELECT)
    .order('timestamp', { ascending: false })
    .limit(2000)

  if (dateFrom) query = query.gte('timestamp', `${dateFrom}T00:00:00`)
  if (dateTo)   query = query.lte('timestamp', `${dateTo}T23:59:59`)

  const { data, error } = (await query) as unknown as { data: StockLogQueryRow[] | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

export async function fetchShiftActivity(
  hotelId: string,
  since: string, // ISO datetime string
): Promise<AuditLogRow[]> {
  const AUDIT_SELECT = `
    id, variant_id, quantity_change, balance_after, reason, timestamp, is_revert,
    user_id, photo_url, was_offline, revert_of, removal_category,
    product_variants!inner(
      name, sku,
      products!inner(name, hotel_id, categories(name))
    )
  `
  const { data, error } = (await supabase
    .from('stock_logs')
    .select(AUDIT_SELECT)
    .eq('hotel_id', hotelId)
    .gte('timestamp', since)
    .order('timestamp', { ascending: false })
    .limit(1000)) as unknown as { data: AuditLogQueryRow[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    ...mapRow(row),
    user_id: row.user_id,
    photo_url: row.photo_url,
    was_offline: row.was_offline,
    revert_of: row.revert_of,
  }))
}

export async function fetchAuditLog(
  hotelId: string,
  opts?: { dateFrom?: string; dateTo?: string; search?: string; limit?: number }
): Promise<AuditLogRow[]> {
  const AUDIT_SELECT = `
    id, variant_id, quantity_change, balance_after, reason, timestamp, is_revert,
    user_id, photo_url, was_offline, revert_of, removal_category,
    product_variants!inner(
      name, sku,
      products!inner(name, hotel_id, categories(name))
    )
  `
  let query = supabase
    .from('stock_logs')
    .select(AUDIT_SELECT)
    .eq('hotel_id', hotelId)
    .order('timestamp', { ascending: false })
    .limit(opts?.limit ?? 500)

  if (opts?.dateFrom) query = query.gte('timestamp', `${opts.dateFrom}T00:00:00`)
  if (opts?.dateTo)   query = query.lte('timestamp', `${opts.dateTo}T23:59:59`)
  if (opts?.search)   query = query.ilike('reason', `%${opts.search}%`)

  const { data, error } = (await query) as unknown as { data: AuditLogQueryRow[] | null; error: { message: string } | null }
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    ...mapRow(row),
    user_id: row.user_id,
    photo_url: row.photo_url,
    was_offline: row.was_offline,
    revert_of: row.revert_of,
  }))
}
