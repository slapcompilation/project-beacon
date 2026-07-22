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
  IntegrationHealthConfig, BottleneckMonitorConfig, BudgetMonitorConfig, CporMonitorConfig,
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

// ── Data-integration health band ────────────────────────────────────────────
// Foundry-style connector + pipeline freshness, made tunable. The METRIC is the
// age of each source's last activity (and, for the document pipeline, how long
// its oldest un-processed item has waited); the TRIGGER is the operator's SLA in
// org policy. This replaces the hardcoded 2h/24h buried inside get_pms_health /
// get_pos_health, and extends coverage to the document-ingestion pipeline, which
// had none.

export type IntegrationHealthStatus = 'fresh' | 'stale' | 'down' | 'never'
export type IntegrationSourceKind = 'pms' | 'pos' | 'documents'

export interface IntegrationSourceReading {
  /** Stable id, e.g. 'pms:mews', 'pos:square', 'documents'. */
  sourceKey: string
  label: string
  kind: IntegrationSourceKind
  /** ISO ts of the last data this source fed us; null = never fed. Live feeds
   *  (PMS/POS) are judged on this. */
  lastActivityAt: string | null
  totalEvents: number
  /** documents: items still waiting for the pipeline's first step. */
  pendingCount?: number
  /** documents: ISO ts of the oldest still-waiting item — the stall signal. */
  oldestPendingAt?: string | null
}

export interface IntegrationHealthHit extends IntegrationSourceReading {
  status: IntegrationHealthStatus
  /** Minutes since the signal the status is based on; null when never fed. */
  staleMinutes: number | null
  /** 0–10. down = 10, never = 8, stale scales toward the down edge, fresh = 0. */
  urgency: number
  detail: string
}

/** The metric applied to the tunable trigger for one source. Live feeds go by
 *  last-activity age; the document pipeline goes by how long its oldest item has
 *  waited (uploads are sporadic, so idle-age would false-fire — a backlog that
 *  isn't draining is the real signal). */
export function classifyIntegrationHealth(
  reading: IntegrationSourceReading,
  rule: IntegrationHealthConfig,
  now: number = Date.now(),
): IntegrationHealthHit {
  if (reading.kind === 'documents') {
    const pending = reading.pendingCount ?? 0
    const waited = minutesSince(reading.oldestPendingAt ?? null, now)
    if (pending === 0 || waited == null) {
      return healthHit(reading, 'fresh', waited, 0, pending === 0 ? 'No backlog' : `${String(pending)} in flight`)
    }
    if (waited >= rule.stuck_ingest_after_minutes * 2) {
      return healthHit(reading, 'down', waited, 10, `${String(pending)} awaiting processing, oldest ${humanAge(waited)}`)
    }
    if (waited >= rule.stuck_ingest_after_minutes) {
      const u = staleUrgency(waited, rule.stuck_ingest_after_minutes, rule.stuck_ingest_after_minutes * 2)
      return healthHit(reading, 'stale', waited, u, `${String(pending)} awaiting processing, oldest ${humanAge(waited)}`)
    }
    return healthHit(reading, 'fresh', waited, 0, `${String(pending)} in flight`)
  }

  const age = minutesSince(reading.lastActivityAt, now)
  if (age == null)                        return healthHit(reading, 'never', null, 8, 'No data received yet')
  if (age >= rule.down_after_minutes)     return healthHit(reading, 'down', age, 10, `No data for ${humanAge(age)}`)
  if (age >= rule.warn_after_minutes) {
    const u = staleUrgency(age, rule.warn_after_minutes, rule.down_after_minutes)
    return healthHit(reading, 'stale', age, u, `Last data ${humanAge(age)} ago`)
  }
  return healthHit(reading, 'fresh', age, 0, `Last data ${humanAge(age)} ago`)
}

/** The trigger: the sources whose health has slipped, worst first. Disabled rule
 *  → nothing. Fresh sources are dropped — this is the "what fires" list; the UI
 *  maps classifyIntegrationHealth over every source for the full readout. */
export function selectIntegrationHealthAlerts(
  readings: ReadonlyArray<IntegrationSourceReading>,
  rule: IntegrationHealthConfig,
  now: number = Date.now(),
): IntegrationHealthHit[] {
  if (!rule.enabled) return []
  return readings
    .map((r) => classifyIntegrationHealth(r, rule, now))
    .filter((h) => h.status !== 'fresh')
    .sort((a, b) => b.urgency - a.urgency)
}

function healthHit(
  reading: IntegrationSourceReading,
  status: IntegrationHealthStatus,
  staleMinutes: number | null,
  urgency: number,
  detail: string,
): IntegrationHealthHit {
  return { ...reading, status, staleMinutes, urgency, detail }
}

// ── Process-bottleneck band (P11, Machinery parity) ──────────────────────────
// The METRIC (entered vs exited counts per state, from the lifecycle transition
// log) is deterministic; the TRIGGER is the operator's rule in org policy. A
// non-terminal state fires when far more objects entered than exited — the
// "266 entered, 16 exited" signal — with a noise floor on volume. isTerminal
// rides in on the reading so this stays free of lifecycle knowledge.

export interface BottleneckReading {
  nodeType:     string
  state:        string
  isTerminal:   boolean
  enteredCount: number
  exitedCount:  number
  currentCount: number
}

export interface BottleneckHit extends BottleneckReading {
  /** exited / entered, 0..1 — how freely objects leave the state. */
  exitRatio: number
  urgency:   number
}

/** 0 exit ratio → 10, at the tunable edge → 1, linear between. Retune the rule
 *  and the bands move with it. */
export function bottleneckUrgency(exitRatio: number, maxExitRatio: number): number {
  if (maxExitRatio <= 0) return 10
  return clamp(Math.round((1 - exitRatio / maxExitRatio) * 9) + 1, 1, 10)
}

export function selectBottleneckTriggers(
  readings: ReadonlyArray<BottleneckReading>,
  rule: BottleneckMonitorConfig,
): BottleneckHit[] {
  if (!rule.enabled) return []
  const hits: BottleneckHit[] = []
  for (const r of readings) {
    if (r.isTerminal || r.enteredCount < rule.min_entered) continue
    const exitRatio = r.enteredCount > 0 ? r.exitedCount / r.enteredCount : 1
    if (exitRatio >= rule.max_exit_ratio) continue
    hits.push({ ...r, exitRatio, urgency: bottleneckUrgency(exitRatio, rule.max_exit_ratio) })
  }
  return hits.sort((a, b) => b.urgency - a.urgency || b.currentCount - a.currentCount)
}

// ── Finance monitors (P2) — the Finance surfaces, as briefing signals ─────────
// The metric (spend vs budget; CPOR period-on-period) is deterministic; the
// trigger is the operator's rule in org policy. Fires a Home-briefing signal
// rather than living as a dashboard tab nobody visits.

export interface BudgetReading {
  categoryId:   string | null
  categoryName: string
  /** actual / allocated × 100; null = unbudgeted (nothing to breach). */
  spendPct:     number | null
  actual:       number
}

export interface BudgetHit {
  categoryId:   string | null
  categoryName: string
  spendPct:     number
  /** How far over the allocation, in points (spendPct − 100); negative if under. */
  overPct:      number
  actual:       number
  urgency:      number
}

export function selectBudgetTriggers(
  readings: ReadonlyArray<BudgetReading>,
  rule: BudgetMonitorConfig,
): BudgetHit[] {
  if (!rule.enabled) return []
  const hits: BudgetHit[] = []
  for (const r of readings) {
    if (r.spendPct == null || r.actual < rule.min_spend) continue
    if (r.spendPct < rule.over_budget_pct) continue
    hits.push({
      categoryId: r.categoryId, categoryName: r.categoryName, spendPct: r.spendPct,
      overPct: r.spendPct - 100, actual: r.actual,
      urgency: clamp(Math.round((r.spendPct - rule.over_budget_pct) / 5) + 1, 1, 10),
    })
  }
  return hits.sort((a, b) => b.urgency - a.urgency || b.overPct - a.overPct)
}

export interface CporReading {
  periodLabel: string
  cpor:        number | null
  /** period-on-period change %; positive = cost rose (unfavourable). */
  changePct:   number | null
}

export interface CporHit {
  periodLabel: string
  cpor:        number
  changePct:   number
  urgency:     number
}

/** CPOR is a single latest-period signal, so this returns one hit or null. */
export function selectCporTrigger(reading: CporReading | null, rule: CporMonitorConfig): CporHit | null {
  if (!rule.enabled || !reading || reading.cpor == null || reading.changePct == null) return null
  if (reading.changePct < rule.rise_pct) return null
  return {
    periodLabel: reading.periodLabel, cpor: reading.cpor, changePct: reading.changePct,
    urgency: clamp(Math.round((reading.changePct - rule.rise_pct) / 5) + 1, 1, 10),
  }
}

function minutesSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.round((nowMs - t) / 60000))
}

/** Linear 1→9 across the [warn, down] window; capped just below a fired 'down'. */
function staleUrgency(minutes: number, warn: number, down: number): number {
  if (down <= warn) return 5
  const ratio = (minutes - warn) / (down - warn)
  return clamp(Math.round(ratio * 8) + 1, 1, 9)
}

function humanAge(minutes: number): string {
  if (minutes < 60) return `${String(minutes)}m`
  const hours = minutes / 60
  if (hours < 48) return `${String(Math.round(hours))}h`
  return `${String(Math.round(hours / 24))}d`
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}
