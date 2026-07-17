// Layer: compute (Logic Tool, category 'logic'). The operator-facing view of the
// occupancy-v1 adapter: scale a variant's baseline demand by EXPECTED occupancy
// over the horizon and show the uplift. When occupancy is known to run above the
// recent norm (a group/event week), demand is lifted ahead of the rush — the
// value occupancy adds beyond the day-of-week pattern.
//
// It DELEGATES the projection to occupancyV1Adapter rather than re-implementing
// the uplift. It used to carry its own copy, which drifted: the adapter's
// histMean is the 30 days matching its base-rate window, while this took 60 —
// so the surfaced number and the graded model disagreed, and the tool re-applied
// a shift the base rate already contained (the same double-count fixed in the
// adapter). One model now: what the operator sees is what the instrument grades.
//
// Uses a dedicated reader (not GraphReader) so it stays decoupled.

import { z } from 'zod'
import type { LogicTool } from '../index'
import type { StockLogRow } from '../graph_reader'
import type { OccupancyPoint } from '../../objectives/consumption_forecast/types'
import { ewmaV1Adapter } from '../../objectives/consumption_forecast/ewma_v1'
import { occupancyV1Adapter } from '../../objectives/consumption_forecast/occupancy_v1'

const DAY = 86_400_000
const HIST_WINDOW_DAYS = 30   // display only; the adapter slices its own
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export interface OccupancyContext {
  /** Occupancy % by ISO date — history AND forward booking forecasts. The
   *  adapter slices it at `asOf`; a precomputed mean can't be re-sliced, which is
   *  how the old copy drifted from the graded model. */
  series: ReadonlyArray<OccupancyPoint>
  /** Category occupancy-demand elasticity, 0–1 (0 = demand ignores occupancy). */
  sensitivity: number
}

export interface OccupancyForecastReader {
  getStockLogs(variantId: string, sinceDays: number): Promise<StockLogRow[]>
  getOccupancyContext(hotelId: string, variantId: string, sinceDays: number): Promise<OccupancyContext>
}

const inputSchema = z.object({
  variantId:   z.string().uuid(),
  hotelId:     z.string().uuid(),
  horizonDays: z.number().int().min(1).max(90).default(7),
})

const outputSchema = z.object({
  variantId:          z.string().uuid(),
  baselineProjected:  z.number().nonnegative(),
  adjustedProjected:  z.number().nonnegative(),
  upliftPct:          z.number(),
  avgForwardOccupancy: z.number(),
  histMeanOccupancy:  z.number(),
  sensitivity:        z.number(),
  basis:              z.string(),
  confidence:         z.number().min(0).max(1),
})

export type OccupancyAdjustedForecastInput = z.input<typeof inputSchema>
export type OccupancyAdjustedForecastOutput = z.infer<typeof outputSchema>

export function makeOccupancyAdjustedForecastTool(
  reader: OccupancyForecastReader,
): LogicTool<OccupancyAdjustedForecastInput, OccupancyAdjustedForecastOutput> {
  return {
    name: 'occupancy_adjusted_forecast',
    category: 'logic',
    kind: 'inproc',
    version: '1.1.0',
    description:
      'Scales a variant\'s baseline demand by expected occupancy over the horizon (forward booking ' +
      'forecasts × the category occupancy-sensitivity). Returns baseline vs occupancy-adjusted projected ' +
      'units and the % uplift. Use to pre-empt demand spikes from known high-occupancy / event days.',
    inputSchema,
    outputSchema,
    traversableLinks: ['consumes'],
    invoke: async (input) => {
      const horizon = input.horizonDays ?? 7
      const now = Date.now()
      const logs = await reader.getStockLogs(input.variantId, 35)
      const occ = await reader.getOccupancyContext(input.hotelId, input.variantId, 60)

      // Baseline: the same EWMA level the adapter builds on, so the uplift is the
      // only difference between the two numbers.
      const baseline = Math.round(
        (await ewmaV1Adapter.runInference({ logs, horizonDays: 1, asOf: now })).projectedUnits * horizon,
      )
      const adjusted = (await occupancyV1Adapter.runInference({
        logs, horizonDays: horizon, asOf: now,
        occupancy: { series: occ.series, sensitivity: occ.sensitivity },
      }))

      // Display-only slices, matching what the adapter reasoned over.
      const from = iso(now - HIST_WINDOW_DAYS * DAY)
      const past = occ.series.filter((p) => p.date > from && p.date <= iso(now))
      const histMean = past.length ? past.reduce((s, p) => s + p.pct, 0) / past.length : 0
      const fwd = occ.series.filter((p) => p.date > iso(now) && p.date <= iso(now + horizon * DAY))

      const upliftPct = baseline > 0 ? Number(((adjusted.projectedUnits - baseline) / baseline).toFixed(3)) : 0

      return {
        variantId:           input.variantId,
        baselineProjected:   baseline,
        adjustedProjected:   adjusted.projectedUnits,
        upliftPct,
        avgForwardOccupancy: fwd.length ? Number((fwd.reduce((s, p) => s + p.pct, 0) / fwd.length).toFixed(1)) : 0,
        histMeanOccupancy:   Number(histMean.toFixed(1)),
        sensitivity:         occ.sensitivity,
        basis:               'occupancy-adjusted-v1',
        confidence:          adjusted.confidence,
      }
    },
  }
}
