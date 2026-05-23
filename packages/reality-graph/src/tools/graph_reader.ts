// Data abstraction the Logic Tools read from.
// apps/web supplies a Supabase-backed impl; evals supply an in-memory impl.
// Keeps reality-graph free of any Supabase imports.

export interface VariantRow {
  id: string
  hotel_id: string
  name: string
  current_stock: number
  par_level: number | null
  preferred_supplier_id?: string | null
}

export interface RestockRequestRow {
  id: string
  hotel_id: string
  variant_id: string
  quantity_needed: number
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled' | 'cancelled'
  created_at: string
}

export interface StockLogRow {
  id: string
  variant_id: string
  hotel_id: string
  delta: number
  created_at: string
}

export interface SupplierRow {
  id: string
  hotel_id: string
  organization_id?: string | null
  name: string
  lead_time_days: number | null
  /** Historical on-time delivery percentage (0–100). */
  on_time_pct: number | null
  /** Historical cost variance vs. quoted (0 = no variance). */
  cost_variance_pct: number | null
}

export interface HotelRow {
  id: string
  organization_id: string | null
  name: string
}

/** Read-only abstraction used by all data/logic tools. */
export interface GraphReader {
  getVariant(variantId: string): Promise<VariantRow | null>
  getOpenRestockRequests(variantId: string): Promise<RestockRequestRow[]>
  getStockLogs(variantId: string, sinceDays: number): Promise<StockLogRow[]>
  getSisterHotels(hotelId: string): Promise<HotelRow[]>
  getVariantsByName(name: string, hotelIds: ReadonlyArray<string>): Promise<VariantRow[]>
  getSuppliersForVariant(variantId: string): Promise<SupplierRow[]>
}
