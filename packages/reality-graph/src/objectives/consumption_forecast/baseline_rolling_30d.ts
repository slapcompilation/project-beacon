// Baseline adapter: rolling-30d average consumption × horizon.
// This is the algorithm that previously lived inline in forecast_consumption;
// extracted so the Studio can swap it for trained adapters without callers
// changing.

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'

const LOOKBACK_DAYS = 30

export const baselineRolling30dAdapter: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> = {
  name:    'baseline-rolling-30d-avg',
  version: '1.0.0',
  inputSchema:  { kind: 'consumption_forecast_input'  },
  outputSchema: { kind: 'consumption_forecast_output' },
  runInference: (input) => {
    // Rolling average over the WINDOW length, not the days that happen to have a
    // log: a burst that ended weeks ago projects the low recent rate, not a
    // spike. Window ends at asOf (now live, the holdout cutoff in backtest) so
    // idle days since the last log correctly drag the rate down.
    const asOf = input.asOf ?? Date.now()
    const windowStart = asOf - LOOKBACK_DAYS * 86_400_000
    const inWindow = input.logs.filter((l) => {
      const t = new Date(l.created_at).getTime()
      return t >= windowStart && t <= asOf
    })
    const consumption = inWindow.filter((l) => l.delta < 0).reduce((sum, l) => sum + Math.abs(l.delta), 0)
    const dailyAvg = consumption / LOOKBACK_DAYS
    const projected = Math.round(dailyAvg * input.horizonDays)

    // Confidence tracks how many distinct days actually carried signal — sparse
    // history is honestly less certain even when the window is full.
    const activeDays = new Set(inWindow.map((l) => l.created_at.slice(0, 10))).size
    const confidence = Math.min(0.95, 0.35 + (activeDays / LOOKBACK_DAYS) * 0.5)

    return Promise.resolve({
      projectedUnits: projected,
      basis:          'baseline-rolling-30d-avg',
      confidence:     Number(confidence.toFixed(2)),
      sampleSize:     inWindow.length,
    })
  },
}
