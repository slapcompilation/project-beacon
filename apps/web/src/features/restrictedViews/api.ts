// Restricted views — "a special kind of dataset where granular access to the
// data within the file is controlled based on defined rules"
// (security/restricted-views). The database owns the grammar, the weights and
// the enforcement (migrations 483–485); these hooks carry rows and refusals.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'
import {
  datasetCurrentFields, effectiveDataMarkings, effectiveFileMarkings, restrictedViewMarkings,
} from '@beacon/platform'
import type { Json } from '@beacon/platform'

// The policy grammar of migration 483, flat form. The database also accepts
// one nested group; the composer builds flat and the JSON tab shows whatever
// is stored.
export type PolicyTerm =
  | { user_attribute: string }
  | { column: string }
  | { value: unknown }

export interface PolicyComparison {
  left: PolicyTerm
  comparison: string
  right: PolicyTerm
}

export interface Policy {
  match: 'all' | 'any'
  rules: PolicyComparison[]
}

/** The supported user attributes, labelled as manage-granular-policies lists
 *  them. Collections marked so the composer can pick sensible comparisons. */
export const USER_ATTRIBUTES: { id: string; label: string; collection: boolean }[] = [
  { id: 'user_id', label: "User ID", collection: false },
  { id: 'username', label: 'Username', collection: false },
  { id: 'group_ids', label: 'Group IDs', collection: true },
  { id: 'group_names', label: 'Group names', collection: true },
  { id: 'authorized_group_ids', label: 'Authorized group IDs', collection: true },
  { id: 'organization_marking_ids', label: 'Organization Marking IDs', collection: true },
  { id: 'marking_ids', label: 'Markings', collection: true },
]

export const COMPARISONS: { id: string; label: string }[] = [
  { id: 'equal', label: 'is equal to' },
  { id: 'intersects', label: 'intersects' },
  { id: 'subset_of', label: 'is a subset of' },
  { id: 'superset_of', label: 'is a superset of' },
  { id: 'less_than', label: 'is less than' },
  { id: 'less_than_or_equal', label: 'is at most' },
  { id: 'greater_than_or_equal', label: 'is at least' },
  { id: 'greater_than', label: 'is greater than' },
]

export interface RestrictedView {
  id: string
  rid: string
  apiName: string
  name: string
  projectId: string
  projectName: string
  inputDatasetId: string
  inputDatasetName: string
  policy: Policy
  createdAt: string
}

export interface DatasetField { name: string; type: string }

const keys = {
  all: ['restricted-views'] as const,
  fields: (ds: string) => ['dataset-fields', ds] as const,
  inputMarkings: (ds: string) => ['input-markings', ds] as const,
  viewMarkings: (rv: string) => ['rv-markings', rv] as const,
}

export function useRestrictedViews() {
  return useQuery({
    queryKey: keys.all,
    queryFn: async (): Promise<RestrictedView[]> => {
      const { data, error } = await supabase.from('restricted_views')
        .select('id, rid, api_name, name, project_id, input_dataset_id, policy, created_at, datasets(name), projects(name)')
        .order('name')
      if (error) throw new Error(error.message)
      return (data as unknown as {
        id: string; rid: string; api_name: string; name: string; project_id: string
        input_dataset_id: string; policy: Policy; created_at: string
        datasets: { name: string } | null; projects: { name: string } | null
      }[]).map((r) => ({
        id: r.id, rid: r.rid, apiName: r.api_name, name: r.name,
        projectId: r.project_id, projectName: r.projects?.name ?? '',
        inputDatasetId: r.input_dataset_id, inputDatasetName: r.datasets?.name ?? '',
        policy: r.policy, createdAt: r.created_at,
      }))
    },
    staleTime: 30_000,
  })
}

/** The backing dataset's current committed schema — what "Column name" means:
 *  "A column in the restricted views backing dataset." */
export function useDatasetFields(datasetId: string | null) {
  return useQuery({
    queryKey: keys.fields(datasetId ?? ''),
    enabled: !!datasetId,
    queryFn: async (): Promise<DatasetField[]> => {
      const fields = await client(datasetCurrentFields).executeFunction({ p_dataset: datasetId as string })
      return (fields as unknown as DatasetField[] | null) ?? []
    },
    staleTime: 30_000,
  })
}

async function markingNames(ids: string[]): Promise<{ id: string; name: string }[]> {
  if (ids.length === 0) return []
  const { data } = await supabase.from('markings').select('id, name').in('id', ids)
  return (data as { id: string; name: string }[] | null ?? [])
}

/** What the input dataset carries — its own file markings plus the data
 *  markings that flowed to it. The "Review access requirements" step. */
export function useInputMarkings(datasetId: string | null) {
  return useQuery({
    queryKey: keys.inputMarkings(datasetId ?? ''),
    enabled: !!datasetId,
    queryFn: async () => {
      const [file, flowed] = await Promise.all([
        client(effectiveFileMarkings).executeFunction({ p_kind: 'dataset', p_id: datasetId as string }),
        client(effectiveDataMarkings).executeFunction({ p_dataset: datasetId as string }),
      ])
      const ids = [...new Set([...file, ...flowed])]
      return markingNames(ids)
    },
    staleTime: 30_000,
  })
}

/** What still marks a saved view after severing. */
export function useViewMarkings(viewId: string | null) {
  return useQuery({
    queryKey: keys.viewMarkings(viewId ?? ''),
    enabled: !!viewId,
    queryFn: async () => {
      const ids = await client(restrictedViewMarkings).executeFunction({ p_view: viewId as string })
      return markingNames(ids)
    },
    staleTime: 15_000,
  })
}

export function useCreateRestrictedView() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: {
      apiName: string; name: string; projectId: string; inputDatasetId: string
      policy: Policy; severedMarkingIds: string[]
    }) => {
      const { data, error } = await supabase.from('restricted_views')
        .insert({
          api_name: i.apiName, name: i.name, project_id: i.projectId,
          input_dataset_id: i.inputDatasetId, policy: i.policy as unknown as Json,
        })
        .select('id').single<{ id: string }>()
      if (error) throw new Error(error.message)
      for (const markingId of i.severedMarkingIds) {
        const { error: stopError } = await supabase.from('restricted_view_marking_stops')
          .insert({ restricted_view_id: data.id, marking_id: markingId })
        if (stopError) throw new Error(stopError.message)
      }
      return data.id
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Restricted view created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useUpdatePolicy(viewId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (policy: Policy) => {
      const { error } = await supabase.from('restricted_views')
        .update({ policy: policy as unknown as Json }).eq('id', viewId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Policy updated') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
