// consumption_forecast — the objective the forecast_consumption Logic Tool
// delegates to once tool-side delegation lands. For Phase 8 v1 the objective
// and its two adapters are registered so the Studio can render them; the
// existing forecast_consumption tool still runs its inline baseline (the two
// implementations are equivalent for the baseline case).

import { registerAdapter, registerObjective, type EvalSuite, type ModelingObjective } from '../index'
import { baselineRolling30dAdapter } from './baseline_rolling_30d'
import { seasonalNaiveV1Adapter } from './seasonal_naive_v1'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'

export { baselineRolling30dAdapter, seasonalNaiveV1Adapter }
export type { ConsumptionForecastInput, ConsumptionForecastOutput }

export const CONSUMPTION_FORECAST_OBJECTIVE_NAME = 'consumption_forecast'

export const consumptionForecastObjective: ModelingObjective = {
  name:        CONSUMPTION_FORECAST_OBJECTIVE_NAME,
  description: 'Projects expected unit consumption for a variant over an N-day horizon. Used by restock_advisor + waste_triage to size gaps and at-risk inventory.',
  defaultAdapter: baselineRolling30dAdapter.name,
  candidates: [baselineRolling30dAdapter.name, seasonalNaiveV1Adapter.name],
}

/** Synthetic eval cases — held-out historical windows where the actual
 *  consumption is known. Real cases will be backfilled from production
 *  stock_logs once the Vitest-CI hook lands. */
export const consumptionForecastEvalSuite: EvalSuite = {
  objective: CONSUMPTION_FORECAST_OBJECTIVE_NAME,
  datasets:  ['stock_logs:last-90-days'],
  metrics:   ['mae', 'rmse'],
  subsets:   ['per-hotel', 'per-product-category'],
  cases:     buildSyntheticCases(),
}

interface ConsumptionForecastCase {
  id:       string
  input:    ConsumptionForecastInput
  expectedOutput?: { projectedUnits: number }
}

function buildSyntheticCases(): ConsumptionForecastCase[] {
  // 10 cases at varying daily-rate + horizon combinations. The "actual" is
  // dailyRate × horizonDays; both adapters should land near this number on a
  // stable workload — seasonal-naive should win when we inject weekend spikes.
  const cases: ConsumptionForecastCase[] = []
  const variants = [
    { id: 'eval-variant-1', dailyRate:  5, horizon: 7  },
    { id: 'eval-variant-2', dailyRate: 12, horizon: 7  },
    { id: 'eval-variant-3', dailyRate: 25, horizon: 14 },
    { id: 'eval-variant-4', dailyRate: 50, horizon: 7  },
    { id: 'eval-variant-5', dailyRate:  3, horizon: 30 },
    { id: 'eval-variant-6', dailyRate:  8, horizon: 7,  withSpike: true },
    { id: 'eval-variant-7', dailyRate: 20, horizon: 14, withSpike: true },
    { id: 'eval-variant-8', dailyRate:  1, horizon: 7  },
    { id: 'eval-variant-9', dailyRate: 40, horizon: 7,  withSpike: true },
    { id: 'eval-variant-10', dailyRate: 15, horizon: 14 },
  ]

  const now = Date.now()
  for (const v of variants) {
    const logs = []
    for (let d = 1; d <= 30; d++) {
      const dayOffset = d * 24 * 60 * 60 * 1000
      const date = new Date(now - dayOffset)
      const isWeekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
      // Weekend spike when the case opts in.
      const units = v.withSpike && isWeekend ? v.dailyRate * 2 : v.dailyRate
      logs.push({
        id:               `${v.id}-log-${String(d)}`,
        variant_id:       v.id,
        hotel_id:         'eval-hotel',
        delta:            -units,
        created_at:       date.toISOString(),
        reason:           'sold',
        removal_category: null,
      })
    }

    // Expected = mean daily × horizon; for spike cases this underestimates
    // because the next horizon window contains weekends. The eval grader
    // surfaces the residual; we don't pin a single "correct" number here.
    const meanDaily = logs.reduce((s, l) => s + Math.abs(l.delta), 0) / 30
    cases.push({
      id:    v.id,
      input: { logs, horizonDays: v.horizon },
      expectedOutput: { projectedUnits: Math.round(meanDaily * v.horizon) },
    })
  }

  return cases
}

let registered = false

/** Idempotent registration — call once at module load. */
export function registerConsumptionForecast(): void {
  if (registered) return
  registered = true
  registerAdapter(baselineRolling30dAdapter)
  registerAdapter(seasonalNaiveV1Adapter)
  registerObjective(consumptionForecastObjective)
}
