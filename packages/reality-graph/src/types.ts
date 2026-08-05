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
