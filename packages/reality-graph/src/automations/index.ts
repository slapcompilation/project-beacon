// Reality Graph — user-authored automations (Studio, P1). A monitor you can
// CREATE as data instead of code: "when a bounded ontology condition holds,
// propose a typed action, routed through the same gate." No deploy.
//
// The grammar is deliberately bounded (pick-from-registry), so an authored rule
// stays typed and auditable — the same discipline that makes Constraints typed
// buckets rather than free predicates. Firing goes through decideAutoExecution
// like every other proposal; authoring never adds a second execution path.

import type { BeaconAction } from '../actions/types'
import type { AgentProposal } from '../agents/index'

export type AutomationSubject = 'variant'
export type ComparisonOp = 'lt' | 'lte' | 'gt' | 'gte'
export type AutomationGate = 'review' | 'auto'
export type AutomationStage = 'sandbox' | 'staging' | 'production'
export type AutomationEffect = Extract<BeaconAction['type'], 'REQUEST_RESTOCK' | 'TRANSFER_STOCK' | 'WRITE_OFF'>

export interface AutomationCondition {
  subject: AutomationSubject
  metric: string
  op: ComparisonOp
  value: number
}

export interface Automation {
  id: string
  name: string
  organizationId: string
  hotelId: string | null
  when: AutomationCondition
  effect: AutomationEffect
  gate: AutomationGate
  /** Author-set 0–1; feeds decideAutoExecution exactly like an agent proposal's. */
  confidence: number
  enabled: boolean
  stage: AutomationStage
  version: number
}

// ── The bounded grammar ──────────────────────────────────────────────────────

export interface MetricDef { key: string; label: string; unit: 'units' | '%'; help: string }

// Variant metrics computable straight from product_variants columns, so the
// composer's live preview is honest without a heavier readings pipeline.
export const AUTOMATION_METRICS: Record<AutomationSubject, MetricDef[]> = {
  variant: [
    { key: 'current_stock',    label: 'Current stock',   unit: 'units', help: 'Units on hand right now.' },
    { key: 'par_level',        label: 'PAR level',       unit: 'units', help: 'The level this item should be kept at.' },
    { key: 'units_below_par',  label: 'Units below PAR', unit: 'units', help: 'How far under PAR (0 when at or above).' },
    { key: 'stock_vs_par_pct', label: 'Stock vs PAR',    unit: '%',     help: 'Current stock as a percentage of its PAR level.' },
  ],
}

export interface EffectDef { effect: AutomationEffect; label: string; help: string; subjects: AutomationSubject[] }

export const AUTOMATION_EFFECTS: EffectDef[] = [
  { effect: 'REQUEST_RESTOCK', label: 'Request a restock',               help: 'Propose a restock request to close the gap.',   subjects: ['variant'] },
  { effect: 'TRANSFER_STOCK',  label: 'Transfer from a sister property',  help: 'Propose a lateral transfer before buying.',     subjects: ['variant'] },
  { effect: 'WRITE_OFF',       label: 'Write off',                        help: 'Propose writing the stock off.',                subjects: ['variant'] },
]

export const COMPARISON_LABELS: Record<ComparisonOp, string> = {
  lt: 'is below', lte: 'is at or below', gt: 'is above', gte: 'is at or above',
}
const COMPARISON_SYMBOL: Record<ComparisonOp, string> = { lt: '<', lte: '≤', gt: '>', gte: '≥' }

// ── Evaluation ───────────────────────────────────────────────────────────────

export interface AutomationReading {
  subject: AutomationSubject
  subjectId: string
  subjectName: string
  metrics: Record<string, number>
  /** Needed to build a firing proposal (e.g. REQUEST_RESTOCK.hotelId). Optional:
   *  the composer's preview doesn't need it, only the cycle does. */
  hotelId?: string
}

export interface AutomationHit {
  automationId: string
  automationName: string
  subjectId: string
  subjectName: string
  effect: AutomationEffect
  gate: AutomationGate
  confidence: number
  reason: string
}

function compare(a: number, op: ComparisonOp, b: number): boolean {
  if (op === 'lt') return a < b
  if (op === 'lte') return a <= b
  if (op === 'gt') return a > b
  return a >= b // gte
}

/** Pure: the subjects an enabled automation fires on, given current readings. */
export function evaluateAutomation(automation: Automation, readings: AutomationReading[]): AutomationHit[] {
  if (!automation.enabled) return []
  const label = AUTOMATION_METRICS[automation.when.subject].find((m) => m.key === automation.when.metric)?.label ?? automation.when.metric
  const hits: AutomationHit[] = []
  for (const r of readings) {
    if (r.subject !== automation.when.subject) continue
    const actual = r.metrics[automation.when.metric]
    if (actual === undefined) continue
    if (compare(actual, automation.when.op, automation.when.value)) {
      hits.push({
        automationId: automation.id,
        automationName: automation.name,
        subjectId: r.subjectId,
        subjectName: r.subjectName,
        effect: automation.effect,
        gate: automation.gate,
        confidence: automation.confidence,
        reason: `${label} ${COMPARISON_SYMBOL[automation.when.op]} ${String(automation.when.value)} (actual ${String(actual)})`,
      })
    }
  }
  return hits
}

export function evaluateAutomations(automations: Automation[], readings: AutomationReading[]): AutomationHit[] {
  return automations.flatMap((a) => evaluateAutomation(a, readings))
}

// ── Firing: turn hits into proposals the cycle routes through the gate ────────

export interface AutomationProposal {
  automationId: string
  subjectId: string
  proposal: AgentProposal
}

/** Build the typed action a hit proposes, or null when it needs context a pure
 *  function can't supply (transfer source, a write-off quantity model). Those
 *  effects are authorable + previewable now; firing them is a later slice. */
/** The identity a fired automation acts on behalf of — the cycle runner (an
 *  operator's id, or the service identity on the cron path). */
export interface AutomationContext { requestorId: string }

function hitToAction(hit: AutomationHit, r: AutomationReading, ctx: AutomationContext): BeaconAction | null {
  if (hit.effect === 'REQUEST_RESTOCK') {
    if (!r.hotelId) return null
    const gap = Math.ceil((r.metrics.par_level ?? 0) - (r.metrics.current_stock ?? 0))
    return {
      type: 'REQUEST_RESTOCK',
      variantId: r.subjectId,
      quantityNeeded: Math.max(1, gap),
      urgency: hit.confidence >= 0.85 ? 'high' : hit.confidence >= 0.6 ? 'medium' : 'low',
      hotelId: r.hotelId,
      requestorId: ctx.requestorId,
      notes: `Automation: ${hit.automationName}`,
    }
  }
  return null
}

/** Production automations → proposals, keyed to the subject they fired on. The
 *  cycle feeds these into the same persist → decideAutoExecution → dispatch path
 *  as agent proposals, so there is exactly one gate. */
export function automationsToProposals(
  automations: Automation[],
  readings: AutomationReading[],
  ctx: AutomationContext,
): AutomationProposal[] {
  const byId = new Map(readings.map((r) => [r.subjectId, r]))
  const out: AutomationProposal[] = []
  for (const hit of evaluateAutomations(automations, readings)) {
    const r = byId.get(hit.subjectId)
    if (!r) continue
    const action = hitToAction(hit, r, ctx)
    if (!action) continue
    out.push({
      automationId: hit.automationId,
      subjectId: hit.subjectId,
      proposal: {
        action,
        confidence: hit.confidence,
        reasoning: `Automation "${hit.automationName}": ${hit.reason}.`,
        provenance: [{ kind: 'tool', ref: `automation:${hit.automationId}`, detail: hit.automationName }],
      },
    })
  }
  return out
}

// ── Authoring helpers ────────────────────────────────────────────────────────

export type AutomationDraft = Pick<Automation, 'name' | 'when' | 'effect' | 'gate' | 'confidence'>

export interface AutomationValidation { ok: boolean; errors: string[] }

export function validateAutomation(draft: AutomationDraft): AutomationValidation {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Name is required.')
  const metrics = AUTOMATION_METRICS[draft.when.subject] as MetricDef[] | undefined
  if (!metrics) errors.push(`Unknown subject "${draft.when.subject}".`)
  else if (!metrics.some((m) => m.key === draft.when.metric)) errors.push(`Metric "${draft.when.metric}" is not valid for ${draft.when.subject}.`)
  if (!Number.isFinite(draft.when.value)) errors.push('Condition value must be a number.')
  const effectDef = AUTOMATION_EFFECTS.find((e) => e.effect === draft.effect)
  if (!effectDef) errors.push(`Unknown effect "${draft.effect}".`)
  else if (!effectDef.subjects.includes(draft.when.subject)) errors.push(`"${effectDef.label}" doesn't apply to a ${draft.when.subject}.`)
  if (draft.confidence < 0 || draft.confidence > 1) errors.push('Confidence must be between 0 and 1.')
  if (draft.gate === 'auto' && draft.confidence < 0.6) errors.push('Auto-execute needs confidence ≥ 0.6 — below that the gate always queues it.')
  return { ok: errors.length === 0, errors }
}

/** The plain-language sentence the composer renders as you build the rule. */
export function describeAutomation(a: Pick<Automation, 'when' | 'effect' | 'gate'>): string {
  const m = AUTOMATION_METRICS[a.when.subject].find((x) => x.key === a.when.metric)
  const effect = AUTOMATION_EFFECTS.find((e) => e.effect === a.effect)
  const pct = m?.unit === '%' ? '%' : ''
  const tail = a.gate === 'auto' ? 'auto-execute it when confident, otherwise queue for review' : 'queue it for review'
  return `When a ${a.when.subject}'s ${m?.label ?? a.when.metric} ${COMPARISON_LABELS[a.when.op]} ${String(a.when.value)}${pct}, propose to ${(effect?.label ?? a.effect).toLowerCase()} — then ${tail}.`
}
