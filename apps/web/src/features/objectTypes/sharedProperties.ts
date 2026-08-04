// Shared property CRUD. Definitions are org-scoped and admin-authored; a
// property on an object type points at one by api_name (migration 329).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { PropertyType, SharedPropertyDef } from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'

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
  return new Map(data.map((d) => [d.apiName, d]))
}

export function useCreateSharedProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { apiName: string; label: string; description: string; baseType: PropertyType }) => {
      const { error } = await supabase.from('shared_properties').insert({
        api_name: i.apiName, label: i.label, description: i.description, base_type: i.baseType,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); toast.success('Shared property created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Editing here moves every object type using it — that is the point. */
export function useUpdateSharedProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id: string; label: string; description: string; visibility: SharedPropertyDef['visibility'] }) => {
      const { error } = await supabase.from('shared_properties')
        .update({ label: i.label, description: i.description, visibility: i.visibility, updated_at: new Date().toISOString() })
        .eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      toast.success('Updated everywhere it is used')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteSharedProperty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // The database refuses this while any object type still inherits from it.
      const { error } = await supabase.from('shared_properties').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: key }); toast.success('Shared property deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
