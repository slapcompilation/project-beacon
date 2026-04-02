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
  | 'po_invoice'
  | 'occupancy_log'

export type EdgeType =
  | 'belongs_to_hotel'
  | 'created_by'
  | 'causes'
  | 'consumes'
  | 'restocks'
  | 'reverts'
  | 'belongs_to_session'
  | 'triggered_alert'
  // Sprint 1 — Reality Graph Core
  | 'approved_by'
  | 'rejected_by'
  | 'fulfills'
  | 'sourced_from'
  | 'batch_of'
  | 'discarded_via'
  | 'linked_to_po'
  | 'invoiced_by'
  | 'influenced_by'

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
