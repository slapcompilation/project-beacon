// Canonical Studio catalog — the single source of truth the web Studio renders
// its Logic Tools + Agents views from, so those views can't drift from what
// actually ships (a hand-maintained list dropped compute_reorder_point and the
// P2 agent changes). Everything here is instantiated with no-op readers/deps:
// only the static metadata (name, version, category, description, schemas,
// toolset) is read — the invoke paths are never called from the catalog.

import type { LogicTool } from './tools/index'
import type { GraphReader } from './tools/graph_reader'
import type { AgentSpec } from './agents/index'
import {
  makeQueryDocumentChunksTool,
  requestClarificationTool,
  makeComputeDecisionCalibrationTool,
} from './tools/index'
import { makeMineProcessTool } from './tools/data/mine_process'
import {
  objectiveRegistry,
  adapterRegistry,
  getEvalSuite,
  type ModelingObjective,
  type ModelAdapter,
  type EvalSuite,
} from './objectives/index'

const noopGraphReader: GraphReader = {
  getVariant:              () => Promise.resolve(null),
  getOpenRestockRequests:  () => Promise.resolve([]),
  getStockLogs:            () => Promise.resolve([]),
  getSisterHotels:         () => Promise.resolve([]),
  getVariantsByName:       () => Promise.resolve([]),
  getSuppliersForVariant:  () => Promise.resolve([]),
  getDocumentsForEntity:   () => Promise.resolve([]),
  searchDocumentChunks:    () => Promise.resolve([]),
  getActivePrinciples:     () => Promise.resolve([]),
}

/** Every Logic Tool that ships, with real metadata. Add a tool here when you add
 *  it to reality-graph — this is the one place the Studio reads from. */
export function listAllToolDescriptors(): ReadonlyArray<LogicTool> {
  return [
    makeMineProcessTool(noopGraphReader),
    makeQueryDocumentChunksTool(noopGraphReader),
    requestClarificationTool,
    makeComputeDecisionCalibrationTool({ getResolvedProposals: () => Promise.resolve([]) }),
  ] as LogicTool[]
}

/** Every agent that ships, built with no-op deps so the Studio reads its live
 *  metadata (toolset, version, scope, release stage) instead of a stale copy. */
export function listAllAgentSpecs(): ReadonlyArray<AgentSpec> {
  // Every shipped agent was hospitality and went with the teardown. Authored
  // agents come from the database, not from here.
  return []
}

export interface ObjectiveDescriptor {
  objective: ModelingObjective
  /** The objective's candidate adapters, resolved from the registry (drift-free). */
  adapters:  ReadonlyArray<ModelAdapter>
  evalSuite: EvalSuite | undefined
}

/** Every Modeling Objective that ships, with its candidate adapters + eval suite
 *  resolved from the registries — so the Studio can't freeze a stale adapter list. */
export function listAllObjectiveDescriptors(): ReadonlyArray<ObjectiveDescriptor> {
  const byName = new Map<string, ModelAdapter>()
  for (const a of adapterRegistry.values()) byName.set(a.name, a)
  return [...objectiveRegistry.values()].map((objective) => ({
    objective,
    adapters: objective.candidates
      .map((n) => byName.get(n))
      .filter((a): a is ModelAdapter => !!a),
    evalSuite: getEvalSuite(objective.name),
  }))
}
