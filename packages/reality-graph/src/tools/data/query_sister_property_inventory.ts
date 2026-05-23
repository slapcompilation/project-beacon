import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'

const inputSchema = z.object({
  variantId: z.string().uuid(),
  variantName: z.string().min(1),
  hotelId: z.string().uuid(),
})

const outputSchema = z.object({
  sisters: z.array(
    z.object({
      hotelId: z.string().uuid(),
      hotelName: z.string(),
      variantId: z.string().uuid(),
      currentStock: z.number().nonnegative(),
      parLevel: z.number().nonnegative().nullable(),
    }),
  ),
  totalAvailableAtSisters: z.number().nonnegative(),
})

export type QuerySisterPropertyInventoryInput = z.infer<typeof inputSchema>
export type QuerySisterPropertyInventoryOutput = z.infer<typeof outputSchema>

/**
 * Lateral-before-external: surfaces whether a sister property in the same
 * organization can cover the gap before procurement goes external.
 */
export function makeQuerySisterPropertyInventoryTool(
  reader: GraphReader,
): LogicTool<QuerySisterPropertyInventoryInput, QuerySisterPropertyInventoryOutput> {
  return {
    name: 'query_sister_property_inventory',
    category: 'data',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Returns inventory levels for the same variant across sister properties in the same organization. ' +
      'Use to evaluate inter-property TRANSFER_STOCK before external procurement (lateral-before-external).',
    inputSchema,
    outputSchema,
    traversableLinks: ['belongs_to_org', 'consumes'],
    examples: [
      {
        input: {
          variantId: '00000000-0000-0000-0000-000000000001',
          variantName: 'Tomatoes',
          hotelId: '00000000-0000-0000-0000-000000000a01',
        },
        output: { sisters: [], totalAvailableAtSisters: 0 },
      },
    ],
    invoke: async (input) => {
      const sisters = await reader.getSisterHotels(input.hotelId)
      if (sisters.length === 0) {
        return { sisters: [], totalAvailableAtSisters: 0 }
      }
      const sisterIds = sisters.map((h) => h.id)
      const matches = await reader.getVariantsByName(input.variantName, sisterIds)
      const rows = matches
        .filter((v) => v.id !== input.variantId)
        .map((v) => {
          const hotel = sisters.find((h) => h.id === v.hotel_id)
          return {
            hotelId: v.hotel_id,
            hotelName: hotel?.name ?? 'Unknown hotel',
            variantId: v.id,
            currentStock: v.current_stock,
            parLevel: v.par_level,
          }
        })
      return {
        sisters: rows,
        totalAvailableAtSisters: rows.reduce((sum, r) => sum + r.currentStock, 0),
      }
    },
  }
}
