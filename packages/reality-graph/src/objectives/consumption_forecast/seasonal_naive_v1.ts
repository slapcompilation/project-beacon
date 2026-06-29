// Seasonal-naive adapter v1: weekly-cycle aware projection.
// Computes a per-day-of-week mean over the available window, then projects
// horizonDays by summing the corresponding DOW means. Outperforms the plain
// rolling average on workloads with weekday/weekend patterns (almost all
// hotel F&B variants).

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'

export const seasonalNaiveV1Adapter: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> = {
  name:    'seasonal-naive-v1',
  version: '1.0.0',
  inputSchema:  { kind: 'consumption_forecast_input'  },
  outputSchema: { kind: 'consumption_forecast_output' },
  runInference: (input) => {
    // Day-of-week mean: 7 buckets indexed Sun..Sat.
    const buckets: Array<{ total: number; days: Set<string> }> = Array.from({ length: 7 }, () => ({
      total: 0,
      days:  new Set<string>(),
    }))

    for (const log of input.logs) {
      if (log.delta >= 0) continue
      const date = new Date(log.created_at)
      const dow  = date.getUTCDay()
      const key  = log.created_at.slice(0, 10)
      const b    = buckets[dow]
      if (!b) continue
      b.total += Math.abs(log.delta)
      b.days.add(key)
    }

    const dowMeans = buckets.map((b) => (b.days.size > 0 ? b.total / b.days.size : 0))
    const overallMean = dowMeans.reduce((s, v) => s + v, 0) / 7

    // Project: start from the reference point (now live; the holdout cutoff in
    // backtest — never the wall clock), walk forward horizonDays, sum the DOW mean.
    let projected = 0
    const start = new Date(input.asOf ?? Date.now())
    for (let i = 1; i <= input.horizonDays; i++) {
      const future = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
      const m = dowMeans[future.getUTCDay()]
      projected += m && m > 0 ? m : overallMean
    }

    // Confidence climbs as more distinct DOW buckets have data.
    const coveredDows = dowMeans.filter((m) => m > 0).length
    const confidence = Math.min(0.95, 0.4 + (coveredDows / 7) * 0.5)

    return Promise.resolve({
      projectedUnits: Math.round(projected),
      basis:          'seasonal-naive-v1',
      confidence:     Number(confidence.toFixed(2)),
      sampleSize:     input.logs.length,
    })
  },
}
