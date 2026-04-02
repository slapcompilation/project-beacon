// Layer: meta — graph traversal utilities, used by all four layers

import type { NodeType, EdgeType } from './types'

// ─── Edge record shape returned by get_variant_flow() RPC ────────────────────

export interface EdgeRecord {
  id: string
  edge_type: EdgeType
  source_type: NodeType
  source_id: string
  target_type: NodeType
  target_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Traversal helpers ────────────────────────────────────────────────────────

/** Returns all edges that touch a specific node (as source or target). */
export function edgesForNode(
  edges: EdgeRecord[],
  nodeId: string,
  nodeType: NodeType
): EdgeRecord[] {
  return edges.filter(
    (e) =>
      (e.source_id === nodeId && e.source_type === nodeType) ||
      (e.target_id === nodeId && e.target_type === nodeType)
  )
}

/** Returns all edges of a specific type originating from a node. */
export function outEdges(
  edges: EdgeRecord[],
  sourceId: string,
  edgeType: EdgeType
): EdgeRecord[] {
  return edges.filter(
    (e) => e.source_id === sourceId && e.edge_type === edgeType
  )
}

/** Returns all edges of a specific type pointing to a node. */
export function inEdges(
  edges: EdgeRecord[],
  targetId: string,
  edgeType: EdgeType
): EdgeRecord[] {
  return edges.filter(
    (e) => e.target_id === targetId && e.edge_type === edgeType
  )
}

/**
 * Walks a revert chain starting from a stock_log id.
 * Returns the full chain of log IDs from root to latest correction.
 */
export function walkRevertChain(
  edges: EdgeRecord[],
  rootLogId: string
): string[] {
  const chain: string[] = [rootLogId]
  let current = rootLogId
  // Guard against cycles (max depth = 50)
  for (let depth = 0; depth < 50; depth++) {
    const revert = edges.find(
      (e) => e.edge_type === 'reverts' && e.target_id === current
    )
    if (!revert) break
    chain.push(revert.source_id)
    current = revert.source_id
  }
  return chain
}

/**
 * Checks whether two nodes are connected by a specific edge type.
 */
export function hasEdge(
  edges: EdgeRecord[],
  sourceId: string,
  edgeType: EdgeType,
  targetId: string
): boolean {
  return edges.some(
    (e) =>
      e.source_id === sourceId &&
      e.edge_type === edgeType &&
      e.target_id === targetId
  )
}

/**
 * Groups edges by their type for display purposes.
 */
export function groupByEdgeType(
  edges: EdgeRecord[]
): Partial<Record<EdgeType, EdgeRecord[]>> {
  const result: Partial<Record<EdgeType, EdgeRecord[]>> = {}
  for (const edge of edges) {
    const key = edge.edge_type
    if (!result[key]) result[key] = []
    result[key]!.push(edge)
  }
  return result
}
