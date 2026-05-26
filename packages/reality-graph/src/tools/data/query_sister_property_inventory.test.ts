import { describe, expect, it } from 'vitest'
import { makeQuerySisterPropertyInventoryTool } from './query_sister_property_inventory'
import { fakeReader, ids } from '../__fixtures__/fakeReader'

describe('query_sister_property_inventory', () => {
  it('returns empty when no sisters exist', async () => {
    const tool = makeQuerySisterPropertyInventoryTool(fakeReader())
    const r = await tool.invoke({ variantId: ids.variant1, variantName: 'Tomatoes', hotelId: ids.hotelA })
    expect(r).toEqual({ sisters: [], totalAvailableAtSisters: 0 })
  })

  it('finds same-named variants at sister hotels, sums their stock, excludes self', async () => {
    const tool = makeQuerySisterPropertyInventoryTool(fakeReader({
      sisterHotels: [
        { id: ids.hotelB, organization_id: 'org-1', name: 'Marriott Riverside' },
        { id: ids.hotelC, organization_id: 'org-1', name: 'Marriott Downtown'  },
      ],
      variants: [
        { id: ids.variant1, hotel_id: ids.hotelA, name: 'Tomatoes', current_stock: 0,  par_level: 50 },
        { id: ids.variant2, hotel_id: ids.hotelB, name: 'Tomatoes', current_stock: 80, par_level: 60 },
        { id: ids.variant3, hotel_id: ids.hotelC, name: 'Tomatoes', current_stock: 25, par_level: 40 },
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1, variantName: 'Tomatoes', hotelId: ids.hotelA })
    expect(r.sisters).toHaveLength(2)
    expect(r.totalAvailableAtSisters).toBe(105)
    expect(r.sisters.every((s) => s.variantId !== ids.variant1)).toBe(true)
    expect(r.sisters.find((s) => s.hotelId === ids.hotelB)?.hotelName).toBe('Marriott Riverside')
  })

  it('ignores variants with a different name', async () => {
    const tool = makeQuerySisterPropertyInventoryTool(fakeReader({
      sisterHotels: [{ id: ids.hotelB, organization_id: 'org-1', name: 'Marriott Riverside' }],
      variants: [
        { id: ids.variant2, hotel_id: ids.hotelB, name: 'Cherry Tomatoes', current_stock: 80, par_level: null },
      ],
    }))
    const r = await tool.invoke({ variantId: ids.variant1, variantName: 'Tomatoes', hotelId: ids.hotelA })
    expect(r.totalAvailableAtSisters).toBe(0)
  })
})
