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

// ─── Graph traversal ──────────────────────────────────────────────────────────

export interface TraversalNode {
  nodeId:   string
  nodeType: NodeType
  depth:    number
  viaEdge?: EdgeRecord
}

export interface TraverseOptions {
  /** How many hops to walk from the start node. Default: 3 */
  maxDepth?:   number
  /** Restrict traversal to these edge types. Default: all types */
  edgeFilter?: EdgeType[]
  /** Which edge directions to follow. Default: 'both' */
  direction?:  'out' | 'in' | 'both'
}

/**
 * Breadth-first traversal of a pre-loaded edge set starting from a given node.
 * Used by the Eye copilot and CausalChain panel to derive cross-domain context.
 *
 * NOTE: `edges` should be pre-fetched for the hotel — do not pass the full
 * global edge store, only the edges relevant to the starting context.
 */
export function traverseGraph(
  edges: EdgeRecord[],
  startId:   string,
  startType: NodeType,
  options?: TraverseOptions,
): TraversalNode[] {
  const { maxDepth = 3, edgeFilter, direction = 'both' } = options ?? {}
  const visited = new Set<string>()
  const queue: TraversalNode[] = [{ nodeId: startId, nodeType: startType, depth: 0 }]
  const result: TraversalNode[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    const key = `${current.nodeType}:${current.nodeId}`
    if (visited.has(key)) continue
    visited.add(key)
    result.push(current)

    if (current.depth >= maxDepth) continue

    const neighbors: EdgeRecord[] = []

    if (direction === 'out' || direction === 'both') {
      for (const e of edges) {
        if (
          e.source_id === current.nodeId &&
          e.source_type === current.nodeType &&
          (!edgeFilter || edgeFilter.includes(e.edge_type))
        ) neighbors.push(e)
      }
    }
    if (direction === 'in' || direction === 'both') {
      for (const e of edges) {
        if (
          e.target_id === current.nodeId &&
          e.target_type === current.nodeType &&
          (!edgeFilter || edgeFilter.includes(e.edge_type))
        ) neighbors.push(e)
      }
    }

    for (const edge of neighbors) {
      const nextId   = edge.source_id === current.nodeId ? edge.target_id   : edge.source_id
      const nextType = edge.source_id === current.nodeId ? edge.target_type : edge.source_type
      if (!visited.has(`${nextType}:${nextId}`)) {
        queue.push({ nodeId: nextId, nodeType: nextType, depth: current.depth + 1, viaEdge: edge })
      }
    }
  }

  return result
}

/**
 * Returns the "other side" of an edge relative to a given node.
 * Useful when iterating a node's edges and you want the connected node.
 */
export function otherSide(
  edge: EdgeRecord,
  nodeId: string,
): { id: string; type: NodeType; role: 'source' | 'target' } {
  if (edge.source_id === nodeId) {
    return { id: edge.target_id, type: edge.target_type, role: 'target' }
  }
  return { id: edge.source_id, type: edge.source_type, role: 'source' }
}
