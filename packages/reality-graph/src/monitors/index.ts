// Monitors — the metric/trigger split made concrete.
//
// A monitor's METRIC is deterministic compute (days_until_expiry, cost_at_risk)
// that stays in code; its TRIGGER is operator-tunable data (the threshold),
// stored in the org policy doc. This module is the trigger side: pure functions
// that take a config + a batch of metric readings and return the fired hits,
// plus the typed Action each hit proposes. No thresholds are hardcoded here —
// every band is derived from the rule the operator owns.

import type { BeaconAction } from '../actions/index'
import type {
  ExpiryMonitorConfig, StockoutMonitorConfig, WasteMonitorConfig, SupplierMonitorConfig,
} from '../policy/index'

export interface ExpiryBatch {
  variantId: string
  variantLabel: string
  quantity: number
  daysUntilExpiry: number
  costAtRisk: number
  hotelId: string
}

export interface ExpiryTriggerHit extends ExpiryBatch {
  /** 0–10, derived from how deep inside the window the batch sits — relative to
   *  the *tunable* threshold, not a hardcoded 3/7-day band. */
  urgency: number
}

/** Urgency as a function of the tunable threshold: expired (≤0) → 10, at the
 *  threshold edge → 1, linear in between. Retune the threshold and the bands
 *  move with it — that's the whole point. */
export function expiryUrgency(daysUntilExpiry: number, thresholdDays: number): number {
  if (daysUntilExpiry <= 0 || thresholdDays <= 0) return 10
  const ratio = 1 - daysUntilExpiry / thresholdDays
  return clamp(Math.round(ratio * 10) + 1, 1, 10)
}

/** The trigger: pick the batches whose metric crosses the operator's rule.
 *  Disabled rule → nothing. Sorted most-urgent (and most-valuable) first. */
export function selectExpiryTriggers(
  batches: ReadonlyArray<ExpiryBatch>,
  rule: ExpiryMonitorConfig,
): ExpiryTriggerHit[] {
  if (!rule.enabled) return []
  const hits: ExpiryTriggerHit[] = []
  for (const b of batches) {
    if (b.quantity <= 0) continue
    if (b.daysUntilExpiry > rule.threshold_days) continue
    if (b.costAtRisk < rule.min_cost_at_risk) continue
    hits.push({ ...b, urgency: expiryUrgency(b.daysUntilExpiry, rule.threshold_days) })
  }
  return hits.sort((a, b) => b.urgency - a.urgency || b.costAtRisk - a.costAtRisk)
}

/** The effect: a fired hit becomes a typed WRITE_OFF proposal. It routes to
 *  Decisions through the same gate as every other proposal — WRITE_OFF is never
 *  in the auto-exec policy, so it always queues for a human. */
export function expiryHitToWriteOff(
  hit: ExpiryTriggerHit,
  userId: string,
): Extract<BeaconAction, { type: 'WRITE_OFF' }> {
  const when = hit.daysUntilExpiry <= 0 ? 'has expired' : `expires in ${String(hit.daysUntilExpiry)}d`
  return {
    type: 'WRITE_OFF',
    variantId: hit.variantId,
    quantity: hit.quantity,
    wasteReason: `Expiry monitor: ${hit.variantLabel} ${when} (€${hit.costAtRisk.toFixed(0)} at risk)`,
    hotelId: hit.hotelId,
    userId,
    removalCategory: 'expiry',
  }
}

// ── NL tuning ─────────────────────────────────────────────────────────────────
// Operators retune the trigger in plain English. Same heuristic-categorizer
// pattern as constraints/categorizer.ts — a stop-gap until a real LLM plugs in
// behind the identical signature. Registerable as a copilot tool unchanged.

export interface ExpiryTuningResult {
  rule: ExpiryMonitorConfig
  /** Human-readable summary of each change applied. Empty when nothing matched. */
  changed: string[]
  understood: boolean
}

export function parseExpiryTuning(text: string, current: ExpiryMonitorConfig): ExpiryTuningResult {
  const t = text.trim().toLowerCase()
  const next: ExpiryMonitorConfig = { ...current }
  const changed: string[] = []

  if (/\b(disable|turn off|switch off|pause|stop)\b/.test(t)) {
    if (next.enabled) { next.enabled = false; changed.push('disabled the monitor') }
  } else if (/\b(enable|turn on|switch on|resume|re-?enable)\b/.test(t)) {
    if (!next.enabled) { next.enabled = true; changed.push('enabled the monitor') }
  }

  const days = /(\d{1,3})\s*(?:days?|d)\b/.exec(t)
  if (days) {
    const n = clamp(Math.round(parseInt(days[1], 10)), 0, 365)
    if (n !== next.threshold_days) { next.threshold_days = n; changed.push(`threshold → ${String(n)} days`) }
  }

  // min cost — only when the sentence is clearly about value/€, not the day count
  if (/(cost|risk|€|eur|euro|value|worth)/.test(t)) {
    const cost = /(?:under|below|at least|min(?:imum)?|over|above|€|eur)\D{0,8}(\d+)/.exec(t)
    if (cost) {
      const n = Math.max(0, parseInt(cost[1], 10))
      if (n !== next.min_cost_at_risk) { next.min_cost_at_risk = n; changed.push(`min value → €${String(n)}`) }
    }
  }

  if (/\b(auto[- ]?propose|automatically (?:propose|write[- ]?off|create)|propose write[- ]?offs?)\b/.test(t)) {
    const off = /\b(don'?t|do not|stop|disable|never|no longer)\b/.test(t)
    const on = !off
    if (next.auto_propose !== on) { next.auto_propose = on; changed.push(on ? 'auto-propose write-offs on' : 'auto-propose write-offs off') }
  }

  return { rule: next, changed, understood: changed.length > 0 }
}

// ── Stockout band ───────────────────────────────────────────────────────────
// The proposal path (restock_advisor) is untouched. This only governs *when a
// variant surfaces* as a stockout signal — the band that used to be a hardcoded
// 14/7/3-day ladder in the UI.

export interface StockoutReading {
  variantId: string
  variantLabel: string
  daysUntilZero: number | null
  currentStock: number
  avgDaily: number
}

export interface StockoutHit extends StockoutReading {
  daysUntilZero: number
  urgency: number
}

export function stockoutUrgency(daysUntilZero: number, thresholdDays: number): number {
  if (daysUntilZero <= 0 || thresholdDays <= 0) return 10
  return clamp(Math.round((1 - daysUntilZero / thresholdDays) * 10) + 1, 1, 10)
}

export function selectStockoutTriggers(
  readings: ReadonlyArray<StockoutReading>,
  rule: StockoutMonitorConfig,
): StockoutHit[] {
  if (!rule.enabled) return []
  const hits: StockoutHit[] = []
  for (const r of readings) {
    if (r.daysUntilZero == null || r.daysUntilZero > rule.threshold_days) continue
    hits.push({ ...r, daysUntilZero: r.daysUntilZero, urgency: stockoutUrgency(r.daysUntilZero, rule.threshold_days) })
  }
  return hits.sort((a, b) => b.urgency - a.urgency)
}

// ── Waste anomaly band ──────────────────────────────────────────────────────

export interface WasteReading {
  variantId: string
  variantLabel: string
  anomalyScore: number
  pctAboveBaseline: number
  qty7d: number
}

export interface WasteHit extends WasteReading {
  urgency: number
}

export function selectWasteTriggers(
  readings: ReadonlyArray<WasteReading>,
  rule: WasteMonitorConfig,
): WasteHit[] {
  if (!rule.enabled) return []
  const hits: WasteHit[] = []
  for (const r of readings) {
    if (r.anomalyScore < rule.min_anomaly_score) continue
    hits.push({ ...r, urgency: clamp(Math.round(r.anomalyScore), 1, 10) })
  }
  return hits.sort((a, b) => b.urgency - a.urgency)
}

// ── Supplier-risk band ──────────────────────────────────────────────────────

export interface SupplierReading {
  supplierId: string | null
  supplierName: string
  reliabilityScore: number
  onTimePct: number
  avgDelayDays: number
  riskTier: string
}

export interface SupplierHit extends SupplierReading {
  urgency: number
}

export function supplierUrgency(reliabilityScore: number): number {
  return clamp(Math.round(10 - reliabilityScore), 1, 10)
}

export function selectSupplierTriggers(
  readings: ReadonlyArray<SupplierReading>,
  rule: SupplierMonitorConfig,
): SupplierHit[] {
  if (!rule.enabled) return []
  const hits: SupplierHit[] = []
  for (const r of readings) {
    if (r.reliabilityScore > rule.max_reliability_score) continue
    hits.push({ ...r, urgency: supplierUrgency(r.reliabilityScore) })
  }
  return hits.sort((a, b) => b.urgency - a.urgency)
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
