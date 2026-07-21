// Resolves a mixed-type batch of node refs (type + id) to human labels via the
// resolve_node_labels RPC (migration 207). relationship_edges only carry
// (type, id); Search Around and edge chips use this to show real names.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { NodeType } from '@beacon/reality-graph'

export interface NodeRef {
  type: NodeType
  id:   string
}

interface ResolvedRow {
  node_type: string
  node_id:   string
  label:     string
}

/** Map keyed by `${type}:${id}` → label. Unresolved refs are simply absent. */
export function useResolveNodeLabels(refs: NodeRef[]) {
  const key = refs.map((r) => `${r.type}:${r.id}`).sort().join(',')
  return useQuery({
    queryKey: ['node-labels', key],
    queryFn: async () => {
      if (refs.length === 0) return new Map<string, string>()
      const { data, error } = await supabase.rpc('resolve_node_labels', {
        p_refs: refs.map((r) => ({ type: r.type, id: r.id })),
      }) as unknown as { data: ResolvedRow[] | null; error: { message: string } | null }
      if (error) throw new Error(error.message)
      return new Map((data ?? []).map((d) => [`${d.node_type}:${d.node_id}`, d.label]))
    },
    enabled:   refs.length > 0,
    staleTime: 60_000,
  })
}
