// Type groups gain their writer (creation review F6.6): the schema and the
// Explorer's group sections have existed since the tables did, with no
// surface able to create a group or put a type in one — the home page could
// only ever show "All object types".

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

export interface TypeGroup {
  id: string
  name: string
  memberIds: string[]
}

const KEY = (ont: string) => ['type-groups', ont] as const

export function useTypeGroups(ontologyId: string | null) {
  return useQuery({
    queryKey: KEY(ontologyId ?? ''),
    enabled: ontologyId !== null,
    queryFn: async (): Promise<TypeGroup[]> => {
      const { data, error } = await supabase.from('type_groups')
        .select('id, name, object_type_group_members(object_type_id)')
        .eq('ontology_id', ontologyId ?? '').order('name')
      if (error) throw new Error(error.message)
      return (data as {
        id: string; name: string
        object_type_group_members: { object_type_id: string }[]
      }[]).map((r) => ({
        id: r.id, name: r.name,
        memberIds: r.object_type_group_members.map((m) => m.object_type_id),
      }))
    },
  })
}

export function useTypeGroupOps(ontologyId: string) {
  const qc = useQueryClient()
  const invalidate = () => { void qc.invalidateQueries({ queryKey: KEY(ontologyId) }) }
  const onError = (e: Error) => { toast.error(e.message) }
  return {
    create: useMutation({
      mutationFn: async (name: string) => {
        const { error } = await supabase.from('type_groups')
          .insert({ ontology_id: ontologyId, name: name.trim() })
        if (error) throw new Error(error.message)
      },
      onSuccess: () => { invalidate(); toast.success('Group created') },
      onError,
    }),
    addMember: useMutation({
      mutationFn: async (i: { groupId: string; objectTypeId: string }) => {
        const { error } = await supabase.from('object_type_group_members')
          .insert({ type_group_id: i.groupId, object_type_id: i.objectTypeId })
        if (error) throw new Error(error.message)
      },
      onSuccess: invalidate, onError,
    }),
    removeMember: useMutation({
      mutationFn: async (i: { groupId: string; objectTypeId: string }) => {
        const { error } = await supabase.from('object_type_group_members')
          .delete().eq('type_group_id', i.groupId).eq('object_type_id', i.objectTypeId)
        if (error) throw new Error(error.message)
      },
      onSuccess: invalidate, onError,
    }),
  }
}
