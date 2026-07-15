import { describe, expect, it } from 'vitest'
import { makeComputeReorderPointTool } from './compute_reorder_point'
import { fakeReader, ids } from '../__fixtures__/fakeReader'
import type { StockLogRow, SupplierRow } from '../graph_reader'
import type { ModelAdapter } from '../../objectives/index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from '../../objectives/consumption_forecast/types'

// Deterministic stub so the test asserts the WIRING (adapter drives the level),
// not a particular smoothing math.
const stubAdapter = (
  projectedUnits: number, basis = 'auto:ewma-v1', confidence = 0.8,
): ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> => ({
  name: 'stub', version: '1.0.0',
  inputSchema:  { kind: 'consumption_forecast_input' },
  outputSchema: { kind: 'consumption_forecast_output' },
  runInference: () => Promise.resolve({ projectedUnits, basis, confidence, sampleSize: 30 }),
})

const DAY = 86_400_000
const at = (k: number) => new Date(Date.now() - k * DAY).toISOString()
const steady = (rate: number): StockLogRow[] =>
  Array.from({ length: 30 }, (_, k) => ({ id: `s-${k}`, variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -rate, created_at: at(k) }))
const spiky = (): StockLogRow[] =>   // 0,10,0,10… → mean 5, high σ
  Array.from({ length: 30 }, (_, k) => ({ id: `p-${k}`, variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -(k % 2 === 0 ? 0 : 10), created_at: at(k) }))
const supplier = (lead: number): SupplierRow =>
  ({ id: ids.supplier1, hotel_id: ids.hotelA, name: 'S', lead_time_days: lead, on_time_pct: 90, cost_variance_pct: 0 })

describe('compute_reorder_point', () => {
  it('steady demand → reorder point ≈ demand over lead time, ~zero safety stock', async () => {
    const tool = makeComputeReorderPointTool(fakeReader({ stockLogs: steady(5) }))
    const r = await tool.invoke({ variantId: ids.variant1, leadTimeDays: 7, serviceLevel: 0.95 })
    expect(r.dailyMean).toBeCloseTo(5, 1)
    expect(r.safetyStock).toBe(0)            // no variability → no buffer
    expect(r.demandOverLeadTime).toBe(35)
    expect(r.reorderPoint).toBe(35)
  })

  it('spiky demand earns a real safety buffer at the same mean', async () => {
    const steadyR = await makeComputeReorderPointTool(fakeReader({ stockLogs: steady(5) }))
      .invoke({ variantId: ids.variant1, leadTimeDays: 7 })
    const spikyR = await makeComputeReorderPointTool(fakeReader({ stockLogs: spiky() }))
      .invoke({ variantId: ids.variant1, leadTimeDays: 7 })
    expect(spikyR.dailyMean).toBeCloseTo(5, 0)
    expect(spikyR.dailySigma).toBeGreaterThan(steadyR.dailySigma)
    expect(spikyR.safetyStock).toBeGreaterThan(steadyR.safetyStock)
    expect(spikyR.reorderPoint).toBeGreaterThan(spikyR.demandOverLeadTime)
  })

  it('a higher service level buys a bigger buffer', async () => {
    const reader = fakeReader({ stockLogs: spiky() })
    const at95 = await makeComputeReorderPointTool(reader).invoke({ variantId: ids.variant1, leadTimeDays: 7, serviceLevel: 0.95 })
    const at99 = await makeComputeReorderPointTool(reader).invoke({ variantId: ids.variant1, leadTimeDays: 7, serviceLevel: 0.99 })
    expect(at99.z).toBeGreaterThan(at95.z)
    expect(at99.safetyStock).toBeGreaterThan(at95.safetyStock)
  })

  it('lead-time variability adds buffer even when demand is steady', async () => {
    const reader = fakeReader({ stockLogs: steady(5) })
    const flat = await makeComputeReorderPointTool(reader).invoke({ variantId: ids.variant1, leadTimeDays: 7 })
    const variableLead = await makeComputeReorderPointTool(reader).invoke({ variantId: ids.variant1, leadTimeDays: 7, leadTimeStddevDays: 2 })
    expect(flat.safetyStock).toBe(0)
    expect(variableLead.safetyStock).toBeGreaterThan(0)   // σ_L term: μ²·σ_L²
  })

  it('falls back to the flat mean + base basis when no adapter is injected', async () => {
    const r = await makeComputeReorderPointTool(fakeReader({ stockLogs: steady(5) }))
      .invoke({ variantId: ids.variant1, leadTimeDays: 7 })
    expect(r.basis).toBe('reorder-point-normal-v1')
    expect(r.demandOverLeadTime).toBe(35)   // 5/day flat × 7
  })

  it('Q1: sizes the demand LEVEL on the injected forecast adapter, not the flat mean', async () => {
    // steady(5) would flat-mean to 35 over 7d; the adapter forecasts 70 over the
    // lead time → μ_d 10, demand-over-lead-time 70. σ_d stays empirical (0 here).
    const tool = makeComputeReorderPointTool({
      reader: fakeReader({ stockLogs: steady(5) }), adapter: stubAdapter(70),
    })
    const r = await tool.invoke({ variantId: ids.variant1, leadTimeDays: 7 })
    expect(r.dailyMean).toBeCloseTo(10, 1)
    expect(r.demandOverLeadTime).toBe(70)
    expect(r.basis).toBe('reorder-point-normal-v1/auto:ewma-v1')   // demand source visible for lineage
  })

  it('caps sizing confidence by the forecast confidence when the adapter drives it', async () => {
    const tool = makeComputeReorderPointTool({
      reader: fakeReader({ stockLogs: steady(5) }), adapter: stubAdapter(70, 'auto:ewma-v1', 0.4),
    })
    const r = await tool.invoke({ variantId: ids.variant1, leadTimeDays: 7 })
    expect(r.confidence).toBeLessThanOrEqual(0.4)
  })

  it('uses the variant fastest supplier lead time when none is given', async () => {
    const tool = makeComputeReorderPointTool(fakeReader({
      stockLogs: steady(5),
      suppliersByVariant: { [ids.variant1]: [supplier(10), supplier(4)] },
    }))
    const r = await tool.invoke({ variantId: ids.variant1, serviceLevel: 0.95 })
    expect(r.leadTimeDays).toBe(4)            // min of {10, 4}
    expect(r.demandOverLeadTime).toBe(20)     // 5/day × 4
  })
})
