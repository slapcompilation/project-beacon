import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'

const inputSchema = z.object({
  variantId: z.string().uuid(),
  horizonDays: z.number().int().min(1).max(90),
})

const outputSchema = z.object({
  variantId: z.string().uuid(),
  projectedUnits: z.number().nonnegative(),
  basis: z.string(),
  confidence: z.number().min(0).max(1),
  sampleSize: z.number().int().nonnegative(),
})

export type ForecastConsumptionInput = z.infer<typeof inputSchema>
export type ForecastConsumptionOutput = z.infer<typeof outputSchema>

/**
 * Deterministic baseline: rolling 30-day average daily consumption × horizon.
 * Trained adapters land later behind a Modeling Objective; basis flips from
 * 'rolling-30d-avg' to e.g. 'prophet-v1'.
 */
export function makeForecastConsumptionTool(
  reader: GraphReader,
): LogicTool<ForecastConsumptionInput, ForecastConsumptionOutput> {
  return {
    name: 'forecast_consumption',
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Returns projected unit consumption for a variant over N days, based on rolling 30-day average. ' +
      'Use when sizing a stockout gap or restock quantity.',
    inputSchema,
    outputSchema,
    traversableLinks: ['consumes'],
    examples: [
      {
        input: { variantId: '00000000-0000-0000-0000-000000000000', horizonDays: 7 },
        output: {
          variantId: '00000000-0000-0000-0000-000000000000',
          projectedUnits: 162,
          basis: 'rolling-30d-avg',
          confidence: 0.85,
          sampleSize: 30,
        },
      },
    ],
    invoke: async (input) => {
      const logs = await reader.getStockLogs(input.variantId, 30)
      const consumption = logs.filter((l) => l.delta < 0).reduce((sum, l) => sum + Math.abs(l.delta), 0)
      const days = Math.max(1, distinctDays(logs))
      const dailyAvg = consumption / days
      const projected = dailyAvg * input.horizonDays

      // Confidence rises with sample density. 30 days of logs → 0.85; fewer → less.
      const confidence = Math.min(0.95, 0.35 + (days / 30) * 0.5)

      return {
        variantId: input.variantId,
        projectedUnits: Math.round(projected),
        basis: 'rolling-30d-avg',
        confidence: Number(confidence.toFixed(2)),
        sampleSize: logs.length,
      }
    },
  }
}

function distinctDays(logs: ReadonlyArray<{ created_at: string }>): number {
  const set = new Set(logs.map((l) => l.created_at.slice(0, 10)))
  return set.size
}
