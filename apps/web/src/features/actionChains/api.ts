// action_chains — multi-step BeaconAction sequences batched as a unit. The
// operator builds the chain in a draft state; commit dispatches every step
// through the regular Action Registry. Renamed from "scenarios" in H1; the
// table + RPCs were renamed in migration 156.

import { supabase } from '@/lib/supabase/client'
import type { BeaconAction } from '@beacon/reality-graph'

export type ActionChainStatus = 'draft' | 'committed' | 'discarded'

export interface ActionChainRow {
  id:                   string
  hotel_id:             string
  organization_id:      string | null
  title:                string
  description:          string | null
  status:               ActionChainStatus
  base_proposal_id:     string | null
  base_case_id:         string | null
  simulated_actions:    BeaconAction[]
  notes:                string | null
  opened_by_user_id:    string
  committed_by_user_id: string | null
  committed_at:         string | null
  commit_results:       Array<{ actionType: string; result?: unknown; error?: string }> | null
  created_at:           string
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function fetchActionChains(hotelId: string, statusFilter?: ActionChainStatus | null): Promise<ActionChainRow[]> {
  let q = supabase
    .from('action_chains')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
  if (statusFilter) q = q.eq('status', statusFilter)
  const { data, error } = await q.overrideTypes<ActionChainRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchActionChain(id: string): Promise<ActionChainRow | null> {
  const { data, error } = await supabase
    .from('action_chains')
    .select('*')
    .eq('id', id)
    .maybeSingle<ActionChainRow>()
  if (error) throw new Error(error.message)
  return data
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export interface CreateActionChainInput {
  hotelId:           string
  organizationId?:   string | null
  title:             string
  description?:      string | null
  baseProposalId?:   string | null
  baseCaseId?:       string | null
  simulatedActions?: BeaconAction[]
  notes?:            string | null
  openedByUserId:    string
}

export async function createActionChain(input: CreateActionChainInput): Promise<ActionChainRow> {
  const { data, error } = await supabase
    .from('action_chains')
    .insert({
      hotel_id:          input.hotelId,
      organization_id:   input.organizationId ?? null,
      title:             input.title,
      description:       input.description ?? null,
      base_proposal_id:  input.baseProposalId ?? null,
      base_case_id:      input.baseCaseId ?? null,
      simulated_actions: input.simulatedActions ?? [],
      notes:             input.notes ?? null,
      opened_by_user_id: input.openedByUserId,
    })
    .select('*')
    .single<ActionChainRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function updateActionChainNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('action_chains')
    .update({ notes })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function appendActionChainStep(chainId: string, action: BeaconAction): Promise<void> {
  const { error } = await supabase.rpc('append_action_chain_step', {
    p_chain_id: chainId,
    p_action:   action as unknown as Record<string, unknown>,
  })
  if (error) throw new Error(error.message)
}

export async function removeActionChainStep(chainId: string, index: number): Promise<void> {
  const { error } = await supabase.rpc('remove_action_chain_step', {
    p_chain_id: chainId,
    p_index:    index,
  })
  if (error) throw new Error(error.message)
}

export async function discardActionChain(id: string): Promise<void> {
  const { error } = await supabase
    .from('action_chains')
    .update({ status: 'discarded' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Marks the chain committed with the dispatch results recorded inline.
 *  The actual dispatching happens in the hook (dispatchAction is browser-only). */
export async function recordActionChainCommit(
  id: string,
  committedByUserId: string,
  results: ActionChainRow['commit_results'],
): Promise<void> {
  const { error } = await supabase
    .from('action_chains')
    .update({
      status:               'committed',
      committed_by_user_id: committedByUserId,
      committed_at:         new Date().toISOString(),
      commit_results:       results,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
