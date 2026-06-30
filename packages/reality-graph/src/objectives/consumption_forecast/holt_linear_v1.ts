// Holt-linear adapter: double exponential smoothing — a recency-weighted level
// AND a recency-weighted trend. Projects accelerating or decaying demand instead
// of assuming the recent rate holds flat (what EWMA and the rolling average do).
// Wins when demand is on a slope; falls back to ~EWMA when the slope is ~0.
//
// ALPHA = level reactivity, BETA = trend reactivity. Each projected day is floored
// at 0 so a decaying trend can't predict negative consumption.

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'
import { buildDailySeries, fitConfidence } from './daily_series'

const LOOKBACK_DAYS = 30
const ALPHA = 0.3
const BETA  = 0.1

export const holtLinearV1Adapter: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> = {
  name:    'holt-linear-v1',
  version: '1.0.0',
  inputSchema:  { kind: 'consumption_forecast_input'  },
  outputSchema: { kind: 'consumption_forecast_output' },
  runInference: (input) => {
    const asOf   = input.asOf ?? Date.now()
    const series = buildDailySeries(input.logs, asOf, LOOKBACK_DAYS)
    if (series.length === 0) {
      return Promise.resolve({ projectedUnits: 0, basis: 'holt-linear-v1', confidence: 0.3, sampleSize: 0 })
    }
    if (series.length === 1) {
      return Promise.resolve({ projectedUnits: Math.round(series[0] * input.horizonDays), basis: 'holt-linear-v1', confidence: 0.3, sampleSize: 1 })
    }
    let level = series[0]
    let trend = series[1] - series[0]
    const oneStep: number[] = new Array(series.length).fill(level)
    for (let i = 1; i < series.length; i++) {
      oneStep[i] = level + trend
      const prevLevel = level
      level = ALPHA * series[i] + (1 - ALPHA) * (level + trend)
      trend = BETA * (level - prevLevel) + (1 - BETA) * trend
    }
    let projected = 0
    for (let k = 1; k <= input.horizonDays; k++) projected += Math.max(0, level + k * trend)
    return Promise.resolve({
      projectedUnits: Math.round(projected),
      basis:          'holt-linear-v1',
      confidence:     fitConfidence(series, oneStep),
      sampleSize:     series.length,
    })
  },
}
