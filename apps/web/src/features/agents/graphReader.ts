// Supabase-backed GraphReader. The reality-graph package stays Supabase-free;
// we satisfy the typed interface here and pass the impl into the agent factory.

import { supabase } from '@/lib/supabase/client'
import type {
  DocumentRow,
  GraphReader,
  HotelRow,
  RestockRequestRow,
  StockLogRow,
  SupplierRow,
  VariantRow,
} from '@beacon/reality-graph'

interface VariantQueryRow {
  id: string
  hotel_id: string
  name: string
  current_stock: number
  par_level: number | null
  preferred_supplier_id: string | null
}

interface RestockRequestQueryRow {
  id: string
  hotel_id: string
  variant_id: string
  quantity_needed: number
  status: string
  created_at: string
}

interface StockLogQueryRow {
  id: string
  variant_id: string
  hotel_id: string
  delta: number
  created_at: string
  reason: string | null
  removal_category: string | null
}

interface SupplierQueryRow {
  id: string
  hotel_id: string
  organization_id: string | null
  name: string
  lead_time_days: number | null
  on_time_pct: number | null
  cost_variance_pct: number | null
}

interface HotelQueryRow {
  id: string
  organization_id: string | null
  name: string
}

export function makeSupabaseGraphReader(): GraphReader {
  return {
    async getVariant(variantId) {
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, hotel_id, name, current_stock, par_level, preferred_supplier_id')
        .eq('id', variantId)
        .maybeSingle<VariantQueryRow>()
      if (error) throw new Error(error.message)
      return data ? toVariantRow(data) : null
    },

    async getOpenRestockRequests(variantId) {
      const { data, error } = await supabase
        .from('restock_requests')
        .select('id, hotel_id, variant_id, quantity_needed, status, created_at')
        .eq('variant_id', variantId)
        .in('status', ['pending', 'approved'])
      if (error) throw new Error(error.message)
      return (data ?? []).map(toRestockRow)
    },

    async getStockLogs(variantId, sinceDays) {
      const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
      // Column aliases: live table uses quantity_change + timestamp; the typed
      // shape uses delta + created_at so reality-graph stays schema-agnostic.
      const { data, error } = await supabase
        .from('stock_logs')
        .select('id, variant_id, hotel_id, delta:quantity_change, created_at:timestamp, reason, removal_category')
        .eq('variant_id', variantId)
        .gte('timestamp', cutoff)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as StockLogRow[]
    },

    async getSisterHotels(hotelId) {
      const { data: self, error: selfErr } = await supabase
        .from('hotels')
        .select('id, organization_id, name')
        .eq('id', hotelId)
        .maybeSingle<HotelQueryRow>()
      if (selfErr) throw new Error(selfErr.message)
      if (!self?.organization_id) return []

      const { data, error } = await supabase
        .from('hotels')
        .select('id, organization_id, name')
        .eq('organization_id', self.organization_id)
        .neq('id', hotelId)
      if (error) throw new Error(error.message)
      return (data ?? []) as HotelRow[]
    },

    async getVariantsByName(name, hotelIds) {
      if (hotelIds.length === 0) return []
      const { data, error } = await supabase
        .from('product_variants')
        .select('id, hotel_id, name, current_stock, par_level, preferred_supplier_id')
        .eq('name', name)
        .in('hotel_id', hotelIds)
      if (error) throw new Error(error.message)
      return (data ?? []).map(toVariantRow)
    },

    async getSuppliersForVariant(_variantId) {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, hotel_id, organization_id, name, lead_time_days, on_time_pct, cost_variance_pct')
      if (error) throw new Error(error.message)
      return (data ?? []).map(toSupplierRow)
    },

    async getDocumentsForEntity(entityType, entityId): Promise<DocumentRow[]> {
      // Two-hop: relationship_edges → documents. Filter to describes_entity
      // edges sourced from a document and pointing AT the target entity.
      const { data: edges, error: edgeError } = await supabase
        .from('relationship_edges')
        .select('source_id')
        .eq('source_type', 'document')
        .eq('edge_type', 'describes_entity')
        .eq('target_type', entityType)
        .eq('target_id', entityId)
      if (edgeError) throw new Error(edgeError.message)
      const docIds = (edges ?? []).map((e) => (e as { source_id: string }).source_id)
      if (docIds.length === 0) return []

      const { data: docs, error: docError } = await supabase
        .from('documents')
        .select('id, title, mime_type, ingestion_stage, chunks, created_at')
        .in('id', docIds)
      if (docError) throw new Error(docError.message)
      return (docs ?? []) as DocumentRow[]
    },
  }
}

function toVariantRow(row: VariantQueryRow): VariantRow {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    name: row.name,
    current_stock: row.current_stock,
    par_level: row.par_level,
    preferred_supplier_id: row.preferred_supplier_id,
  }
}

function toRestockRow(row: RestockRequestQueryRow): RestockRequestRow {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    variant_id: row.variant_id,
    quantity_needed: row.quantity_needed,
    status: row.status as RestockRequestRow['status'],
    created_at: row.created_at,
  }
}

function toSupplierRow(row: SupplierQueryRow): SupplierRow {
  return {
    id: row.id,
    hotel_id: row.hotel_id,
    organization_id: row.organization_id,
    name: row.name,
    lead_time_days: row.lead_time_days,
    on_time_pct: row.on_time_pct,
    cost_variance_pct: row.cost_variance_pct,
  }
}

// Suppress unused-var lint on intentionally-discarded query rows
export type { StockLogQueryRow }
