// Forecast-accuracy instrument — the measuring stick every P1 forecast change is
// graded against (roadmap P0.2). For a series of past cutoffs it reconstructs the
// forecast the active adapter WOULD have made at that cutoff (asOf), scores it
// against what actually got consumed over the following horizon, and aggregates
// MAPE + signed bias per basis. Pure + deterministic (asOf injected); the
// adapter's runInference is the only async seam — the same contract backtest uses.
//
// Reconstruction is faithful while adapters are pure functions of stock logs.
// Once an adapter takes external inputs (occupancy, P1.2) the forward-recorded
// forecast_observations table is the source of truth; this module then scores
// those rows instead of reconstructing. Either way the score shape is identical.

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'
import type { StockLogRow } from '../../tools/graph_reader'

const DAY = 86_400_000
const LOOKBACK_DAYS = 30   // the adapter's training window; censoring in it biases the forecast

export interface ForecastObservation {
  /** Cutoff the forecast was made at (epoch ms). */
  asOf: number
  horizonDays: number
  projectedUnits: number
  realizedUnits: number
  basis: string
  confidence: number
  sampleSize: number
  /** projected − realized: >0 over-forecast, <0 under-forecast. */
  signedError: number
  /** |projected − realized| / max(realized, 1). */
  absPctError: number
  /** Stock hit zero in the forecast's training OR realized window → observed
   *  demand is a lower bound, not true demand, so the forecast is biased low.
   *  null when balance isn't known (StockLogRow.balance_after absent). The hook
   *  P1.4 (censoring correction) acts on. */
  censored: boolean | null
}

export interface BasisScore { basis: string; n: number; mape: number; biasPct: number }

export interface ForecastAccuracyScore {
  /** Scored observations. */
  n: number
  /** Mean absolute percentage error across observations. */
  mape: number
  /** Mean signed error in units (>0 over-forecast, <0 under-forecast). */
  meanSignedError: number
  /** Mean signed percentage error (<0 = systematic under-forecast). */
  biasPct: number
  /** biasPct over censored observations only — the demand-censoring signal P1.4
   *  acts on. null when no censored observation was scored. */
  censoredBiasPct: number | null
  byBasis: BasisScore[]
}

export interface ReconstructOpts {
  horizonDays: number
  adapter: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput>
  /** Cutoffs (epoch ms) to reconstruct a forecast at. Each realized window should
   *  be fully in the past; build with rollingCutoffs. */
  cutoffs: ReadonlyArray<number>
  /** Min distinct training days before a cutoff for its observation to be scored. */
  minTrainDays?: number
  /** Q4 — occupancy context for adapters that model it. Passed through whole;
   *  the adapter slices it at each cutoff's asOf, so it can't see history that
   *  hadn't happened yet. Occupancy-blind adapters ignore it. */
  occupancy?: ConsumptionForecastInput['occupancy']
}

/** Cutoffs whose realized windows tile backwards from `now`, each fully closed.
 *  The newest realized window ends at `now`; returns `count` of them. */
export function rollingCutoffs(now: number, horizonDays: number, count: number, stepDays?: number): number[] {
  const step = (stepDays ?? horizonDays) * DAY
  const newest = now - horizonDays * DAY
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push(newest - i * step)
  return out
}

function consumedBetween(logs: ReadonlyArray<StockLogRow>, fromExclusive: number, toInclusive: number): number {
  return logs
    .filter((l) => {
      const t = new Date(l.created_at).getTime()
      return t > fromExclusive && t <= toInclusive && l.delta < 0
    })
    .reduce((s, l) => s + Math.abs(l.delta), 0)
}

/** Did stock hit zero in [from, to]? true if it touched zero, false if it stayed
 *  positive, null if no balance is recorded across the span. */
function windowCensored(logs: ReadonlyArray<StockLogRow>, fromExclusive: number, toInclusive: number): boolean | null {
  const bals = logs
    .filter((l) => {
      const t = new Date(l.created_at).getTime()
      return t > fromExclusive && t <= toInclusive
    })
    .map((l) => l.balance_after)
    .filter((b): b is number => b != null)
  if (bals.length === 0) return null
  return bals.some((b) => b <= 0)
}

export async function reconstructObservations(
  logs: ReadonlyArray<StockLogRow>,
  opts: ReconstructOpts,
): Promise<ForecastObservation[]> {
  const minTrainDays = opts.minTrainDays ?? 7
  const out: ForecastObservation[] = []
  for (const asOf of opts.cutoffs) {
    const train = logs.filter((l) => new Date(l.created_at).getTime() < asOf)
    const trainDays = new Set(train.map((l) => l.created_at.slice(0, 10))).size
    const realized = consumedBetween(logs, asOf, asOf + opts.horizonDays * DAY)
    if (trainDays < minTrainDays || realized <= 0) continue   // unscoreable

    const f = await opts.adapter.runInference({
      logs: train, horizonDays: opts.horizonDays, asOf, occupancy: opts.occupancy,
    })
    const signedError = f.projectedUnits - realized
    out.push({
      asOf,
      horizonDays:    opts.horizonDays,
      projectedUnits: f.projectedUnits,
      realizedUnits:  realized,
      basis:          f.basis,
      confidence:     f.confidence,
      sampleSize:     f.sampleSize,
      signedError,
      absPctError:    Math.abs(signedError) / Math.max(realized, 1),
      censored:       windowCensored(logs, asOf - LOOKBACK_DAYS * DAY, asOf + opts.horizonDays * DAY),
    })
  }
  return out
}

const mean = (xs: number[]): number => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

export function scoreForecastAccuracy(obs: ReadonlyArray<ForecastObservation>): ForecastAccuracyScore {
  const signedPct = (o: ForecastObservation) => o.signedError / Math.max(o.realizedUnits, 1)
  const censored = obs.filter((o) => o.censored === true)
  // Grade only where the ground truth is valid: realized sales on a stock-out
  // window are themselves capped, so scoring against them would wrongly penalise
  // the (correct) uncensored uplift. Fall back to all obs if every one is censored.
  const valid = obs.filter((o) => o.censored !== true)
  const graded = valid.length ? valid : obs
  const bases = [...new Set(graded.map((o) => o.basis))].sort()
  return {
    n:               graded.length,
    mape:            mean(graded.map((o) => o.absPctError)),
    meanSignedError: mean(graded.map((o) => o.signedError)),
    biasPct:         mean(graded.map(signedPct)),
    censoredBiasPct: censored.length ? mean(censored.map(signedPct)) : null,
    byBasis: bases.map((b) => {
      const bs = graded.filter((o) => o.basis === b)
      return { basis: b, n: bs.length, mape: mean(bs.map((o) => o.absPctError)), biasPct: mean(bs.map(signedPct)) }
    }),
  }
}
