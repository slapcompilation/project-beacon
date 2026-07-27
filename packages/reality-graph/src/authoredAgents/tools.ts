// The tools an authored agent may be given. Every one is read-or-compute:
// mutation tools are deliberately absent, because an authored agent PROPOSES —
// writes stay with the Action Registry behind decideAutoExecution.
//
// Shipped agents each assemble their own registry from these same factories;
// this is the equivalent for agents that have no code to assemble it.

import type { LogicTool } from '../tools/index'
import type { GraphReader } from '../tools/graph_reader'
import { makeQueryOpenRestockRequestsTool } from '../tools/data/query_open_restock_requests'
import { makeQuerySisterPropertyInventoryTool } from '../tools/data/query_sister_property_inventory'
import { makeQueryVariantDocumentsTool } from '../tools/data/query_variant_documents'
import { makeQueryDocumentChunksTool } from '../tools/data/query_document_chunks'
import { makeForecastConsumptionTool } from '../tools/logic/forecast_consumption'
import { makeComputeReorderPointTool } from '../tools/logic/compute_reorder_point'
import { makeRankAlternativeSuppliersTool } from '../tools/logic/rank_alternative_suppliers'
import { requestClarificationTool } from '../tools/predefined/request_clarification'

/** Executable, reader-backed tools keyed by name. The composer offers these
 *  names; the runner resolves them here, so a name the operator can pick is
 *  always a tool the model can actually call.
 *
 *  `authored` are the org's own tools (authoredToolAsLogicTool). A shipped tool
 *  always wins a name collision — an org must never be able to redefine what
 *  `forecast_consumption` means for an agent by authoring one. */
export function buildAuthoredAgentTools(
  reader: GraphReader,
  authored: ReadonlyArray<LogicTool> = [],
): Map<string, LogicTool> {
  const tools = [
    makeQueryOpenRestockRequestsTool(reader),
    makeQuerySisterPropertyInventoryTool(reader),
    makeQueryVariantDocumentsTool(reader),
    makeQueryDocumentChunksTool(reader),
    makeForecastConsumptionTool(reader),
    makeComputeReorderPointTool(reader),
    makeRankAlternativeSuppliersTool(reader),
    requestClarificationTool,
  ] as LogicTool[]

  const registry = new Map(tools.map((t) => [t.name, t]))
  for (const t of authored) if (!registry.has(t.name)) registry.set(t.name, t)
  return registry
}

/** Names an authored tool may not take, so the collision is caught at authoring
 *  time rather than silently ignored at run time. */
export function shippedAgentToolNames(reader: GraphReader): string[] {
  return [...buildAuthoredAgentTools(reader).keys()]
}
