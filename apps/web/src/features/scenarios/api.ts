// Scenarios — AIP-shaped sandbox graph branches (H2/H3). A scenario carries a
// graph_overlay merged on top of real state at simulation time; runs never
// touch the real graph. This module is the typed DB surface; the runner +
// merge helpers live in @beacon/reality-graph.

import { supabase } from '@/lib/supabase/client'
import type { ScenarioGraphOverlay, ScenarioSimulationCache } from '@beacon/reality-graph'

export type ScenarioStatus = 'draft' | 'archived' | 'promoted'

export interface ScenarioRow {
  id:                 string
  organization_id:    string
  hotel_id:           string | null
  title:              string
  description:        string | null
  graph_overlay:      ScenarioGraphOverlay
  status:             ScenarioStatus
  last_simulation:    ScenarioSimulationCache | null
  last_simulated_at:  string | null
  created_by_user_id: string | null
  created_at:         string
  updated_at:         string
}

export interface OverlayEditRow {
  id:          string
  scenario_id: string
  path:        string[]
  before:      unknown
  after:       unknown
  source:      'llm' | 'operator'
  author_id:   string | null
  created_at:  string
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function fetchScenarios(statusFilter?: ScenarioStatus | null): Promise<ScenarioRow[]> {
  let q = supabase.from('scenarios').select('*').order('updated_at', { ascending: false })
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

export async function fetchOverlayEdits(scenarioId: string): Promise<OverlayEditRow[]> {
  const { data, error } = await supabase
    .from('scenario_overlay_edits')
    .select('*')
    .eq('scenario_id', scenarioId)
    .order('created_at', { ascending: false })
    .overrideTypes<OverlayEditRow[], { merge: false }>()
  if (error) throw new Error(error.message)
  return data
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export interface CreateScenarioInput {
  organizationId: string
  hotelId:        string | null
  title:          string
  description?:   string | null
  graphOverlay?:  ScenarioGraphOverlay
  createdByUserId: string
}

export async function createScenario(input: CreateScenarioInput): Promise<ScenarioRow> {
  const { data, error } = await supabase
    .from('scenarios')
    .insert({
      organization_id:    input.organizationId,
      hotel_id:           input.hotelId,
      title:              input.title,
      description:        input.description ?? null,
      graph_overlay:      input.graphOverlay ?? {},
      created_by_user_id: input.createdByUserId,
    })
    .select('*')
    .single<ScenarioRow>()
  if (error) throw new Error(error.message)
  return data
}

/** Atomic overlay edit via the migration-157 RPC. value=undefined removes
 *  the key. Returns the updated scenario row. */
export async function applyOverlayEdit(args: {
  scenarioId: string
  path:       ReadonlyArray<string>
  value:      unknown
  source:     'llm' | 'operator'
}): Promise<ScenarioRow> {
  const { data, error } = await supabase.rpc('apply_overlay_edit', {
    p_scenario_id: args.scenarioId,
    p_path:        args.path as unknown as Record<string, unknown>,
    p_value:       (args.value ?? null) as Record<string, unknown> | null,
    p_source:      args.source,
  }) as unknown as { data: ScenarioRow | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  if (!data) throw new Error('apply_overlay_edit returned no row')
  return data
}

export async function recordSimulationResult(scenarioId: string, cache: ScenarioSimulationCache): Promise<void> {
  const { error } = await supabase.rpc('record_simulation_result', {
    p_scenario_id: scenarioId,
    p_result:      cache as unknown as Record<string, unknown>,
  })
  if (error) throw new Error(error.message)
}

export async function setScenarioStatus(id: string, status: ScenarioStatus): Promise<void> {
  const { error } = await supabase.from('scenarios').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateScenarioMeta(id: string, patch: { title?: string; description?: string }): Promise<void> {
  const { error } = await supabase.from('scenarios').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}
