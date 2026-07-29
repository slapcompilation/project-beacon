// pending_action_approvals — soft-violating actions waiting for org approval.
// Persistence layer used by dispatch.ts (writes) and PendingApprovalsPage (reads + decides).

import { supabase } from '@/lib/supabase/client'
import type { TriggeredBy } from '@beacon/reality-graph'

export type PendingStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface PendingViolation {
  constraintId: string
  message:      string
  severity:     'hard' | 'soft'
  ruleType?:    string
}

export interface PendingApprovalRow {
  id:                     string
  hotel_id:               string
  organization_id:        string | null
  action_type:            string
  action_payload:         Record<string, unknown>
  violations:             PendingViolation[]
  original_triggered_by:  TriggeredBy
  original_actor_id:      string | null
  status:                 PendingStatus
  requested_by_user_id:   string | null
  decided_by_user_id:     string | null
  decided_at:             string | null
  decision_note:          string | null
  created_at:             string
}

export interface CreatePendingApprovalInput {
  hotelId:              string
  organizationId?:      string | null
  actionType:           string
  actionPayload:        Record<string, unknown>
  violations:           PendingViolation[]
  originalTriggeredBy:  TriggeredBy
  originalActorId:      string | null
  requestedByUserId:    string
}

export async function createPendingApproval(input: CreatePendingApprovalInput): Promise<PendingApprovalRow> {
  const { data, error } = await supabase
    .from('pending_action_approvals')
    .insert({
      hotel_id:              input.hotelId,
      organization_id:       input.organizationId ?? null,
      action_type:           input.actionType,
      action_payload:        input.actionPayload,
      violations:            input.violations,
      original_triggered_by: input.originalTriggeredBy,
      original_actor_id:     input.originalActorId,
      requested_by_user_id:  input.requestedByUserId,
    })
    .select('*')
    .single<PendingApprovalRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchPendingApprovals(hotelId: string): Promise<PendingApprovalRow[]> {
  const { data, error } = await supabase
    .from('pending_action_approvals')
    .select('*')
    .eq('hotel_id', hotelId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .overrideTypes<PendingApprovalRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export interface DecidePendingApprovalInput {
  id:                  string
  status:              'approved' | 'rejected'
  decidedByUserId:     string
  decisionNote?:       string | null
}

export async function decidePendingApproval(input: DecidePendingApprovalInput): Promise<void> {
  const { error } = await supabase
    .from('pending_action_approvals')
    .update({
      status:             input.status,
      decided_by_user_id: input.decidedByUserId,
      decided_at:         new Date().toISOString(),
      decision_note:      input.decisionNote ?? null,
    })
    .eq('id', input.id)
  if (error) throw new Error(error.message)
}
