// Supabase-backed GraphReader. The reality-graph package stays Supabase-free;
// we satisfy the typed interface here and pass the impl into the agent factory.

import { supabase } from '@/lib/supabase/client'
import type {
  DocumentChunkMatch,
  DocumentRow,
  GraphReader,
  HotelRow,
  PrincipleRecord,
  RestockRequestRow,
  StockLogRow,
  SupplierRow,
  VariantRow,
} from '@beacon/reality-graph'

interface VariantQueryRow {
  id: string
  name: string
  current_stock: number
  // The live schema keeps the reorder point as low_stock_threshold and the
  // preferred supplier as default_supplier_id; reality-graph's VariantRow calls
  // them par_level + preferred_supplier_id. hotel_id lives on products, reached
  // via the embedded join (product_variants has no hotel_id column).
  low_stock_threshold: number | null
  default_supplier_id: string | null
  products: { hotel_id: string } | { hotel_id: string }[] | null
}

const VARIANT_SELECT =
  'id, name, current_stock, low_stock_threshold, default_supplier_id, products!inner(hotel_id, name)'

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
        .select(VARIANT_SELECT)
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
      return data.map(toRestockRow)
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
      return data as unknown as StockLogRow[]
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
      return data as HotelRow[]
    },

    async getVariantsByName(name, hotelIds) {
      if (hotelIds.length === 0) return []
      // Cross-property match is on the PRODUCT name (variants are per-hotel rows
      // named e.g. 'Standard'; "Soda Water" is the product the agent passes).
      const { data, error } = await supabase
        .from('product_variants')
        .select(VARIANT_SELECT)
        .eq('products.name', name)
        .in('products.hotel_id', hotelIds)
        .overrideTypes<VariantQueryRow[], { merge: false }>()
      if (error) throw new Error(error.message)
      return data.map(toVariantRow)
    },

    async getSuppliersForVariant(_variantId) {
      // organization_id isn't a column on suppliers (they're hotel-scoped); the
      // reliability metrics on_time_pct / cost_variance_pct ARE — populated by
      // compute_supplier_reliability() weekly. NULL when no PO/invoice history
      // yet; rank_alternative_suppliers uses its conservative defaults then.
      // RLS scopes the rows to the caller's hotel.
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, hotel_id, name, lead_time_days, on_time_pct, cost_variance_pct')
      if (error) throw new Error(error.message)
      return data.map(toSupplierRow)
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
      const docIds = edges.map((e) => (e as { source_id: string }).source_id)
      if (docIds.length === 0) return []

      const { data: docs, error: docError } = await supabase
        .from('documents')
        .select('id, title, mime_type, ingestion_stage, chunks, created_at')
        .in('id', docIds)
      if (docError) throw new Error(docError.message)
      return docs as DocumentRow[]
    },

    async searchDocumentChunks(hotelId, query, opts): Promise<DocumentChunkMatch[]> {
      // Two-step: embed the query via edge function, then call the
      // match_document_chunks pgvector RPC. Failure at either step
      // returns [] so the agent's reasoning can continue without
      // hard-erroring when the embedding pipeline is down.
      try {
        const embedResp = await supabase.functions.invoke<{ embeddings: number[][] }>('embed-text', {
          body: { texts: [query] },
        })
        const vec = embedResp.data?.embeddings[0]
        if (!vec || vec.length === 0) return []

        const rpcResult = await supabase.rpc('match_document_chunks', {
          p_hotel_id:  hotelId,
          p_query:     `[${vec.join(',')}]`,
          p_threshold: opts?.threshold ?? 0.70,
          p_limit:     opts?.limit ?? 8,
        }) as { data: DocumentChunkMatch[] | null; error: { message: string } | null }
        if (rpcResult.error) throw new Error(rpcResult.error.message)
        return rpcResult.data ?? []
      } catch (err) {
        console.warn('[graphReader] searchDocumentChunks failed:', err)
        return []
      }
    },

    async getActivePrinciples(hotelId, _organizationId): Promise<PrincipleRecord[]> {
      const { data, error } = await supabase
        .from('principles')
        .select('id, body, category, applies_to_node_ids')
        .eq('hotel_id', hotelId)
        .eq('active', true)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      const rows = data as Array<{ id: string; body: string; category: string; applies_to_node_ids: string[] | null }>
      return rows.map((r) => ({
        id:               r.id,
        body:             r.body,
        category:         r.category,
        appliesToNodeIds: r.applies_to_node_ids ?? [],
      }))
    },
  }
}

function toVariantRow(row: VariantQueryRow): VariantRow {
  const product = Array.isArray(row.products) ? row.products[0] : row.products
  return {
    id: row.id,
    hotel_id: product?.hotel_id ?? '',
    name: row.name,
    current_stock: row.current_stock,
    par_level: row.low_stock_threshold,
    preferred_supplier_id: row.default_supplier_id,
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
    organization_id: null,
    name: row.name,
    lead_time_days: row.lead_time_days,
    on_time_pct: row.on_time_pct,
    cost_variance_pct: row.cost_variance_pct,
  }
}

// Suppress unused-var lint on intentionally-discarded query rows
export type { StockLogQueryRow }
