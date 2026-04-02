// Layer: meta — Reality Graph traversal hooks (Sprint 1)
// These hooks expose the 2-hop graph context for any node in the system.
// Used by all four layers to surface causal relationships inline.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import type { NodeType, EdgeType } from '@beacon/reality-graph'

export interface GraphEdgeRow {
  hop: number
  id: string
  edge_type: EdgeType
  source_type: NodeType
  source_id: string
  target_type: NodeType
  target_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

async function fetchNodeContext(
  nodeType: string,
  nodeId: string,
  maxHops = 2,
): Promise<GraphEdgeRow[]> {
  const result = await supabase.rpc('get_node_context', {
    p_node_type: nodeType,
    p_node_id: nodeId,
    p_max_hops: maxHops,
  }) as unknown as { data: GraphEdgeRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

async function fetchVariantFlow(variantId: string): Promise<GraphEdgeRow[]> {
  const result = await supabase.rpc('get_variant_flow', {
    p_variant_id: variantId,
  }) as unknown as { data: GraphEdgeRow[] | null; error: { message: string } | null }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}

// ─── Query key factory ──────────────────────────────────────────────────────

export const graphKeys = {
  nodeContext: (nodeType: string, nodeId: string, hops: number) =>
    ['graph', 'node-context', nodeType, nodeId, hops] as const,
  variantFlow: (variantId: string) =>
    ['graph', 'variant-flow', variantId] as const,
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Returns all edges within `maxHops` hops of a given node.
 * hop=1: direct edges; hop=2: edges on neighbors.
 */
export function useNodeContext(
  nodeType: NodeType | null,
  nodeId: string | null,
  maxHops = 2,
) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: graphKeys.nodeContext(nodeType ?? '', nodeId ?? '', maxHops),
    queryFn: () => fetchNodeContext(nodeType!, nodeId!, maxHops),
    enabled: !!hotelId && !!nodeType && !!nodeId,
    staleTime: 60 * 1000, // graph structure is stable; re-fetch on mutations via invalidation
  })
}

/**
 * All edges incident on a variant — shortcut for the most common traversal.
 * Backed by get_variant_flow() which is optimised with a covering index.
 */
export function useVariantFlow(variantId: string | null) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: graphKeys.variantFlow(variantId ?? ''),
    queryFn: () => fetchVariantFlow(variantId!),
    enabled: !!hotelId && !!variantId,
    staleTime: 60 * 1000,
  })
}

// ─── Derived helpers — filter by edge type from a context result ─────────────

/** Pull edges of a specific type from a useNodeContext result. */
export function edgesByType(
  edges: GraphEdgeRow[],
  type: EdgeType,
): GraphEdgeRow[] {
  return edges.filter((e) => e.edge_type === type)
}

/** Edges that touch a specific node ID as source or target. */
export function edgesTouchingNode(
  edges: GraphEdgeRow[],
  nodeId: string,
): GraphEdgeRow[] {
  return edges.filter((e) => e.source_id === nodeId || e.target_id === nodeId)
}
