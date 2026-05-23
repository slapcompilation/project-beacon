import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'

const inputSchema = z.object({
  variantId: z.string().uuid(),
})

const outputSchema = z.object({
  requests: z.array(
    z.object({
      id: z.string().uuid(),
      quantityNeeded: z.number().int().nonnegative(),
      status: z.enum(['pending', 'approved', 'rejected', 'fulfilled', 'cancelled']),
      ageDays: z.number().int().nonnegative(),
    }),
  ),
  totalOpenQuantity: z.number().int().nonnegative(),
})

export type QueryOpenRestockRequestsInput = z.infer<typeof inputSchema>
export type QueryOpenRestockRequestsOutput = z.infer<typeof outputSchema>

export function makeQueryOpenRestockRequestsTool(
  reader: GraphReader,
): LogicTool<QueryOpenRestockRequestsInput, QueryOpenRestockRequestsOutput> {
  return {
    name: 'query_open_restock_requests',
    category: 'data',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Returns open restock requests for a variant — those in pending or approved status. ' +
      'Use to confirm whether an existing request already covers a stockout gap before proposing a new one.',
    inputSchema,
    outputSchema,
    traversableLinks: ['restocks'],
    examples: [
      {
        input: { variantId: '00000000-0000-0000-0000-000000000000' },
        output: { requests: [], totalOpenQuantity: 0 },
      },
    ],
    invoke: async (input) => {
      const all = await reader.getOpenRestockRequests(input.variantId)
      const open = all.filter((r) => r.status === 'pending' || r.status === 'approved')
      const now = Date.now()
      const requests = open.map((r) => ({
        id: r.id,
        quantityNeeded: r.quantity_needed,
        status: r.status,
        ageDays: Math.floor((now - new Date(r.created_at).getTime()) / (24 * 60 * 60 * 1000)),
      }))
      return {
        requests,
        totalOpenQuantity: open.reduce((sum, r) => sum + r.quantity_needed, 0),
      }
    },
  }
}
