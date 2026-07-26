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
import type { AutoExecutionPolicy } from '../constraints/index'

/** A monitor's trigger is data, not code: the operator tunes the threshold,
 *  the deterministic metric (days_until_expiry, cost_at_risk) stays in a tool.
 *  Stored inside the org policy doc so it's editable with no redeploy. */
export interface ExpiryMonitorConfig {
  /** Master switch. When false the detector emits nothing. */
  enabled: boolean
  /** Fire when a batch's days_until_expiry ≤ this. The tunable trigger. */
  threshold_days: number
  /** Ignore batches whose cost_at_risk is below this (€). Filters noise. */
  min_cost_at_risk: number
  /** When true, fired batches emit WRITE_OFF proposals into Decisions. They
   *  still queue for review — WRITE_OFF is never in the auto-exec policy. */
  auto_propose: boolean
}

/** Stockout surfacing band — the proposal path (restock_advisor) is unchanged;
 *  this only tunes when a variant *surfaces* as a stockout signal. */
export interface StockoutMonitorConfig {
  enabled: boolean
  /** Surface when days_until_zero ≤ this. */
  threshold_days: number
}

/** Waste anomaly band. */
export interface WasteMonitorConfig {
  enabled: boolean
  /** Surface when anomaly_score ≥ this (scores run 1–10). */
  min_anomaly_score: number
}

/** Supplier-risk band — score runs 0–10, lower is worse. */
export interface SupplierMonitorConfig {
  enabled: boolean
  /** Surface when reliability_score ≤ this. */
  max_reliability_score: number
}

/** Data-integration health SLA. The metric (minutes since a connector last fed
 *  us; how long the document pipeline's oldest un-processed item has waited) is
 *  deterministic; these are the tunable thresholds that used to be hardcoded as
 *  2h/24h inside get_pms_health / get_pos_health. */
export interface IntegrationHealthConfig {
  enabled: boolean
  /** A live feed (PMS/POS) is 'stale' once this many minutes pass with no new
   *  data. Default 120 (the old hardcoded 2h). */
  warn_after_minutes: number
  /** …and 'down' past this many minutes. Default 1440 (the old 24h). */
  down_after_minutes: number
  /** A document left waiting to be processed longer than this counts the
   *  ingestion pipeline as stalled. Default 720 (12h). */
  stuck_ingest_after_minutes: number
}

/** Process-bottleneck detection over the lifecycle transition log (P11, Foundry
 *  Machinery parity). The metric (how many objects entered vs exited a state) is
 *  deterministic; these are the tunable thresholds — a non-terminal state fires
 *  when its exit ratio slips below max_exit_ratio and enough objects have passed
 *  through to matter. */
export interface BottleneckMonitorConfig {
  enabled: boolean
  /** Ignore states fewer than this many objects have entered (noise floor). */
  min_entered: number
  /** Fire when exited/entered drops below this. Default 0.4. 0..1. */
  max_exit_ratio: number
}

/** Budget monitor: fire when a category's spend crosses the operator's ceiling.
 *  Metric = actual as % of the allocated budget; trigger = the % + a spend floor. */
export interface BudgetMonitorConfig {
  enabled: boolean
  /** Fire when actual/allocated × 100 reaches this. Default 100 (at/over budget). */
  over_budget_pct: number
  /** Ignore categories with less actual spend than this (noise floor). */
  min_spend: number
}

/** CPOR monitor: fire when cost-per-occupied-room rises sharply period-on-period.
 *  Metric = cpor_change_pct (positive = cost rose); trigger = the % rise. */
export interface CporMonitorConfig {
  enabled: boolean
  /** Fire when the latest period's CPOR rose by at least this %. Default 10. */
  rise_pct: number
}

export interface OrgPolicy {
  auto_execution: {
    /** Per-action-type confidence floor for auto-execution, 0..1. */
    thresholds: Partial<Record<BeaconAction['type'], number>>
    /** Per-agent floor that supersedes the action-type threshold when the
     *  proposal came from this agent. Lets the operator tighten or loosen
     *  one agent without touching the rest. 0..1. */
    agent_overrides: Record<string, number>
    /** Trust budget: when true, an action auto-executes only if the proposing
     *  agent has *proven* calibration — enough resolved samples, both outcome
     *  classes, and an observed hit-rate at the proposal's confidence that
     *  meets the floor. Default false (static floors govern alone). */
    require_calibration: boolean
    /** Minimum resolved samples before calibration counts as proven. */
    min_calibration_samples: number
    /** Q3 — MAPE ceiling above which a proven-inaccurate forecast basis vetoes
     *  auto-execution (block-only, alongside calibration). The forecast that
     *  sized the order must be trustworthy, not just the agent's confidence. 0..1. */
    max_forecast_mape: number
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
  monitors: {
    /** Expiry detection — the first monitor whose condition is tunable data. */
    expiry: ExpiryMonitorConfig
    stockout: StockoutMonitorConfig
    waste: WasteMonitorConfig
    supplier: SupplierMonitorConfig
    /** Connector + ingestion-pipeline freshness (Foundry health-checks parity). */
    integration: IntegrationHealthConfig
    /** Process bottlenecks over the lifecycle transition log (Machinery parity). */
    bottleneck: BottleneckMonitorConfig
    /** F&B budget breaches — fires a Home-briefing signal, not a dashboard tab. */
    budget: BudgetMonitorConfig
    /** Cost-per-occupied-room spikes — the GM's P&L signal in the briefing. */
    cpor: CporMonitorConfig
  }
  /** Learning-loop goals (P3 observability→control). Targets the operator sets
   *  for "is the loop getting better?", tracked on the Flywheel as progress. */
  goals: {
    /** Target ceiling for calibration error (ECE), 0..1. Met when actual ≤ this. */
    max_calibration_error: number
    /** Target floor for the proposal approval rate, 0..1. Met when actual ≥ this. */
    min_approval_rate: number
  }
}

export interface GoalDef { key: 'calibration_error' | 'approval_rate'; label: string; unit: '%'; lowerIsBetter: boolean }

export const LOOP_GOALS: GoalDef[] = [
  { key: 'calibration_error', label: 'Calibration error (ECE)', unit: '%', lowerIsBetter: true },
  { key: 'approval_rate',     label: 'Proposal approval rate',  unit: '%', lowerIsBetter: false },
]

/** Progress toward a goal: met + a 0–100 bar. lowerIsBetter goals (ECE) are met
 *  at or below target; higher-is-better (approval) at or above. */
export function goalProgress(target: number, actual: number | null, lowerIsBetter: boolean): { met: boolean; pct: number } {
  if (actual === null || !Number.isFinite(actual)) return { met: false, pct: 0 }
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  if (lowerIsBetter) {
    const met = actual <= target
    return { met, pct: met ? 100 : actual > 0 ? Math.round(clamp01(target / actual) * 100) : 100 }
  }
  const met = actual >= target
  return { met, pct: target > 0 ? Math.round(clamp01(actual / target) * 100) : 100 }
}

/** A goal that's off target maps to one bounded, governed remediation the
 *  operator can apply with a click. Not silent automation — a recommendation
 *  that writes through the same audited set_org_policy path. `next` is the full
 *  policy to persist. */
export interface GoalIntervention {
  goalKey:    GoalDef['key']
  title:      string
  rationale:  string
  applyLabel: string
  next:       OrgPolicy
}

/** Given a missed loop-goal, returns the single tightening lever that most
 *  directly addresses it, or null when the goal is met or the lever is already
 *  pulled (nothing left to tighten). One lever per goal — deliberately bounded. */
export function recommendGoalIntervention(key: GoalDef['key'], actual: number | null, policy: OrgPolicy): GoalIntervention | null {
  if (actual === null || !Number.isFinite(actual)) return null
  const pct = (x: number) => `${Math.round(x * 100)}%`

  if (key === 'calibration_error') {
    const target = policy.goals.max_calibration_error
    if (actual <= target) return null                                  // met
    if (policy.auto_execution.require_calibration) return null         // lever already pulled
    return {
      goalKey: key,
      title: 'Require proven calibration for auto-execution',
      rationale: `Calibration error is ${pct(actual)} against your ${pct(target)} ceiling — agents are more confident than they are correct. Gate unattended execution on proven calibration until the loop recovers.`,
      applyLabel: 'Require calibration',
      next: { ...policy, auto_execution: { ...policy.auto_execution, require_calibration: true } },
    }
  }

  const target = policy.goals.min_approval_rate
  if (actual >= target) return null                                    // met
  const bumped = bumpThresholds(policy.auto_execution.thresholds, 0.05, 0.95)
  if (bumped === null) return null                                     // nothing left to raise
  return {
    goalKey: key,
    title: 'Raise the auto-execution bar',
    rationale: `Operators are approving only ${pct(actual)} of proposals against your ${pct(target)} floor — too much is auto-executing that they would not sign off on. Raise the confidence floor so more proposals route to review.`,
    applyLabel: 'Raise floors +5%',
    next: { ...policy, auto_execution: { ...policy.auto_execution, thresholds: bumped } },
  }
}

/** Bumps every set confidence floor by `step`, capped at `cap`. Returns null when
 *  no floor could move (empty map, or all already at/above the cap). */
function bumpThresholds(
  thresholds: Partial<Record<BeaconAction['type'], number>>,
  step: number,
  cap: number,
): Partial<Record<BeaconAction['type'], number>> | null {
  const entries = Object.entries(thresholds) as [BeaconAction['type'], number][]
  if (entries.length === 0) return null
  let moved = false
  const out: Partial<Record<BeaconAction['type'], number>> = {}
  for (const [k, v] of entries) {
    const next = Math.min(cap, Math.round((v + step) * 100) / 100)
    if (next > v) moved = true
    out[k] = next
  }
  return moved ? out : null
}

export const DEFAULT_ORG_POLICY: OrgPolicy = {
  auto_execution: {
    thresholds:      { REQUEST_RESTOCK: 0.9 },
    agent_overrides: {},
    require_calibration:     false,
    min_calibration_samples: 20,
    max_forecast_mape:       0.4,
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
  monitors: {
    expiry:   { enabled: true, threshold_days: 7, min_cost_at_risk: 0, auto_propose: false },
    stockout: { enabled: true, threshold_days: 14 },
    waste:    { enabled: true, min_anomaly_score: 1 },
    supplier: { enabled: true, max_reliability_score: 6 },
    integration: { enabled: true, warn_after_minutes: 120, down_after_minutes: 1440, stuck_ingest_after_minutes: 720 },
    bottleneck:  { enabled: true, min_entered: 3, max_exit_ratio: 0.4 },
    budget:      { enabled: true, over_budget_pct: 100, min_spend: 0 },
    cpor:        { enabled: true, rise_pct: 10 },
  },
  goals: {
    max_calibration_error: 0.1,
    min_approval_rate:     0.7,
  },
}

/** Deep-merges operator overrides over the defaults. Missing sections fall
 *  back; missing individual fields within a section fall back. Unknown keys
 *  in the override are ignored. */
export function mergeOrgPolicy(override: unknown): OrgPolicy {
  if (override == null || typeof override !== 'object') return DEFAULT_ORG_POLICY
  const o = override as Record<string, unknown>

  const merged: OrgPolicy = {
    auto_execution: {
      thresholds:      { ...DEFAULT_ORG_POLICY.auto_execution.thresholds },
      agent_overrides: { ...DEFAULT_ORG_POLICY.auto_execution.agent_overrides },
      require_calibration:     DEFAULT_ORG_POLICY.auto_execution.require_calibration,
      min_calibration_samples: DEFAULT_ORG_POLICY.auto_execution.min_calibration_samples,
      max_forecast_mape:       DEFAULT_ORG_POLICY.auto_execution.max_forecast_mape,
    },
    promotion:            { ...DEFAULT_ORG_POLICY.promotion },
    overstock:            { ...DEFAULT_ORG_POLICY.overstock },
    par:                  { ...DEFAULT_ORG_POLICY.par },
    supplier_reliability: { ...DEFAULT_ORG_POLICY.supplier_reliability },
    caps:                 { ...DEFAULT_ORG_POLICY.caps },
    monitors: {
      expiry:      { ...DEFAULT_ORG_POLICY.monitors.expiry },
      stockout:    { ...DEFAULT_ORG_POLICY.monitors.stockout },
      waste:       { ...DEFAULT_ORG_POLICY.monitors.waste },
      supplier:    { ...DEFAULT_ORG_POLICY.monitors.supplier },
      integration: { ...DEFAULT_ORG_POLICY.monitors.integration },
      bottleneck:  { ...DEFAULT_ORG_POLICY.monitors.bottleneck },
      budget:      { ...DEFAULT_ORG_POLICY.monitors.budget },
      cpor:        { ...DEFAULT_ORG_POLICY.monitors.cpor },
    },
    goals: { ...DEFAULT_ORG_POLICY.goals },
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
    if (isObj(ae.agent_overrides)) {
      const overrides = ae.agent_overrides as Record<string, unknown>
      for (const [k, v] of Object.entries(overrides)) {
        if (typeof v === 'number' && v >= 0 && v <= 1) {
          merged.auto_execution.agent_overrides[k] = v
        }
      }
    }
    if (typeof ae.require_calibration === 'boolean') {
      merged.auto_execution.require_calibration = ae.require_calibration
    }
    if (typeof ae.min_calibration_samples === 'number' && ae.min_calibration_samples >= 1) {
      merged.auto_execution.min_calibration_samples = Math.round(ae.min_calibration_samples)
    }
    if (typeof ae.max_forecast_mape === 'number' && ae.max_forecast_mape >= 0) {
      merged.auto_execution.max_forecast_mape = ae.max_forecast_mape
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
  if (isObj(o.monitors)) {
    const mo = o.monitors as Record<string, unknown>
    if (isObj(mo.expiry)) {
      const e = mo.expiry as Record<string, unknown>
      const m = merged.monitors.expiry
      if (typeof e.enabled          === 'boolean') m.enabled          = e.enabled
      if (typeof e.auto_propose     === 'boolean') m.auto_propose     = e.auto_propose
      if (typeof e.threshold_days   === 'number')  m.threshold_days   = clamp(Math.round(e.threshold_days), 0, 365)
      if (typeof e.min_cost_at_risk === 'number')  m.min_cost_at_risk = Math.max(0, e.min_cost_at_risk)
    }
    if (isObj(mo.stockout)) {
      const s = mo.stockout as Record<string, unknown>
      const m = merged.monitors.stockout
      if (typeof s.enabled        === 'boolean') m.enabled        = s.enabled
      if (typeof s.threshold_days === 'number')  m.threshold_days = clamp(Math.round(s.threshold_days), 0, 365)
    }
    if (isObj(mo.waste)) {
      const w = mo.waste as Record<string, unknown>
      const m = merged.monitors.waste
      if (typeof w.enabled           === 'boolean') m.enabled           = w.enabled
      if (typeof w.min_anomaly_score === 'number')  m.min_anomaly_score = clamp(w.min_anomaly_score, 0, 10)
    }
    if (isObj(mo.supplier)) {
      const sup = mo.supplier as Record<string, unknown>
      const m = merged.monitors.supplier
      if (typeof sup.enabled               === 'boolean') m.enabled               = sup.enabled
      if (typeof sup.max_reliability_score === 'number')  m.max_reliability_score = clamp(sup.max_reliability_score, 0, 10)
    }
    if (isObj(mo.integration)) {
      const ig = mo.integration as Record<string, unknown>
      const m = merged.monitors.integration
      if (typeof ig.enabled                    === 'boolean') m.enabled                    = ig.enabled
      if (typeof ig.warn_after_minutes         === 'number')  m.warn_after_minutes         = clamp(Math.round(ig.warn_after_minutes), 1, 43200)
      if (typeof ig.down_after_minutes         === 'number')  m.down_after_minutes         = clamp(Math.round(ig.down_after_minutes), 1, 43200)
      if (typeof ig.stuck_ingest_after_minutes === 'number')  m.stuck_ingest_after_minutes = clamp(Math.round(ig.stuck_ingest_after_minutes), 1, 43200)
    }
    if (isObj(mo.bottleneck)) {
      const bn = mo.bottleneck as Record<string, unknown>
      const m = merged.monitors.bottleneck
      if (typeof bn.enabled        === 'boolean') m.enabled        = bn.enabled
      if (typeof bn.min_entered    === 'number')  m.min_entered    = Math.max(0, Math.round(bn.min_entered))
      if (typeof bn.max_exit_ratio === 'number')  m.max_exit_ratio = clamp(bn.max_exit_ratio, 0, 1)
    }
    if (isObj(mo.budget)) {
      const b = mo.budget as Record<string, unknown>
      const m = merged.monitors.budget
      if (typeof b.enabled         === 'boolean') m.enabled         = b.enabled
      if (typeof b.over_budget_pct === 'number')  m.over_budget_pct = clamp(b.over_budget_pct, 0, 1000)
      if (typeof b.min_spend       === 'number')  m.min_spend       = Math.max(0, b.min_spend)
    }
    if (isObj(mo.cpor)) {
      const c = mo.cpor as Record<string, unknown>
      const m = merged.monitors.cpor
      if (typeof c.enabled  === 'boolean') m.enabled  = c.enabled
      if (typeof c.rise_pct === 'number')  m.rise_pct = clamp(c.rise_pct, 0, 1000)
    }
  }
  if (isObj(o.goals)) {
    const g = o.goals as Record<string, unknown>
    if (typeof g.max_calibration_error === 'number') merged.goals.max_calibration_error = clamp(g.max_calibration_error, 0, 1)
    if (typeof g.min_approval_rate     === 'number') merged.goals.min_approval_rate     = clamp(g.min_approval_rate, 0, 1)
  }

  return merged
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function isObj(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === 'object' && !Array.isArray(x)
}

/** Adapter — pulls the per-action-type confidence floors out of an OrgPolicy
 *  into the shape decideAutoExecution expects. Phase E2 callers use this
 *  instead of the hardcoded DEFAULT_AUTO_EXEC_POLICY. */
export function orgPolicyToAutoExecPolicy(p: OrgPolicy): AutoExecutionPolicy {
  return { thresholds: { ...p.auto_execution.thresholds } }
}
