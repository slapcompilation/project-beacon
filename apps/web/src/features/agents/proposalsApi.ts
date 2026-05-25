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
  provenance: ReadonlyArray<{ kind: 'tool' | 'document'; ref: string; detail?: string }>
  status: ProposalStatus
  parent_version_id: string | null
  refinement_note: string | null
  created_by_user_id: string
  decided_by_user_id: string | null
  decided_at: string | null
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

  return data
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

export interface DecideProposalInput {
  proposalId: string
  status: 'approved' | 'rejected' | 'superseded'
  decidedByUserId: string
  resultingNodeId?: string | null
  resultingNodeType?: string | null
}

export async function decideProposal(input: DecideProposalInput): Promise<void> {
  const { error } = await supabase
    .from('proposals')
    .update({
      status:              input.status,
      decided_by_user_id:  input.decidedByUserId,
      decided_at:          new Date().toISOString(),
      resulting_node_id:   input.resultingNodeId ?? null,
      resulting_node_type: input.resultingNodeType ?? null,
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
