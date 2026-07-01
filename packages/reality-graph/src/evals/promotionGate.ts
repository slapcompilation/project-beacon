// Promotion gate — turns a version diff into a promote/hold decision for the
// challenger. This is the rule the release gate should enforce: an LLM version
// can't ship just because it clears the absolute pass-rate floor; it must also
// not REGRESS the deterministic baseline — overall or within any cohort.
//
// promote_agent (migrations 175/178) already enforces role + staging + a
// recorded pass-rate floor from model_eval_runs. This adds the missing
// no-regression check on top, as a pure, testable decision the live eval run
// (and a future server persist) both consume.

import type { VersionDiff } from './versionDiff'

export interface PromotionPolicy {
  /** Challenger's overall pass rate must meet this (mirrors the SQL production floor). */
  minPassRate?: number
  /** Block if the challenger regresses any case the baseline passed. Default true. */
  requireNoRegression?: boolean
  /** Block if any cohort regresses, even when the aggregate looks fine. Default true. */
  requireNoCohortRegression?: boolean
}

export interface PromotionDecision {
  promotable: boolean
  challenger: string
  passRate: number
  /** Human-readable reasons the challenger is held back; empty when promotable. */
  blockers: string[]
}

const DEFAULT_POLICY: Required<PromotionPolicy> = {
  minPassRate: 0.7,
  requireNoRegression: true,
  requireNoCohortRegression: true,
}

/** Evaluates the challenger (default: the last non-baseline version in the diff)
 *  against the baseline using the diff's per-case + per-cohort deltas. */
export function evaluatePromotion(
  diff: VersionDiff,
  policy?: PromotionPolicy,
  challengerLabel?: string,
): PromotionDecision {
  const p = { ...DEFAULT_POLICY, ...policy }
  const challenger = challengerLabel ?? diff.summary[diff.summary.length - 1]?.version ?? diff.baseline
  const passRate = diff.summary.find((s) => s.version === challenger)?.passRate ?? 0
  const blockers: string[] = []

  if (challenger === diff.baseline) {
    blockers.push('challenger is the baseline — nothing to promote')
  }
  if (passRate < p.minPassRate) {
    blockers.push(`pass rate ${passRate.toFixed(2)} is below floor ${p.minPassRate.toFixed(2)}`)
  }
  if (p.requireNoRegression) {
    const delta = diff.deltas.find((d) => d.version === challenger)
    if (delta && delta.regressions.length > 0) {
      blockers.push(`regresses ${String(delta.regressions.length)} case(s) vs baseline: ${delta.regressions.join(', ')}`)
    }
  }
  if (p.requireNoCohortRegression) {
    for (const c of diff.cohorts) {
      const delta = c.deltas.find((d) => d.version === challenger)
      if (delta && delta.regressions.length > 0) {
        blockers.push(`cohort '${c.cohort}' regresses: ${delta.regressions.join(', ')}`)
      }
    }
  }

  return { promotable: blockers.length === 0, challenger, passRate, blockers }
}
