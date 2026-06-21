import { describe, it, expect } from 'vitest'
import {
  selectStockoutTriggers, stockoutUrgency,
  selectWasteTriggers,
  selectSupplierTriggers, supplierUrgency,
  type StockoutReading, type WasteReading, type SupplierReading,
} from './index'
import { DEFAULT_ORG_POLICY } from '../policy/index'

const M = DEFAULT_ORG_POLICY.monitors

describe('selectStockoutTriggers', () => {
  const base: StockoutReading = { variantId: 'v', variantLabel: 'Tea', daysUntilZero: 5, currentStock: 10, avgDaily: 2 }
  it('fires within the tunable band', () => {
    expect(selectStockoutTriggers([base], M.stockout)).toHaveLength(1)
  })
  it('skips beyond the band and null forecasts', () => {
    expect(selectStockoutTriggers([{ ...base, daysUntilZero: 30 }], M.stockout)).toHaveLength(0)
    expect(selectStockoutTriggers([{ ...base, daysUntilZero: null }], M.stockout)).toHaveLength(0)
  })
  it('widening the band captures more', () => {
    expect(selectStockoutTriggers([{ ...base, daysUntilZero: 30 }], { ...M.stockout, threshold_days: 45 })).toHaveLength(1)
  })
  it('disabled emits nothing', () => {
    expect(selectStockoutTriggers([base], { ...M.stockout, enabled: false })).toHaveLength(0)
  })
  it('urgency: out of stock is max, edge is low', () => {
    expect(stockoutUrgency(0, 14)).toBe(10)
    expect(stockoutUrgency(14, 14)).toBe(1)
    expect(stockoutUrgency(2, 14)).toBeGreaterThan(stockoutUrgency(10, 14))
  })
})

describe('selectWasteTriggers', () => {
  const base: WasteReading = { variantId: 'v', variantLabel: 'Cream', anomalyScore: 6, pctAboveBaseline: 120, qty7d: 9 }
  it('fires at or above the min anomaly score', () => {
    expect(selectWasteTriggers([base], M.waste)).toHaveLength(1)
  })
  it('raising the floor filters weak signals', () => {
    expect(selectWasteTriggers([{ ...base, anomalyScore: 3 }], { ...M.waste, min_anomaly_score: 5 })).toHaveLength(0)
    expect(selectWasteTriggers([{ ...base, anomalyScore: 7 }], { ...M.waste, min_anomaly_score: 5 })).toHaveLength(1)
  })
  it('urgency tracks the anomaly score', () => {
    const [hit] = selectWasteTriggers([base], M.waste)
    expect(hit.urgency).toBe(6)
  })
  it('disabled emits nothing', () => {
    expect(selectWasteTriggers([base], { ...M.waste, enabled: false })).toHaveLength(0)
  })
})

describe('selectSupplierTriggers', () => {
  const base: SupplierReading = { supplierId: 's', supplierName: 'Acme', reliabilityScore: 4, onTimePct: 70, avgDelayDays: 2, riskTier: 'high' }
  it('fires at or below the max reliability score', () => {
    expect(selectSupplierTriggers([base], M.supplier)).toHaveLength(1)
  })
  it('skips reliable suppliers', () => {
    expect(selectSupplierTriggers([{ ...base, reliabilityScore: 9 }], M.supplier)).toHaveLength(0)
  })
  it('tightening the cutoff surfaces only the worst', () => {
    expect(selectSupplierTriggers([{ ...base, reliabilityScore: 5 }], { ...M.supplier, max_reliability_score: 3 })).toHaveLength(0)
  })
  it('urgency: lower score is worse', () => {
    expect(supplierUrgency(2)).toBeGreaterThan(supplierUrgency(6))
    expect(supplierUrgency(0)).toBe(10)
  })
  it('disabled emits nothing', () => {
    expect(selectSupplierTriggers([base], { ...M.supplier, enabled: false })).toHaveLength(0)
  })
})
