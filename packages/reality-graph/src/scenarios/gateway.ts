// Phase H step 2 — abstract gateway for scenario tools.
//
// The Logic Tools below (apply_overlay_edit, simulate_cycle_with_overlay,
// query_simulation_result) decoupled from any specific runtime. The web
// adapter wires Supabase; future edge-fn adapters wire the service-role
// client. The simulation tool also needs a callback that materializes the
// runner's dependencies (variants + agent + constraints + policy) from real
// state filtered through the scenario's overlay — that's injected too.

import type { ScenarioGraphOverlay, ScenarioSimulationCache } from './index'
import type { SimulationDeps } from './simulate'
import type { CycleResult } from '../cycles/intelligenceCycle'

export interface ScenarioRow {
  id:                 string
  organization_id:    string
  hotel_id:           string | null
  title:              string
  description:        string | null
  graph_overlay:      ScenarioGraphOverlay
  status:             'draft' | 'archived' | 'promoted'
  last_simulation:    ScenarioSimulationCache | null
  last_simulated_at:  string | null
  created_at:         string
  updated_at:         string
}

export interface ScenarioGateway {
  fetchScenario(id: string): Promise<ScenarioRow | null>

  /** Calls the DB's apply_overlay_edit RPC + returns the updated row. */
  applyOverlayEdit(args: {
    scenarioId: string
    path:       ReadonlyArray<string>
    /** undefined = remove key; otherwise set to value. */
    value:      unknown
    source:     'llm' | 'operator'
  }): Promise<ScenarioRow>

  /** Materializes the simulation deps for a scenario: pulls real-state
   *  variants/constraints/policy and applies the overlay before handing the
   *  shape over to simulateCycleWithOverlay. */
  buildSimulationDeps(scenario: ScenarioRow): Promise<SimulationDeps>

  /** Caches the simulation result + delta on the scenario row. */
  recordSimulation(scenarioId: string, cache: ScenarioSimulationCache): Promise<void>
}

export interface ScenarioSimulationResult {
  result: CycleResult
  /** NULL when no baseline run was taken. */
  delta:  ScenarioSimulationCache['delta']
}
