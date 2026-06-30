import { describe, expect, it } from 'vitest'
import { makeScoreForecastAccuracyTool } from './score_forecast_accuracy'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

const DAY = 86_400_000
const at = (k: number) => new Date(Date.now() - k * DAY).toISOString()

describe('score_forecast_accuracy', () => {
  it('grades a stable series as accurate and low-bias', async () => {
    const stockLogs = Array.from({ length: 60 }, (_, k) => ({
      id: `l-${k}`, variant_id: ids.variant1, hotel_id: ids.hotelA,
      delta: -2, created_at: at(k), balance_after: 100,
    }))
    const tool = makeScoreForecastAccuracyTool(fakeReader({ stockLogs }))
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7, windows: 4 })
    expect(r.basis).toBe('reconstructed-rolling-backfill')
    expect(r.n).toBe(4)
    expect(r.mape).toBeLessThan(0.05)
    expect(Math.abs(r.biasPct)).toBeLessThan(0.05)
    expect(r.censoredBiasPct).toBeNull()
    expect(r.confidence).toBeGreaterThanOrEqual(0.8)   // all 4 windows scored
  })

  it('returns n=0 with low confidence when there is no history to grade', async () => {
    const tool = makeScoreForecastAccuracyTool(fakeReader())
    const r = await tool.invoke({ variantId: ids.variant1, horizonDays: 7, windows: 4 })
    expect(r.n).toBe(0)
    expect(r.confidence).toBeLessThan(0.3)
  })
})
