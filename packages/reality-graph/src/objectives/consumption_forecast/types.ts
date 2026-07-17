// Shared I/O contract for every consumption_forecast adapter.
// Adapters take recent stock logs + a horizon; they return projected units,
// basis tag, sample size, and confidence. Two adapters share this shape so
// the Logic Tool can swap implementations without re-typing callers.

import type { StockLogRow } from '../../tools/graph_reader'

export interface OccupancyPoint {
  /** ISO date, yyyy-mm-dd. */
  date: string
  /** Occupancy %, 0–100. */
  pct: number
}

/** External demand driver (Q4). Adapters that don't model occupancy ignore it,
 *  so this stays additive — every existing adapter is still a pure function of
 *  logs. The series spans history AND forward; the adapter slices it at `asOf`,
 *  which is what keeps a backtest honest about what was knowable when. */
export interface OccupancyInput {
  series: ReadonlyArray<OccupancyPoint>
  /** Category occupancy-demand elasticity, 0–1 (0 = demand ignores occupancy). */
  sensitivity: number
}

export interface ConsumptionForecastInput {
  /** Stock logs for the variant; consumption is the negative deltas. */
  logs: ReadonlyArray<StockLogRow>
  /** How far ahead to project. */
  horizonDays: number
  /** Reference "now" (epoch ms) the rolling window ends at. Defaults to the
   *  current time; the backtest passes its holdout cutoff so an adapter never
   *  reads the wall clock during evaluation. */
  asOf?: number
  /** Occupancy context. Optional: absent → occupancy-blind adapters are
   *  unaffected, and occupancy-v1 degrades rather than guessing. */
  occupancy?: OccupancyInput
}

export interface ConsumptionForecastOutput {
  projectedUnits: number
  /** Identifier of the algorithm — flips when the active adapter changes. */
  basis: string
  /** Confidence in the projection, 0–1. */
  confidence: number
  /** Number of stock-log rows the projection saw. */
  sampleSize: number
}
