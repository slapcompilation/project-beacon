// The bench, the resolver and the registry must agree on which adapters exist.
// They drifted once: the Lab backtested 2 of 6 and the resolver couldn't resolve
// occupancy_v1, so a released adapter silently fell back to the default.

import { describe, expect, it } from 'vitest'
import {
  CONSUMPTION_FORECAST_ADAPTERS,
  consumptionForecastObjective,
  registerConsumptionForecast,
} from './index'
import { listAllObjectiveDescriptors } from '../../catalog'

describe('consumption_forecast adapter registry', () => {
  it('declares candidates from the typed adapter list', () => {
    expect(consumptionForecastObjective.candidates)
      .toEqual(CONSUMPTION_FORECAST_ADAPTERS.map((a) => a.name))
  })

  it('registers every candidate, so each one resolves', () => {
    registerConsumptionForecast()
    const d = listAllObjectiveDescriptors().find((x) => x.objective.name === consumptionForecastObjective.name)
    expect(d?.adapters.map((a) => a.name).sort())
      .toEqual(CONSUMPTION_FORECAST_ADAPTERS.map((a) => a.name).sort())
  })

  it('names are unique and the default is one of them', () => {
    const names = CONSUMPTION_FORECAST_ADAPTERS.map((a) => a.name)
    expect(new Set(names).size).toBe(names.length)
    expect(names).toContain(consumptionForecastObjective.defaultAdapter)
  })
})
