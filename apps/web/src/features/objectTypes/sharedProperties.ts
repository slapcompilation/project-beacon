// Shared property CRUD. Definitions are org-scoped and admin-authored; a
// property on an object type points at one by api_name (migration 329).

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useComposeBranch } from '@/features/branching/api'
import { useAppStore } from '@/stores/app.store'
import { toast } from 'sonner'
import type { PropertyType, SharedPropertyDef } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { saveSharedProperty, deleteOntologyResource, type Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

interface Row {
  id: string
  ontology_id: string
  api_name: string
  label: string
  description: string
  base_type: PropertyType
  visibility: 'prominent' | 'normal' | 'hidden'
}

/** A definition plus the ontology it belongs to. `shared_properties.ontology_id`
 *  is NOT NULL, so "all shared properties" is never the right list to show. */
export interface SharedProperty extends SharedPropertyDef { ontologyId: string }

const toDef = (r: Row): SharedProperty => ({
  id: r.id, ontologyId: r.ontology_id, apiName: r.api_name,
  label: r.label, description: r.description, baseType: r.base_type,
  visibility: r.visibility,
})

const key = ['shared-properties'] as const

export function useSharedProperties() {
  const q = useQuery({
    queryKey: key,
    // Raw rows out of the query so the branch overlay (column-shaped fields)
    // composes BEFORE the def mapping — composing camelCase defs would corrupt.
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase.from('shared_properties').select('*').order('label')
      if (error) throw new Error(error.message)
      return data as Row[]
    },
    staleTime: 30_000,
  })
  const compose = useComposeBranch<Row>('shared_property', { visibility: 'normal', description: '' })
  const data = useMemo(() => compose(q.data ?? []).map(toDef), [q.data, compose])
  return { ...q, data }
}

/** Keyed by api_name — what `resolveProperty` folds into a property. */
export function useSharedPropertyMap(): Map<string, SharedPropertyDef> {
  const { data } = useSharedProperties()
  // Keyed by id: `object_type_properties.shared_property_id` is a foreign key
  // now, not the api name the jsonb used to carry.
  return new Map(data.map((d) => [d.id, d]))
}

export function useCreateSharedProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { apiName: string; label: string; description: string; baseType: PropertyType; ontologyId: string }) =>
      client(saveSharedProperty).applyAction({
        p_property: {
          api_name: i.apiName, label: i.label, description: i.description, base_type: i.baseType,
          ontology_id: i.ontologyId, project_id: useAppStore.getState().omaProjectId,
        } as unknown as Json,
        p_branch: useAppStore.getState().omaBranchId ?? undefined,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Staged — save to add it to the ontology')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Editing here moves every object type using it — that is the point. */
export function useUpdateSharedProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { id: string; label: string; description: string; visibility: SharedPropertyDef['visibility'] }) =>
      client(saveSharedProperty).applyAction({
        p_property: {
          id: i.id, label: i.label, description: i.description, visibility: i.visibility,
        } as unknown as Json,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Staged — this moves every object type using it on save')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteSharedProperty() {
  const qc = useQueryClient()
  return useMutation({
    // The database refuses this while any object type still inherits from it —
    // on save, now, rather than on the click.
    mutationFn: (id: string) =>
      client(deleteOntologyResource).applyAction({ p_kind: 'shared_property', p_id: id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Staged for deletion — save to apply it')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
