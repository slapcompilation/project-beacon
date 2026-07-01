// Canonical Studio catalog — the single source of truth the web Studio renders
// its Logic Tools + Agents views from, so those views can't drift from what
// actually ships (a hand-maintained list dropped compute_reorder_point and the
// P2 agent changes). Everything here is instantiated with no-op readers/deps:
// only the static metadata (name, version, category, description, schemas,
// toolset) is read — the invoke paths are never called from the catalog.

import type { LogicTool } from './tools/index'
import type { GraphReader } from './tools/graph_reader'
import type { AgentSpec } from './agents/index'
import { StubLLMClient } from './agents/llm'
import {
  makeQueryOpenRestockRequestsTool,
  makeQuerySisterPropertyInventoryTool,
  makeForecastConsumptionTool,
  makeComputeReorderPointTool,
  makeRankAlternativeSuppliersTool,
  makeQueryVariantDocumentsTool,
  makeQueryDocumentChunksTool,
  requestClarificationTool,
  makeScoreForecastAccuracyTool,
  makeComputeDecisionCalibrationTool,
  makeDetectOntologyGapsTool,
  makeOccupancyAdjustedForecastTool,
} from './tools/index'
import { makeQueryRecentWasteLogsTool } from './tools/data/query_recent_waste_logs'
import { buildRestockAdvisorAgent } from './agents/restock_advisor/index'
import { buildWasteTriageAgent } from './agents/waste_triage/index'
import { buildOverstockRebalancerAgent } from './agents/overstock_rebalancer/index'
import {
  objectiveRegistry,
  adapterRegistry,
  getEvalSuite,
  type ModelingObjective,
  type ModelAdapter,
  type EvalSuite,
} from './objectives/index'
import { registerConsumptionForecast } from './objectives/consumption_forecast/index'

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
    makeQueryOpenRestockRequestsTool(noopGraphReader),
    makeQuerySisterPropertyInventoryTool(noopGraphReader),
    makeForecastConsumptionTool(noopGraphReader),
    makeComputeReorderPointTool(noopGraphReader),
    makeRankAlternativeSuppliersTool(noopGraphReader),
    makeQueryRecentWasteLogsTool(noopGraphReader),
    makeQueryVariantDocumentsTool(noopGraphReader),
    makeQueryDocumentChunksTool(noopGraphReader),
    requestClarificationTool,
    makeScoreForecastAccuracyTool(noopGraphReader),
    makeComputeDecisionCalibrationTool({ getResolvedProposals: () => Promise.resolve([]) }),
    makeDetectOntologyGapsTool({
      getRemovalReasons:          () => Promise.resolve([]),
      getKnownRemovalCategories:  () => Promise.resolve([]),
      getAdditionReasons:         () => Promise.resolve([]),
      getKnownMovementCategories: () => Promise.resolve([]),
      getEdgeTypeCounts:          () => Promise.resolve([]),
    }),
    makeOccupancyAdjustedForecastTool({
      getStockLogs:        () => Promise.resolve([]),
      getOccupancyContext: () => Promise.resolve({ histMean: 0, forward: [], sensitivity: 0 }),
    }),
  ] as LogicTool[]
}

/** Every agent that ships, built with no-op deps so the Studio reads its live
 *  metadata (toolset, version, scope, release stage) instead of a stale copy. */
export function listAllAgentSpecs(): ReadonlyArray<AgentSpec> {
  const llm = new StubLLMClient([])
  return [
    buildRestockAdvisorAgent({ llm, reader: noopGraphReader }),
    buildWasteTriageAgent({ llm, reader: noopGraphReader }),
    buildOverstockRebalancerAgent({ llm, reader: noopGraphReader }),
  ]
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
  registerConsumptionForecast()   // idempotent — populates the registries
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
