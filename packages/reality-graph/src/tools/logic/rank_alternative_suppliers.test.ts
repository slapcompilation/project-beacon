import { describe, expect, it } from 'vitest'
import { makeRankAlternativeSuppliersTool } from './rank_alternative_suppliers'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

describe('rank_alternative_suppliers', () => {
  it('returns empty when no suppliers', async () => {
    const tool = makeRankAlternativeSuppliersTool(fakeReader())
    const r = await tool.invoke({ variantId: ids.variant1, maxLeadTimeDays: 7 })
    expect(r.ranked).toEqual([])
    expect(r.confidence).toBeLessThan(0.5)
  })

  it('drops suppliers whose lead time exceeds the ceiling', async () => {
    const tool = makeRankAlternativeSuppliersTool(fakeReader({
      suppliersByVariant: {
        [ids.variant1]: [
          { id: ids.supplier1, hotel_id: ids.hotelA, name: 'Fast Co.',   lead_time_days:  2, on_time_pct: 95, cost_variance_pct: 1 },
          { id: ids.supplier2, hotel_id: ids.hotelA, name: 'Slow Co.',   lead_time_days: 15, on_time_pct: 99, cost_variance_pct: 0 },
        ],
      },
    }))
    const r = await tool.invoke({ variantId: ids.variant1, maxLeadTimeDays: 7 })
    expect(r.ranked).toHaveLength(1)
    expect(r.ranked[0].supplierId).toBe(ids.supplier1)
  })

  it('ranks by composite score (on-time dominates)', async () => {
    const tool = makeRankAlternativeSuppliersTool(fakeReader({
      suppliersByVariant: {
        [ids.variant1]: [
          { id: ids.supplier1, hotel_id: ids.hotelA, name: 'Cheap & flaky', lead_time_days: 3, on_time_pct: 60, cost_variance_pct:  0 },
          { id: ids.supplier2, hotel_id: ids.hotelA, name: 'Pricey & sure', lead_time_days: 3, on_time_pct: 99, cost_variance_pct: 10 },
        ],
      },
    }))
    const r = await tool.invoke({ variantId: ids.variant1, maxLeadTimeDays: 7 })
    expect(r.ranked[0].supplierId).toBe(ids.supplier2)
  })

  it('drops suppliers with null lead_time_days', async () => {
    const tool = makeRankAlternativeSuppliersTool(fakeReader({
      suppliersByVariant: {
        [ids.variant1]: [
          { id: ids.supplier1, hotel_id: ids.hotelA, name: 'Unknown lead', lead_time_days: null, on_time_pct: 90, cost_variance_pct: 0 },
        ],
      },
    }))
    const r = await tool.invoke({ variantId: ids.variant1, maxLeadTimeDays: 7 })
    expect(r.ranked).toEqual([])
  })
})
