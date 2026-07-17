// occupancy-v1 — the first adapter with an EXTERNAL demand driver (Q4).
//
// Every other candidate is a pure function of the variant's own stock logs, so
// they can only extrapolate the past. This one knows something they can't: how
// full the hotel will be. Bookings are largely on the books a week out, so
// forward occupancy is genuinely knowable in a way demand never is — that is the
// whole informational edge.
//
//   day demand = baseRate · (1 + sensitivity · (expectedOcc − histMean) / histMean)
//
// Same model as the occupancy_adjusted_forecast Logic Tool (one definition of
// the uplift, so the surfaced number and the graded adapter can't drift). The
// difference is the seam: this one is graded by the instrument and can be picked
// per-variant by auto-select.
//
// HONESTY: it slices the series at `asOf`, so history is only what was known by
// then. The forward window is whatever the caller supplies — in production the
// real booking forecasts; in a backtest, realized occupancy, which assumes a
// forecast-quality booking curve. That makes backtest numbers an UPPER BOUND on
// occupancy's value (defensible a week out, where most rooms are already sold —
// but it is an assumption, not a measurement).

import type { ModelAdapter } from '../index'
import type { ConsumptionForecastInput, ConsumptionForecastOutput } from './types'
import { ewmaV1Adapter } from './ewma_v1'

const DAY = 86_400_000
// Must match the window the base rate is learned over (ewma's daily series).
// If histMean is taken over ALL history while baseRate reflects only the last 30
// days, the uplift compares the future to a stale long-run mean and re-applies a
// shift the base rate already contains — a systematic over-forecast. Measured:
// +6.3% bias, worst of five adapters, before this was matched.
const HIST_WINDOW_DAYS = 30
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const occupancyV1Adapter: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput> = {
  name:    'occupancy-v1',
  version: '1.0.0',
  inputSchema:  { kind: 'consumption_forecast_input'  },
  outputSchema: { kind: 'consumption_forecast_output' },
  runInference: async (input) => {
    const asOf = input.asOf ?? Date.now()
    const occ = input.occupancy

    // The daily level still comes from the variant's own history — occupancy
    // reshapes it, it doesn't replace it. horizon 1 → the EWMA daily rate.
    const base = await ewmaV1Adapter.runInference({ logs: input.logs, horizonDays: 1, asOf })
    const baseRate = base.projectedUnits

    // The norm the uplift is measured against: occupancy over the SAME recent
    // window the base rate was learned from, never the whole history.
    const from = iso(asOf - HIST_WINDOW_DAYS * DAY)
    const past = occ?.series.filter((p) => p.date > from && p.date <= iso(asOf)) ?? []
    const histMean = past.length ? past.reduce((s, p) => s + p.pct, 0) / past.length : 0

    // No usable signal → don't invent one. Fall back to EWMA's own projection at
    // a capped confidence, so auto-select can't pick this on evidence it lacks.
    if (!occ || occ.sensitivity <= 0 || histMean <= 0) {
      const flat = await ewmaV1Adapter.runInference({ logs: input.logs, horizonDays: input.horizonDays, asOf })
      return { ...flat, basis: 'occupancy-v1', confidence: Math.min(flat.confidence, 0.3) }
    }

    const forward = new Map(occ.series.map((p) => [p.date, p.pct]))
    let projected = 0
    let covered = 0
    for (let d = 1; d <= input.horizonDays; d++) {
      const key = iso(asOf + d * DAY)
      const known = forward.get(key)
      if (known != null) covered++
      const expectedOcc = known ?? histMean
      const mult = 1 + occ.sensitivity * (expectedOcc - histMean) / histMean
      projected += Math.max(0, baseRate * mult)
    }

    // Trust tracks how much of the horizon forward occupancy actually covers —
    // an uncovered day falls back to the mean, which is just EWMA again.
    const coverage = input.horizonDays > 0 ? covered / input.horizonDays : 0
    const confidence = Number(Math.max(0.3, Math.min(0.9, 0.35 + coverage * 0.55)).toFixed(2))

    return {
      projectedUnits: Math.round(projected),
      basis:          'occupancy-v1',
      confidence,
      sampleSize:     base.sampleSize,
    }
  },
}
