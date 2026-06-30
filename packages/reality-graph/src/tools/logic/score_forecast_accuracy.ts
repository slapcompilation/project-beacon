// Layer: compute (Logic Tool, category 'logic'). Ontology: reads a variant's
// StockLogs; no writes. Scope: hotel (inherits caller). The measuring stick for
// the consumption_forecast objective — grades the active adapter's recent
// forecasts against realized consumption so every P1 accuracy change is provable.
//
// Backfills by reconstruction (deterministic adapters are pure functions of
// logs); when forward-recorded forecast_observations exist they become the
// source. Either path produces the same ForecastAccuracyScore.

import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'
import type { ModelAdapter } from '../../objectives/index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from '../../objectives/consumption_forecast/types'
import { baselineRolling30dAdapter } from '../../objectives/consumption_forecast/baseline_rolling_30d'
import { reconstructObservations, scoreForecastAccuracy, rollingCutoffs } from '../../objectives/consumption_forecast/accuracy'

const LOOKBACK_DAYS = 30

const inputSchema = z.object({
  variantId:   z.string().uuid(),
  horizonDays: z.number().int().min(1).max(90).default(7),
  windows:     z.number().int().min(1).max(26).default(4),
})

const outputSchema = z.object({
  variantId:       z.string().uuid(),
  n:               z.number().int().nonnegative(),
  mape:            z.number().nonnegative(),
  meanSignedError: z.number(),
  biasPct:         z.number(),
  censoredBiasPct: z.number().nullable(),
  basis:           z.string(),
  confidence:      z.number().min(0).max(1),
})

export type ScoreForecastAccuracyInput = z.infer<typeof inputSchema>
export type ScoreForecastAccuracyOutput = z.infer<typeof outputSchema>

export interface ScoreForecastAccuracyDeps {
  reader: GraphReader
  /** Adapter to grade. Defaults to the rolling-30d baseline. */
  adapter?: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput>
}

export function makeScoreForecastAccuracyTool(
  depsOrReader: GraphReader | ScoreForecastAccuracyDeps,
): LogicTool<ScoreForecastAccuracyInput, ScoreForecastAccuracyOutput> {
  const deps: ScoreForecastAccuracyDeps =
    'reader' in depsOrReader ? depsOrReader : { reader: depsOrReader }
  const adapter = deps.adapter ?? baselineRolling30dAdapter

  return {
    name: 'score_forecast_accuracy',
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Grades recent consumption forecasts for a variant against what actually got consumed: ' +
      'returns MAPE, mean signed error, signed bias % (negative = systematic under-forecast), and ' +
      'the bias over stock-out (censored) windows. Use to check whether the forecast is trustworthy ' +
      'before sizing on it, or to compare an adapter change.',
    inputSchema,
    outputSchema,
    traversableLinks: ['consumes'],
    invoke: async (input) => {
      const horizonDays = input.horizonDays ?? 7
      const windows = input.windows ?? 4
      // Enough history for the oldest cutoff's 30-day lookback + all realized windows.
      const sinceDays = LOOKBACK_DAYS + horizonDays * (windows + 1)
      const logs = await deps.reader.getStockLogs(input.variantId, sinceDays)

      const cutoffs = rollingCutoffs(Date.now(), horizonDays, windows)
      const obs = await reconstructObservations(logs, { horizonDays, adapter, cutoffs })
      const score = scoreForecastAccuracy(obs)

      // Confidence in the accuracy read itself tracks how many windows we could
      // actually score — a one-observation MAPE is barely a signal.
      const confidence = Number(Math.min(0.9, 0.2 + (score.n / windows) * 0.7).toFixed(2))

      return {
        variantId:       input.variantId,
        n:               score.n,
        mape:            Number(score.mape.toFixed(4)),
        meanSignedError: Number(score.meanSignedError.toFixed(2)),
        biasPct:         Number(score.biasPct.toFixed(4)),
        censoredBiasPct: score.censoredBiasPct === null ? null : Number(score.censoredBiasPct.toFixed(4)),
        basis:           'reconstructed-rolling-backfill',
        confidence,
      }
    },
  }
}
