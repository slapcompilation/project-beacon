import { describe, expect, it } from 'vitest'
import { makeQueryRecentWasteLogsTool } from './query_recent_waste_logs'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

const NOW = Date.now()
const days = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

describe('query_recent_waste_logs', () => {
  it('returns zeros when no waste rows', async () => {
    const tool = makeQueryRecentWasteLogsTool(fakeReader())
    const r = await tool.invoke({ variantId: ids.variant1, sinceDays: 14 })
    expect(r.totalWasteUnits).toBe(0)
    expect(r.daysWithWaste).toBe(0)
  })

  it('classifies waste by removal_category', async () => {
    const tool = makeQueryRecentWasteLogsTool(fakeReader({
      stockLogs: [
        { id: 'l-1', variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -3, created_at: days(1), removal_category: 'spoilage' },
        { id: 'l-2', variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -5, created_at: days(2), removal_category: 'expired'  },
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1, sinceDays: 14 })
    expect(r.totalWasteUnits).toBe(8)
    expect(r.daysWithWaste).toBe(2)
  })

  it('classifies waste by reason keyword when category is unset', async () => {
    const tool = makeQueryRecentWasteLogsTool(fakeReader({
      stockLogs: [
        { id: 'l-1', variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -2, created_at: days(1), reason: 'spoiled in walk-in' },
        { id: 'l-2', variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -1, created_at: days(2), reason: 'damaged on arrival' },
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1, sinceDays: 14 })
    expect(r.totalWasteUnits).toBe(3)
  })

  it('ignores positive-delta and non-waste logs', async () => {
    const tool = makeQueryRecentWasteLogsTool(fakeReader({
      stockLogs: [
        { id: 'l-1', variant_id: ids.variant1, hotel_id: ids.hotelA, delta:  50, created_at: days(1), removal_category: 'spoilage' },
        { id: 'l-2', variant_id: ids.variant1, hotel_id: ids.hotelA, delta: -10, created_at: days(1), reason: 'sold' },
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1, sinceDays: 14 })
    expect(r.totalWasteUnits).toBe(0)
  })
})
