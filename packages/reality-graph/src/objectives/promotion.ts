// Closes the modeling loop: turn eval results into a promotion recommendation.
// The eval suite already scores every candidate adapter; this decides whether the
// best one should replace the current production release. The recommendation is
// surfaced for the operator to approve — autonomy earned + audited, not a silent
// flip. A loss metric (MAE/RMSE — lower is better) is assumed.

export interface AdapterEval {
  name: string
  version: string
  /** Latest value of the comparison metric for this adapter (lower = better). */
  value: number
}

export interface PromotionRecommendation {
  action: 'promote' | 'hold'
  winner?: AdapterEval
  reason: string
}

export function recommendAdapterPromotion(
  latestEvals: ReadonlyArray<AdapterEval>,
  production: { name: string; version: string } | null,
  margin = 0.05,
): PromotionRecommendation {
  const scored = latestEvals.filter((e) => Number.isFinite(e.value))
  if (scored.length === 0) {
    return { action: 'hold', reason: 'No eval runs yet — run the eval suite to rank the adapters.' }
  }
  const winner = scored.reduce((best, e) => (e.value < best.value ? e : best))

  if (production && production.name === winner.name && production.version === winner.version) {
    return { action: 'hold', winner, reason: 'Production already runs the best-evaluated adapter.' }
  }
  if (!production) {
    return { action: 'promote', winner, reason: `No production release pinned — ${winner.name} has the best eval.` }
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
      ? `${winner.name} beats production ${production.name} on eval (${winner.value} vs ${prod.value}).`
      : `${winner.name} is the best-evaluated adapter; production ${production.name} has no comparable eval.`,
  }
}
