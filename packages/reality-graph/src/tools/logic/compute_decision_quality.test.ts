import { describe, expect, it } from 'vitest'
import { makeComputeDecisionQualityTool, scoreDecisionQuality } from './compute_decision_quality'
import { fakeReader, ids } from '../__fixtures__/fakeReader'
import type { StockLogRow } from '../graph_reader'

const NOW = Date.now()
const days = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()
const log = (o: Partial<StockLogRow> & { delta: number; created_at: string }): StockLogRow => ({
  id: Math.random().toString(36).slice(2),
  variant_id: ids.variant1,
  hotel_id: ids.hotelA,
  ...o,
})

describe('scoreDecisionQuality', () => {
  it('is all-clear on an empty window', () => {
    const s = scoreDecisionQuality([], NOW, 30)
    expect(s.stockoutDays).toBe(0)
    expect(s.availabilityRate).toBe(1)
    expect(s.wasteUnits).toBe(0)
    expect(s.wasteRate).toBe(0)
    expect(s.confidence).toBe(0.2)   // no balance coverage
  })

  it('counts stock-out days from a non-positive balance and prices availability', () => {
    const s = scoreDecisionQuality([
      log({ delta: -5, created_at: days(3), balance_after: 10 }),
      log({ delta: -8, created_at: days(2), balance_after: 0 }),   // stockout day
      log({ delta: -2, created_at: days(1), balance_after: 4 }),
    ], NOW, 30)
    expect(s.stockoutDays).toBe(1)
    expect(s.daysWithBalance).toBe(3)
    expect(s.availabilityRate).toBeCloseTo(1 - 1 / 30, 4)
  })

  it('splits waste from consumption and rates it (one shared classifier)', () => {
    const s = scoreDecisionQuality([
      log({ delta: -20, created_at: days(2), reason: 'sold' }),
      log({ delta: -5,  created_at: days(1), removal_category: 'spoilage' }),
      log({ delta: -3,  created_at: days(1), reason: 'expired in walk-in' }),
    ], NOW, 30)
    expect(s.consumedUnits).toBe(20)
    expect(s.wasteUnits).toBe(8)
    expect(s.wasteRate).toBeCloseTo(8 / 28, 4)
  })

  it('excludes logs outside the window', () => {
    const s = scoreDecisionQuality([
      log({ delta: -9, created_at: days(45), balance_after: 0 }),  // older than 30d
      log({ delta: -4, created_at: days(2),  reason: 'sold' }),
    ], NOW, 30)
    expect(s.stockoutDays).toBe(0)
    expect(s.consumedUnits).toBe(4)
  })

  it('confidence scales with balance-data coverage', () => {
    const withBalance = Array.from({ length: 30 }, (_, i) =>
      log({ delta: -1, created_at: days(i + 1), balance_after: 5 }))
    const s = scoreDecisionQuality(withBalance, NOW, 30)
    expect(s.confidence).toBeGreaterThan(0.8)
  })
})

describe('compute_decision_quality tool', () => {
  it('reads the graph and returns the typed score', async () => {
    const tool = makeComputeDecisionQualityTool(fakeReader({
      stockLogs: [
        log({ delta: -6, created_at: days(2), balance_after: 0 }),
        log({ delta: -4, created_at: days(1), removal_category: 'waste' }),
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1, windowDays: 30 })
    expect(r.variantId).toBe(ids.variant1)
    expect(r.stockoutDays).toBe(1)
    expect(r.wasteUnits).toBe(4)
    expect(r.basis).toBe('inventory-outcomes-v1')
  })
})
