// Phase H step 2 — Scenarios layer.
//
// A Scenario carries a graph_overlay: typed overrides on variants, policy,
// constraints, plus a list of hypothetical actions. At simulation time the
// overlay is merged on top of the real graph state and runIntelligenceCycle
// runs against the merged view with NO-OP persistence — proposals never
// touch the real DB, dispatches never fire.
//
// The runner returns a CycleResult plus a delta vs reality so the operator
// can see "this overlay would queue 4 of today's 12 auto-execs."

import type { BeaconAction } from '../actions/index'
import type { OrgPolicy } from '../policy/index'
import type { ConstraintRecord } from '../constraints/index'

// ── Typed overlay shape ──────────────────────────────────────────────────────
// All keys are optional; missing key = no override for that layer.

export interface ScenarioGraphOverlay {
  /** Per-variant overrides keyed by variant id. Missing field = use the real
   *  value. Used by the runner to materialize a hypothetical variant snapshot. */
  variants?: Record<string, {
    par_level?:     number
    current_stock?: number
  }>
  /** Partial OrgPolicy merged on top of the org's saved policy. Threading is
   *  the same as the operator-tunable Mind → Policy editor — every nested
   *  key is optional. */
  policy?: DeepPartial<OrgPolicy>
  /** Constraint overlay: disable specific real constraints and/or add new
   *  hypothetical ones for this simulation only. */
  constraints?: {
    disabled?: ReadonlyArray<string>
    added?:    ReadonlyArray<ConstraintRecord>
  }
  /** Hypothetical actions to inject before the scan. Used to ask "if I
   *  manually did X first, what would the cycle then propose?" */
  actions?: ReadonlyArray<BeaconAction>
}

// ── Cached simulation result (record_simulation_result row) ──────────────────

export interface ScenarioSimulationCache {
  ran_at: string
  /** CycleResult shape from runIntelligenceCycle. Kept loose to avoid an
   *  import cycle; the runner is the source of truth. */
  result: {
    scanned:      number
    proposed:     number
    autoExecuted: number
    queued:       number
    ranAt:        string
    items:        ReadonlyArray<{
      variantId:    string
      variantName:  string
      outcome:      string
      actionType?:  string
      reason?:      string
    }>
  }
  /** Delta vs a baseline run with the same scope but no overlay. NULL when
   *  the baseline run wasn't taken (e.g. operator opted out for speed). */
  delta: {
    autoExecutedDelta: number
    queuedDelta:       number
    /** Per-item flips: "this variant was auto-exec in baseline → queued under overlay". */
    flips: ReadonlyArray<{
      variantId:    string
      variantName:  string
      baseline:     string  // baseline outcome
      overlay:      string  // overlay outcome
    }>
  } | null
}

// ── Merge helpers ────────────────────────────────────────────────────────────

/** Deep-merges a partial OrgPolicy overlay on top of a base policy. Numeric
 *  values are replaced, objects are merged recursively. Undefined values in
 *  the overlay leave the base value alone. */
export function mergePolicyOverlay(base: OrgPolicy, overlay: DeepPartial<OrgPolicy> | undefined): OrgPolicy {
  if (!overlay) return base
  return {
    auto_execution: {
      thresholds: {
        ...base.auto_execution.thresholds,
        ...(overlay.auto_execution?.thresholds ?? {}),
      },
      agent_overrides: mergeNumericMap(
        base.auto_execution.agent_overrides,
        overlay.auto_execution?.agent_overrides,
      ),
    },
    promotion: {
      production_pass_rate_floor:
        overlay.promotion?.production_pass_rate_floor ?? base.promotion.production_pass_rate_floor,
    },
    overstock: {
      factor: overlay.overstock?.factor ?? base.overstock.factor,
    },
    par: {
      service_level: overlay.par?.service_level ?? base.par.service_level,
      window_days:   overlay.par?.window_days   ?? base.par.window_days,
    },
    supplier_reliability: {
      window_days: overlay.supplier_reliability?.window_days ?? base.supplier_reliability.window_days,
    },
    caps: {
      max_variants_per_cycle:  overlay.caps?.max_variants_per_cycle  ?? base.caps.max_variants_per_cycle,
      max_proposals_per_sweep: overlay.caps?.max_proposals_per_sweep ?? base.caps.max_proposals_per_sweep,
    },
  }
}

/** Applies the constraint overlay: filters out disabled ids, appends any
 *  added hypothetical constraints. */
export function mergeConstraintOverlay(
  base: ReadonlyArray<ConstraintRecord>,
  overlay: ScenarioGraphOverlay['constraints'] | undefined,
): ConstraintRecord[] {
  if (!overlay) return base.slice()
  const disabled = new Set(overlay.disabled ?? [])
  const kept = base.filter((c) => !disabled.has(c.id))
  return [...kept, ...(overlay.added ?? [])]
}

/** Applies a variant overlay onto a single variant value. Used by the runner
 *  when building the simulation-time variant snapshot. */
export function applyVariantOverlay<T extends { id: string; current_stock?: number; par_level?: number | null }>(
  v: T,
  overlay: ScenarioGraphOverlay['variants'] | undefined,
): T {
  if (!overlay) return v
  const ov = overlay[v.id]
  if (!ov) return v
  return {
    ...v,
    current_stock: ov.current_stock ?? v.current_stock,
    par_level:     ov.par_level     ?? v.par_level,
  }
}

// ── Internal helpers ─────────────────────────────────────────────────────────

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

function mergeNumericMap(
  base: Record<string, number>,
  overlay: Record<string, number | undefined> | undefined,
): Record<string, number> {
  const out: Record<string, number> = { ...base }
  if (overlay) {
    for (const [k, v] of Object.entries(overlay)) {
      if (typeof v === 'number') out[k] = v
    }
  }
  return out
}
