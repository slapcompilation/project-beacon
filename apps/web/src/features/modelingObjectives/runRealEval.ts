// Grades every candidate adapter on REAL production demand (roadmap Q5).
//
// The synthetic suite scored each adapter on how closely it reproduced the flat
// 30-day mean (`expectedOutput = meanDaily x horizon`) — conformity to the very
// baseline we're trying to beat, not accuracy. It ranked ewma 0.2 vs auto-select
// 0.9, i.e. it would have recommended DEMOTING the better model. A promotion
// loop fed that way is worse than a dormant one.
//
// This holds out the most recent `holdoutDays` of real stock logs, runs each
// adapter on the prior window, and scores its projection against what actually
// got consumed — via backtestForecastAdapters, the same harness the objective
// already ships. Metrics stay 'mae'/'rmse' (same names, real ground truth) so
// the promotion banner works unchanged; cohort slices land as extra 'mape' rows.

import {
  backtestForecastAdapters,
  type BacktestCase,
  type ModelAdapter,
} from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { makeSupabaseGraphReader } from '@/features/agents/graphReader'
import { fetchGradeableVariants, recordEvalRun } from './api'

const LOOKBACK_DAYS = 30

export interface RealEvalSummary {
  holdoutDays: number
  cases:       number
  /** Lowest-MAPE adapter with at least one scored case. */
  winner:      string | null
  perAdapter:  Array<{ adapter: string; mae: number; rmse: number; mape: number; bias: number; scored: number }>
}

/** Cohort per variant — its category. Real slices (Mixers vs Spirits) so a
 *  regression hidden in the overall number shows up where it lives. */
async function cohortByVariant(variantIds: string[]): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('product_variants')
    .select('id, product:products(category:categories(name))')
    .in('id', variantIds)
  const out = new Map<string, string>()
  for (const r of (data ?? []) as Array<{ id: string; product?: { category?: { name?: string } | null } | null }>) {
    out.set(r.id, r.product?.category?.name ?? 'uncategorised')
  }
  return out
}

export async function runRealBacktestEval(args: {
  adapters:       ReadonlyArray<ModelAdapter>
  objectiveName:  string
  hotelId:        string
  organizationId: string | null
  userId:         string | null
  holdoutDays?:   number
}): Promise<RealEvalSummary> {
  const holdoutDays = args.holdoutDays ?? 7
  const variants = await fetchGradeableVariants(args.hotelId)
  const cohorts = await cohortByVariant(variants.map((v) => v.variant_id))
  const reader = makeSupabaseGraphReader()

  // Enough history for the training window plus the held-out days.
  const since = LOOKBACK_DAYS + holdoutDays * 2
  const cases: BacktestCase[] = await Promise.all(variants.map(async (v) => ({
    variantId: v.variant_id,
    label:     v.variant_name,
    cohort:    cohorts.get(v.variant_id) ?? 'uncategorised',
    logs:      await reader.getStockLogs(v.variant_id, since),
  })))

  // The objective registers its candidates as generic ModelAdapter; the backtest
  // is typed to the consumption-forecast IO. Same objects, narrower signature.
  const typed = args.adapters as unknown as Parameters<typeof backtestForecastAdapters>[0]
  const result = await backtestForecastAdapters(typed, cases, { holdoutDays })

  const perAdapter: RealEvalSummary['perAdapter'] = []
  for (const adapter of args.adapters) {
    const ps = result.predictions.filter((p) => p.adapter === adapter.name && p.scored)
    if (ps.length === 0) continue
    // True error against realized consumption — not distance from a baseline.
    const mae  = mean(ps.map((p) => Math.abs(p.predicted - p.actual)))
    const rmse = Math.sqrt(mean(ps.map((p) => (p.predicted - p.actual) ** 2)))
    const score = result.scores.find((s) => s.adapter === adapter.name)
    const dataset = `stock_logs:real-backtest-${String(holdoutDays)}d`

    for (const [metric, value] of [['mae', mae], ['rmse', rmse]] as const) {
      await recordEvalRun({
        organizationId: args.organizationId, objectiveName: args.objectiveName,
        adapterName: adapter.name, adapterVersion: adapter.version,
        dataset, metric, value: Number(value.toFixed(4)),
        caseCount: ps.length, subset: 'overall', triggeredByUserId: args.userId,
      })
    }
    // Cohort slices — a per-category regression the overall MAPE would hide.
    for (const co of score?.byCohort ?? []) {
      await recordEvalRun({
        organizationId: args.organizationId, objectiveName: args.objectiveName,
        adapterName: adapter.name, adapterVersion: adapter.version,
        dataset, metric: 'mape', value: Number(co.mape.toFixed(4)),
        caseCount: co.cases, subset: co.cohort, triggeredByUserId: args.userId,
      })
    }

    perAdapter.push({
      adapter: adapter.name,
      mae: round4(mae), rmse: round4(rmse),
      mape: round4(score?.mape ?? 0), bias: round4(score?.bias ?? 0),
      scored: ps.length,
    })
  }

  return { holdoutDays, cases: cases.length, winner: result.winner, perAdapter }
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const round4 = (x: number) => Number(x.toFixed(4))
