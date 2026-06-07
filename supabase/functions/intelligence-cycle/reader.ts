// Service-role GraphReader for the unattended cycle. Mirrors the browser
// reader (apps/web/src/features/agents/graphReader.ts) but runs under the
// service role (RLS bypassed), so any query the browser version left to RLS
// for hotel-scoping must filter explicitly here — see getSuppliersForVariant.
//
// Document tools return empty: the cron path doesn't cite documents (and
// skipping the embed call avoids per-variant OpenAI spend). The agent's
// reasoning handles empty document results without erroring.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Local structural types — the reality-graph bundle ships no .d.ts, so the
// GraphReader contract is restated here for the rows we return.
interface VariantRow {
  id: string
  hotel_id: string
  name: string
  current_stock: number
  par_level: number | null
  preferred_supplier_id: string | null
  shelf_life_days: number | null
}

// product_variants has no hotel_id/par_level/preferred_supplier_id columns —
// hotel_id is on products (embedded join), the reorder point is
// low_stock_threshold, the supplier is default_supplier_id. Mirrors the fix in
// apps/web/src/features/agents/graphReader.ts.
const VARIANT_SELECT =
  'id, name, current_stock, low_stock_threshold, default_supplier_id, products!inner(hotel_id, name, shelf_life_days)'

export function makeServiceRoleGraphReader(supabase: SupabaseClient, hotelId: string) {
  const toVariant = (r: Record<string, unknown>): VariantRow => {
    const p = r.products as { hotel_id: string; shelf_life_days?: number | null } | { hotel_id: string; shelf_life_days?: number | null }[] | null
    const product = Array.isArray(p) ? p[0] : p
    return {
      id: r.id as string,
      hotel_id: product?.hotel_id ?? '',
      name: r.name as string,
      current_stock: r.current_stock as number,
      par_level: (r.low_stock_threshold as number | null) ?? null,
      preferred_supplier_id: (r.default_supplier_id as string | null) ?? null,
      shelf_life_days: product?.shelf_life_days ?? null,
    }
  }

  return {
    async getVariant(variantId: string) {
      const { data, error } = await supabase
        .from('product_variants')
        .select(VARIANT_SELECT)
        .eq('id', variantId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data ? toVariant(data) : null
    },

    async getOpenRestockRequests(variantId: string) {
      const { data, error } = await supabase
        .from('restock_requests')
        .select('id, hotel_id, variant_id, quantity_needed, status, created_at')
        .eq('variant_id', variantId)
        .in('status', ['pending', 'approved'])
      if (error) throw new Error(error.message)
      return data ?? []
    },

    async getStockLogs(variantId: string, sinceDays: number) {
      const cutoff = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
      const { data, error } = await supabase
        .from('stock_logs')
        .select('id, variant_id, hotel_id, delta:quantity_change, created_at:timestamp, reason, removal_category')
        .eq('variant_id', variantId)
        .gte('timestamp', cutoff)
      if (error) throw new Error(error.message)
      return data ?? []
    },

    async getSisterHotels(hid: string) {
      const { data: self, error: selfErr } = await supabase
        .from('hotels')
        .select('id, organization_id, name')
        .eq('id', hid)
        .maybeSingle()
      if (selfErr) throw new Error(selfErr.message)
      if (!self?.organization_id) return []
      const { data, error } = await supabase
        .from('hotels')
        .select('id, organization_id, name')
        .eq('organization_id', self.organization_id)
        .neq('id', hid)
      if (error) throw new Error(error.message)
      return data ?? []
    },

    async getVariantsByName(name: string, hotelIds: string[]) {
      if (hotelIds.length === 0) return []
      // Cross-property match is on the PRODUCT name, not the variant name —
      // variants are per-hotel rows named e.g. 'Standard'; "Soda Water" is the
      // product. The agent passes the product display name here.
      const { data, error } = await supabase
        .from('product_variants')
        .select(VARIANT_SELECT)
        .eq('products.name', name)
        .in('products.hotel_id', hotelIds)
      if (error) throw new Error(error.message)
      return (data ?? []).map(toVariant)
    },

    async getSuppliersForVariant(_variantId: string) {
      // Service role bypasses RLS, so scope by hotel explicitly. on_time_pct +
      // cost_variance_pct are populated by compute_supplier_reliability()
      // weekly (NULL until PO/invoice data lands; rank_alternative_suppliers
      // uses its conservative defaults then). organization_id isn't on this
      // table — suppliers are hotel-scoped.
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, hotel_id, name, lead_time_days, on_time_pct, cost_variance_pct')
        .eq('hotel_id', hotelId)
      if (error) throw new Error(error.message)
      return (data ?? []).map((s: Record<string, unknown>) => ({
        id: s.id as string,
        hotel_id: s.hotel_id as string,
        organization_id: null,
        name: s.name as string,
        lead_time_days: (s.lead_time_days as number | null) ?? null,
        on_time_pct: (s.on_time_pct as number | null) ?? null,
        cost_variance_pct: (s.cost_variance_pct as number | null) ?? null,
      }))
    },

    // Document provenance is out of scope for the cron path (no embed spend).
    getDocumentsForEntity(_entityType: string, _entityId: string) {
      return Promise.resolve([])
    },
    searchDocumentChunks(_hotelId: string, _query: string) {
      return Promise.resolve([])
    },

    async getActivePrinciples(hid: string) {
      const { data, error } = await supabase
        .from('principles')
        .select('id, body, category, applies_to_node_ids')
        .eq('hotel_id', hid)
        .eq('active', true)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        body: r.body as string,
        category: r.category as string,
        appliesToNodeIds: (r.applies_to_node_ids as string[] | null) ?? [],
      }))
    },
  }
}
