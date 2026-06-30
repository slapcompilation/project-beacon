// EWMA adapter: single exponential smoothing of the daily consumption rate.
// Recent days carry more weight than old ones, so a variant whose demand has
// shifted is tracked far better than the flat rolling-30d average (which weights
// day-1 and day-29 equally and over/under-forecasts after a level change).
//
// ALPHA is the recency weight (higher = more reactive). A sensible default for
// daily F&B demand; a future slice can lift it into org_policy (config-as-data).

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'
import { buildDailySeries, fitConfidence } from './daily_series'

const LOOKBACK_DAYS = 30
const ALPHA = 0.3

export const ewmaV1Adapter: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> = {
  name:    'ewma-v1',
  version: '1.0.0',
  inputSchema:  { kind: 'consumption_forecast_input'  },
  outputSchema: { kind: 'consumption_forecast_output' },
  runInference: (input) => {
    const asOf   = input.asOf ?? Date.now()
    const series = buildDailySeries(input.logs, asOf, LOOKBACK_DAYS)
    if (series.length === 0) {
      return Promise.resolve({ projectedUnits: 0, basis: 'ewma-v1', confidence: 0.3, sampleSize: 0 })
    }
    let level = series[0]
    const oneStep: number[] = new Array(series.length).fill(level)
    for (let i = 1; i < series.length; i++) {
      oneStep[i] = level
      level = ALPHA * series[i] + (1 - ALPHA) * level
    }
    return Promise.resolve({
      projectedUnits: Math.round(level * input.horizonDays),
      basis:          'ewma-v1',
      confidence:     fitConfidence(series, oneStep),
      sampleSize:     series.length,
    })
  },
}
