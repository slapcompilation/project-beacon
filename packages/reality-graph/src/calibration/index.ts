// Decision calibration — does a stated confidence match reality?
//
// 1. Layer: compute. Pure aggregation over resolved proposals; no I/O.
// 2. Ontology fit: reads Proposal {confidence, status}. Operator disposition is
//    the ground-truth label — approved = hit, rejected/superseded = miss.
// 3. Scope: caller decides which proposals to feed (hotel or org); this math is
//    scope-agnostic.
//
// When an agent says 0.85, is it right 85% of the time? This is the primitive
// behind trustworthy autonomy: a calibrated agent is one you can safely raise
// the auto-execution floor against. Wrapped by the compute_decision_calibration
// Logic Tool; later feeds the autonomy "trust budget".

import type { ProposalStatus } from '../nodes/aip'

export interface CalibrationSample {
  /** The agent's stated confidence at proposal time, 0..1. */
  confidence: number
  /** Resolved disposition — operator judgment is the label. */
  status: ProposalStatus
  /** When the proposal was resolved (ISO string or epoch ms). Only used when
   *  `halfLifeDays` is set — otherwise every sample weighs the same. */
  decidedAt?: string | number | null
  /** True when the operator edited the proposal's action before approving it.
   *  With `editPenalty` set, an edited approval scores a partial hit, not a full
   *  one — the agent's call needed correcting. Only meaningful for `approved`. */
  edited?: boolean
}

/** Sensible default half-life when time-decay is turned on: a 3-month-old
 *  outcome counts half as much as a fresh one. */
export const DEFAULT_CALIBRATION_HALF_LIFE_DAYS = 90

/** Default partial-credit discount for an edited-then-approved proposal: half a
 *  hit. An operator who had to fix the agent's call before accepting it didn't
 *  get a clean prediction. */
export const DEFAULT_CALIBRATION_EDIT_PENALTY = 0.5

/**
 * Maps a resolved proposal status to a binary outcome, or null when the status
 * carries no operator judgment. Approved = the prediction was accepted as-is.
 * Rejected = wrong. Superseded = the operator refined it rather than accept, so
 * the original version missed. Pending is unresolved; expired was never acted on.
 */
export function outcomeLabel(status: ProposalStatus): 0 | 1 | null {
  switch (status) {
    case 'approved':   return 1
    case 'rejected':   return 0
    case 'superseded': return 0
    case 'pending':    return null
    case 'expired':    return null
  }
}

export interface CalibrationBin {
  /** Inclusive lower / exclusive upper bound of the confidence band. */
  lower: number
  upper: number
  /** Scoreable proposals whose stated confidence fell in this band. */
  count: number
  /** Mean stated confidence in the band — what the agent claimed. */
  meanConfidence: number
  /** Observed hit rate in the band — what actually happened. */
  accuracy: number
  /** accuracy − meanConfidence. Negative = overconfident, positive = under. */
  gap: number
}

export type CalibrationVerdict =
  | 'well-calibrated'
  | 'overconfident'
  | 'underconfident'
  | 'insufficient-data'

export interface CalibrationReport {
  /** Non-empty reliability bins, ascending by confidence. */
  bins: CalibrationBin[]
  /** Scoreable samples = approved + rejected + superseded. */
  resolved: number
  /** Excluded from scoring, surfaced for an honest denominator. */
  excluded: { pending: number; expired: number }
  /** Mean stated confidence across all scoreable samples. */
  meanConfidence: number
  /** Overall observed hit rate across all scoreable samples. */
  accuracy: number
  /** Expected Calibration Error: population-weighted mean |accuracy − confidence|
   *  across bins. 0 = perfect; lower is better. */
  ece: number
  /** Brier score: mean (confidence − outcome)². 0 = perfect; lower is better. */
  brier: number
  verdict: CalibrationVerdict
  /** Enough resolved samples AND both outcome classes present to be meaningful. */
  sufficientData: boolean
  /** Self-confidence in this estimate, 0..1, driven by sample size + class balance. */
  confidence: number
}

export interface CalibrationOptions {
  /** Equal-width bins across [0,1]. Default 10 (standard ECE binning). */
  bins?: number
  /** Minimum scoreable samples before the estimate is trusted. Default 20. */
  minSamples?: number
  /** |overall gap| at or below this counts as well-calibrated. Default 0.05. */
  tolerance?: number
  /** Exponential recency weighting: a sample `halfLifeDays` old counts half as
   *  much. Omitted → no decay (every sample weighs 1), so callers that don't opt
   *  in are unaffected. Needs `decidedAt` on the samples to take effect. */
  halfLifeDays?: number
  /** Clock for decay, epoch ms. Defaults to Date.now(); injectable for tests. */
  now?: number
  /** Discount applied to an edited-then-approved sample's hit (0..1). 0 / omitted
   *  → edited approvals still count as full hits (callers that don't track edits
   *  are unaffected). Needs `edited` on the samples to take effect. */
  editPenalty?: number
}

/** Recency weight for one sample. 1 when decay is off, no timestamp, or the
 *  outcome is in the future/now; otherwise 0.5^(ageDays / halfLifeDays). */
function sampleWeight(
  decidedAt: string | number | null | undefined,
  halfLifeDays: number | undefined,
  now: number,
): number {
  if (halfLifeDays == null || halfLifeDays <= 0 || decidedAt == null) return 1
  const t = typeof decidedAt === 'number' ? decidedAt : Date.parse(decidedAt)
  if (!Number.isFinite(t)) return 1
  const ageDays = (now - t) / 86_400_000
  if (ageDays <= 0) return 1
  return 0.5 ** (ageDays / halfLifeDays)
}

/**
 * Computes a reliability report from resolved proposals. Pure and deterministic
 * — feed it the population you want (filter by agent/action/window upstream).
 */
export function computeCalibration(
  samples: ReadonlyArray<CalibrationSample>,
  opts: CalibrationOptions = {},
): CalibrationReport {
  const binCount  = Math.max(1, Math.floor(opts.bins ?? 10))
  const minSamples = opts.minSamples ?? 20
  const tolerance  = opts.tolerance ?? 0.05
  const now = opts.now ?? Date.now()
  const editPenalty = clamp01(opts.editPenalty ?? 0)

  const excluded = { pending: 0, expired: 0 }
  const scoreable: { confidence: number; label: number; weight: number }[] = []
  for (const s of samples) {
    const base = outcomeLabel(s.status)
    if (base == null) {
      if (s.status === 'pending') excluded.pending++
      else excluded.expired++
      continue
    }
    // An edited-then-approved call is a partial hit, not a clean one.
    const label = base === 1 && s.edited ? 1 - editPenalty : base
    const c = clamp01(s.confidence)
    scoreable.push({ confidence: c, label, weight: sampleWeight(s.decidedAt, opts.halfLifeDays, now) })
  }

  const n = scoreable.length
  // n is the raw sample count (thresholds + class-balance use it); rate stats use
  // the recency weight. With decay off every weight is 1, so this is identical.
  let weightSum = 0
  for (const s of scoreable) weightSum += s.weight
  if (n === 0 || weightSum <= 0) {
    return {
      bins: [], resolved: 0, excluded,
      meanConfidence: 0, accuracy: 0, ece: 0, brier: 0,
      verdict: 'insufficient-data', sufficientData: false, confidence: 0,
    }
  }

  // Accumulate per-bin and global sums in one pass (raw n for display, weighted
  // sums for the rate stats).
  const acc = Array.from({ length: binCount }, () => ({ n: 0, w: 0, conf: 0, hits: 0 }))
  let confSum = 0
  let hitSum  = 0
  let brierSum = 0
  let minLabel = Infinity
  let maxLabel = -Infinity
  for (const { confidence, label, weight } of scoreable) {
    const idx = Math.min(binCount - 1, Math.floor(confidence * binCount))
    const b = acc[idx]
    b.n++; b.w += weight; b.conf += weight * confidence; b.hits += weight * label
    confSum += weight * confidence
    hitSum  += weight * label
    brierSum += weight * (confidence - label) ** 2
    if (label < minLabel) minLabel = label
    if (label > maxLabel) maxLabel = label
  }

  const bins: CalibrationBin[] = []
  let ece = 0
  for (let i = 0; i < binCount; i++) {
    const b = acc[i]
    if (b.n === 0) continue
    const meanConfidence = b.conf / b.w
    const accuracy = b.hits / b.w
    ece += (b.w / weightSum) * Math.abs(accuracy - meanConfidence)
    bins.push({
      lower: i / binCount,
      upper: (i + 1) / binCount,
      count: b.n,
      meanConfidence,
      accuracy,
      gap: accuracy - meanConfidence,
    })
  }

  const meanConfidence = confSum / weightSum
  const accuracy = hitSum / weightSum
  const brier = brierSum / weightSum
  // Calibration needs outcome variety to assess — all-identical labels (every
  // hit, every miss, or every same-partial) carry no signal. Spread, not a raw
  // hit count, so this stays correct once edited approvals make labels fractional.
  const bothClasses = maxLabel > minLabel
  const sufficientData = n >= minSamples && bothClasses

  const gap = accuracy - meanConfidence
  let verdict: CalibrationVerdict
  if (!sufficientData) verdict = 'insufficient-data'
  else if (Math.abs(gap) <= tolerance) verdict = 'well-calibrated'
  else if (gap < 0) verdict = 'overconfident'
  else verdict = 'underconfident'

  // Self-confidence: scales with sample size, discounted hard when only one
  // outcome class is present (you can't assess calibration with zero misses).
  const confidence = Math.min(1, n / (minSamples * 2)) * (bothClasses ? 1 : 0.3)

  return {
    bins, resolved: n, excluded,
    meanConfidence, accuracy, ece, brier,
    verdict, sufficientData, confidence,
  }
}

/**
 * The observed hit-rate for the confidence band a stated confidence falls in —
 * the empirically-calibrated probability the call is right when the agent claims
 * roughly this much. Returns null when no resolved samples sit in that band (no
 * evidence at this confidence level). The auto-execution trust budget uses this
 * to compare what an agent *achieves* at a confidence level against the floor,
 * rather than trusting what it *claims*.
 */
export function calibratedConfidence(report: CalibrationReport, stated: number): number | null {
  const c = clamp01(stated)
  for (const bin of report.bins) {
    const inUpper = bin.upper >= 1 ? c <= bin.upper : c < bin.upper
    if (c >= bin.lower && inUpper) return bin.accuracy
  }
  return null
}

function clamp01(x: number): number {
  if (Number.isNaN(x)) return 0
  return x < 0 ? 0 : x > 1 ? 1 : x
}

// ── Calibration → Policy: agents earn autonomy automatically ─────────────────
//
// The flywheel actually turning: observed calibration proposes edits to the
// per-agent auto-execution floor. A well-calibrated agent with enough resolved
// decisions earns a *lower* floor (more unattended execution); a proven
// overconfident one gets a *higher* floor. These are recommendations — a human
// applies them, so autonomy is earned AND audited, never silently widened.

export interface AutonomyConfig {
  /** Minimum resolved samples before a recommendation is made. */
  minSamples: number
  /** Hard lower bound on any floor — autonomy never goes below this. */
  floorMin: number
  /** Upper bound on any floor. */
  floorMax: number
  /** Adjustment increment per recommendation. */
  step: number
  /** Floor assumed for an agent with no explicit override yet. */
  baselineFloor: number
}

export const DEFAULT_AUTONOMY_CONFIG: AutonomyConfig = {
  minSamples: 20,
  floorMin: 0.7,
  floorMax: 0.98,
  step: 0.05,
  baselineFloor: 0.9,
}

/** Per-agent context the recommender needs to reason about action types, not just
 *  floors: which action type the agent proposes, whether that type is already
 *  auto-exec-enabled, and whether the agent has a production release. Supply it to
 *  unlock 'enable' recommendations (a queue-only type that has earned auto-exec). */
export interface AgentActionContext {
  actionType: string
  enabled: boolean
  hasProductionRelease: boolean
}

export interface AutonomyRecommendation {
  agentName: string
  kind: 'loosen' | 'tighten' | 'enable'
  /** Present for 'enable' — the action type to switch on in the thresholds map. */
  actionType?: string
  currentFloor: number
  proposedFloor: number
  resolved: number
  ece: number
  verdict: CalibrationVerdict
  rationale: string
}

/** Proposes autonomy changes from observed calibration. Pure: callers apply the
 *  result (via set_org_policy) with a human in the loop. Underconfident and
 *  insufficient-data agents get no recommendation. With `agentContext`, a
 *  proven-well-calibrated agent whose action type is still queue-only AND has a
 *  production release earns an 'enable' recommendation; otherwise we loosen the
 *  floor of an already-enabled type, and tighten on proven overconfidence. */
export function recommendAutonomy(
  reports: ReadonlyArray<{ key: string; report: CalibrationReport }>,
  currentOverrides: Readonly<Record<string, number>>,
  cfg: Partial<AutonomyConfig> = {},
  agentContext: Readonly<Record<string, AgentActionContext>> = {},
): AutonomyRecommendation[] {
  const c = { ...DEFAULT_AUTONOMY_CONFIG, ...cfg }
  const out: AutonomyRecommendation[] = []
  for (const { key, report } of reports) {
    if (!report.sufficientData || report.resolved < c.minSamples) continue
    const ctx = agentContext[key]
    const current = currentOverrides[key] ?? c.baselineFloor

    if (report.verdict === 'well-calibrated') {
      // A queue-only action type whose agent has now proven calibrated AND is in
      // production has earned unattended execution — recommend ENABLING it. No
      // production release → no recommendation (the fail-closed gate queues it
      // anyway). Not-yet-enabled types have no floor to loosen.
      if (ctx && !ctx.enabled) {
        if (ctx.hasProductionRelease) {
          out.push({
            agentName: key, kind: 'enable', actionType: ctx.actionType,
            currentFloor: c.baselineFloor, proposedFloor: c.baselineFloor,
            resolved: report.resolved, ece: report.ece, verdict: report.verdict,
            rationale: `Well-calibrated over ${String(report.resolved)} decisions (ECE ${pct(report.ece)}, hit-rate ${pct(report.accuracy)} vs ${pct(report.meanConfidence)} claimed) and in production. Safe to enable ${ctx.actionType} auto-execution at floor ${c.baselineFloor.toFixed(2)}.`,
          })
        }
        continue
      }
      const proposed = round2(Math.max(c.floorMin, current - c.step))
      if (proposed < current) {
        out.push({
          agentName: key, kind: 'loosen', currentFloor: current, proposedFloor: proposed,
          resolved: report.resolved, ece: report.ece, verdict: report.verdict,
          rationale: `Well-calibrated over ${String(report.resolved)} decisions (ECE ${pct(report.ece)}, hit-rate ${pct(report.accuracy)} vs ${pct(report.meanConfidence)} claimed). Safe to widen autonomy.`,
        })
      }
    } else if (report.verdict === 'overconfident') {
      // Only meaningful if the type is actually auto-executing.
      if (ctx && !ctx.enabled) continue
      const proposed = round2(Math.min(c.floorMax, current + c.step))
      if (proposed > current) {
        out.push({
          agentName: key, kind: 'tighten', currentFloor: current, proposedFloor: proposed,
          resolved: report.resolved, ece: report.ece, verdict: report.verdict,
          rationale: `Overconfident over ${String(report.resolved)} decisions (hit-rate ${pct(report.accuracy)} below ${pct(report.meanConfidence)} claimed). Tighten the floor.`,
        })
      }
    }
  }
  return out
}

function round2(x: number): number { return Math.round(x * 100) / 100 }
function pct(x: number): string { return `${String(Math.round(x * 100))}%` }
