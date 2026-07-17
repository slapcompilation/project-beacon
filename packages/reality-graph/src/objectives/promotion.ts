// Closes the modeling loop: turn eval results into a promotion recommendation.
// The eval suite already scores every candidate adapter; this decides whether the
// best one should replace the current production release. The recommendation is
// surfaced for the operator to approve — autonomy earned + audited, not a silent
// flip. A loss metric (MAE/RMSE/MAPE — lower is better) is assumed.
//
// EVIDENCE THRESHOLD (Q5 follow-up): every other gate in this system demands
// evidence before it acts — the calibration trust budget needs >=20 resolved
// samples, the forecast-accuracy veto needs >=3 scored windows, auto-select needs
// >=3 windows AND a 10% margin before switching. This was the one gate that fired
// on a single reading. It matters: a single-window backtest ranked occupancy-v1
// first, and moving the cutoff by ONE DAY made it last. Promoting on one reading
// pins whatever regime happened to be running that day.
//
// So: rank on the MEAN across runs (noise averages out), and refuse to promote
// until the winner has been measured `minRuns` independent times.

export interface AdapterEval {
  name: string
  version: string
  /** Value of the comparison metric for this run (lower = better). */
  value: number
  /** When this run happened. Distinct runs are what the evidence gate counts;
   *  omit and each entry counts as its own run. */
  runAt?: string | number
}

export interface PromotionRecommendation {
  action: 'promote' | 'hold'
  winner?: AdapterEval
  reason: string
}

export interface PromotionOptions {
  /** Production must be beaten by more than this to be worth churning. */
  margin?: number
  /** Independent eval runs required before a promotion is recommended. One
   *  reading is a point-in-time loss comparison, not evidence. Default 3. */
  minRuns?: number
}

interface Aggregated {
  name: string
  version: string
  /** Mean of the metric across runs — the ranking value. */
  value: number
  runs: number
}

function aggregate(evals: ReadonlyArray<AdapterEval>): Aggregated[] {
  const byAdapter = new Map<string, { name: string; version: string; values: number[]; runs: Set<string> }>()
  for (const e of evals) {
    if (!Number.isFinite(e.value)) continue
    const key = `${e.name}@${e.version}`
    const entry = byAdapter.get(key) ?? { name: e.name, version: e.version, values: [], runs: new Set<string>() }
    entry.values.push(e.value)
    entry.runs.add(e.runAt != null ? String(e.runAt) : `#${String(entry.values.length)}`)
    byAdapter.set(key, entry)
  }
  return [...byAdapter.values()].map((e) => ({
    name:    e.name,
    version: e.version,
    value:   e.values.reduce((s, v) => s + v, 0) / e.values.length,
    runs:    e.runs.size,
  }))
}

export function recommendAdapterPromotion(
  evals: ReadonlyArray<AdapterEval>,
  production: { name: string; version: string } | null,
  opts: PromotionOptions | number = {},
): PromotionRecommendation {
  // Back-compat: the third arg used to be the bare margin.
  const { margin = 0.05, minRuns = 3 } = typeof opts === 'number' ? { margin: opts } : opts

  const scored = aggregate(evals)
  if (scored.length === 0) {
    return { action: 'hold', reason: 'No eval runs yet — run the eval suite to rank the adapters.' }
  }
  const best = scored.reduce((b, e) => (e.value < b.value ? e : b))
  const winner: AdapterEval = { name: best.name, version: best.version, value: Number(best.value.toFixed(4)) }

  if (production && production.name === winner.name && production.version === winner.version) {
    return { action: 'hold', winner, reason: 'Production already runs the best-evaluated adapter.' }
  }

  // Evidence gate — before any comparison is acted on.
  if (best.runs < minRuns) {
    return {
      action: 'hold', winner,
      reason: `${winner.name} leads on ${String(best.runs)} eval run(s) — needs ${String(minRuns)} before promoting. A single reading is a point-in-time comparison, not evidence.`,
    }
  }

  if (!production) {
    return { action: 'promote', winner, reason: `No production release pinned — ${winner.name} has the best eval over ${String(best.runs)} runs.` }
  }
  const prod = scored.find((e) => e.name === production.name && e.version === production.version)
  if (prod && winner.value >= prod.value * (1 - margin)) {
    return {
      action: 'hold', winner,
      reason: `Production (${production.name}) is within ${(margin * 100).toFixed(0)}% of the best — not worth churning.`,
    }
  }
  return {
    action: 'promote', winner,
    reason: prod
      ? `${winner.name} beats production ${production.name} over ${String(best.runs)} runs (${String(winner.value)} vs ${String(Number(prod.value.toFixed(4)))}).`
      : `${winner.name} is the best-evaluated adapter over ${String(best.runs)} runs; production ${production.name} has no comparable eval.`,
  }
}
