// The Links sub-tab's data: which concrete link types satisfy each interface
// link type constraint, for one implementing object type.
// "you must select a link type on the object type that satisfies each required
// link type constraint. You can also optionally provide a link mapping for any
// non-required link type constraints." (interfaces/implement-interface)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import { satisfyLinkConstraint } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'

export interface LinkSatisfactionRow {
  interface_id: string
  constraint_id: string
  link_type_id: string
}

/** A set per constraint, not a single value: the api types an implementation's
 *  `links` as a map to a list of link type api names. */
export function useLinkSatisfactions(objectTypeId: string) {
  return useQuery({
    queryKey: ['link-satisfactions', objectTypeId],
    queryFn: async (): Promise<LinkSatisfactionRow[]> => {
      const { data, error } = await supabase.from('interface_link_satisfactions')
        .select('interface_id, constraint_id, link_type_id')
        .eq('object_type_id', objectTypeId)
      if (error) throw new Error(error.message)
      return data as LinkSatisfactionRow[]
    },
  })
}

/** Sends the whole set for one constraint — the empty array is the wizard's
 *  "Skip", which is why there is no separate unsatisfy call. */
export function useSatisfyLinks(objectTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { interfaceId: string; constraintId: string; linkTypeIds: string[] }) =>
      client(satisfyLinkConstraint).applyAction({
        p_object_type: objectTypeId, p_interface: v.interfaceId,
        p_constraint: v.constraintId, p_link_types: v.linkTypeIds,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['link-satisfactions', objectTypeId] })
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
