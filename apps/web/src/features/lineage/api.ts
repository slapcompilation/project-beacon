// Data Lineage's data: the one graph reader, typed.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { lineageGraph } from '@beacon/platform'

export interface LineageNode {
  kind: 'dataset' | 'object_type'
  id: string
  depth: number
  label: string
  api_name: string
  icon: string | null
  status: string | null
  visibility: string | null
  txn_type: string | null
  built_at: string | null
  row_count: number | null
  defines_object_type: boolean | null
  out_of_date_with_parent: boolean
}

export interface LineageEdge {
  edge: 'input' | 'datasource' | 'materialization' | 'link_type'
  from_kind: string
  from_id: string
  to_kind: string
  to_id: string
  api_name: string | null
}

export interface LineageGraph {
  nodes: LineageNode[]
  edges: LineageEdge[]
  truncated: boolean
}

export function useLineageGraph(
  kind: 'dataset' | 'object_type' | null, id: string | null, up: number, down: number,
) {
  return useQuery({
    queryKey: ['lineage', kind, id, up, down],
    enabled: kind !== null && id !== null,
    queryFn: async (): Promise<LineageGraph> => {
      // lineage_graph is VOLATILE for its temp table, so the generated client
      // files it under actions; it reads, it writes nothing.
      const g = await client(lineageGraph).applyAction({
        p_kind: kind as string, p_id: id as string, p_up: up, p_down: down })
      return g as unknown as LineageGraph
    },
  })
}

export interface DatasetPick { id: string; name: string; api_name: string }

export function useDatasetPicks() {
  return useQuery({
    queryKey: ['lineage', 'datasets'],
    queryFn: async (): Promise<DatasetPick[]> => {
      const { data, error } = await supabase.from('datasets')
        .select('id, name, api_name').order('name')
      if (error) throw new Error(error.message)
      return data as DatasetPick[]
    },
    staleTime: 30_000,
  })
}
