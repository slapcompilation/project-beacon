// System Map (OAG) — assembles every registered surface into a single graph
// view. Pure data layer; renders in SystemMapPage.

import { listAllObjectiveDescriptors, type CatalogObjectiveDescriptor as ObjectiveDescriptor } from '@beacon/reality-graph'
import {
  agentDescriptors,
  toolDescriptors,
  type AgentDescriptor,
} from '@/features/agentStudio/registry'
import { actionDescriptors, type ActionDescriptor, type BeaconAction, type LogicTool, type ModelAdapter, type ModelingObjective } from '@beacon/reality-graph'

/** Manual map: which Logic Tool delegates to which Modeling Objective.
 *  Only forecast_consumption today; grows as more adapter-backed tools land. */
export const TOOL_TO_OBJECTIVE: Record<string, string> = {
  forecast_consumption: 'consumption_forecast',
}

export interface SystemMapData {
  agents:     ReadonlyArray<AgentDescriptor>
  tools:      ReadonlyArray<LogicTool>
  actions:    ReadonlyArray<{ name: BeaconAction['type']; descriptor: ActionDescriptor }>
  objectives: ReadonlyArray<{ objective: ModelingObjective; adapters: ReadonlyArray<ModelAdapter> }>
  adapters:   ReadonlyArray<{ adapter: ModelAdapter; objectiveName: string }>
  /** edges: which agent uses which tool */
  agentUsesTool: ReadonlyArray<{ agent: string; tool: string }>
  /** edges: which agent emits which action */
  agentEmitsAction: ReadonlyArray<{ agent: string; action: string }>
  /** edges: which tool delegates to which objective */
  toolDelegatesToObjective: ReadonlyArray<{ tool: string; objective: string }>
  /** edges: which adapter belongs to which objective */
  adapterBelongsToObjective: ReadonlyArray<{ adapter: string; objective: string }>
}

export function buildSystemMap(): SystemMapData {
  const objectiveDescriptors = listAllObjectiveDescriptors()
  const objs = objectiveDescriptors.map((d: ObjectiveDescriptor) => ({
    objective: d.objective,
    adapters:  d.adapters,
  }))

  const adapters: Array<{ adapter: ModelAdapter; objectiveName: string }> = []
  for (const d of objectiveDescriptors) {
    for (const a of d.adapters) {
      adapters.push({ adapter: a, objectiveName: d.objective.name })
    }
  }

  const actionEntries = Object
    .entries(actionDescriptors)
    .map(([name, descriptor]) => ({ name: name, descriptor }))

  const agentUsesTool: Array<{ agent: string; tool: string }> = []
  const agentEmitsAction: Array<{ agent: string; action: string }> = []
  for (const a of agentDescriptors) {
    for (const t of a.toolset)  agentUsesTool.push({ agent: a.name, tool: t })
    for (const e of a.emits)    agentEmitsAction.push({ agent: a.name, action: e })
  }

  const toolDelegatesToObjective = Object
    .entries(TOOL_TO_OBJECTIVE)
    .map(([tool, objective]) => ({ tool, objective }))

  const adapterBelongsToObjective = adapters
    .map(({ adapter, objectiveName }) => ({ adapter: adapter.name, objective: objectiveName }))

  return {
    agents:     agentDescriptors,
    tools:      toolDescriptors,
    actions:    actionEntries,
    objectives: objs,
    adapters,
    agentUsesTool,
    agentEmitsAction,
    toolDelegatesToObjective,
    adapterBelongsToObjective,
  }
}
