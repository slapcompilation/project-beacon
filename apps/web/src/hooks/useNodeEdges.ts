// Layer: meta — graph edge query hook
// Fetches all relationship_edges touching a given node (source OR target).
// Used by GraphConnections to render the live ontology around any object.

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import type { NodeType, EdgeType } from '@beacon/reality-graph'

// ─── Row shape from relationship_edges ───────────────────────────────────────

export interface EdgeRow {
  id:           string
  edge_type:    EdgeType
  source_type:  NodeType
  source_id:    string
  target_type:  NodeType
  target_id:    string
  hotel_id:     string
  triggered_by: string
  actor_id:     string | null
  metadata:     Record<string, unknown> | null
  created_at:   string
}

// ─── Fetcher ──────────────────────────────────────────────────────────────────

async function fetchNodeEdges(
  nodeType: NodeType,
  nodeId:   string,
  hotelId:  string,
): Promise<EdgeRow[]> {
  const { data, error } = await supabase
    .from('relationship_edges')
    .select('*')
    .eq('hotel_id', hotelId)
    .or(
      `and(source_id.eq.${nodeId},source_type.eq.${nodeType}),` +
      `and(target_id.eq.${nodeId},target_type.eq.${nodeType})`
    )
    .order('created_at', { ascending: false })
    .limit(150) as unknown as { data: EdgeRow[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNodeEdges(nodeType: NodeType, nodeId: string | null) {
  const hotelId     = useActiveHotelId()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey:  ['node-edges', nodeType, nodeId, hotelId],
    queryFn:   () => fetchNodeEdges(nodeType, nodeId!, hotelId!),
    enabled:   !!nodeId && !!hotelId,
    staleTime: 30_000,
  })

  // Realtime: invalidate when new edges are written to this hotel's graph
  useEffect(() => {
    if (!hotelId) return
    const channel = supabase
      .channel(`edges:${nodeType}:${nodeId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'relationship_edges',
          filter: `hotel_id=eq.${hotelId}`,
        },
        (payload) => {
          const row = payload.new as EdgeRow
          // Only invalidate if this new edge involves our node
          if (
            (row.source_id === nodeId && row.source_type === nodeType) ||
            (row.target_id === nodeId && row.target_type === nodeType)
          ) {
            void queryClient.invalidateQueries({ queryKey: ['node-edges', nodeType, nodeId, hotelId] })
          }
        }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [hotelId, nodeId, nodeType, queryClient])

  return query
}
