import { describe, expect, it } from 'vitest'
import { makeQueryOpenRestockRequestsTool } from './query_open_restock_requests'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

const NOW = Date.now()
const days = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

describe('query_open_restock_requests', () => {
  it('returns 0 when nothing pending', async () => {
    const tool = makeQueryOpenRestockRequestsTool(fakeReader())
    const r = await tool.invoke({ variantId: ids.variant1 })
    expect(r).toEqual({ requests: [], totalOpenQuantity: 0 })
  })

  it('aggregates pending + approved, drops fulfilled/cancelled/rejected', async () => {
    const tool = makeQueryOpenRestockRequestsTool(fakeReader({
      restockRequests: [
        { id: ids.request1, hotel_id: ids.hotelA, variant_id: ids.variant1, quantity_needed: 10, status: 'pending',   created_at: days(2) },
        { id: ids.request2, hotel_id: ids.hotelA, variant_id: ids.variant1, quantity_needed:  5, status: 'approved',  created_at: days(1) },
        { id: 'r-3',        hotel_id: ids.hotelA, variant_id: ids.variant1, quantity_needed: 99, status: 'fulfilled', created_at: days(3) },
        { id: 'r-4',        hotel_id: ids.hotelA, variant_id: ids.variant1, quantity_needed: 99, status: 'rejected',  created_at: days(3) },
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1 })
    expect(r.totalOpenQuantity).toBe(15)
    expect(r.requests).toHaveLength(2)
    expect(r.requests.every((req) => req.status === 'pending' || req.status === 'approved')).toBe(true)
  })

  it('computes ageDays from created_at', async () => {
    const tool = makeQueryOpenRestockRequestsTool(fakeReader({
      restockRequests: [
        { id: ids.request1, hotel_id: ids.hotelA, variant_id: ids.variant1, quantity_needed: 1, status: 'pending', created_at: days(5) },
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1 })
    expect(r.requests[0].ageDays).toBeGreaterThanOrEqual(4)
    expect(r.requests[0].ageDays).toBeLessThanOrEqual(5)
  })
})
