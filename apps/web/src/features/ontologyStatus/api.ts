// Reading and writing developmental state on the resources that carry it.
//
// One writer for all three tables, because the columns, the guards and the
// cascade are identical (migration 321). A second implementation per table is
// how the object-type panel and everything else would drift apart.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { Deprecation, OntologyStatus, OntologyVisibility } from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'

/** The tables with status columns. `object_types` writes through its own hook,
 *  which also invalidates the type caches. */
export type StatusTable = 'link_types' | 'ontology_interfaces'

export interface StatusFields {
  status: OntologyStatus
  visibility: OntologyVisibility
  deprecation: Deprecation | null
}

interface Row {
  id: string
  status: OntologyStatus
  visibility: OntologyVisibility
  deprecation_reason: string | null
  deprecation_deadline: string | null
  replaced_by: string | null
}

export const toStatusFields = (r: Row): StatusFields => ({
  status: r.status,
  visibility: r.visibility,
  deprecation: r.deprecation_reason && r.deprecation_deadline
    ? { reason: r.deprecation_reason, deadline: r.deprecation_deadline, replacedBy: r.replaced_by }
    : null,
})

/** Status for every row of a table, keyed by id. One read backs a whole list. */
export function useStatuses(table: StatusTable) {
  return useQuery({
    queryKey: ['ontology-status', table],
    queryFn: async (): Promise<Map<string, StatusFields>> => {
      const { data, error } = await supabase.from(table)
        .select('id, status, visibility, deprecation_reason, deprecation_deadline, replaced_by')
      if (error) throw new Error(error.message)
      return new Map((data as Row[]).map((r) => [r.id, toStatusFields(r)]))
    },
    staleTime: 30_000,
  })
}

export function useSetStatus(table: StatusTable) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: { id: string } & StatusFields) => {
      const { error } = await supabase.from(table).update({
        status: i.status,
        visibility: i.visibility,
        // The database refuses a deprecation with no reason or deadline, and
        // clears the paperwork when the status leaves `deprecated`. Sending
        // nulls explicitly keeps the client from disagreeing with that.
        deprecation_reason:   i.status === 'deprecated' ? i.deprecation?.reason ?? null : null,
        deprecation_deadline: i.status === 'deprecated' ? i.deprecation?.deadline ?? null : null,
        replaced_by:          i.status === 'deprecated' ? i.deprecation?.replacedBy ?? null : null,
      }).eq('id', i.id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ontology-status', table] })
      // A link type's status follows the weaker of its two ends, in a trigger —
      // so an object type change can move rows here without this hook running.
      void qc.invalidateQueries({ queryKey: ['link-types'] })
      toast.success('Status updated')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
