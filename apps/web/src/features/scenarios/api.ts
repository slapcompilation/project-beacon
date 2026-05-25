// scenarios — exploratory uncommitted branches. Each row holds a list of
// simulated BeaconActions the operator has tried inside the sandbox; commit
// dispatches them through the regular Action Registry.

import { supabase } from '@/lib/supabase/client'
import type { BeaconAction } from '@beacon/reality-graph'

export type ScenarioStatus = 'draft' | 'committed' | 'discarded'

export interface ScenarioRow {
  id:                   string
  hotel_id:             string
  organization_id:      string | null
  title:                string
  description:          string | null
  status:               ScenarioStatus
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

export async function fetchScenarios(hotelId: string, statusFilter?: ScenarioStatus | null): Promise<ScenarioRow[]> {
  let q = supabase
    .from('scenarios')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false })
  if (statusFilter) q = q.eq('status', statusFilter)
  const { data, error } = await q.overrideTypes<ScenarioRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

export async function fetchScenario(id: string): Promise<ScenarioRow | null> {
  const { data, error } = await supabase
    .from('scenarios')
    .select('*')
    .eq('id', id)
    .maybeSingle<ScenarioRow>()
  if (error) throw new Error(error.message)
  return data
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export interface CreateScenarioInput {
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

export async function createScenario(input: CreateScenarioInput): Promise<ScenarioRow> {
  const { data, error } = await supabase
    .from('scenarios')
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
    .single<ScenarioRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function updateScenarioNotes(id: string, notes: string): Promise<void> {
  const { error } = await supabase
    .from('scenarios')
    .update({ notes })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function appendSimulatedAction(scenarioId: string, action: BeaconAction): Promise<void> {
  const { error } = await supabase.rpc('append_simulated_action', {
    p_scenario_id: scenarioId,
    p_action:      action as unknown as Record<string, unknown>,
  })
  if (error) throw new Error(error.message)
}

export async function removeSimulatedAction(scenarioId: string, index: number): Promise<void> {
  const { error } = await supabase.rpc('remove_simulated_action', {
    p_scenario_id: scenarioId,
    p_index:       index,
  })
  if (error) throw new Error(error.message)
}

export async function discardScenario(id: string): Promise<void> {
  const { error } = await supabase
    .from('scenarios')
    .update({ status: 'discarded' })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

/** Marks the scenario committed with the dispatch results recorded inline.
 *  The actual dispatching happens in the hook (dispatchAction is browser-only). */
export async function recordScenarioCommit(
  id: string,
  committedByUserId: string,
  results: ScenarioRow['commit_results'],
): Promise<void> {
  const { error } = await supabase
    .from('scenarios')
    .update({
      status:               'committed',
      committed_by_user_id: committedByUserId,
      committed_at:         new Date().toISOString(),
      commit_results:       results,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
}
