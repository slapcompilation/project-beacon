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

// The edge vocabulary lives in @beacon/types so BOTH packages can name it
// without a cycle — reality-graph depends on types, never the reverse. It was
// here, and `types` grew a second, staler union (GraphEdgeType, eight values,
// one of which the database refuses) precisely because it could not reach this
// one. Re-exported so the nine importers here are unchanged.
import type { EdgeType } from '@beacon/types'
export type { EdgeType }

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
