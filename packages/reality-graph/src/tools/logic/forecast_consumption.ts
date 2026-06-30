import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'
import type { ModelAdapter } from '../../objectives/index'
import type {
  ConsumptionForecastInput,
  ConsumptionForecastOutput,
} from '../../objectives/consumption_forecast/types'
import { ewmaV1Adapter } from '../../objectives/consumption_forecast/ewma_v1'

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

export interface ForecastConsumptionDeps {
  reader: GraphReader
  /** Adapter the tool delegates inference to. When omitted, the tool falls
   *  back to the inline rolling-30d baseline (kept for eval/fixture paths
   *  that don't construct an adapter). */
  adapter?: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput>
}

/**
 * AIP pattern: the Logic Tool is the boundary callers bind to; the underlying
 * algorithm lives behind a typed ModelAdapter. Promoting a new adapter to
 * production flips the basis without callers changing.
 */
export function makeForecastConsumptionTool(
  depsOrReader: GraphReader | ForecastConsumptionDeps,
): LogicTool<ForecastConsumptionInput, ForecastConsumptionOutput> {
  const deps: ForecastConsumptionDeps =
    'reader' in depsOrReader ? depsOrReader : { reader: depsOrReader }

  return {
    name: 'forecast_consumption',
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Returns projected unit consumption for a variant over N days. Delegates to the active ' +
      'adapter registered against the consumption_forecast Modeling Objective; falls back to ' +
      'the rolling-30d baseline when no adapter is bound. Use when sizing a stockout gap or ' +
      'restock quantity.',
    inputSchema,
    outputSchema,
    traversableLinks: ['consumes'],
    examples: [
      {
        input: { variantId: '00000000-0000-0000-0000-000000000000', horizonDays: 7 },
        output: {
          variantId: '00000000-0000-0000-0000-000000000000',
          projectedUnits: 162,
          basis: 'ewma-v1',
          confidence: 0.85,
          sampleSize: 30,
        },
      },
    ],
    invoke: async (input) => {
      const logs = await deps.reader.getStockLogs(input.variantId, 30)

      // Delegate to the adapter when bound.
      if (deps.adapter) {
        const result = await deps.adapter.runInference({ logs, horizonDays: input.horizonDays })
        return {
          variantId:      input.variantId,
          projectedUnits: result.projectedUnits,
          basis:          result.basis,
          confidence:     result.confidence,
          sampleSize:     result.sampleSize,
        }
      }

      // Fallback: the default adapter when none is injected (evals + the cron).
      // EWMA-v1 — recency-weighted; it measurably beat the rolling-30d baseline on
      // live data (MAPE 18.5%→13.9%, bias −15.2%→−9.7%), so it's the default the
      // whole stack grades against. asOf = now (this is the live path).
      const fallback = await ewmaV1Adapter.runInference({
        logs, horizonDays: input.horizonDays, asOf: Date.now(),
      })
      return { variantId: input.variantId, ...fallback }
    },
  }
}
