// Authored action types + their action log.
//
// Foundry's action log is "one-to-one with action types. Submitting an action
// generates a single new object of the corresponding action log object type."
// Ours is one append-only row per submission, which the database refuses to
// update or delete.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type {
  AuthoredActionDef, AuthoredActionOperation, AuthoredActionParameter,
  SubmissionCriterion,
} from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'

interface Row {
  id: string
  organization_id: string
  hotel_id: string | null
  name: string
  api_name: string
  description: string
  subject_type_id: string
  operation: AuthoredActionOperation
  parameters: AuthoredActionParameter[]
  submission_criteria: SubmissionCriterion[]
  invocation_mode: 'open-form' | 'apply-immediately'
  approval_tier: 'self' | 'hotel-admin' | 'org-director'
  enabled: boolean
}

const toDef = (r: Row): AuthoredActionDef => ({
  id: r.id, organizationId: r.organization_id, hotelId: r.hotel_id,
  name: r.name, apiName: r.api_name, description: r.description,
  subjectTypeId: r.subject_type_id, operation: r.operation,
  parameters: r.parameters, submissionCriteria: r.submission_criteria,
  invocationMode: r.invocation_mode, approvalTier: r.approval_tier, enabled: r.enabled,
})

const keys = {
  all: ['authored-actions'] as const,
  log: (id: string) => ['authored-action-log', id] as const,
}

export function useAuthoredActions() {
  return useQuery({
    queryKey: keys.all,
    queryFn: async (): Promise<AuthoredActionDef[]> => {
      const { data, error } = await supabase.from('user_action_types').select('*').order('name')
      if (error) throw new Error(error.message)
      return (data as Row[]).map(toDef)
    },
    staleTime: 30_000,
  })
}

export interface CreateActionTypeInput {
  name: string
  apiName: string
  description: string
  subjectTypeId: string
  operation: AuthoredActionOperation
  parameters: AuthoredActionParameter[]
  submissionCriteria: SubmissionCriterion[]
  invocationMode: 'open-form' | 'apply-immediately'
  approvalTier: 'self' | 'hotel-admin' | 'org-director'
}

export function useCreateActionType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (i: CreateActionTypeInput) => {
      const { error } = await supabase.from('user_action_types').insert({
        name: i.name, api_name: i.apiName, description: i.description,
        subject_type_id: i.subjectTypeId, operation: i.operation,
        parameters: i.parameters, submission_criteria: i.submissionCriteria,
        invocation_mode: i.invocationMode, approval_tier: i.approvalTier,
      })
      // Actions:NameIsShipped and Actions:SubjectIsCodeOwned arrive here as
      // messages; both already read as sentences, so they surface unchanged.
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Action type created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteActionType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('user_action_types').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.all }); toast.success('Action type deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export interface ActionLogEntry {
  id: string
  operation: AuthoredActionOperation
  parameters: Record<string, unknown>
  previous: Record<string, unknown> | null
  triggeredBy: string
  createdAt: string
  recordId: string | null
}

/** The decisions this action type has taken. Append-only by trigger — a
 *  correction is another row, never an edit. */
export function useActionLog(actionTypeId: string | null) {
  return useQuery({
    queryKey: keys.log(actionTypeId ?? ''),
    enabled: !!actionTypeId,
    queryFn: async (): Promise<ActionLogEntry[]> => {
      const { data, error } = await supabase.from('user_action_log')
        .select('id, operation, parameters, previous, triggered_by, created_at, record_id')
        .eq('action_type_id', actionTypeId ?? '')
        .order('created_at', { ascending: false }).limit(50)
      if (error) throw new Error(error.message)
      interface LogRow {
        id: string; operation: AuthoredActionOperation; parameters: Record<string, unknown>
        previous: Record<string, unknown> | null; triggered_by: string
        created_at: string; record_id: string | null
      }
      return (data as LogRow[]).map((r) => ({
        id: r.id, operation: r.operation, parameters: r.parameters, previous: r.previous,
        triggeredBy: r.triggered_by, createdAt: r.created_at, recordId: r.record_id,
      }))
    },
    staleTime: 15_000,
  })
}
