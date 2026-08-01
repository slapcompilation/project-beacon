// Reality Graph — Node and Edge type definitions
// Every entity in the system is a node; every relationship is an edge.
// Layer: meta (used by all layers)

export type NodeType =
  | 'hotel'
  | 'user'
  | 'product'
  | 'variant'
  | 'stock_log'
  | 'restock_request'
  | 'stocktake_session'
  | 'stocktake_line'
  | 'alert'
  | 'report'
  // Sprint 1 — Reality Graph Core
  | 'supplier'
  | 'product_batch'
  | 'restock_receive'
  | 'purchase_order'
  | 'shift_handover'
  | 'budget_allocation'
  | 'gl_account_mapping'
  | 'purchase_order_line'
  | 'po_discrepancy'
  | 'po_invoice'
  | 'occupancy_log'
  // AIP-native nodes
  | 'document'
  | 'proposal'
  | 'principle'
  | 'approved_answer'
  | 'case'
  | 'constraint'
  // Network — lateral inter-property moves
  | 'stock_transfer'
  // Multi-step BeaconAction sequences batched into one commit (Phase 18.a, renamed H1)
  | 'action_chain'
  // Supplier delivery telemetry (powers reliability scoring)
  | 'delivery_event'
  // Hotel taxonomy + reference data
  | 'location'
  | 'category'
  | 'removal_reason'
  // Pick lists (Flow layer batch workflow)
  | 'pick_list'
  | 'pick_list_item'
  // F&B menu engineering
  | 'menu_item'
  | 'menu_item_ingredient'
  // Demand-planner events
  | 'event'
  // Doc-ingestion object model (Foundry-exact): a Chunk of a Document, and a
  // discovered Entity that chunks mention and that resolves to operational nodes.
  | 'chunk'
  | 'entity'

export type EdgeType =
  | 'causes'
  | 'consumes'
  | 'restocks'
  | 'reverts'
  | 'belongs_to_session'
  | 'triggered_alert'
  // Sprint 1 — Reality Graph Core
  | 'approved_by'
  | 'rejected_by'
  | 'modified_by'
  | 'fulfills'
  | 'log_fulfills_request'
  | 'sourced_from'
  | 'delivery_sourced_from'
  | 'receipt_sourced_from'
  | 'po_sourced_from'
  | 'recipe_consumes'
  | 'pick_consumes'
  // 288 — the recipe chain: a sale sells a dish, a dish lists ingredients
  | 'sold'
  | 'ingredient_of'
  // 303 — the last grandfathered tables join the ontology
  | 'counts_variant'
  | 'item_of'
  | 'categorised_as'
  | 'allocated_to'
  // 294 — purchase-order lines and discrepancies
  | 'line_of'
  | 'line_orders'
  | 'line_fulfills_request'
  | 'discrepancy_of'
  | 'transfer_approved_by'
  | 'batch_of'
  | 'discarded_via'
  | 'linked_to_po'
  | 'invoiced_by'
  | 'influenced_by_occupancy'
  | 'influenced_by_principle'
  | 'similar_to'
  // AIP-native edges
  | 'transfers'
  | 'proposed_by'
  | 'benchmarks'
  | 'harmonized_to'
  | 'describes_entity'
  | 'cited_in'
  | 'applies_to'
  // Prediction lineage (Q2): a proposal traces to the forecast that sized it.
  | 'derived_from'
  // Doc-ingestion Track 2 (Foundry-exact object model): chunk mentions a
  // discovered Entity; an Entity resolves to a real operational node.
  | 'mentions'      // many-to-many: chunk -> entity
  | 'resolved_to'   // entity -> supplier | variant (deterministic exact match)

/** Runtime list of every typed edge. The ontology drift detector compares the
 *  edge types present in the graph against this set; anything in the data but
 *  not here is an untyped-edge gap. Kept exhaustive against EdgeType by the
 *  compile-time check below (and `satisfies` guards against typos / stale entries). */
export const EDGE_TYPES = [
  'causes', 'consumes', 'restocks', 'reverts',
  'belongs_to_session', 'triggered_alert', 'approved_by', 'rejected_by', 'modified_by',
  'fulfills', 'log_fulfills_request', 'sourced_from',
  'delivery_sourced_from', 'receipt_sourced_from', 'po_sourced_from',
  'recipe_consumes', 'pick_consumes', 'sold', 'ingredient_of', 'transfer_approved_by',
  'line_of', 'line_orders', 'line_fulfills_request', 'discrepancy_of',
  'counts_variant', 'item_of', 'categorised_as', 'allocated_to', 'batch_of', 'discarded_via', 'linked_to_po', 'invoiced_by',
  'influenced_by_occupancy', 'influenced_by_principle', 'similar_to', 'transfers', 'proposed_by', 'benchmarks',
  'harmonized_to', 'describes_entity', 'cited_in', 'applies_to', 'derived_from',
  'mentions', 'resolved_to',
] as const satisfies readonly EdgeType[]

// Compile error if EDGE_TYPES omits any EdgeType member.
type _MissingEdgeTypes = Exclude<EdgeType, (typeof EDGE_TYPES)[number]>
const _edgeTypesExhaustive: [_MissingEdgeTypes] extends [never] ? true : ['EDGE_TYPES missing', _MissingEdgeTypes] = true
void _edgeTypesExhaustive

export interface GraphNode {
  id: string
  type: NodeType
  hotel_id: string
  payload: Record<string, unknown>
  created_at: string
}

export interface GraphEdge {
  id: string
  type: EdgeType
  source_id: string
  source_type: NodeType
  target_id: string
  target_type: NodeType
  hotel_id: string
  metadata?: Record<string, unknown>
  created_at: string
}

/** Attach this to any component or hook to declare its layer */
export type LayerDeclaration = {
  layer: 'floor' | 'flow' | 'eye' | 'mind'
  description?: string
}
