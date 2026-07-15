import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'
import { isWasteLog } from '../logic/waste_classification'

const inputSchema = z.object({
  variantId:  z.string().uuid(),
  sinceDays:  z.number().int().min(1).max(90).default(14),
})

const wasteEventSchema = z.object({
  id:        z.string(),
  quantity:  z.number().int().positive(),
  reason:    z.string(),
  ageDays:   z.number().int().nonnegative(),
})

const outputSchema = z.object({
  events:           z.array(wasteEventSchema),
  totalWasteUnits:  z.number().int().nonnegative(),
  /** How many of the last `sinceDays` days had at least one waste event. */
  daysWithWaste:    z.number().int().nonnegative(),
  /** Average waste units per day across the window. */
  meanDailyWaste:   z.number().nonnegative(),
})

export type QueryRecentWasteLogsInput = z.infer<typeof inputSchema>
export type QueryRecentWasteLogsOutput = z.infer<typeof outputSchema>

export function makeQueryRecentWasteLogsTool(
  reader: GraphReader,
): LogicTool<QueryRecentWasteLogsInput, QueryRecentWasteLogsOutput> {
  return {
    name: 'query_recent_waste_logs',
    category: 'data',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Returns recent waste/spoilage stock-log events for a variant within the given window. ' +
      'Use to assess whether a variant has a pattern of waste before sizing a write-off proposal.',
    inputSchema,
    outputSchema,
    traversableLinks: ['consumes'],
    examples: [
      {
        input:  { variantId: '00000000-0000-0000-0000-000000000000', sinceDays: 14 },
        output: { events: [], totalWasteUnits: 0, daysWithWaste: 0, meanDailyWaste: 0 },
      },
    ],
    invoke: async (input) => {
      const logs   = await reader.getStockLogs(input.variantId, input.sinceDays)
      const waste  = logs.filter(isWasteLog)
      const now    = Date.now()

      const events = waste.map((l) => ({
        id:       l.id,
        quantity: Math.abs(l.delta),
        reason:   l.reason ?? l.removal_category ?? 'unspecified',
        ageDays:  Math.floor((now - new Date(l.created_at).getTime()) / (24 * 60 * 60 * 1000)),
      }))

      const totalWasteUnits = events.reduce((s, e) => s + e.quantity, 0)
      const distinctDays    = new Set(waste.map((l) => l.created_at.slice(0, 10))).size

      return {
        events,
        totalWasteUnits,
        daysWithWaste:  distinctDays,
        meanDailyWaste: Number((totalWasteUnits / input.sinceDays).toFixed(2)),
      }
    },
  }
}
