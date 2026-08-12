// Data Lineage's data: the one graph reader, typed.

import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import { datasetMarkings, lineageGraph, simulateMarkingChanges } from '@beacon/platform'

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

// ── the marking simulation (L3) ────────────────────────────────────────────

export type SimState =
  | 'simulated_changes_applied' | 'access_affected'
  | 'access_unaffected' | 'no_visible_transactions'

export interface SimResult { dataset_id: string; name: string; state: SimState }

export function useSimulateMarkings() {
  return useMutation({
    mutationFn: async (i: { datasetId: string; add: string[]; remove: string[] }): Promise<SimResult[]> => {
      const r = await client(simulateMarkingChanges).executeFunction({
        p_dataset: i.datasetId, p_add: i.add, p_remove: i.remove })
      return r as unknown as SimResult[]
    },
  })
}

export interface MarkingPick { id: string; name: string; category: string }

export function useAllMarkings() {
  return useQuery({
    queryKey: ['lineage', 'markings'],
    queryFn: async (): Promise<MarkingPick[]> => {
      const { data, error } = await supabase.from('markings')
        .select('id, name, marking_categories(name)').order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as { id: string; name: string; marking_categories: { name: string } | null }[])
        .map((m) => ({ id: m.id, name: m.name, category: m.marking_categories?.name ?? '' }))
    },
    staleTime: 30_000,
  })
}

/** The markings applied DIRECTLY on a dataset — the only ones a simulation
 *  may uncheck ("You can only remove Markings that were applied directly"). */
export function useDirectMarkings(datasetId: string | null) {
  return useQuery({
    queryKey: ['lineage', 'direct-markings', datasetId],
    enabled: datasetId !== null,
    queryFn: async (): Promise<string[]> => {
      const rows = await client(datasetMarkings).executeFunction({ p_dataset: datasetId as string })
      return (rows as { marking_id: string; origin: string }[])
        .filter((r) => r.origin === 'direct').map((r) => r.marking_id)
    },
  })
}
