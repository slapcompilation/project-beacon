// Phase E1 — operator-tunable autonomy policy.
//
// Today most knobs governing the autonomous loop are code constants. This
// module establishes them as a typed document the operator owns; the DB
// (org_policy table, migration 151) stores only the overrides — defaults live
// here so the system has sensible behaviour with an empty table.
//
// Callers (decideAutoExecution, runIntelligenceCycle, useOrgOverstockSweep,
// promote_agent, compute_supplier_reliability) get plumbed in Phase E2.

import type { BeaconAction } from '../actions/index'

export interface OrgPolicy {
  auto_execution: {
    /** Per-action-type confidence floor for auto-execution, 0..1. */
    thresholds: Partial<Record<BeaconAction['type'], number>>
  }
  promotion: {
    /** Minimum eval pass rate required to promote an agent to production, 0..1. */
    production_pass_rate_floor: number
  }
  overstock: {
    /** current_stock > low_stock_threshold * factor counts as overstock. */
    factor: number
  }
  par: {
    /** Service level (fill rate) the par engine targets, 0..1. */
    service_level: number
    /** Window of consumption history the engine considers, in days. */
    window_days: number
  }
  supplier_reliability: {
    /** Window of PO/invoice history feeding on_time_pct + cost_variance_pct, in days. */
    window_days: number
  }
  caps: {
    /** Hard cap on at-risk variants the intelligence cycle scans per run. */
    max_variants_per_cycle: number
    /** Hard cap on proposals an org-sweep emits per invocation. */
    max_proposals_per_sweep: number
  }
}

export const DEFAULT_ORG_POLICY: OrgPolicy = {
  auto_execution: {
    thresholds: { REQUEST_RESTOCK: 0.9 },
  },
  promotion: {
    production_pass_rate_floor: 0.7,
  },
  overstock: {
    factor: 2,
  },
  par: {
    service_level: 0.95,
    window_days: 90,
  },
  supplier_reliability: {
    window_days: 90,
  },
  caps: {
    max_variants_per_cycle: 25,
    max_proposals_per_sweep: 25,
  },
}

/** Deep-merges operator overrides over the defaults. Missing sections fall
 *  back; missing individual fields within a section fall back. Unknown keys
 *  in the override are ignored. */
export function mergeOrgPolicy(override: unknown): OrgPolicy {
  if (override == null || typeof override !== 'object') return DEFAULT_ORG_POLICY
  const o = override as Record<string, unknown>

  const merged: OrgPolicy = {
    auto_execution: { thresholds: { ...DEFAULT_ORG_POLICY.auto_execution.thresholds } },
    promotion:            { ...DEFAULT_ORG_POLICY.promotion },
    overstock:            { ...DEFAULT_ORG_POLICY.overstock },
    par:                  { ...DEFAULT_ORG_POLICY.par },
    supplier_reliability: { ...DEFAULT_ORG_POLICY.supplier_reliability },
    caps:                 { ...DEFAULT_ORG_POLICY.caps },
  }

  if (isObj(o.auto_execution)) {
    const ae = o.auto_execution as Record<string, unknown>
    if (isObj(ae.thresholds)) {
      const thresholds = ae.thresholds as Record<string, unknown>
      for (const [k, v] of Object.entries(thresholds)) {
        if (typeof v === 'number' && v >= 0 && v <= 1) {
          merged.auto_execution.thresholds[k as BeaconAction['type']] = v
        }
      }
    }
  }
  if (isObj(o.promotion) && typeof (o.promotion as Record<string, unknown>).production_pass_rate_floor === 'number') {
    merged.promotion.production_pass_rate_floor = (o.promotion as Record<string, number>).production_pass_rate_floor
  }
  if (isObj(o.overstock) && typeof (o.overstock as Record<string, unknown>).factor === 'number') {
    merged.overstock.factor = (o.overstock as Record<string, number>).factor
  }
  if (isObj(o.par)) {
    const p = o.par as Record<string, unknown>
    if (typeof p.service_level === 'number') merged.par.service_level = p.service_level
    if (typeof p.window_days   === 'number') merged.par.window_days   = Math.round(p.window_days)
  }
  if (isObj(o.supplier_reliability)) {
    const sr = o.supplier_reliability as Record<string, unknown>
    if (typeof sr.window_days === 'number') merged.supplier_reliability.window_days = Math.round(sr.window_days)
  }
  if (isObj(o.caps)) {
    const c = o.caps as Record<string, unknown>
    if (typeof c.max_variants_per_cycle  === 'number') merged.caps.max_variants_per_cycle  = Math.round(c.max_variants_per_cycle)
    if (typeof c.max_proposals_per_sweep === 'number') merged.caps.max_proposals_per_sweep = Math.round(c.max_proposals_per_sweep)
  }

  return merged
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x)
}
