// Phase 4 — user-authored Logic Tools.
//
// A code Logic Tool has an `invoke` body, which is exactly what an operator
// can't be handed: arbitrary code is neither safe to run nor config-as-data. So
// an authored tool is a bounded QUESTION over the ontology — "how many / total /
// average <property> of <object type> where <conditions>" — stored as data and
// answered by one interpreter here.
//
// It honours the same output contract every code tool does (value + basis +
// confidence), so a caller can't tell whether a tool was authored or shipped.

import type { ComparisonOp } from '../automations/index'
import type { InterfaceDef } from '../interfaces/index'
import { interfaceProperties } from '../interfaces/index'
import type { ObjectTypeDef, PropertyDef } from '../objectTypes/index'
import { evaluateComputed } from '../objectTypes/index'

export type { ComparisonOp }

/** What a tool asks about. A `type` subject runs over one type's records; an
 *  `interface` subject runs over EVERY type implementing it — including types
 *  authored after the tool was written, which is the whole point of interfaces. */
export type ToolSubject =
  | { kind: 'type'; type: ObjectTypeDef }
  | { kind: 'interface'; iface: InterfaceDef }

/** Properties a tool may reference. For an interface that is the interface's own
 *  properties ONLY — filtering on something one implementer happens to have is
 *  exactly what breaks the tool on the next implementer. */
export function subjectProperties(s: ToolSubject): PropertyDef[] {
  return s.kind === 'type' ? allProperties(s.type) : interfaceProperties(s.iface)
}

export function subjectLabel(s: ToolSubject): string {
  return s.kind === 'type' ? s.type.label : s.iface.label
}

/** Aggregations an authored tool may perform. `count` needs no property; the
 *  rest reduce a numeric one. */
export type AggregationFn = 'count' | 'sum' | 'avg' | 'min' | 'max'

export interface AggregationDef {
  fn: AggregationFn
  label: string
  /** false for `count`, which counts matching records rather than a column. */
  needsProperty: boolean
  help: string
}

export const AGGREGATIONS: AggregationDef[] = [
  { fn: 'count', label: 'Count of records',  needsProperty: false, help: 'How many records match' },
  { fn: 'sum',   label: 'Sum of',            needsProperty: true,  help: 'Total across matching records' },
  { fn: 'avg',   label: 'Average of',        needsProperty: true,  help: 'Mean across matching records' },
  { fn: 'min',   label: 'Minimum of',        needsProperty: true,  help: 'Smallest value among matches' },
  { fn: 'max',   label: 'Maximum of',        needsProperty: true,  help: 'Largest value among matches' },
]

/** One filter. Numeric properties compare with the shared ComparisonOp
 *  vocabulary; text and boolean compare for equality only — there is no
 *  meaningful "less than" on a label. */
export interface ToolFilter {
  property: string
  op: ComparisonOp | 'eq' | 'neq'
  /** Typed against the property: number for number/date-age, string for text,
   *  boolean for boolean. */
  value: number | string | boolean
}

export interface UserToolDef {
  id: string
  organizationId: string
  hotelId: string | null
  /** Human name; apiName is the stable identifier a caller (or an LLM) uses. */
  name: string
  apiName: string
  description: string
  /** Exactly one of these is set — one object type, or one interface. */
  subjectTypeId: string | null
  subjectInterfaceId: string | null
  filters: ToolFilter[]
  aggregation: { fn: AggregationFn; property?: string }
  enabled: boolean
}

export interface ToolTypeBreakdown {
  typeId: string
  label: string
  matched: number
  scanned: number
  value: number
}

export interface UserToolResult {
  value: number
  /** How the number was reached — the same audit affordance code tools carry. */
  basis: string
  /** 0..1. An aggregation over zero matching records is honestly unconfident. */
  confidence: number
  matched: number
  scanned: number
  /** Where the answer came from: one entry per contributing type. An interface
   *  tool's aggregate is otherwise unexplainable. */
  byType: ToolTypeBreakdown[]
}

/** A record as stored: property key → value, plus computed properties resolved
 *  by the caller (evaluateComputed) so filters can read them too. */
export type ToolRecord = Record<string, unknown>

// ── Validation ───────────────────────────────────────────────────────────────

/** Checks a draft against its subject. Returns [] when the tool is answerable;
 *  every message names what to fix. */
export function validateUserTool(
  draft: Pick<UserToolDef, 'name' | 'apiName' | 'subjectTypeId' | 'subjectInterfaceId' | 'filters' | 'aggregation'>,
  subject: ToolSubject | undefined,
  /** Shipped tool names. An authored tool that took one would be silently
   *  ignored in an agent's registry, where the shipped tool wins. */
  reserved: ReadonlyArray<string> = [],
): string[] {
  const errors: string[] = []
  if (!draft.name.trim())    errors.push('Name is required')
  if (!draft.apiName.trim()) errors.push('API name is required')
  if (reserved.includes(draft.apiName)) {
    errors.push(`"${draft.apiName}" is a shipped tool — pick another name`)
  }
  if (draft.subjectTypeId && draft.subjectInterfaceId) {
    errors.push('A tool asks about one object type or one interface, not both')
  }
  if (!subject) {
    errors.push('Pick an object type or interface for the tool to ask about')
    return errors
  }

  const label = subjectLabel(subject)
  const props = subjectProperties(subject)
  const byKey = new Map(props.map((p) => [p.key, p]))

  for (const f of draft.filters) {
    const p = byKey.get(f.property)
    if (!p) {
      // On an interface this is the load-bearing rule, not a typo check: a
      // property outside the interface would break on the next implementer.
      errors.push(subject.kind === 'interface'
        ? `"${f.property}" is not on the ${label} interface — a tool across types can only use the shape they all share`
        : `Filter property "${f.property}" is not on ${label}`)
      continue
    }
    if (p.type === 'number' && typeof f.value !== 'number') {
      errors.push(`Filter on "${p.label}" needs a number`)
    }
    if (p.type === 'boolean' && typeof f.value !== 'boolean') {
      errors.push(`Filter on "${p.label}" needs true or false`)
    }
    if ((p.type === 'text' || p.type === 'boolean') && f.op !== 'eq' && f.op !== 'neq') {
      errors.push(`"${p.label}" can only be compared with is / is not`)
    }
  }

  const agg = AGGREGATIONS.find((a) => a.fn === draft.aggregation.fn)
  if (!agg) {
    errors.push('Pick an aggregation')
  } else if (agg.needsProperty) {
    const key = draft.aggregation.property
    if (!key) {
      errors.push(`${agg.label} needs a numeric property`)
    } else {
      const p = byKey.get(key)
      if (!p) errors.push(`Aggregated property "${key}" is not on ${label}`)
      else if (p.type !== 'number') errors.push(`${agg.label} needs a number property — "${p.label}" is ${p.type}`)
    }
  }
  return errors
}

/** Schema properties plus computed ones — a tool can filter or aggregate on a
 *  computed value exactly like a stored one. */
export function allProperties(type: ObjectTypeDef): PropertyDef[] {
  const computed: PropertyDef[] = type.computedProperties.map((c) => ({
    key: c.key, label: c.label, type: 'number', required: false,
  }))
  return [...type.properties, ...computed]
}

// ── Evaluation ───────────────────────────────────────────────────────────────

/** Records from one type. An interface tool gets one group per implementer. */
export interface ToolRecordGroup {
  /** Undefined only when the type row couldn't be read — computed properties
   *  then don't resolve. */
  type?: ObjectTypeDef
  records: ReadonlyArray<ToolRecord>
}

/** Answers the tool against a record set. Pure: the caller fetches, this
 *  computes — same split as every other tool in the registry. */
export function evaluateUserTool(
  def: Pick<UserToolDef, 'filters' | 'aggregation'>,
  records: ReadonlyArray<ToolRecord>,
  type?: ObjectTypeDef,
): UserToolResult {
  return evaluateUserToolAcross(def, [{ type, records }])
}

/** Answers the tool across every contributing type. Records are POOLED before
 *  aggregating, so `avg` over an interface is the real mean of all matching
 *  records — not the mean of each type's mean, which would weight a type with
 *  three records like one with three hundred. */
export function evaluateUserToolAcross(
  def: Pick<UserToolDef, 'filters' | 'aggregation'>,
  groups: ReadonlyArray<ToolRecordGroup>,
): UserToolResult {
  const per = groups.map((g) => {
    // Resolve computed properties first so filters and aggregation see them.
    const resolved = g.type ? g.records.map((r) => ({ ...r, ...computedValues(g.type as ObjectTypeDef, r) })) : g.records.slice()
    const matched = resolved.filter((r) => def.filters.every((f) => passes(r[f.property], f)))
    return { type: g.type, scanned: resolved.length, matched }
  })

  const pooled  = per.flatMap((g) => g.matched)
  const scanned = per.reduce((s, g) => s + g.scanned, 0)
  const total   = aggregate(def.aggregation, pooled, scanned)

  return {
    ...total,
    basis: describeBasis(def, pooled.length, scanned, per.length),
    matched: pooled.length,
    scanned,
    byType: per.map((g) => ({
      typeId: g.type?.id ?? '',
      label:  g.type?.label ?? 'records',
      matched: g.matched.length,
      scanned: g.scanned,
      value: aggregate(def.aggregation, g.matched, g.scanned).value,
    })),
  }
}

function aggregate(
  agg: UserToolDef['aggregation'],
  matched: ReadonlyArray<ToolRecord>,
  scanned: number,
): { value: number; confidence: number } {
  if (agg.fn === 'count') {
    // Counting is exact when there's anything to count.
    return { value: matched.length, confidence: scanned === 0 ? 0 : 1 }
  }
  const key = agg.property ?? ''
  const nums = matched.map((r) => Number(r[key])).filter((n) => Number.isFinite(n))
  return {
    value: nums.length === 0 ? 0 : reduce(agg.fn, nums),
    // No matching records, or none with a usable number, is a real answer of
    // "unknown" — say so rather than reporting a confident zero.
    confidence: nums.length === 0 ? 0 : Math.min(1, nums.length / Math.max(1, matched.length)),
  }
}

/** Computed properties as a flat patch, so filters and aggregation read them
 *  like stored ones. A computed value that can't resolve is simply absent. */
function computedValues(type: ObjectTypeDef, data: ToolRecord): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of type.computedProperties) {
    const v = evaluateComputed(c, data)
    if (v !== null) out[c.key] = v
  }
  return out
}

function reduce(fn: Exclude<AggregationFn, 'count'>, nums: number[]): number {
  switch (fn) {
    case 'sum': return nums.reduce((s, n) => s + n, 0)
    case 'avg': return nums.reduce((s, n) => s + n, 0) / nums.length
    case 'min': return Math.min(...nums)
    case 'max': return Math.max(...nums)
  }
}

function passes(actual: unknown, f: ToolFilter): boolean {
  if (f.op === 'eq')  return normalize(actual) === normalize(f.value)
  if (f.op === 'neq') return normalize(actual) !== normalize(f.value)
  const a = Number(actual)
  const b = Number(f.value)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  switch (f.op) {
    case 'lt':  return a <  b
    case 'lte': return a <= b
    case 'gt':  return a >  b
    case 'gte': return a >= b
  }
}

/** Text compares case-insensitively; everything else by value. Keeps
 *  "Urgent" and "urgent" from being different answers. */
function normalize(v: unknown): unknown {
  return typeof v === 'string' ? v.trim().toLowerCase() : v
}

function describeBasis(
  def: Pick<UserToolDef, 'filters' | 'aggregation'>,
  matched: number, scanned: number, types: number,
): string {
  const what = def.aggregation.fn === 'count'
    ? 'count'
    : `${def.aggregation.fn}(${def.aggregation.property ?? '?'})`
  const where = def.filters.length === 0 ? 'all records' : `${String(def.filters.length)} filter(s)`
  const span = types === 1 ? '' : ` across ${String(types)} types`
  return `${what} over ${String(matched)}/${String(scanned)} records matching ${where}${span}`
}

/** One-line English for the composer + the tool list, so an authored tool reads
 *  like a question rather than a config blob. */
export function describeUserTool(def: Pick<UserToolDef, 'filters' | 'aggregation'>, subject: ToolSubject | undefined): string {
  const label = subject ? subjectLabel(subject) : 'records'
  const props = subject ? new Map(subjectProperties(subject).map((p) => [p.key, p.label])) : new Map<string, string>()
  const agg = AGGREGATIONS.find((a) => a.fn === def.aggregation.fn)
  const scope = subject?.kind === 'interface' ? `every ${label}` : label
  const head = def.aggregation.fn === 'count'
    ? `Count of ${scope}`
    : `${agg?.label ?? def.aggregation.fn} ${props.get(def.aggregation.property ?? '') ?? def.aggregation.property ?? '?'} across ${scope}`
  if (def.filters.length === 0) return head
  const parts = def.filters.map((f) => `${props.get(f.property) ?? f.property} ${OP_LABELS[f.op]} ${String(f.value)}`)
  return `${head} where ${parts.join(' and ')}`
}

export const OP_LABELS: Record<ToolFilter['op'], string> = {
  lt: 'is below', lte: 'is at or below', gt: 'is above', gte: 'is at or above',
  eq: 'is', neq: 'is not',
}
