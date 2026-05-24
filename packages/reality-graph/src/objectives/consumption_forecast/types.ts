// Shared I/O contract for every consumption_forecast adapter.
// Adapters take recent stock logs + a horizon; they return projected units,
// basis tag, sample size, and confidence. Two adapters share this shape so
// the Logic Tool can swap implementations without re-typing callers.

import type { StockLogRow } from '../../tools/graph_reader'

export interface ConsumptionForecastInput {
  /** Stock logs for the variant; consumption is the negative deltas. */
  logs: ReadonlyArray<StockLogRow>
  /** How far ahead to project. */
  horizonDays: number
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
