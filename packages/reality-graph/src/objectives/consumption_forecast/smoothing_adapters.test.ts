import { describe, expect, it } from 'vitest'
import { ewmaV1Adapter } from './ewma_v1'
import { holtLinearV1Adapter } from './holt_linear_v1'
import { baselineRolling30dAdapter } from './baseline_rolling_30d'
import type { StockLogRow } from '../../tools/graph_reader'

const DAY = 86_400_000
const NOW = new Date('2026-06-01T12:00:00.000Z').getTime()
const at = (k: number) => new Date(NOW - k * DAY).toISOString()
const log = (k: number, delta: number): StockLogRow => ({ id: `l-${k}-${delta}`, variant_id: 'v1', hotel_id: 'h1', delta, created_at: at(k) })

describe('EWMA vs baseline — recency', () => {
  it('tracks a recent level shift the flat average misses', async () => {
    // 20 stale days at 2/day, then 10 recent days at 10/day. True recent rate is 10.
    const logs = [
      ...Array.from({ length: 20 }, (_, i) => log(29 - i, -2)),   // days 29..10
      ...Array.from({ length: 10 }, (_, i) => log(9 - i, -10)),   // days 9..0
    ]
    const ewma     = await ewmaV1Adapter.runInference({ logs, horizonDays: 7, asOf: NOW })
    const baseline = await baselineRolling30dAdapter.runInference({ logs, horizonDays: 7, asOf: NOW })
    const realized = 70   // if the recent 10/day holds for the next 7 days

    expect(ewma.projectedUnits).toBeGreaterThan(baseline.projectedUnits)
    // EWMA is much closer to what actually consumes than the stale-weighted average.
    expect(Math.abs(ewma.projectedUnits - realized)).toBeLessThan(Math.abs(baseline.projectedUnits - realized))
  })
})

describe('Holt-linear — trend', () => {
  it('projects a rising trend higher than the flat-level EWMA', async () => {
    // Linearly increasing demand 1..30.
    const logs = Array.from({ length: 30 }, (_, i) => log(29 - i, -(i + 1)))
    const holt = await holtLinearV1Adapter.runInference({ logs, horizonDays: 7, asOf: NOW })
    const ewma = await ewmaV1Adapter.runInference({ logs, horizonDays: 7, asOf: NOW })
    expect(holt.projectedUnits).toBeGreaterThan(ewma.projectedUnits)   // trend carried forward
  })

  it('never projects negative consumption on a steep decay', async () => {
    const logs = Array.from({ length: 30 }, (_, i) => log(29 - i, -Math.max(0, 30 - i)))   // 30→1 then would go negative
    const holt = await holtLinearV1Adapter.runInference({ logs, horizonDays: 14, asOf: NOW })
    expect(holt.projectedUnits).toBeGreaterThanOrEqual(0)
  })
})

describe('confidence is measured, not assumed', () => {
  it('is high on a clean fit and lower on a noisy one', async () => {
    const flat  = Array.from({ length: 30 }, (_, i) => log(29 - i, -5))
    const noisy = Array.from({ length: 30 }, (_, i) => log(29 - i, -(i % 2 === 0 ? 0 : 10)))   // 0,10,0,10…
    const flatR  = await ewmaV1Adapter.runInference({ logs: flat,  horizonDays: 7, asOf: NOW })
    const noisyR = await ewmaV1Adapter.runInference({ logs: noisy, horizonDays: 7, asOf: NOW })
    expect(flatR.confidence).toBeGreaterThan(noisyR.confidence)
    expect(flatR.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it('returns a zero projection with floor confidence on no history', async () => {
    const r = await ewmaV1Adapter.runInference({ logs: [], horizonDays: 7, asOf: NOW })
    expect(r.projectedUnits).toBe(0)
    expect(r.confidence).toBe(0.3)
    expect(r.sampleSize).toBe(0)
  })
})
