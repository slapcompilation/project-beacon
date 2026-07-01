// Modeling Objectives descriptor registry — derived from reality-graph's
// canonical catalog (listAllObjectiveDescriptors), the single source of truth,
// so the Studio's adapter list can't freeze while the objective grows.

import {
  listAllObjectiveDescriptors,
  CONSUMPTION_FORECAST_OBJECTIVE_NAME,
  type EvalSuite,
  type ModelAdapter,
  type ModelingObjective,
} from '@beacon/reality-graph'

export interface ObjectiveDescriptor {
  objective:  ModelingObjective
  adapters:   ReadonlyArray<ModelAdapter>
  evalSuite:  EvalSuite
}

// Every registered objective ships an eval suite (bound to the objective); the
// flatMap narrows evalSuite from `EvalSuite | undefined` and drops any objective
// that somehow lacks one rather than rendering a broken card.
export const objectiveDescriptors: ReadonlyArray<ObjectiveDescriptor> = listAllObjectiveDescriptors()
  .flatMap((d) => (d.evalSuite ? [{ objective: d.objective, adapters: d.adapters, evalSuite: d.evalSuite }] : []))

export function getObjectiveDescriptor(name: string): ObjectiveDescriptor | undefined {
  return objectiveDescriptors.find((d) => d.objective.name === name)
}

export { CONSUMPTION_FORECAST_OBJECTIVE_NAME }
