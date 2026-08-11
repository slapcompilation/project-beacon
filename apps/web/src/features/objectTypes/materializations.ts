// Materializations — the latest state of each object, written back to a dataset.
// "Navigate to the Materializations tab by toggling the Edits configuration in
// the Datasources tab in Ontology Manager." (object-edits/materializations)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { buildMaterialization } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import { toast } from 'sonner'

const key = (typeId: string) => ['materializations', typeId]

export interface MaterializationRow {
  id: string
  datasetId: string
  datasetName: string
  propagation: 'automatic' | 'periodic'
  builtAt: string | null
  /** True when no edit landed after the last build — the screenshot's
   *  "Up to date"; false is our "Stale", which Foundry's propagation would
   *  clear on its own and our missing worker does not. */
  upToDate: boolean
}

export function useMaterializations(typeId: string) {
  return useQuery({
    queryKey: key(typeId),
    queryFn: async (): Promise<MaterializationRow[]> => {
      const [{ data, error }, { data: lastEdit, error: e2 }] = await Promise.all([
        supabase.from('object_type_materializations')
          .select('id, dataset_id, propagation, built_at, datasets(name)')
          .eq('object_type_id', typeId).order('created_at'),
        supabase.from('object_edits').select('applied_at')
          .eq('object_type_id', typeId).order('seq', { ascending: false }).limit(1),
      ])
      if (error) throw new Error(error.message)
      if (e2) throw new Error(e2.message)
      const newest = lastEdit[0]?.applied_at as string | undefined
      return (data as unknown as {
        id: string; dataset_id: string; propagation: 'automatic' | 'periodic'
        built_at: string | null; datasets: { name: string } | null
      }[]).map((r) => ({
        id: r.id, datasetId: r.dataset_id, datasetName: r.datasets?.name ?? '',
        propagation: r.propagation, builtAt: r.built_at,
        upToDate: r.built_at !== null && (!newest || newest <= r.built_at),
      }))
    },
  })
}

/** The Edits configuration on the Datasources tab — the door to this tab. */
export function useEditsEnabled(typeId: string) {
  return useQuery({
    queryKey: ['edits-enabled', typeId],
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from('object_types')
        .select('edits_enabled').eq('id', typeId).single()
      if (error) throw new Error(error.message)
      return (data as { edits_enabled: boolean }).edits_enabled
    },
  })
}

export function useSetEditsEnabled(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from('object_types')
        .update({ edits_enabled: enabled }).eq('id', typeId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['edits-enabled', typeId] }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Output dataset + materialization row + first build, one flow. The output
 *  lands in the same project as the backing dataset — the dialog chooses only
 *  the rebuild interval, like the screenshot's. */
export function useCreateMaterialization(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { name: string; propagation: 'automatic' | 'periodic' }) => {
      const { data: src, error: e0 } = await supabase.from('object_type_datasources')
        .select('datasets(organization_id, project_id)').eq('object_type_id', typeId).limit(1)
      if (e0) throw new Error(e0.message)
      const home = (src as unknown as { datasets: { organization_id: string; project_id: string } | null }[])[0]?.datasets
      if (!home) throw new Error('Add a backing datasource first — the output dataset lands in its project.')

      const { data: ds, error: e1 } = await supabase.from('datasets')
        .insert({
          organization_id: home.organization_id, project_id: home.project_id,
          api_name: i.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_'), name: i.name,
        }).select('id').single()
      if (e1) throw new Error(e1.message)

      const { data: m, error: e2 } = await supabase.from('object_type_materializations')
        .insert({ object_type_id: typeId, dataset_id: (ds as { id: string }).id, propagation: i.propagation })
        .select('id').single()
      if (e2) throw new Error(e2.message)
      await client(buildMaterialization).applyAction({ p_materialization: (m as { id: string }).id })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(typeId) })
      toast.success('Object dataset created and built')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetPropagation(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id: string; propagation: 'automatic' | 'periodic' }) => {
      const { error } = await supabase.from('object_type_materializations')
        .update({ propagation: i.propagation }).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key(typeId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Stands in for the propagation worker we do not have: automatic/periodic are
 *  stored configuration, and this button is what runs the build meanwhile. */
export function useRebuildMaterialization(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => client(buildMaterialization).applyAction({ p_materialization: id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key(typeId) })
      toast.success('Rebuilt')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
