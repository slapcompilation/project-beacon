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
    const days = observedWindowDays(input.logs, 30)
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

// Average over the observed window SPAN (inclusive days from first to last log),
// not the count of days that have a log — dividing by active days over-projects
// intermittent items and starves the overstock detector.
function observedWindowDays(logs: ReadonlyArray<{ created_at: string }>, lookback: number): number {
  if (logs.length === 0) return 1
  const times = logs.map((l) => new Date(l.created_at).getTime())
  const spanDays = Math.floor((Math.max(...times) - Math.min(...times)) / 86_400_000) + 1
  return Math.min(lookback, Math.max(1, spanDays))
}
