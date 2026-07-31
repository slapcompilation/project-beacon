// proposals table — persistence for AgentProposal nodes.
// Append-mostly: status flips through decide(); refinement chains via parent_version_id.

import { supabase } from '@/lib/supabase/client'
import type { AgentProposal, BeaconAction, ProposalStatus } from '@beacon/reality-graph'

export interface ProposalRow {
  id: string
  hotel_id: string
  organization_id: string | null
  agent_name: string
  agent_version: string
  action_type: string
  action_payload: Record<string, unknown>
  confidence: number
  reasoning: string
  provenance: ReadonlyArray<{ kind: 'tool' | 'document' | 'principle'; ref: string; detail?: string }>
  status: ProposalStatus
  parent_version_id: string | null
  refinement_note: string | null
  created_by_user_id: string | null
  decided_by_user_id: string | null
  decided_at: string | null
  /** Who owns reviewing this. NULL is a real state — the unassigned queue. */
  assigned_to_user_id: string | null
  assigned_at: string | null
  edited_before_approval: boolean
  resulting_node_id: string | null
  resulting_node_type: string | null
  created_at: string
}

export interface CreateProposalInput {
  hotelId: string
  organizationId?: string | null
  agentName: string
  agentVersion: string
  proposal: AgentProposal
  createdByUserId: string
  /** Set when this proposal supersedes a prior one via NL refinement. */
  parentVersionId?: string | null
  refinementNote?: string | null
}

export async function createProposal(input: CreateProposalInput): Promise<ProposalRow> {
  const { data, error } = await supabase
    .from('proposals')
    .insert({
      hotel_id:           input.hotelId,
      organization_id:    input.organizationId ?? null,
      agent_name:         input.agentName,
      agent_version:      input.agentVersion,
      action_type:        input.proposal.action.type,
      action_payload:     input.proposal.action as unknown as Record<string, unknown>,
      confidence:         input.proposal.confidence,
      reasoning:          input.proposal.reasoning,
      provenance:         input.proposal.provenance,
      status:             'pending',
      parent_version_id:  input.parentVersionId ?? null,
      refinement_note:    input.refinementNote ?? null,
      created_by_user_id: input.createdByUserId,
    })
    .select('*')
    .single<ProposalRow>()
  if (error) throw new Error(error.message)

  // Scan provenance for { kind: 'document', ref: '<doc_id>' } entries and
  // write proposal --cited_in--> document edges into relationship_edges.
  // Best-effort: edge-write failures don't block proposal creation; the
  // citation is still visible inline via the proposal's provenance array.
  const docRefs = input.proposal.provenance
    .filter((p) => p.kind === 'document' && isUuid(p.ref))
    .map((p) => p.ref)
  if (docRefs.length > 0) {
    const edges = docRefs.map((docId) => ({
      hotel_id:     input.hotelId,
      edge_type:    'cited_in' as const,
      source_type:  'proposal',
      source_id:    data.id,
      target_type:  'document',
      target_id:    docId,
      triggered_by: 'ai_proposal_accepted',
      actor_id:     input.createdByUserId,
    }))
    const { error: edgeError } = await supabase
      .from('relationship_edges')
      .insert(edges)
    if (edgeError) {
      console.warn('[beacon:proposals] cited_in edge write failed:', edgeError.message)
    }
  }

  // Scan provenance for { kind: 'principle', ref: '<principle_id>' } entries and
  // write proposal --influenced_by--> principle edges. Closes the learning
  // flywheel in the graph: an operator can trace which proposals their feedback
  // shaped. Best-effort, same as cited_in.
  const principleRefs = input.proposal.provenance
    .filter((p) => p.kind === 'principle' && isUuid(p.ref))
    .map((p) => p.ref)
  if (principleRefs.length > 0) {
    const edges = principleRefs.map((principleId) => ({
      hotel_id:     input.hotelId,
      edge_type:    'influenced_by' as const,
      source_type:  'proposal',
      source_id:    data.id,
      target_type:  'principle',
      target_id:    principleId,
      triggered_by: 'ai_proposal_accepted',
      actor_id:     input.createdByUserId,
    }))
    const { error: edgeError } = await supabase
      .from('relationship_edges')
      .insert(edges)
    if (edgeError) {
      console.warn('[beacon:proposals] influenced_by edge write failed:', edgeError.message)
    }
  }

  // Q2 — prediction lineage: record the forecast that SIZED this proposal and
  // link it (proposal --derived_from--> forecast_observation), so "was the
  // forecast that drove this order right?" becomes a query once it's scored.
  // Best-effort, same as the edges above.
  const forecast = input.proposal.forecast
  const variantId = (input.proposal.action as { variantId?: string }).variantId
  if (forecast && variantId && isUuid(variantId)) {
    const { data: foId, error: foErr } = await supabase.rpc('record_decision_forecast', {
      p_hotel_id:    input.hotelId,
      p_variant_id:  variantId,
      p_proposal_id: data.id,
      p_horizon:     forecast.horizonDays,
      p_projected:   forecast.projectedUnits,
      p_basis:       forecast.basis,
      p_confidence:  forecast.confidence,
      p_sample_size: forecast.sampleSize ?? 0,
    }) as unknown as { data: string | null; error: { message: string } | null }
    if (foErr) {
      console.warn('[beacon:proposals] record_decision_forecast failed:', foErr.message)
    } else if (foId) {
      const { error: edgeErr } = await supabase.from('relationship_edges').insert({
        hotel_id:     input.hotelId,
        edge_type:    'derived_from' as const,
        source_type:  'proposal',
        source_id:    data.id,
        target_type:  'forecast_observation',
        target_id:    foId,
        triggered_by: 'ai_proposal_accepted',
        actor_id:     input.createdByUserId,
      })
      if (edgeErr) console.warn('[beacon:proposals] derived_from edge write failed:', edgeErr.message)
    }
  }

  return data
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export interface DecideProposalInput {
  proposalId: string
  status: 'approved' | 'rejected' | 'superseded'
  decidedByUserId: string
  /** True when the operator edited the proposal's action before approving — the
   *  calibration label discounts it from a full hit (corrections #6). */
  edited?: boolean
  resultingNodeId?: string | null
  resultingNodeType?: string | null
}

export async function decideProposal(input: DecideProposalInput): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .update({
      status:                 input.status,
      decided_by_user_id:     input.decidedByUserId,
      decided_at:             new Date().toISOString(),
      edited_before_approval: input.edited ?? false,
      resulting_node_id:      input.resultingNodeId ?? null,
      resulting_node_type:    input.resultingNodeType ?? null,
    })
    .eq('id', input.proposalId)
  if (error) throw new Error(error.message)
}

export interface PendingProposalFilters {
  hotelId: string
  /** When set, only proposals from these agents. */
  agentNames?: string[]
  /** When set, only proposals with these action types. */
  actionTypes?: string[]
  /** When set, only proposals with confidence in [min, max]. */
  confidenceMin?: number
  confidenceMax?: number
}

/**
 * Triage feed: pending proposals for the hotel, lowest-confidence first so the
 * operator sees the most uncertain calls before auto-approvable ones.
 */
export async function fetchPendingProposals(filters: PendingProposalFilters): Promise<ProposalRow[]> {
  let q = supabase
    .from('proposals')
    .select('*')
    .eq('hotel_id', filters.hotelId)
    .eq('status', 'pending')
    .order('confidence', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters.agentNames && filters.agentNames.length > 0) {
    q = q.in('agent_name', filters.agentNames)
  }
  if (filters.actionTypes && filters.actionTypes.length > 0) {
    q = q.in('action_type', filters.actionTypes)
  }
  if (typeof filters.confidenceMin === 'number') {
    q = q.gte('confidence', filters.confidenceMin)
  }
  if (typeof filters.confidenceMax === 'number') {
    q = q.lte('confidence', filters.confidenceMax)
  }

  const { data, error } = await q.overrideTypes<ProposalRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function rejectProposal(input: {
  proposalId: string
  decidedByUserId: string
}): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .update({
      status:             'rejected',
      decided_by_user_id: input.decidedByUserId,
      decided_at:         new Date().toISOString(),
    })
    .eq('id', input.proposalId)
  if (error) throw new Error(error.message)
}

export async function fetchProposalsByParent(parentId: string): Promise<ProposalRow[]> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('parent_version_id', parentId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data as ProposalRow[]
}

export async function fetchProposal(id: string): Promise<ProposalRow | null> {
  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .maybeSingle<ProposalRow>()
  if (error) throw new Error(error.message)
  return data
}

/** Rebuilds an AgentProposal from a persisted row (e.g. when re-displaying history). */
export function rowToAgentProposal(row: ProposalRow): AgentProposal {
  return {
    action: row.action_payload as unknown as BeaconAction,
    confidence: row.confidence,
    reasoning: row.reasoning,
    provenance: row.provenance,
  }
}

// ── Assignment (migration 275) ───────────────────────────────────────────────
// Routes a proposal to a person, or clears it with null. Goes through the RPC
// rather than an UPDATE: assign_proposal refuses an assignee outside the
// organization, because work assigned to someone who cannot open it is a queue
// that silently never moves.

export async function assignProposal(proposalId: string, assignee: string | null): Promise<ProposalRow> {
  const { data, error } = await supabase
    .rpc('assign_proposal', { p_proposal_id: proposalId, p_assignee: assignee })
    .single<ProposalRow>()
  if (error) throw new Error(error.message)
  return data
}

export interface ReviewQueueLoadRow {
  assignee:       string | null
  assignee_email: string
  pending:        number
  oldest_days:    number
}

/** Pending review per assignee, unassigned included as its own row. */
export async function fetchReviewQueueLoad(): Promise<ReviewQueueLoadRow[]> {
  const result = await supabase.rpc('review_queue_load') as unknown as {
    data: ReviewQueueLoadRow[] | null
    error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return result.data ?? []
}
