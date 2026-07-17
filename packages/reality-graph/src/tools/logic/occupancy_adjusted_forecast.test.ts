import { describe, expect, it } from 'vitest'
import { makeOccupancyAdjustedForecastTool, type OccupancyContext, type OccupancyForecastReader } from './occupancy_adjusted_forecast'
import { ids } from '../__fixtures__/fakeReader'
import type { StockLogRow } from '../graph_reader'

const DAY = 86_400_000
const at = (k: number) => new Date(Date.now() - k * DAY).toISOString()
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const steadyLogs = (rate: number): StockLogRow[] =>
  Array.from({ length: 30 }, (_, k) => ({ id: `l-${String(k)}`, variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -rate, created_at: at(k) }))

/** History at `histPct` for the last 30d, forward at `fwdPct` for the next 7d.
 *  The tool hands the whole series to the adapter, which slices it at now — the
 *  same window its base rate came from. */
const series = (histPct: number, fwdPct: number | null, fwdDays = 7) => [
  ...Array.from({ length: 30 }, (_, k) => ({ date: iso(Date.now() - (k + 1) * DAY), pct: histPct })),
  ...(fwdPct == null ? [] : Array.from({ length: fwdDays }, (_, i) => ({ date: iso(Date.now() + (i + 1) * DAY), pct: fwdPct }))),
]

function reader(occ: OccupancyContext): OccupancyForecastReader {
  return {
    getStockLogs: () => Promise.resolve(steadyLogs(10)),   // baseline 10/day → 70 over 7d
    getOccupancyContext: () => Promise.resolve(occ),
  }
}

describe('occupancy_adjusted_forecast', () => {
  it('lifts demand when forward occupancy runs above the recent mean', async () => {
    const tool = makeOccupancyAdjustedForecastTool(reader({ series: series(60, 78), sensitivity: 0.5 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.baselineProjected).toBe(70)
    expect(r.adjustedProjected).toBeGreaterThan(r.baselineProjected)
    expect(r.upliftPct).toBeGreaterThan(0.1)              // ~+15% at 30% above mean, sensitivity 0.5
    expect(r.avgForwardOccupancy).toBeCloseTo(78, 0)
    expect(r.histMeanOccupancy).toBeCloseTo(60, 0)
  })

  it('lowers demand when forward occupancy runs below the mean', async () => {
    const tool = makeOccupancyAdjustedForecastTool(reader({ series: series(60, 42), sensitivity: 0.5 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.adjustedProjected).toBeLessThan(r.baselineProjected)
  })

  it('no adjustment when the category is occupancy-insensitive', async () => {
    const tool = makeOccupancyAdjustedForecastTool(reader({ series: series(60, 90), sensitivity: 0 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.adjustedProjected).toBe(r.baselineProjected)
    expect(r.upliftPct).toBe(0)
  })

  it('falls back to baseline with low confidence when no forward occupancy exists', async () => {
    const tool = makeOccupancyAdjustedForecastTool(reader({ series: series(60, null), sensitivity: 0.5 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.adjustedProjected).toBe(r.baselineProjected)
    expect(r.confidence).toBeLessThan(0.4)
  })

  it('does not re-apply a shift the base rate already contains', async () => {
    // The hotel has been full for the last 30 days and stays full — the EWMA base
    // rate already reflects it, so there is no NEW information and no uplift. The
    // old copy took histMean over 60 days (half of it quiet) and lifted anyway.
    const tool = makeOccupancyAdjustedForecastTool(reader({ series: series(95, 95), sensitivity: 0.9 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.adjustedProjected).toBe(r.baselineProjected)
    expect(r.upliftPct).toBe(0)
  })
})
