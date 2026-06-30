// Layer: compute (Logic Tool, category 'logic'). The typed port of the legacy SQL
// get_occupancy_adjusted_forecast: scale a variant's baseline daily demand by the
// EXPECTED occupancy over the horizon, using forward booking forecasts and the
// variant's category occupancy-sensitivity (elasticity). When occupancy is known
// to run above the historical norm (a group/event week), demand is lifted ahead
// of the rush — the value occupancy adds beyond the day-of-week pattern.
//
//   day demand = baseRate · (1 + sensitivity · (expectedOcc − histMean) / histMean)
//
// Uses a dedicated reader (not GraphReader) so it stays decoupled. Surfaced on the
// variant view; the copilot can call it. Becoming a competing auto-select adapter
// is deferred until occupancy data is fresh enough for the instrument to grade it.

import { z } from 'zod'
import type { LogicTool } from '../index'
import type { StockLogRow } from '../graph_reader'
import { ewmaV1Adapter } from '../../objectives/consumption_forecast/ewma_v1'

const DAY = 86_400_000

export interface OccupancyContext {
  /** Mean historical occupancy % over the lookback. */
  histMean: number
  /** Forward expected occupancy by ISO date (yyyy-mm-dd) from booking forecasts. */
  forward: ReadonlyArray<{ date: string; pct: number }>
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
    version: '1.0.0',
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
      // Baseline daily rate = the default EWMA level (horizon 1 → the daily rate).
      const baseRate = (await ewmaV1Adapter.runInference({ logs, horizonDays: 1, asOf: now })).projectedUnits
      const occ = await reader.getOccupancyContext(input.hotelId, input.variantId, 60)

      const baseline = Math.round(baseRate * horizon)
      const fwd = new Map(occ.forward.map((f) => [f.date, f.pct]))

      let adjusted = 0
      let occSum = 0
      let occDays = 0
      for (let d = 1; d <= horizon; d++) {
        const key = new Date(now + d * DAY).toISOString().slice(0, 10)
        const known = fwd.get(key)
        const expectedOcc = known ?? occ.histMean
        if (known != null) { occSum += known; occDays++ }
        const mult = occ.histMean > 0
          ? 1 + occ.sensitivity * (expectedOcc - occ.histMean) / occ.histMean
          : 1
        adjusted += Math.max(0, baseRate * mult)
      }
      adjusted = Math.round(adjusted)

      const upliftPct = baseline > 0 ? Number(((adjusted - baseline) / baseline).toFixed(3)) : 0
      const coverage = occDays / horizon
      // Confident only when forward occupancy actually covers the horizon.
      const confidence = Number(Math.max(0.3, Math.min(0.9, 0.35 + coverage * 0.55)).toFixed(2))

      return {
        variantId:           input.variantId,
        baselineProjected:   baseline,
        adjustedProjected:   adjusted,
        upliftPct,
        avgForwardOccupancy: occDays ? Number((occSum / occDays).toFixed(1)) : 0,
        histMeanOccupancy:   Number(occ.histMean.toFixed(1)),
        sensitivity:         occ.sensitivity,
        basis:               'occupancy-adjusted-v1',
        confidence,
      }
    },
  }
}
