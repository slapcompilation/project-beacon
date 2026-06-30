// Shared building blocks for the smoothing adapters (EWMA, Holt-linear).
// buildDailySeries turns stock logs into a regular per-calendar-day consumption
// series over the observed window [earliest in-window log .. asOf], capped at
// lookbackDays, gaps filled with 0. Oldest → newest. fitConfidence turns the
// model's own one-step residuals into a MEASURED confidence — not a heuristic.

import type { StockLogRow } from '../../tools/graph_reader'

const DAY = 86_400_000

export function buildDailySeries(
  logs: ReadonlyArray<StockLogRow>, asOf: number, lookbackDays: number,
): number[] {
  const windowStart = asOf - lookbackDays * DAY
  const byDay = new Map<string, number>()
  let earliest = Infinity
  let latest   = -Infinity
  for (const l of logs) {
    if (l.delta >= 0) continue
    const t = new Date(l.created_at).getTime()
    if (t < windowStart || t > asOf) continue
    const key = l.created_at.slice(0, 10)
    byDay.set(key, (byDay.get(key) ?? 0) + Math.abs(l.delta))
    if (t < earliest) earliest = t
    if (t > latest)   latest = t
  }
  if (!isFinite(latest)) return []
  // Anchor the series at the LAST day with data, not asOf: the current/asOf day
  // is usually empty (no logs yet, or excluded by a strict cutoff) and a trailing
  // zero would drag a recency-weighted model down into a false under-forecast.
  // Interior gaps stay 0 — those are genuine zero-demand days.
  const n = Math.min(lookbackDays, Math.floor((latest - earliest) / DAY) + 1)
  const series: number[] = []
  for (let i = n - 1; i >= 0; i--) {
    series.push(byDay.get(new Date(latest - i * DAY).toISOString().slice(0, 10)) ?? 0)
  }
  return series
}

/** Measured confidence in [0.3, 0.95] from one-step in-sample fit. `oneStep[i]`
 *  is the model's forecast of `series[i]` made from data through i−1. Good fit
 *  (low error relative to the level) + enough history → high confidence. */
export function fitConfidence(series: ReadonlyArray<number>, oneStep: ReadonlyArray<number>): number {
  if (series.length < 2) return 0.3
  let absErr = 0
  for (let i = 1; i < series.length; i++) absErr += Math.abs(series[i] - (oneStep[i] ?? 0))
  const meanAbs   = absErr / (series.length - 1)
  const meanLevel = series.reduce((s, v) => s + v, 0) / series.length
  const cv          = meanAbs / Math.max(meanLevel, 1)
  const lengthFactor = Math.min(1, series.length / 14)
  return Number(Math.max(0.3, Math.min(0.95, (1 - cv) * lengthFactor)).toFixed(2))
}
