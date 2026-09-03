// Object Explorer's data: the E1 engine functions through the typed client,
// plus the metadata the home page arranges (groups, index counts).
//
// Filters travel in the documented grammar (generate-urls.md) — the same jsonb
// the engine validates, so a filter the UI builds is a filter a saved
// exploration can hold.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  aggregateObjectSet, countObjectSet, evaluateObjectSet, histogramObjectSet,
  objectSetRows, objectSetSize, objectTypeIndexReport, saveObjectSet, searchObjects,
  type Json,
} from '@beacon/platform'

// ── the documented filter grammar, as types ────────────────────────────────

export type FilterValue =
  | { type: 'textFilter'; text: string }
  | { type: 'valuesFilter'; values: string[] }
  | { type: 'numberRangeFilter'; min?: number; max?: number }
  | { type: 'dateRangeFilter'; dateRangeFilter: { start?: string; end?: string } }

export type ExplorerFilter =
  | { type: 'propertyFilter'; propertyType: string; value: FilterValue }
  | { type: 'linkFilter'; linkType: string; value: { type: 'presenceFilter'; matchType: 'MUST_HAVE' | 'MUST_NOT_HAVE' } }

export interface SortSpec { property: string; direction: 'asc' | 'desc' }

export interface AggregateRow {
  group_value: string | null
  object_count: number
  sum: number | null
  average: number | null
  min: number | null
  max: number | null
  property_count: number
  unique_count: number
}

export interface HistogramBucket { bucket_min: number; bucket_max: number; object_count: number }

export type ObjectRow = Record<string, unknown>

// ── metadata ───────────────────────────────────────────────────────────────

export interface IndexInfo { object_type_id: string; state: string | null; object_count: number | null }

export function useIndexCounts() {
  return useQuery({
    queryKey: ['explorer', 'index-counts'],
    queryFn: async (): Promise<IndexInfo[]> => {
      // The count is only meaningful once the pipeline completed, so the state
      // travels with it rather than being inferred from a row existing.
      const rows = await client(objectTypeIndexReport).executeFunction({})
      return rows.map((r) => ({
        object_type_id: r.object_type_id, state: r.state, object_count: r.object_count,
      }))
    },
    staleTime: 30_000,
  })
}

export interface TypeGroup {
  id: string
  name: string
  description: string
  object_type_group_members: { object_type_id: string }[]
}

export function useTypeGroups() {
  return useQuery({
    queryKey: ['explorer', 'type-groups'],
    queryFn: async (): Promise<TypeGroup[]> => {
      const { data, error } = await supabase.from('type_groups')
        .select('id, name, description, object_type_group_members(object_type_id)')
        .order('name')
      if (error) throw new Error(error.message)
      return data as TypeGroup[]
    },
    staleTime: 30_000,
  })
}

// ── the engine ─────────────────────────────────────────────────────────────
// The readers are applied, not executed: since 746 a named read records
// itself in the usage ledger, which makes them writes under the client's
// volatility contract.

const filterKey = (filters: ExplorerFilter[]) => JSON.stringify(filters)

export function useObjectSetCount(typeId: string | null, filters: ExplorerFilter[]) {
  return useQuery({
    queryKey: ['explorer', 'count', typeId, filterKey(filters)],
    enabled: typeId !== null,
    queryFn: async (): Promise<number> => {
      return client(countObjectSet).applyAction({
        p_object_type: typeId as string, p_filters: filters as unknown as Json,
        p_application: 'object-explorer' })
    },
  })
}

export function useObjectSetRows(
  typeId: string | null, filters: ExplorerFilter[], sort: SortSpec[], limit = 100,
) {
  return useQuery({
    queryKey: ['explorer', 'rows', typeId, filterKey(filters), JSON.stringify(sort), limit],
    enabled: typeId !== null,
    queryFn: async (): Promise<ObjectRow[]> => {
      const rows = await client(evaluateObjectSet).applyAction({
        p_object_type: typeId as string, p_filters: filters as unknown as Json,
        p_sort: sort as unknown as Json, p_limit: limit, p_offset: 0,
        p_application: 'object-explorer' })
      return rows as ObjectRow[]
    },
  })
}

export function useObjectSetAggregate(
  typeId: string | null, filters: ExplorerFilter[], groupBy: string | null,
  aggProperty: string | null = null, limit = 5,
) {
  return useQuery({
    queryKey: ['explorer', 'agg', typeId, filterKey(filters), groupBy, aggProperty, limit],
    enabled: typeId !== null,
    queryFn: async (): Promise<AggregateRow[]> => {
      const rows = await client(aggregateObjectSet).applyAction({
        p_object_type: typeId as string, p_filters: filters as unknown as Json,
        p_group_by: groupBy ?? undefined, p_agg_property: aggProperty ?? undefined,
        p_sort_by: 'count', p_desc: true, p_limit: limit,
        p_application: 'object-explorer' })
      return rows as AggregateRow[]
    },
  })
}

export function useObjectSetHistogram(
  typeId: string | null, filters: ExplorerFilter[], property: string | null, buckets = 20,
) {
  return useQuery({
    queryKey: ['explorer', 'hist', typeId, filterKey(filters), property, buckets],
    enabled: typeId !== null && property !== null,
    queryFn: async (): Promise<HistogramBucket[]> => {
      const rows = await client(histogramObjectSet).applyAction({
        p_object_type: typeId as string, p_filters: filters as unknown as Json,
        p_property: property as string, p_buckets: buckets,
        p_application: 'object-explorer' })
      return rows as HistogramBucket[]
    },
  })
}

export interface SearchHit {
  object_type_id: string
  object_type_label: string
  primary_key: string
  title: string
}

/** The global bar: OpenSearch first — real Lucene, the documented syntax
 *  verbatim — falling back to the Postgres title reader (443) when the
 *  cluster is unreachable (the free tier sleeps after a quiet day). */
export function useGlobalSearch(query: string) {
  return useQuery({
    queryKey: ['explorer', 'search', query],
    enabled: query.trim().length > 0,
    queryFn: async (): Promise<SearchHit[]> => {
      const res: { data: unknown; error: unknown } = await supabase.functions.invoke('search-query', {
        body: { query, limit: 8 } })
      if (res.error === null && res.data !== null) return (res.data as { hits: SearchHit[] }).hits
      const rows = await client(searchObjects).executeFunction({ p_query: query, p_limit: 8 })
      return rows as SearchHit[]
    },
  })
}

// ── saved sets: dynamic Explorations, static Lists ─────────────────────────

export interface SavedSet {
  id: string
  name: string
  description: string
  set_kind: 'exploration' | 'list'
  subject_type_id: string | null
  project_id: string
  filters: ExplorerFilter[]
}

export function useSavedSets() {
  return useQuery({
    queryKey: ['explorer', 'saved-sets'],
    queryFn: async (): Promise<SavedSet[]> => {
      const { data, error } = await supabase.from('object_sets')
        .select('id, name, description, set_kind, subject_type_id, project_id, filters')
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)
      return data as SavedSet[]
    },
    staleTime: 30_000,
  })
}

export interface SaveSetInput {
  name: string
  description: string
  subjectTypeId: string
  projectId: string
  kind: 'exploration' | 'list'
  filters: ExplorerFilter[]
  /** "Only save N selected" — a list built from ticked rows. */
  primaryKeys?: string[]
}

export function useSaveObjectSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: SaveSetInput): Promise<string> =>
      client(saveObjectSet).applyAction({ p_set: {
        name: i.name, description: i.description, subject_type_id: i.subjectTypeId,
        project_id: i.projectId, set_kind: i.kind, filters: i.filters,
        ...(i.primaryKeys ? { primary_keys: i.primaryKeys } : {}),
      } as unknown as Json }),
    onSuccess: (_, i) => {
      void qc.invalidateQueries({ queryKey: ['explorer', 'saved-sets'] })
      toast.success(`Saved ${i.kind === 'list' ? 'list' : 'exploration'} "${i.name}"`)
    },
    onError: (e) => { toast.error(e.message) },
  })
}

export function useSavedSetRows(setId: string | null, limit = 100) {
  return useQuery({
    queryKey: ['explorer', 'saved-rows', setId, limit],
    enabled: setId !== null,
    queryFn: async (): Promise<ObjectRow[]> => {
      const rows = await client(objectSetRows).executeFunction({
        p_set: setId as string, p_limit: limit, p_offset: 0 })
      return rows as ObjectRow[]
    },
  })
}

export function useSavedSetSize(setId: string | null) {
  return useQuery({
    queryKey: ['explorer', 'saved-size', setId],
    enabled: setId !== null,
    queryFn: async (): Promise<number> =>
      client(objectSetSize).executeFunction({ p_set: setId as string }),
  })
}
