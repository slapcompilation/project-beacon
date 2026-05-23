// Constraint engine — pure evaluator + typed rule shapes.
// Operators author in NL; a categorizer (apps/web) fills bucket + typed_rule.
// At action submission, evaluateConstraints() returns the set of violations.

import type { BeaconAction } from '../actions/index'
import type { ConstraintBucket, ConstraintSeverity } from '../nodes/aip'

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
