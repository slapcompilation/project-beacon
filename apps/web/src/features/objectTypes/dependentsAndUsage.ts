// Sections 5 and 7 of Foundry's object type Overview — Dependents and Usage.
// Both engines shipped this session (579, 580) with nothing rendering them, and
// CLAUDE.md's fourth question is "What reaches it? If nothing does, it is not
// built yet."
//
// Dependents counts APPLICATIONS that consume an object type. The kinds a
// panel shows are the ones the platform has, so ours lists two where Foundry
// lists nine — `curating-apps` scopes the application list per enrollment, and
// the rendered zeroes are kinds the platform HAS and this type does not use.
//
// Usage is reads and writes over 30 days. It is opt-in per ontology, and OFF
// IS NOT ZERO: `view-usage` warns that with metrics disabled you see "No usage
// for the last 30 days" for everything, so the surface must distinguish an
// ontology with no traffic from one that never switched metrics on.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  objectTypeDependentCounts, objectTypeDependents,
  ontologyUsageSummary, ontologyUsageByApplication,
} from '@beacon/platform'

/** A dependent kind with its count — the left pane, zeroes included. */
export interface DependentCount {
  kind: string
  label: string
  dependents: number
}

/** One consuming application — the right pane. */
export interface Dependent {
  kind: string
  dependent_id: string
  name: string
}

export function useDependentCounts(typeId: string) {
  return useQuery({
    queryKey: ['object-type-dependents', typeId, 'counts'],
    queryFn: async () =>
      await client(objectTypeDependentCounts)
        .executeFunction({ p_object_type: typeId }) as unknown as DependentCount[],
  })
}

export function useDependents(typeId: string) {
  return useQuery({
    queryKey: ['object-type-dependents', typeId, 'list'],
    queryFn: async () =>
      await client(objectTypeDependents)
        .executeFunction({ p_object_type: typeId }) as unknown as Dependent[],
  })
}

export interface UsageSummary {
  interactions: number
  reads: number
  writes: number
  active_users: number
  last_interaction: string | null
}

export interface UsageByApplication {
  application: string
  reads: number
  writes: number
}

/** Whether this ontology records usage at all, and since when. The surface
 *  needs both: metrics that were switched on yesterday cannot answer a
 *  thirty-day question, which is the distinction that keeps a cleanup queue
 *  from proposing to delete an entire ontology. */
export function useMetricsState(ontologyId: string | null) {
  return useQuery({
    queryKey: ['ontology-metrics-state', ontologyId],
    enabled: Boolean(ontologyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ontologies')
        .select('metrics_enabled, metrics_enabled_at')
        .eq('id', ontologyId ?? '')
        .single<{ metrics_enabled: boolean; metrics_enabled_at: string | null }>()
      if (error) throw error
      const since = data.metrics_enabled_at ? new Date(data.metrics_enabled_at) : null
      const covers30d = Boolean(
        data.metrics_enabled && since &&
        Date.now() - since.getTime() >= 30 * 24 * 60 * 60 * 1000,
      )
      return { enabled: data.metrics_enabled, since, covers30d }
    },
  })
}

export function useUsageSummary(typeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['object-type-usage', typeId, 'summary'],
    enabled,
    queryFn: async () => {
      const rows = await client(ontologyUsageSummary)
        .executeFunction({ p_object_type: typeId, p_days: 30 }) as unknown as UsageSummary[]
      return rows[0] ?? null
    },
  })
}

export function useUsageByApplication(typeId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['object-type-usage', typeId, 'applications'],
    enabled,
    queryFn: async () =>
      await client(ontologyUsageByApplication)
        .executeFunction({ p_object_type: typeId, p_days: 30 }) as unknown as UsageByApplication[],
  })
}
