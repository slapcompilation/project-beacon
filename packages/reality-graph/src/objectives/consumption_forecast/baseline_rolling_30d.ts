// Baseline adapter: rolling-30d average consumption × horizon.
// This is the algorithm that previously lived inline in forecast_consumption;
// extracted so the Studio can swap it for trained adapters without callers
// changing.

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'

export const baselineRolling30dAdapter: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> = {
  name:    'baseline-rolling-30d-avg',
  version: '1.0.0',
  inputSchema:  { kind: 'consumption_forecast_input'  },
  outputSchema: { kind: 'consumption_forecast_output' },
  runInference: (input) => {
    const consumption = input.logs
      .filter((l) => l.delta < 0)
      .reduce((sum, l) => sum + Math.abs(l.delta), 0)
    const days = Math.max(1, distinctDays(input.logs))
    const dailyAvg = consumption / days
    const projected = dailyAvg * input.horizonDays
    const confidence = Math.min(0.95, 0.35 + (days / 30) * 0.5)

    return Promise.resolve({
      projectedUnits: Math.round(projected),
      basis:          'baseline-rolling-30d-avg',
      confidence:     Number(confidence.toFixed(2)),
      sampleSize:     input.logs.length,
    })
  },
}

function distinctDays(logs: ReadonlyArray<{ created_at: string }>): number {
  const set = new Set(logs.map((l) => l.created_at.slice(0, 10)))
  return set.size
}
