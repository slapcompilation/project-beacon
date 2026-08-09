// Shared property CRUD. Definitions are org-scoped and admin-authored; a
// property on an object type points at one by api_name (migration 329).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PropertyType, SharedPropertyDef } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { saveSharedProperty, deleteOntologyResource, type Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

interface Row {
  id: string
  organization_id: string
  api_name: string
  label: string
  description: string
  base_type: PropertyType
  visibility: 'prominent' | 'normal' | 'hidden'
}

const toDef = (r: Row): SharedPropertyDef => ({
  id: r.id, organizationId: r.organization_id, apiName: r.api_name,
  label: r.label, description: r.description, baseType: r.base_type,
  visibility: r.visibility,
})

const key = ['shared-properties'] as const

export function useSharedProperties() {
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<SharedPropertyDef[]> => {
      const { data, error } = await supabase.from('shared_properties').select('*').order('label')
      if (error) throw new Error(error.message)
      return (data as Row[]).map(toDef)
    },
    staleTime: 30_000,
  })
}

/** Keyed by api_name — what `resolveProperty` folds into a property. */
export function useSharedPropertyMap(): Map<string, SharedPropertyDef> {
  const { data = [] } = useSharedProperties()
  // Keyed by id: `object_type_properties.shared_property_id` is a foreign key
  // now, not the api name the jsonb used to carry.
  return new Map(data.map((d) => [d.id, d]))
}

export function useCreateSharedProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { apiName: string; label: string; description: string; baseType: PropertyType }) =>
      client(saveSharedProperty).applyAction({
        p_property: {
          api_name: i.apiName, label: i.label, description: i.description, base_type: i.baseType,
        } as unknown as Json,
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
