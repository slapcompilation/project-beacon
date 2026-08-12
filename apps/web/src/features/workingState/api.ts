// The work-in-progress state — everything edited and not yet saved.
//
// "Any changes you make in the Ontology Manager are stored locally in a
// work-in-progress state. For these Ontology changes to be available for others
// and reflected in user-facing applications, you must save your changes."
//
// One entry per resource, the diff inside it per field. Nothing here writes to
// the ontology; `save` is the only thing that does.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'
import {
  saveWorkingState, discardWorkingState, workingStateConflicts, updateWorkingState,
  type Json,
} from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import { useAppStore } from '@/stores/app.store'

export type ResourceKind =
  | 'object_type' | 'link_type' | 'shared_property'
  | 'interface' | 'action_type' | 'type_group'

export interface WorkingEntry {
  id: string
  resourceKind: ResourceKind
  resourceId: string
  operation: 'created' | 'modified' | 'deleted'
  /** What I want each field to be. `properties` and `datasources` are sections. */
  fields: Record<string, unknown>
  /** What those fields held when I first touched them. */
  base: Record<string, unknown>
  updatedAt: string
}

interface EntryRow {
  id: string; resource_kind: ResourceKind; resource_id: string
  operation: WorkingEntry['operation']
  fields: Record<string, unknown>; base: Record<string, unknown>
  updated_at: string
}

const KEY = ['working-state']

export function useWorkingState() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<WorkingEntry[]> => {
      const { data, error } = await supabase
        .from('working_state_changes')
        .select('id, resource_kind, resource_id, operation, fields, base, updated_at')
        .is('branch_id', null)
        .order('created_at')
      if (error) throw new Error(error.message)
      return (data as EntryRow[]).map((r) => ({
        id: r.id, resourceKind: r.resource_kind, resourceId: r.resource_id,
        operation: r.operation, fields: r.fields, base: r.base, updatedAt: r.updated_at,
      }))
    },
  })
}

export interface Conflict {
  resource_kind: ResourceKind
  resource_id: string
  field: string
  base_value: unknown
  mine: unknown
  theirs: unknown
}

/** Fields somebody else moved while I was editing. Empty is the normal case —
 *  everything that does not overlap merges without asking. */
export function useWorkingStateConflicts() {
  return useQuery({
    queryKey: [...KEY, 'conflicts'],
    queryFn: async (): Promise<Conflict[]> =>
      (await client(workingStateConflicts).executeFunction({})) as unknown as Conflict[],
  })
}

/** The dialog lists the fields but offers one pair of buttons per entity, so a
 *  choice is per resource. */
export type Choice = 'latest' | 'mine'
export interface Resolution { resource_kind: ResourceKind; resource_id: string; choice: Choice }

export function useUpdateWorkingState() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (resolutions: Resolution[]) =>
      client(updateWorkingState).applyAction({ p_resolutions: resolutions as unknown as Json }),
    onSuccess: () => {
      invalidateAll(qc)
      toast.success('Updated to the latest ontology')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Every query that reads the ontology or the state it is pending in. */
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: KEY })
  void qc.invalidateQueries({ queryKey: ['object-types'] })
  void qc.invalidateQueries({ queryKey: ['action-types'] })
  void qc.invalidateQueries({ queryKey: ['ontologies'] })
  void qc.invalidateQueries({ queryKey: ['object-type-indexes'] })
}

export function useSaveWorkingState() {
  const qc = useQueryClient()
  return useMutation({
    // On a branch, the save is the branch save — validation composed, main
    // untouched (461). On main it is what it always was.
    mutationFn: () => client(saveWorkingState).applyAction(
      { p_branch: useAppStore.getState().omaBranchId ?? undefined }),
    onSuccess: (n) => {
      invalidateAll(qc)
      toast.success(n === 1 ? '1 resource saved to the ontology' : `${n} resources saved to the ontology`)
    },
    // The namespaced errors are the useful half — StaleWorkingState and
    // SaveBlockedByErrors both mean "nothing was written", and say why.
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDiscardWorkingState() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (target?: { kind: ResourceKind; id: string }) =>
      client(discardWorkingState).applyAction(
        target ? { p_kind: target.kind, p_id: target.id } : {},
      ),
    onSuccess: (n, target) => {
      invalidateAll(qc)
      toast.success(target ? 'Changes discarded' : `${n} entries discarded`)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
