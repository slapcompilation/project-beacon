// Phase 4 — user-authored Logic Tools.
//
// A code Logic Tool has an `invoke` body, which is exactly what an operator
// can't be handed: arbitrary code is neither safe to run nor config-as-data. So
// an authored tool is a bounded QUESTION over the ontology — "how many / total /
// average <property> of <object type> where <conditions>" — stored as data and
// answered here.
//
// The "where <conditions>" half is an object set and lives in ../objectSets: an
// authored tool is an AGGREGATION OVER A SET, and one of several consumers of the
// same selection. The Tool* names below are aliases kept for callers written
// before the split.
//
// It honours the same output contract every code tool does (value + basis +
// confidence), so a caller can't tell whether a tool was authored or shipped.

import type {
  ObjectSetSelection, RecordGroup, SetArgs, SetDefinition, SetFilter,
  SetParamDef, SetRecord, SetSubject, SetTypeBreakdown,
} from '../objectSets/index'
import {
  bindSetArgs, describeSetFilters, selectObjectSet, subjectLabel, subjectProperties,
  validateSetDefinition,
} from '../objectSets/index'

export type { ComparisonOp } from '../objectSets/index'
export { allProperties, subjectLabel, subjectProperties, OP_LABELS } from '../objectSets/index'

export type ToolSubject = SetSubject
export type ToolFilter = SetFilter
export type ToolParamDef = SetParamDef
export type ToolArgs = SetArgs
export type ToolRecord = SetRecord
export type ToolRecordGroup = RecordGroup

export const bindToolArgs = bindSetArgs

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

export interface UserToolDef extends SetDefinition {
  id: string
  organizationId: string
  hotelId: string | null
  /** Human name; apiName is the stable identifier a caller (or an LLM) uses. */
  name: string
  apiName: string
  description: string
  aggregation: { fn: AggregationFn; property?: string }
  enabled: boolean
}

export interface ToolTypeBreakdown extends SetTypeBreakdown {
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

// ── Validation ───────────────────────────────────────────────────────────────

/** Checks a draft against its subject. Returns [] when the tool is answerable;
 *  every message names what to fix. The selection half is the set's own rules. */
export function validateUserTool(
  draft: Pick<UserToolDef, 'name' | 'apiName' | 'subjectTypeId' | 'subjectInterfaceId' | 'parameters' | 'filters' | 'aggregation'>,
  subject: SetSubject | undefined,
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
  errors.push(...validateSetDefinition(draft, subject))
  if (!subject) return errors

  const label = subjectLabel(subject)
  const byKey = new Map(subjectProperties(subject).map((p) => [p.key, p]))

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

// ── Evaluation ───────────────────────────────────────────────────────────────

/** Answers the tool against a record set. Pure: the caller fetches, this
 *  aggregates over the set's members. */
export function evaluateUserTool(
  def: Pick<UserToolDef, 'filters' | 'aggregation'>,
  records: ReadonlyArray<SetRecord>,
  type?: RecordGroup['type'],
): UserToolResult {
  return evaluateUserToolAcross(def, [{ type, records }])
}

/** Answers the tool across every contributing type. The set pools its members
 *  before aggregation, so `avg` over an interface is the real mean of all
 *  matching records — not the mean of each type's mean, which would weight a
 *  type with three records like one with three hundred. */
export function evaluateUserToolAcross(
  def: Pick<UserToolDef, 'filters' | 'aggregation'>,
  groups: ReadonlyArray<RecordGroup>,
): UserToolResult {
  // One selection per group, then pool — the per-type breakdown needs each
  // group's own members, and the pooled figure is their concatenation.
  const per = groups.map((g) => selectObjectSet(def, [g]))
  const pooled: ObjectSetSelection = {
    records: per.flatMap((s) => s.records),
    scanned: per.reduce((n, s) => n + s.scanned, 0),
    byType:  per.flatMap((s) => s.byType),
  }
  const total = aggregate(def.aggregation, pooled.records, pooled.scanned)

  return {
    ...total,
    basis: describeBasis(def, pooled.records.length, pooled.scanned, groups.length),
    matched: pooled.records.length,
    scanned: pooled.scanned,
    byType: per.map((s) => ({
      ...s.byType[0],
      value: aggregate(def.aggregation, s.records, s.scanned).value,
    })),
  }
}

function aggregate(
  agg: UserToolDef['aggregation'],
  matched: ReadonlyArray<SetRecord>,
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

function reduce(fn: Exclude<AggregationFn, 'count'>, nums: number[]): number {
  switch (fn) {
    case 'sum': return nums.reduce((s, n) => s + n, 0)
    case 'avg': return nums.reduce((s, n) => s + n, 0) / nums.length
    case 'min': return Math.min(...nums)
    case 'max': return Math.max(...nums)
  }
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
export function describeUserTool(def: Pick<UserToolDef, 'filters' | 'aggregation'>, subject?: SetSubject): string {
  const label = subject ? subjectLabel(subject) : 'records'
  const props = subject ? new Map(subjectProperties(subject).map((p) => [p.key, p.label])) : new Map<string, string>()
  const agg = AGGREGATIONS.find((a) => a.fn === def.aggregation.fn)
  const scope = subject?.kind === 'interface' ? `every ${label}` : label
  const head = def.aggregation.fn === 'count'
    ? `Count of ${scope}`
    : `${agg?.label ?? def.aggregation.fn} ${props.get(def.aggregation.property ?? '') ?? def.aggregation.property ?? '?'} across ${scope}`
  const where = describeSetFilters(def, subject)
  return where ? `${head} where ${where}` : head
}
