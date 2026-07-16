// Constraint engine — pure evaluator + typed rule shapes.
// Operators author in NL; a categorizer (apps/web) fills bucket + typed_rule.
// At action submission, evaluateConstraints() returns the set of violations.

import type { BeaconAction } from '../actions/index'
import type { ConstraintBucket, ConstraintSeverity } from '../nodes/aip'
import { calibratedConfidence, type CalibrationReport } from '../calibration/index'

// ── Typed-rule shapes per bucket ──────────────────────────────────────────────

export interface ScopeRule {
  bucket: 'scope'
  /** Allowed hotel ids. Empty = no restriction beyond `applies_to_action_types`. */
  allowedHotelIds?: ReadonlyArray<string>
  /** Allowed organization ids. */
  allowedOrgIds?: ReadonlyArray<string>
}

export interface ThresholdRule {
  bucket: 'threshold'
  /** Which numeric field on the action to compare against. */
  field: string
  /** Inclusive upper bound; violation when value > max. */
  max?: number
  /** Inclusive lower bound; violation when value < min. */
  min?: number
}

export interface TimeWindowRule {
  bucket: 'time-window'
  /** Hour-of-day window (0–23 inclusive). Violation when now is outside. */
  startHour: number
  endHour: number
  /** Optional days-of-week restriction (0 = Sunday). Empty = every day. */
  daysOfWeek?: ReadonlyArray<number>
  /** IANA tz string the window is evaluated in. Defaults to UTC. */
  tz?: string
}

export interface ActorRoleRule {
  bucket: 'actor-role'
  /** Roles allowed to take the action. Violation when actor's role isn't in the set. */
  allowedRoles: ReadonlyArray<string>
}

export type ConstraintTypedRule = ScopeRule | ThresholdRule | TimeWindowRule | ActorRoleRule

// ── Constraint record + evaluation primitives ────────────────────────────────

export interface ConstraintRecord {
  id: string
  body: string
  bucket: ConstraintBucket
  typedRule: ConstraintTypedRule
  severity: ConstraintSeverity
  /** BeaconAction types this constraint gates. Empty = applies to all. */
  appliesToActionTypes: ReadonlyArray<string>
  active: boolean
}

export interface EvaluationContext {
  actorRole?: string | null
  /** `now` is injected so the evaluator is deterministic + testable. */
  now?: Date
}

export interface ConstraintViolation {
  constraintId: string
  body: string
  severity: ConstraintSeverity
  bucket: ConstraintBucket
  /** Operator-readable explanation that includes the offending value. */
  message: string
}

// ── Evaluator ────────────────────────────────────────────────────────────────

export function evaluateConstraints(
  action: BeaconAction,
  constraints: ReadonlyArray<ConstraintRecord>,
  ctx: EvaluationContext = {},
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = []
  const now = ctx.now ?? new Date()

  for (const c of constraints) {
    if (!c.active) continue
    if (c.appliesToActionTypes.length > 0 && !c.appliesToActionTypes.includes(action.type)) continue

    const v = evaluateOne(action, c, ctx, now)
    if (v) violations.push(v)
  }

  return violations
}

function evaluateOne(
  action: BeaconAction,
  c: ConstraintRecord,
  ctx: EvaluationContext,
  now: Date,
): ConstraintViolation | null {
  switch (c.typedRule.bucket) {
    case 'scope': {
      const r = c.typedRule
      const hotelId = (action as { hotelId?: string }).hotelId
      if (r.allowedHotelIds && r.allowedHotelIds.length > 0 && hotelId && !r.allowedHotelIds.includes(hotelId)) {
        return mkViolation(c, `hotel ${hotelId} not in allowed scope`)
      }
      return null
    }
    case 'threshold': {
      const r = c.typedRule
      const raw = (action as unknown as Record<string, unknown>)[r.field]
      if (typeof raw !== 'number') return null  // field not present → no violation
      if (r.max != null && raw > r.max) {
        return mkViolation(c, `${r.field} = ${String(raw)} exceeds max ${String(r.max)}`)
      }
      if (r.min != null && raw < r.min) {
        return mkViolation(c, `${r.field} = ${String(raw)} below min ${String(r.min)}`)
      }
      return null
    }
    case 'time-window': {
      const r = c.typedRule
      const hour = now.getUTCHours()
      const day = now.getUTCDay()
      const inHour = hour >= r.startHour && hour < r.endHour
      const inDay = !r.daysOfWeek || r.daysOfWeek.length === 0 || r.daysOfWeek.includes(day)
      if (inHour && inDay) return null
      return mkViolation(c, `outside allowed window ${String(r.startHour)}:00–${String(r.endHour)}:00 UTC`)
    }
    case 'actor-role': {
      const r = c.typedRule
      if (!ctx.actorRole) {
        return mkViolation(c, 'actor role unknown; this action requires a role check')
      }
      if (!r.allowedRoles.includes(ctx.actorRole)) {
        return mkViolation(c, `role "${ctx.actorRole}" not in allowed set [${r.allowedRoles.join(', ')}]`)
      }
      return null
    }
  }
}

function mkViolation(c: ConstraintRecord, message: string): ConstraintViolation {
  return {
    constraintId: c.id,
    body: c.body,
    severity: c.severity,
    bucket: c.bucket,
    message,
  }
}

/**
 * Convenience: returns true when the action is auto-executable given confidence,
 * the operator's per-action threshold, and the set of violations.
 *
 * Used by agent code that wants to short-circuit operator review when both:
 *   - confidence × criteria ≥ threshold
 *   - no hard violations
 *
 * Soft violations don't block auto-execution by themselves but are surfaced
 * to the operator after the fact for retroactive sampling.
 */
export function isAutoExecutable(args: {
  confidence: number
  threshold: number
  violations: ReadonlyArray<ConstraintViolation>
}): boolean {
  if (args.confidence < args.threshold) return false
  if (args.violations.some((v) => v.severity === 'hard')) return false
  return true
}

// ── Auto-execution policy ─────────────────────────────────────────────────────
//
// The single safety-critical decision behind unattended execution: should this
// proposal apply itself (triggered_by 'ai_auto_approved') or wait in the review
// queue? Centralized here so the operator-invoked path and the unattended cycle
// use identical rules — and so it's unit-tested in one place.

/** Per-action-type confidence floors. An action type absent from the map is
 *  NEVER auto-executable — it always routes to operator review. */
export interface AutoExecutionPolicy {
  thresholds: Partial<Record<BeaconAction['type'], number>>
}

/** Conservative V1 default: only REQUEST_RESTOCK auto-executes, at ≥0.9. */
export const DEFAULT_AUTO_EXEC_POLICY: AutoExecutionPolicy = {
  thresholds: { REQUEST_RESTOCK: 0.9 },
}

export interface AutoExecutionDecision {
  autoExecute: boolean
  /** Human-readable rationale, surfaced in the audit trail + cycle summary. */
  reason: string
}

/** Phase C step 2b: the proposing agent + which releases are visible. The
 *  release gate is fail-closed (Gap C): decideAutoExecution refuses to
 *  auto-execute unless the agent has a production release in scope. A caller
 *  that legitimately doesn't gate on releases opts out with allowUnreleased. */
export interface AgentReleaseContext {
  agentName:    string
  agentVersion: string
}

export interface ActiveAgentReleases {
  production: ReadonlyArray<{ agentName: string; version: string }>
}

/**
 * Decides whether an agent proposal may auto-execute. Composes the per-type
 * threshold policy with the constraint-violation set: an action auto-executes
 * only when its type is eligible, no hard constraint is violated, its
 * confidence clears the type's floor, and the proposing agent has a production
 * release. The release gate is fail-closed — omitting release context queues
 * the action unless the caller opts out with allowUnreleased.
 */
export function decideAutoExecution(args: {
  action: BeaconAction
  confidence: number
  violations: ReadonlyArray<ConstraintViolation>
  policy: AutoExecutionPolicy
  agent?: AgentReleaseContext
  releases?: ActiveAgentReleases
  /** Gap C — opt out of the fail-closed release gate. Default false: auto-exec
   *  REQUIRES a production release, so a caller that omits release context is
   *  queued, not silently executed. Set true only where the release gate isn't
   *  the concern (unit tests of other gates, the no-write scenario sandbox).
   *  Production cycle callers never set it. */
  allowUnreleased?: boolean
  /** Phase E3 — per-agent floor overrides. When the proposing agent's name
   *  appears here, this value supersedes the per-action-type threshold (it
   *  does not bypass the action-type eligibility check). */
  agentOverrides?: Record<string, number>
  /** Phase P2 — calibration trust budget. The proposing agent's reliability
   *  report (from computeCalibration over its resolved proposals). When present
   *  and proven, it can VETO an otherwise-eligible auto-execution: a proven
   *  agent whose observed hit-rate at this confidence is below the floor is
   *  queued instead. Omit to keep static-floor behaviour. */
  calibration?: CalibrationReport
  /** When true, auto-execution additionally REQUIRES proven calibration —
   *  no evidence means queue. Default false. */
  requireCalibration?: boolean
  /** Minimum resolved samples before calibration counts as proven. Default 20. */
  minCalibrationSamples?: number
  /** Q3 — forecast-accuracy trust budget. Realized accuracy of the forecast
   *  basis that SIZED this proposal (from scored forecast_observations). When the
   *  basis has proven inaccurate — enough scored windows AND MAPE above the
   *  ceiling — auto-execution is vetoed even if the agent's decision-calibration
   *  looks fine: an accurate decision on a bad number still queues. BLOCK-only,
   *  like the calibration budget. Omit → unchanged. */
  forecastAccuracy?: { basis: string; mape: number; n: number }
  /** MAPE ceiling above which a proven-inaccurate forecast basis vetoes auto-exec. Default 0.4. */
  maxForecastMape?: number
  /** Min scored windows before forecast accuracy counts as proven. Default 3. */
  minForecastWindows?: number
}): AutoExecutionDecision {
  const typeThreshold = args.policy.thresholds[args.action.type]
  if (typeThreshold == null) {
    return { autoExecute: false, reason: `${args.action.type} is not eligible for auto-execution` }
  }
  const agentOverride = args.agent != null ? args.agentOverrides?.[args.agent.agentName] : undefined
  const threshold = agentOverride ?? typeThreshold

  const hard = args.violations.filter((v) => v.severity === 'hard')
  if (hard.length > 0) {
    return { autoExecute: false, reason: `blocked by ${String(hard.length)} hard constraint(s)` }
  }
  if (args.confidence < threshold) {
    const why = agentOverride != null
      ? `agent floor ${threshold.toFixed(2)} (override)`
      : `floor ${threshold.toFixed(2)}`
    return { autoExecute: false, reason: `confidence ${args.confidence.toFixed(2)} below ${why}` }
  }
  // Release gate (fail-closed, Gap C): auto-execution requires a production
  // release for the proposing agent. A caller that simply forgets to wire
  // release context is DENIED (queued), never silently auto-executed. Callers
  // that legitimately don't gate on releases — unit tests of the other gates,
  // the no-write scenario sandbox — opt out loudly with allowUnreleased. The
  // safety logic lives only here; there is no second gate (see CLAUDE.md).
  if (!args.allowUnreleased) {
    if (args.agent == null || args.releases == null) {
      return { autoExecute: false, reason: 'auto-execution requires release context (no agent/releases supplied)' }
    }
    const prod = args.releases.production.find((r) => r.agentName === args.agent!.agentName)
    if (prod == null) {
      return { autoExecute: false, reason: `${args.agent.agentName} has no production release in scope` }
    }
  }

  // Calibration trust budget: an agent earns unattended execution by proving
  // its stated confidence is honest. This only ever BLOCKS — a proven agent
  // whose observed hit-rate at this confidence is below the floor is queued
  // even though it cleared the static floor; require_calibration additionally
  // demands the evidence exist. No calibration supplied → unchanged behaviour.
  const minSamples = args.minCalibrationSamples ?? 20
  const cal = args.calibration
  const proven = cal != null && cal.sufficientData && cal.resolved >= minSamples

  if (args.requireCalibration && !proven) {
    const why = cal == null ? 'no calibration evidence yet'
      : !cal.sufficientData ? 'calibration not yet conclusive (need both approvals and rejections)'
      : `only ${String(cal.resolved)} resolved sample(s), need ${String(minSamples)}`
    return { autoExecute: false, reason: `auto-execution requires proven calibration — ${why}` }
  }
  if (proven) {
    const observed = calibratedConfidence(cal, args.confidence)
    if (observed != null && observed < threshold) {
      return {
        autoExecute: false,
        reason: `observed hit-rate ${observed.toFixed(2)} at confidence ~${args.confidence.toFixed(2)} below floor ${threshold.toFixed(2)} — agent is overconfident here`,
      }
    }
  }

  // Forecast-accuracy trust budget (Q3): the agent's decision may be well-
  // calibrated, but if the FORECAST that sized this order has been running
  // inaccurate, queue it — a confident, correct decision on a bad number is
  // still a bad order. Composes the second accuracy signal into the one gate.
  const fa = args.forecastAccuracy
  if (fa != null) {
    const minWindows = args.minForecastWindows ?? 3
    const ceiling = args.maxForecastMape ?? 0.4
    if (fa.n >= minWindows && fa.mape > ceiling) {
      return {
        autoExecute: false,
        reason: `forecast basis ${fa.basis} running ${(fa.mape * 100).toFixed(0)}% MAPE over ${String(fa.n)} scored windows (ceiling ${(ceiling * 100).toFixed(0)}%) — queue for review`,
      }
    }
  }
  return { autoExecute: true, reason: `confidence ${args.confidence.toFixed(2)} ≥ ${threshold.toFixed(2)}, no hard violations` }
}
