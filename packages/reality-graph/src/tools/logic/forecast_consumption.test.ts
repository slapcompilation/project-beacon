import { describe, expect, it } from 'vitest'
import { makeForecastConsumptionTool } from './forecast_consumption'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

const NOW = Date.now()
const days = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

describe('forecast_consumption — baseline (no adapter)', () => {
  it('returns zero projection with low confidence on no history', async () => {
    const tool = makeForecastConsumptionTool(fakeReader())
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7 })
    expect(r.projectedUnits).toBe(0)
    expect(r.basis).toBe('baseline-rolling-30d-avg')
    expect(r.confidence).toBeLessThan(0.5)
    expect(r.sampleSize).toBe(0)
  })

  it('projects rolling-30d daily average over the horizon', async () => {
    // 60 units consumed across 30 distinct days → 2/day → 14 over a 7-day horizon
    const stockLogs = Array.from({ length: 30 }, (_, i) => ({
      id: `l-${i}`, variant_id: ids.variant1, hotel_id: ids.hotelA,
      delta: -2, created_at: days(i + 1),
    }))
    const tool = makeForecastConsumptionTool(fakeReader({ stockLogs }))
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7 })
    expect(r.projectedUnits).toBe(14)
    expect(r.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('averages over the window span, not active days (intermittent history)', async () => {
    // 33 units consumed across 9 events spread over the 30-day window. The honest
    // daily rate is ~33/30 ≈ 1.1 → ~33 over 30 days. Dividing by active days
    // (9) would project ~110 (3x) and drop confidence below 0.6 — which is what
    // silently starved the overstock detector on real (intermittent) data.
    const eventDays = [1, 4, 8, 12, 15, 19, 23, 27, 30]
    const stockLogs = eventDays.map((d, i) => ({
      id: `l-${i}`, variant_id: ids.variant1, hotel_id: ids.hotelA,
      delta: i === 0 ? -1 : -4, created_at: days(d),   // sums to -33
    }))
    const tool = makeForecastConsumptionTool(fakeReader({ stockLogs }))
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 30 })
    expect(r.projectedUnits).toBeLessThanOrEqual(40)   // ~33, not ~110
    expect(r.confidence).toBeGreaterThanOrEqual(0.6)   // window well-covered
  })

  it('ignores positive-delta (receive) logs', async () => {
    const tool = makeForecastConsumptionTool(fakeReader({
      stockLogs: [
        { id: 'l-1', variant_id: ids.variant1, hotel_id: ids.hotelA, delta:  100, created_at: days(1) },
        { id: 'l-2', variant_id: ids.variant1, hotel_id: ids.hotelA, delta:   -2, created_at: days(1) },
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7 })
    expect(r.projectedUnits).toBe(14)
  })
})

describe('forecast_consumption — adapter delegation', () => {
  it('returns adapter output verbatim when adapter is bound', async () => {
    const tool = makeForecastConsumptionTool({
      reader:  fakeReader(),
      adapter: {
        name:         'prophet-v1',
        version:      '1.0.0',
        inputSchema:  {},
        outputSchema: {},
        runInference: () => Promise.resolve({
          projectedUnits: 999, basis: 'prophet-v1', confidence: 0.97, sampleSize: 90,
        }),
      },
    })
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7 })
    expect(r.projectedUnits).toBe(999)
    expect(r.basis).toBe('prophet-v1')
    expect(r.confidence).toBe(0.97)
  })
})
