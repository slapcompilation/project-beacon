import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'
import type { ModelAdapter } from '../../objectives/index'
import type {
  ConsumptionForecastInput,
  ConsumptionForecastOutput,
} from '../../objectives/consumption_forecast/types'

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
          basis: 'baseline-rolling-30d-avg',
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

      // Fallback: inline rolling-30d baseline (same numbers as the registered
      // baseline-rolling-30d-avg adapter; kept here so the tool is usable
      // without injecting an adapter — required by evals and fixtures).
      const consumption = logs.filter((l) => l.delta < 0).reduce((sum, l) => sum + Math.abs(l.delta), 0)
      const days = observedWindowDays(logs, 30)
      const dailyAvg = consumption / days
      const projected = dailyAvg * input.horizonDays
      const confidence = Math.min(0.95, 0.35 + (days / 30) * 0.5)

      return {
        variantId:      input.variantId,
        projectedUnits: Math.round(projected),
        basis:          'baseline-rolling-30d-avg',
        confidence:     Number(confidence.toFixed(2)),
        sampleSize:     logs.length,
      }
    },
  }
}

// Average consumption over the observed window SPAN (inclusive calendar days from
// the first to the last log), not the count of days that happen to have a log.
// Dividing by active days over-projects intermittent items ~Nx and starves the
// overstock detector; the span is the honest denominator for a daily rate.
function observedWindowDays(logs: ReadonlyArray<{ created_at: string }>, lookback: number): number {
  if (logs.length === 0) return 1
  const times = logs.map((l) => new Date(l.created_at).getTime())
  const spanDays = Math.floor((Math.max(...times) - Math.min(...times)) / 86_400_000) + 1
  return Math.min(lookback, Math.max(1, spanDays))
}
