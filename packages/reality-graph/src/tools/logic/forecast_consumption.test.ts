import { describe, expect, it } from 'vitest'
import { makeForecastConsumptionTool } from './forecast_consumption'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

const NOW = Date.now()
const days = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

describe('forecast_consumption — default adapter (none injected → EWMA-v1)', () => {
  it('returns zero projection with low confidence on no history', async () => {
    const tool = makeForecastConsumptionTool(fakeReader())
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7 })
    expect(r.projectedUnits).toBe(0)
    expect(r.basis).toBe('ewma-v1')
    expect(r.confidence).toBeLessThan(0.5)
    expect(r.sampleSize).toBe(0)
  })

  it('projects the daily rate over the horizon (flat demand → same as the average)', async () => {
    // 2/day for 30 days → EWMA level settles at 2 → 14 over a 7-day horizon.
    // A clean flat fit → high (measured) confidence.
    const stockLogs = Array.from({ length: 30 }, (_, i) => ({
      id: `l-${i}`, variant_id: ids.variant1, hotel_id: ids.hotelA,
      delta: -2, created_at: days(i),
    }))
    const tool = makeForecastConsumptionTool(fakeReader({ stockLogs }))
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7 })
    expect(r.projectedUnits).toBe(14)
    expect(r.basis).toBe('ewma-v1')
    expect(r.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('is honestly low-confidence on sparse/intermittent history', async () => {
    // 33 units across 9 events spread over the window. EWMA over a mostly-zero
    // daily series stays modest (not the ~110 that dividing by active days gives)
    // and — the point — reports LOW confidence because the fit is poor.
    const eventDays = [0, 3, 7, 11, 14, 18, 22, 26, 29]
    const stockLogs = eventDays.map((d, i) => ({
      id: `l-${i}`, variant_id: ids.variant1, hotel_id: ids.hotelA,
      delta: i === 0 ? -1 : -4, created_at: days(d),   // sums to -33
    }))
    const tool = makeForecastConsumptionTool(fakeReader({ stockLogs }))
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 30 })
    expect(r.projectedUnits).toBeLessThanOrEqual(60)   // not ~110
    expect(r.confidence).toBeLessThan(0.6)             // poor fit → honestly unsure
  })

  it('ignores positive-delta (receive) logs', async () => {
    // A big receive (+100) plus steady consumption — only the negatives count.
    const stockLogs = [
      { id: 'r', variant_id: ids.variant1, hotel_id: ids.hotelA, delta: 100, created_at: days(2) },
      ...Array.from({ length: 30 }, (_, i) => ({
        id: `c-${i}`, variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -2, created_at: days(i),
      })),
    ]
    const tool = makeForecastConsumptionTool(fakeReader({ stockLogs }))
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7 })
    expect(r.projectedUnits).toBe(14)   // 60 consumed / 30 × 7; the +100 ignored
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
