// cases — AIP workflow envelope. Ties an input (alert / agent run / note)
// to N agent proposals + a final outcome.

import { supabase } from '@/lib/supabase/client'

export type CaseStatus = 'open' | 'in_review' | 'resolved' | 'closed'

export interface CaseInputRef {
  kind: 'alert' | 'agent_run' | 'note' | 'proposal' | 'manual'
  ref:  string
}

export interface CaseOutcome {
  action_type: string
  summary:     string
}

export interface CaseRow {
  id:                   string
  hotel_id:             string
  organization_id:      string | null
  title:                string
  status:               CaseStatus
  input_refs:           CaseInputRef[]
  proposal_ids:         string[]
  outcome:              CaseOutcome | null
  opened_by_user_id:    string
  resolved_by_user_id:  string | null
  resolved_at:          string | null
  created_at:           string
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function fetchCases(hotelId: string, statusFilter?: CaseStatus | null): Promise<CaseRow[]> {
  let q = supabase
    .from('cases')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
  if (statusFilter) q = q.eq('status', statusFilter)
  const { data, error } = await q.overrideTypes<CaseRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchCase(id: string): Promise<CaseRow | null> {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .eq('id', id)
    .maybeSingle<CaseRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchCasesForProposal(proposalId: string): Promise<CaseRow[]> {
  const { data, error } = await supabase
    .from('cases')
    .select('*')
    .contains('proposal_ids', [proposalId])
    .overrideTypes<CaseRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export interface CreateCaseInput {
  hotelId:          string
  organizationId?:  string | null
  title:            string
  inputRefs?:       CaseInputRef[]
  proposalIds?:     string[]
  openedByUserId:   string
}

export async function createCase(input: CreateCaseInput): Promise<CaseRow> {
  const { data, error } = await supabase
    .from('cases')
    .insert({
      hotel_id:          input.hotelId,
      organization_id:   input.organizationId ?? null,
      title:             input.title,
      input_refs:        input.inputRefs ?? [],
      proposal_ids:      input.proposalIds ?? [],
      opened_by_user_id: input.openedByUserId,
    })
    .select('*')
    .single<CaseRow>()
  if (error) throw new Error(error.message)
  return data
}

export interface TransitionCaseInput {
  id:                  string
  status:              CaseStatus
  resolvedByUserId?:   string | null
  outcome?:            CaseOutcome | null
}

export async function transitionCase(input: TransitionCaseInput): Promise<void> {
  const updates: Record<string, unknown> = { status: input.status }
  if (input.status === 'resolved' || input.status === 'closed') {
    updates.resolved_at         = new Date().toISOString()
    updates.resolved_by_user_id = input.resolvedByUserId ?? null
    if (input.outcome) updates.outcome = input.outcome
  } else {
    updates.resolved_at         = null
    updates.resolved_by_user_id = null
  }
  const { error } = await supabase
    .from('cases')
    .update(updates)
    .eq('id', input.id)
  if (error) throw new Error(error.message)
}

export async function attachProposalToCase(caseId: string, proposalId: string): Promise<void> {
  const { error } = await supabase.rpc('attach_proposal_to_case', {
    p_case_id:     caseId,
    p_proposal_id: proposalId,
  })
  if (error) throw new Error(error.message)
}

export async function detachProposalFromCase(caseId: string, proposalId: string): Promise<void> {
  const { error } = await supabase.rpc('detach_proposal_from_case', {
    p_case_id:     caseId,
    p_proposal_id: proposalId,
  })
  if (error) throw new Error(error.message)
}
