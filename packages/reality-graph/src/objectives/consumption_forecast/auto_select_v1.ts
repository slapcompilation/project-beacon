// Auto-select adapter: per-variant model selection — the data-driven form of
// "per-cohort adapter selection". For each variant it backtests every candidate
// on that variant's OWN recent history (rolling holdout, graded by the accuracy
// instrument) and forecasts with the winner. EWMA is the incumbent: a challenger
// only wins if it beats EWMA's MAPE by a margin over enough windows, so noise
// can't flip the choice. The cohort is the variant's own demand signature — no
// hand-maintained category→adapter map to drift.
//
// basis is `auto:<chosen>` so the trace shows which model was picked and why.

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'
import { baselineRolling30dAdapter } from './baseline_rolling_30d'
import { seasonalNaiveV1Adapter } from './seasonal_naive_v1'
import { ewmaV1Adapter } from './ewma_v1'
import { holtLinearV1Adapter } from './holt_linear_v1'
import { occupancyV1Adapter } from './occupancy_v1'
import { reconstructObservations, scoreForecastAccuracy, rollingCutoffs } from './accuracy'

const INCUMBENT = ewmaV1Adapter
// occupancy-v1 competes on the same terms as the rest: it only wins where its
// external driver measurably beats EWMA on the variant's own history. With no
// occupancy supplied it degrades to EWMA, ties, and the switch margin keeps it out.
const CANDIDATES: ReadonlyArray<ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput>> = [
  ewmaV1Adapter, holtLinearV1Adapter, seasonalNaiveV1Adapter, baselineRolling30dAdapter, occupancyV1Adapter,
]
const SELECT_WINDOWS = 5     // rolling holdout windows scored per candidate
const MIN_SCORED     = 3     // need this many scoreable windows to trust a switch
const SWITCH_MARGIN  = 0.1   // a challenger must beat EWMA's MAPE by ≥10% relative
const MIN_INC_MAPE   = 0.05  // …and EWMA must have real error to fix — else don't
                             // churn the model on tiny-MAPE noise (well-fit variants)

export const autoSelectV1Adapter: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> = {
  name:    'auto-select-v1',
  version: '1.0.0',
  inputSchema:  { kind: 'consumption_forecast_input'  },
  outputSchema: { kind: 'consumption_forecast_output' },
  runInference: async (input) => {
    const asOf    = input.asOf ?? Date.now()
    const cutoffs = rollingCutoffs(asOf, input.horizonDays, SELECT_WINDOWS)

    const mapeByName = new Map<string, { mape: number; n: number }>()
    for (const a of CANDIDATES) {
      const s = scoreForecastAccuracy(
        await reconstructObservations(input.logs, {
          horizonDays: input.horizonDays, adapter: a, cutoffs, occupancy: input.occupancy,
        }),
      )
      mapeByName.set(a.name, { mape: s.mape, n: s.n })
    }

    let chosen = INCUMBENT
    const inc = mapeByName.get(INCUMBENT.name)
    if (inc && inc.n >= MIN_SCORED && inc.mape > MIN_INC_MAPE) {
      const challengers = CANDIDATES.filter((a) => {
        if (a.name === INCUMBENT.name) return false
        const s = mapeByName.get(a.name)
        return !!s && s.n >= MIN_SCORED && s.mape < inc.mape * (1 - SWITCH_MARGIN)
      })
      if (challengers.length > 0) {
        chosen = challengers.reduce((best, a) =>
          (mapeByName.get(a.name)!.mape < mapeByName.get(best.name)!.mape ? a : best))
      }
    }

    const out = await chosen.runInference({
      logs: input.logs, horizonDays: input.horizonDays, asOf, occupancy: input.occupancy,
    })
    return { ...out, basis: `auto:${out.basis}` }
  },
}
