// Submission criteria: the tree 421 stored, the evaluator 602 completed, and
// until now nothing that reads either.
//
// "Submission criteria (formerly known as validations) are the conditions that
// determine whether an action can be submitted" — action-types/submission-criteria.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { canWriteActionType, submissionOperators } from '@beacon/platform'
import { supabase } from '@/lib/supabase/client'
import { client } from '@/lib/supabase/ontologyClient'

export type NodeType = 'condition' | 'logical'
export type LogicalOperator = 'all' | 'any' | 'none'
export type Template = 'current_user' | 'parameter'
export type UserField = 'user_id' | 'group_ids' | 'attribute'
export type ValueSource = 'parameter' | 'static' | 'none'

export interface CriterionRow {
  id: string
  action_type_id: string
  parent_id: string | null
  position: number
  node_type: NodeType
  logical_operator: LogicalOperator | null
  template: Template | null
  parameter_id: string | null
  user_field: UserField | null
  attribute_name: string | null
  operator: string | null
  value_source: ValueSource | null
  value_parameter_id: string | null
  static_value: unknown
  failure_message: string | null
}

/** `submission_operators()` is the page's two tables — five single-value
 *  operators and five for parameters with multiple values. The arity is why the
 *  picker can say "Only showing compatible operators". */
export interface SubmissionOperator { operator: string; arity: 'single' | 'multi'; note: string }

const keys = {
  tree: (actionTypeId: string) => ['submission-criteria', actionTypeId] as const,
  operators: ['submission-operators'] as const,
}

export function useCriteria(actionTypeId: string | null) {
  return useQuery({
    queryKey: keys.tree(actionTypeId ?? ''),
    enabled: actionTypeId !== null,
    queryFn: async (): Promise<CriterionRow[]> => {
      const { data, error } = await supabase.from('action_type_submission_criteria')
        .select('*').eq('action_type_id', actionTypeId ?? '').order('position')
      if (error) throw new Error(error.message)
      return data as CriterionRow[]
    },
  })
}

/** "action submission criteria are hidden from users who cannot edit action
 *  types" — 607 narrowed the policy, so a viewer reads an empty tree. Asking
 *  first is the difference between "hidden" and "there are none". */
export function useCanEditActionType(actionTypeId: string | null) {
  return useQuery({
    queryKey: ['can-write-action-type', actionTypeId],
    enabled: actionTypeId !== null,
    staleTime: 60_000,
    queryFn: () => client(canWriteActionType).executeFunction({ p_action: actionTypeId as string }),
  })
}

export function useSubmissionOperators() {
  return useQuery({
    queryKey: keys.operators,
    staleTime: Infinity,
    queryFn: async (): Promise<SubmissionOperator[]> => {
      const rows = await client(submissionOperators).executeFunction({})
      return rows.map((r) => ({ ...r, arity: r.arity === 'multi' ? 'multi' : 'single' }))
    },
  })
}

function invalidate(qc: ReturnType<typeof useQueryClient>, actionTypeId: string) {
  void qc.invalidateQueries({ queryKey: keys.tree(actionTypeId) })
}

export function useAddCriterion(actionTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (n: Partial<CriterionRow> & { node_type: NodeType }) => {
      const { data: siblings } = await supabase.from('action_type_submission_criteria')
        .select('position').eq('action_type_id', actionTypeId)
        .is('parent_id', n.parent_id ?? null)
      const next = Math.max(-1, ...((siblings ?? []) as { position: number }[]).map((s) => s.position)) + 1
      const { error } = await supabase.from('action_type_submission_criteria')
        .insert({ ...n, action_type_id: actionTypeId, position: next })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, actionTypeId) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useUpdateCriterion(actionTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CriterionRow> & { id: string }) => {
      const { error } = await supabase.from('action_type_submission_criteria')
        .update(patch).eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, actionTypeId) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteCriterion(actionTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('action_type_submission_criteria').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { invalidate(qc, actionTypeId) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Children of a node, in position order. A null parent is a root, and the
 *  roots conjoin — `submission_criteria_verdict` returns the first failure. */
export const childrenOf = (rows: CriterionRow[], parent: string | null): CriterionRow[] =>
  rows.filter((r) => r.parent_id === parent).sort((a, b) => a.position - b.position)

/** The second card on the Security & Submission Criteria tab. Foundry's
 *  `Frontend consumers` is a SET — object-monitors names a second switch for
 *  object monitors — and Automate is the only consumer we have. */
export function useAutomateCanSubmit(actionTypeId: string | null) {
  return useQuery({
    queryKey: ['automate-can-submit', actionTypeId],
    enabled: actionTypeId !== null,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from('action_types')
        .select('automate_can_submit').eq('id', actionTypeId ?? '').single()
      if (error) throw new Error(error.message)
      return (data as { automate_can_submit: boolean }).automate_can_submit
    },
  })
}

export function useSetAutomateCanSubmit(actionTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (allowed: boolean) => {
      const { error } = await supabase.from('action_types')
        .update({ automate_can_submit: allowed }).eq('id', actionTypeId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['automate-can-submit', actionTypeId] }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The Form tab's Allow-revert toggle (682). "New actions are revertible by
 *  default" — and turning it off clears revertibility on submissions that
 *  already happened, which the database does, not this. */
export function useAllowRevert(actionTypeId: string | null) {
  return useQuery({
    queryKey: ['allow-revert', actionTypeId],
    enabled: actionTypeId !== null,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from('action_types')
        .select('allow_revert').eq('id', actionTypeId ?? '').single()
      if (error) throw new Error(error.message)
      return (data as { allow_revert: boolean }).allow_revert
    },
  })
}

export function useSetAllowRevert(actionTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (allowed: boolean) => {
      const { error } = await supabase.from('action_types')
        .update({ allow_revert: allowed }).eq('id', actionTypeId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['allow-revert', actionTypeId] }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
