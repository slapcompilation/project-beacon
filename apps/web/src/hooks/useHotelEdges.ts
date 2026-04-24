// Layer: meta — hotel-wide edge corpus for multi-hop graph traversal
//
// Fetches the most recent operational edges for the active hotel.
// Excludes pure audit edges (belongs_to_hotel, created_by) since those
// add noise without traversal value.
//
// Used by: Eye Copilot (cross-domain graph synthesis)
//          CausalChain panel (multi-hop incident tracing)

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import type { EdgeRecord } from '@beacon/reality-graph'

// Operational edge types worth traversing — excludes audit-only edges
const TRAVERSAL_EDGE_TYPES = [
  'restocks',
  'fulfills',
  'sourced_from',
  'linked_to_po',
  'causes',
  'caused_by',
  'triggered',
  'reverts',
  'discarded_via',
  'approved_by',
  'rejected_by',
  'invoiced_by',
  'similar_to',
]

async function fetchHotelEdges(hotelId: string): Promise<EdgeRecord[]> {
  const { data, error } = await supabase
    .from('relationship_edges')
    .select('id, edge_type, source_type, source_id, target_type, target_id, metadata, created_at')
    .eq('hotel_id', hotelId)
    .in('edge_type', TRAVERSAL_EDGE_TYPES)
    .order('created_at', { ascending: false })
    .limit(300) as unknown as { data: EdgeRecord[] | null; error: { message: string } | null }

  if (error) throw new Error(error.message)
  return data ?? []
}

export function useHotelEdges() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['hotel-edges', hotelId],
    queryFn:   () => fetchHotelEdges(hotelId ?? ''),
    enabled:   !!hotelId,
    staleTime: 2 * 60 * 1000,
  })
}
