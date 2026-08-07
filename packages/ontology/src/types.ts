// Reality Graph — Node and Edge type definitions
// Every entity in the system is a node; every relationship is an edge.
// Layer: meta (used by all layers)

/** The api name of an object type — `object_types.api_name`, resolved at
 *  runtime, exactly as EdgeType became a link type's api name.
 *
 *  This was a union of thirty hospitality nouns (variant, stock_log,
 *  purchase_order, shift_handover…) plus a handful we called AIP-native and
 *  audited away. Object types describe a customer's own data — they arrive when
 *  somebody registers one over a datasource, so the platform cannot know them
 *  at compile time (`mirror/ontology/core-concepts.md`). */
export type NodeType = string

/** The api name of a link type — `link_types.api_name`, resolved at runtime.
 *  A link type is "a relationship between object types" defined in the ontology
 *  (`mirror/object-link-types/link-types-overview.md`), so the platform cannot
 *  know the names at compile time and does not need to. */
export type EdgeType = string

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
