import { describe, expect, it } from 'vitest'
import { makeOccupancyAdjustedForecastTool, type OccupancyContext, type OccupancyForecastReader } from './occupancy_adjusted_forecast'
import { ids } from '../__fixtures__/fakeReader'
import type { StockLogRow } from '../graph_reader'

const DAY = 86_400_000
const at = (k: number) => new Date(Date.now() - k * DAY).toISOString()
const steadyLogs = (rate: number): StockLogRow[] =>
  Array.from({ length: 30 }, (_, k) => ({ id: `l-${k}`, variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -rate, created_at: at(k) }))

// Forward occupancy at a flat pct for the next `days` days (matching tool's date keys).
const forwardAt = (pct: number, days = 7) =>
  Array.from({ length: days }, (_, i) => ({ date: new Date(Date.now() + (i + 1) * DAY).toISOString().slice(0, 10), pct }))

function reader(occ: OccupancyContext): OccupancyForecastReader {
  return {
    getStockLogs: () => Promise.resolve(steadyLogs(10)),   // baseline 10/day → 70 over 7d
    getOccupancyContext: () => Promise.resolve(occ),
  }
}

describe('occupancy_adjusted_forecast', () => {
  it('lifts demand when forward occupancy runs above the historical mean', async () => {
    const tool = makeOccupancyAdjustedForecastTool(reader({ histMean: 60, forward: forwardAt(78), sensitivity: 0.5 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.baselineProjected).toBe(70)
    expect(r.adjustedProjected).toBeGreaterThan(r.baselineProjected)
    expect(r.upliftPct).toBeGreaterThan(0.1)              // ~+15% at 30% above mean, sensitivity 0.5
    expect(r.avgForwardOccupancy).toBeCloseTo(78, 0)
  })

  it('lowers demand when forward occupancy runs below the mean', async () => {
    const tool = makeOccupancyAdjustedForecastTool(reader({ histMean: 60, forward: forwardAt(42), sensitivity: 0.5 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.adjustedProjected).toBeLessThan(r.baselineProjected)
  })

  it('no adjustment when the category is occupancy-insensitive', async () => {
    const tool = makeOccupancyAdjustedForecastTool(reader({ histMean: 60, forward: forwardAt(90), sensitivity: 0 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.adjustedProjected).toBe(r.baselineProjected)
    expect(r.upliftPct).toBe(0)
  })

  it('falls back to baseline with low confidence when no forward occupancy exists', async () => {
    const tool = makeOccupancyAdjustedForecastTool(reader({ histMean: 60, forward: [], sensitivity: 0.5 }))
    const r = await tool.invoke({ variantId: ids.variant1, hotelId: ids.hotelA, horizonDays: 7 })
    expect(r.adjustedProjected).toBe(r.baselineProjected)
    expect(r.confidence).toBeLessThan(0.4)
  })
})
