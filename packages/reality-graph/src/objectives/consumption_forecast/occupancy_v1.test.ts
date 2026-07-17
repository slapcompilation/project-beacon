import { describe, expect, it } from 'vitest'
import { occupancyV1Adapter } from './occupancy_v1'
import { autoSelectV1Adapter } from './auto_select_v1'
import type { StockLogRow } from '../../tools/graph_reader'
import type { OccupancyPoint } from './types'

const DAY = 86_400_000
const ASOF = Date.UTC(2026, 6, 16)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Flat 10/day for `days` before asOf — so any deviation is occupancy's doing. */
const flatLogs = (days = 40, rate = 10): StockLogRow[] =>
  Array.from({ length: days }, (_, k) => ({
    id: `l-${String(k)}`, variant_id: 'v1', hotel_id: 'h1',
    delta: -rate, created_at: new Date(ASOF - (k + 1) * DAY).toISOString(),
  }))

/** Occupancy at `histPct` for the past, `fwdPct` for the next 14 days. */
const series = (histPct: number, fwdPct: number): OccupancyPoint[] => [
  ...Array.from({ length: 30 }, (_, k) => ({ date: iso(ASOF - (k + 1) * DAY), pct: histPct })),
  ...Array.from({ length: 14 }, (_, k) => ({ date: iso(ASOF + (k + 1) * DAY), pct: fwdPct })),
]

describe('occupancy-v1 adapter', () => {
  it('lifts demand when the hotel will be fuller than normal', async () => {
    const r = await occupancyV1Adapter.runInference({
      logs: flatLogs(), horizonDays: 7, asOf: ASOF,
      occupancy: { series: series(50, 100), sensitivity: 0.9 },   // +100% occupancy
    })
    // baseRate 10/day → flat would be 70. +100% occ x 0.9 elasticity → ~+90%.
    expect(r.projectedUnits).toBeGreaterThan(120)
    expect(r.basis).toBe('occupancy-v1')
  })

  it('cuts demand when the hotel will be emptier than normal', async () => {
    const r = await occupancyV1Adapter.runInference({
      logs: flatLogs(), horizonDays: 7, asOf: ASOF,
      occupancy: { series: series(80, 40), sensitivity: 0.9 },
    })
    expect(r.projectedUnits).toBeLessThan(70)
  })

  it('scales the uplift by the category elasticity', async () => {
    const opts = { logs: flatLogs(), horizonDays: 7, asOf: ASOF }
    const elastic = await occupancyV1Adapter.runInference({ ...opts, occupancy: { series: series(50, 100), sensitivity: 0.9 } })
    const rigid   = await occupancyV1Adapter.runInference({ ...opts, occupancy: { series: series(50, 100), sensitivity: 0.45 } })
    expect(elastic.projectedUnits).toBeGreaterThan(rigid.projectedUnits)
  })

  it('degrades to EWMA at capped confidence when no occupancy is supplied', async () => {
    const r = await occupancyV1Adapter.runInference({ logs: flatLogs(), horizonDays: 7, asOf: ASOF })
    expect(r.projectedUnits).toBeCloseTo(70, -1)   // just the EWMA level
    expect(r.confidence).toBeLessThanOrEqual(0.3)  // won't be picked on evidence it lacks
  })

  it('degrades when the category has zero elasticity (demand ignores occupancy)', async () => {
    const r = await occupancyV1Adapter.runInference({
      logs: flatLogs(), horizonDays: 7, asOf: ASOF,
      occupancy: { series: series(50, 100), sensitivity: 0 },
    })
    expect(r.confidence).toBeLessThanOrEqual(0.3)
  })

  it('measures uplift against the RECENT norm, not the whole history', async () => {
    // Demand (and so the EWMA base rate) has already adjusted to a hotel that has
    // been full for the last 30 days. Occupancy stays full. There is no NEW
    // information, so there must be no uplift — taking histMean over all history
    // (which includes a quiet winter) re-applies a shift the base rate already
    // contains: a systematic over-forecast. Measured at +6.3% bias before the fix.
    const series: OccupancyPoint[] = [
      ...Array.from({ length: 120 }, (_, k) => ({ date: iso(ASOF - (k + 31) * DAY), pct: 50 })),  // quiet winter, long ago
      ...Array.from({ length: 30 },  (_, k) => ({ date: iso(ASOF - (k + 1) * DAY),  pct: 95 })),  // recent: full
      ...Array.from({ length: 14 },  (_, k) => ({ date: iso(ASOF + (k + 1) * DAY),  pct: 95 })),  // forward: still full
    ]
    const r = await occupancyV1Adapter.runInference({
      logs: flatLogs(), horizonDays: 7, asOf: ASOF, occupancy: { series, sensitivity: 0.9 },
    })
    // baseRate 10/day already reflects the full hotel → 7 days ≈ 70, no lift.
    expect(r.projectedUnits).toBeCloseTo(70, -1)
  })

  it('never sees occupancy from after asOf as history (backtest honesty)', async () => {
    // History says 50; the future says 100. If the adapter averaged the WHOLE
    // series into histMean it would leak the future and under-lift.
    const r = await occupancyV1Adapter.runInference({
      logs: flatLogs(), horizonDays: 7, asOf: ASOF,
      occupancy: { series: series(50, 100), sensitivity: 0.9 },
    })
    const leaky = await occupancyV1Adapter.runInference({
      logs: flatLogs(), horizonDays: 7, asOf: ASOF,
      // same forward, but history already at 100 → no uplift to find
      occupancy: { series: series(100, 100), sensitivity: 0.9 },
    })
    expect(r.projectedUnits).toBeGreaterThan(leaky.projectedUnits)
  })
})

describe('auto-select with occupancy-v1 as a candidate', () => {
  it('does not switch to occupancy-v1 when no occupancy is supplied', async () => {
    const r = await autoSelectV1Adapter.runInference({ logs: flatLogs(60), horizonDays: 7, asOf: ASOF })
    expect(r.basis).not.toContain('occupancy-v1')
  })
})
