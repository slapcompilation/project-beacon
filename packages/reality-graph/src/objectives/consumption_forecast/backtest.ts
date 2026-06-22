// Backtest harness for the consumption_forecast objective — the "evaluate"
// half of the AIP modeling loop. Hold out the most recent `holdoutDays`, run
// each candidate adapter on the prior window, and score its projection against
// what actually got consumed. Pure + deterministic (now is injected); the
// adapters' runInference is the only async seam.
//
// This is also the eval-cohort engine: every prediction carries a cohort label,
// so scores break down per slice (perishable vs shelf-stable, category, hotel)
// and a regression hidden in the overall MAPE shows up per cohort.

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'
import type { StockLogRow } from '../../tools/graph_reader'

export interface BacktestCase {
  variantId: string
  label: string
  /** Eval-cohort slice this case belongs to. */
  cohort: string
  /** Full history including the holdout window. */
  logs: ReadonlyArray<StockLogRow>
}

export interface BacktestConfig {
  /** Days held out at the end as the "actual" to score against. */
  holdoutDays: number
  /** Min distinct training days + positive actual for a case to be scored. */
  minTrainDays?: number
  /** Injected for deterministic tests. */
  now?: Date
}

export interface CasePrediction {
  variantId: string
  label: string
  cohort: string
  adapter: string
  predicted: number
  actual: number
  /** Absolute percentage error |predicted-actual|/actual. */
  ape: number
  /** Signed percentage error (negative = under-forecast). */
  signedBias: number
  /** Excluded from aggregates when false (too little history / no actual). */
  scored: boolean
}

export interface CohortScore { cohort: string; cases: number; mape: number; bias: number }
export interface AdapterScore { adapter: string; cases: number; mape: number; bias: number; byCohort: CohortScore[] }
export interface BacktestResult {
  scores: AdapterScore[]
  predictions: CasePrediction[]
  /** Lowest-MAPE adapter with at least one scored case. */
  winner: string | null
}

export async function backtestForecastAdapters(
  adapters: ReadonlyArray<ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput>>,
  cases: ReadonlyArray<BacktestCase>,
  cfg: BacktestConfig,
): Promise<BacktestResult> {
  const now = cfg.now ?? new Date()
  const cutoff = new Date(now.getTime() - cfg.holdoutDays * 86_400_000)
  const minTrainDays = cfg.minTrainDays ?? 7
  const predictions: CasePrediction[] = []

  for (const c of cases) {
    const train = c.logs.filter((l) => new Date(l.created_at) < cutoff)
    const holdout = c.logs.filter((l) => new Date(l.created_at) >= cutoff)
    const actual = holdout.filter((l) => l.delta < 0).reduce((s, l) => s + Math.abs(l.delta), 0)
    const trainDays = new Set(train.map((l) => l.created_at.slice(0, 10))).size
    const scored = trainDays >= minTrainDays && actual > 0

    for (const a of adapters) {
      const out = await a.runInference({ logs: train, horizonDays: cfg.holdoutDays })
      const predicted = out.projectedUnits
      predictions.push({
        variantId: c.variantId, label: c.label, cohort: c.cohort, adapter: a.name,
        predicted, actual,
        ape:        actual > 0 ? Math.abs(predicted - actual) / actual : 0,
        signedBias: actual > 0 ? (predicted - actual) / actual : 0,
        scored,
      })
    }
  }

  const scores: AdapterScore[] = adapters.map((a) => {
    const ps = predictions.filter((p) => p.adapter === a.name && p.scored)
    const cohorts = [...new Set(ps.map((p) => p.cohort))].sort()
    return {
      adapter: a.name,
      cases: ps.length,
      mape: mean(ps.map((p) => p.ape)),
      bias: mean(ps.map((p) => p.signedBias)),
      byCohort: cohorts.map((co) => {
        const cps = ps.filter((p) => p.cohort === co)
        return { cohort: co, cases: cps.length, mape: mean(cps.map((p) => p.ape)), bias: mean(cps.map((p) => p.signedBias)) }
      }),
    }
  })

  const winner = scores.filter((s) => s.cases > 0).sort((a, b) => a.mape - b.mape)[0]?.adapter ?? null
  return { scores, predictions, winner }
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0
}
