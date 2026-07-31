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
  /** Days before the product spoils once on hand; NULL = non-perishable.
   *  waste_triage uses it as the spoilage safe-window (falls back to a default
   *  when absent). */
  shelf_life_days?: number | null
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
  /** Operator-supplied note. Used to flag waste/spoilage when removal_category is unset. */
  reason?: string | null
  /** Tags like 'waste', 'spoilage', 'damaged'. Set on intentional removals. */
  removal_category?: string | null
  /** On-hand balance after this log. When present, lets the accuracy instrument
   *  flag a realized window where stock hit zero (demand was censored). */
  balance_after?: number | null
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

/** Minimal Document shape the tools need. Mirrors DocumentPayload from
 *  packages/reality-graph/src/nodes/aip.ts with the chunks elaborated. */
export interface DocumentRow {
  id:              string
  title:           string
  mime_type:       string
  ingestion_stage: string
  chunks:          ReadonlyArray<{ chunk_id: string; page: number; text_preview: string }> | null
  created_at:      string
}

/** One match returned by searchDocumentChunks. Mirrors the
 *  match_document_chunks RPC shape declared in migration 139. */
export interface DocumentChunkMatch {
  id:           string
  document_id:  string
  chunk_key:    string
  page:         number
  text_preview: string
  /** Cosine similarity in [0, 1]; higher is closer. */
  similarity:   number
}

/** An active operator Principle the agent weighs as a soft constraint.
 *  Mirrors PrinciplePayload from nodes/aip.ts with the row id attached. */
export interface PrincipleRecord {
  id:       string
  body:     string
  category: string
  /** When set, the principle applies only to these node ids (variants,
   *  suppliers, agents). Empty/undefined = applies hotel-wide. */
  appliesToNodeIds?: string[]
}

export interface ProcessStateStat {
  state:              string
  enteredCount:       number
  currentCount:       number
  exitedCount:        number
  avgDurationSeconds: number | null
}
export interface ProcessTransitionStat {
  from:               string
  to:                 string
  count:              number
  avgLeadTimeSeconds: number | null
}
export interface MinedProcessResult {
  states:      ProcessStateStat[]
  transitions: ProcessTransitionStat[]
}

/** Read-only abstraction used by all data/logic tools. */
export interface GraphReader {
  getVariant(variantId: string): Promise<VariantRow | null>
  getOpenRestockRequests(variantId: string): Promise<RestockRequestRow[]>
  getStockLogs(variantId: string, sinceDays: number): Promise<StockLogRow[]>
  getSisterHotels(hotelId: string): Promise<HotelRow[]>
  getVariantsByName(name: string, hotelIds: ReadonlyArray<string>): Promise<VariantRow[]>
  getSuppliersForVariant(variantId: string): Promise<SupplierRow[]>
  /** Documents linked to a node via a `describes_entity` edge.
   *  Used by query_variant_documents and any future entity-document tool. */
  getDocumentsForEntity(entityType: string, entityId: string): Promise<DocumentRow[]>
  /** Semantic search across every document_chunks row in a hotel via
   *  the match_document_chunks pgvector RPC. Used by query_document_chunks.
   *  Implementations are expected to embed `query` before calling the RPC. */
  searchDocumentChunks(
    hotelId: string,
    query:   string,
    opts?:   { threshold?: number; limit?: number },
  ): Promise<DocumentChunkMatch[]>
  /** Active operator Principles for the hotel (optionally org-wide too).
   *  Agents fetch these and weigh applicable ones as soft constraints,
   *  recording honored principles in proposal provenance. */
  getActivePrinciples(hotelId: string, organizationId?: string): Promise<PrincipleRecord[]>
  /** Process-mining metrics over the lifecycle transition log (mine_process RPC,
   *  migration 208). Optional — only the browser reader implements it; agents /
   *  fixtures that don't need it can omit it. Used by the mine_process tool. */
  mineProcess?(nodeType: string, hotelId: string): Promise<MinedProcessResult>
  /** The agreed commercial term for a variant from a supplier, or null when no
   *  agreement covers the pair. Optional like mineProcess — fixtures and the
   *  edge reader need not implement it. Used by get_contract_terms. */
  getContractTerms?(variantId: string, supplierId: string): Promise<ContractTerms | null>
}

/** One row of get_contract_terms (migration 300). inForce folds is_active and
 *  the validity window together, because a decision cares about "can I use this
 *  price today", not about which of the three reasons it cannot. */
export interface ContractTerms {
  contractedPrice: number
  minOrderQty:     number | null
  validFrom:       string | null
  validUntil:      string | null
  inForce:         boolean
  basis:           string
}
