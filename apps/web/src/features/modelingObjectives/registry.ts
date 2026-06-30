// Modeling Objectives descriptor registry — pulls objectives + adapters from
// @beacon/reality-graph. Registration happens at module load so the Studio
// always renders a populated registry.

import {
  CONSUMPTION_FORECAST_OBJECTIVE_NAME,
  consumptionForecastObjective,
  consumptionForecastEvalSuite,
  baselineRolling30dAdapter,
  seasonalNaiveV1Adapter,
  ewmaV1Adapter,
  holtLinearV1Adapter,
  autoSelectV1Adapter,
  registerConsumptionForecast,
  type EvalSuite,
  type ModelAdapter,
  type ModelingObjective,
} from '@beacon/reality-graph'

// Idempotent — safe to import from multiple places.
registerConsumptionForecast()

export interface ObjectiveDescriptor {
  objective:  ModelingObjective
  adapters:   ReadonlyArray<ModelAdapter>
  evalSuite:  EvalSuite
}

export const objectiveDescriptors: ReadonlyArray<ObjectiveDescriptor> = [
  {
    objective:  consumptionForecastObjective,
    adapters:   [
      autoSelectV1Adapter       as unknown as ModelAdapter,
      ewmaV1Adapter             as unknown as ModelAdapter,
      holtLinearV1Adapter       as unknown as ModelAdapter,
      seasonalNaiveV1Adapter    as unknown as ModelAdapter,
      baselineRolling30dAdapter as unknown as ModelAdapter,
    ],
    evalSuite:  consumptionForecastEvalSuite,
  },
]

export function getObjectiveDescriptor(name: string): ObjectiveDescriptor | undefined {
  return objectiveDescriptors.find((d) => d.objective.name === name)
}

export { CONSUMPTION_FORECAST_OBJECTIVE_NAME }
