// Tier 1 — the object set. A named, reusable answer to "which records".
//
// This concept was already here twice, welded to a different consumer each time:
// an authored tool was a set fused to an aggregation, and an automation is a set
// fused to an effect (and only over variants). Neither could be named on its own,
// which is exactly why we have no cohorts — you cannot say "these records" without
// also saying what to do with them.
//
// Foundry's object set is the noun that functions, actions and aggregations all
// take. Same here: selection lives in this file, and every consumer is something
// applied to what it returns.
//
// Pure: the caller fetches records, this decides which ones are in.

/** Ordering comparisons. Lived in automations, which was ours; an object set
 *  filter needs them regardless of who evaluates it. Equality is added at the
 *  filter's own op type. */
export type ComparisonOp = 'lt' | 'lte' | 'gt' | 'gte'
import type { InterfaceDef } from '../interfaces/index'
import { interfaceProperties } from '../interfaces/index'
import type { ObjectTypeDef, PropertyDef, PropertyType } from '../objectTypes/index'
import { validateTraversals, type SetTraversal } from './traversal'
import { evaluateComputed } from '../objectTypes/index'

/** What a set is drawn from. A `type` subject runs over one type's records; an
 *  `interface` subject runs over EVERY type implementing it — including types
 *  authored after the set was written, which is the whole point of interfaces. */
export type SetSubject =
  | { kind: 'type'; type: ObjectTypeDef }
  | { kind: 'interface'; iface: InterfaceDef }

/** Properties a set may reference. For an interface that is the interface's own
 *  properties ONLY — filtering on something one implementer happens to have is
 *  exactly what breaks the set on the next implementer. */
export function subjectProperties(s: SetSubject): PropertyDef[] {
  return s.kind === 'type' ? allProperties(s.type) : interfaceProperties(s.iface)
}

export function subjectLabel(s: SetSubject): string {
  return s.kind === 'type' ? s.type.label : s.iface.label
}

/** Schema properties plus computed ones — a set can filter on a computed value
 *  exactly like a stored one. */
export function allProperties(type: ObjectTypeDef): PropertyDef[] {
  // A computed value is derived at read time, so it has no column and no row.
  const computed: PropertyDef[] = type.computedProperties.map((c) => ({
    key: c.key, label: c.label, apiName: c.key, type: 'integer', required: false,
  }))
  return [...type.properties, ...computed]
}

/** One filter. Numeric properties compare with the shared ComparisonOp
 *  vocabulary; text and boolean compare for equality only — there is no
 *  meaningful "less than" on a label. */
export interface SetFilter {
  property: string
  op: ComparisonOp | 'eq' | 'neq'
  /** Typed against the property. When `param` is set this is the fallback used
   *  if the caller omits an optional parameter. */
  value: number | string | boolean
  /** Take the comparison value from this parameter instead of the literal
   *  above — what turns one set into a family of sets. */
  param?: string
}

/** A value the caller supplies at selection time. Without these, "urgent
 *  requests" needs a separate set per urgency. */
export interface SetParamDef {
  key: string
  label: string
  type: PropertyType
  required: boolean
}

export type SetArgs = Record<string, unknown>

/** A record as stored: property key → value. Computed properties are resolved
 *  during selection so filters can read them too. */
export type SetRecord = Record<string, unknown>

/** Records from one type. An interface-subject set gets one group per implementer. */
export interface RecordGroup {
  /** Undefined only when the type row couldn't be read — computed properties
   *  then don't resolve. */
  type?: ObjectTypeDef
  records: ReadonlyArray<SetRecord>
}

/** The selection half of a set definition: everything except what a consumer
 *  does with the result. An authored tool adds an aggregation; an automation
 *  adds an effect; a cohort adds nothing at all. */
export interface SetDefinition {
  /** Exactly one of these is set — one object type, or one interface. */
  subjectTypeId: string | null
  subjectInterfaceId: string | null
  parameters: SetParamDef[]
  filters: SetFilter[]
}

/** A set stored under a name — a cohort. The name is the point: it lets more
 *  than one thing refer to the same group, which is what neither the automation
 *  nor the tool copy of this concept could do. */
export interface ObjectSetDef extends SetDefinition {
  /** Search Around chain. When present the set's members are of the LAST hop's
   *  type, not the subject's — traversal changes the type of the set. */
  traversals: SetTraversal[]
  id: string
  organizationId: string
  hotelId: string | null
  name: string
  /** Stable identifier a consumer refers to, unique per organization. */
  apiName: string
  description: string
}

/** Checks a named set. The selection rules plus the naming ones — a set nothing
 *  can refer to is not a cohort. */
export function validateObjectSet(
  draft: Pick<ObjectSetDef, 'name' | 'apiName' | 'subjectTypeId' | 'subjectInterfaceId' | 'parameters' | 'filters'>
       & Partial<Pick<ObjectSetDef, 'traversals'>>,
  subject: SetSubject | undefined,
  /** apiNames already taken in the organization, excluding this set's own. */
  taken: ReadonlyArray<string> = [],
  /** Registered link types. A hop over anything else is refused. */
  declaredLinks: ReadonlySet<string> = new Set(),
): string[] {
  const errors: string[] = []
  if (!draft.name.trim()) errors.push('Name is required')
  if (!draft.apiName.trim()) {
    errors.push('API name is required')
  } else if (!/^[a-z][a-z0-9_]*$/.test(draft.apiName)) {
    errors.push('API name must be lower_snake_case')
  } else if (taken.includes(draft.apiName)) {
    errors.push(`"${draft.apiName}" is already used by another set`)
  }
  errors.push(...validateTraversals(draft.traversals ?? [], declaredLinks))
  return [...errors, ...validateSetDefinition(draft, subject)]
}

export interface SetTypeBreakdown {
  typeId: string
  label: string
  matched: number
  scanned: number
}

export interface ObjectSetSelection {
  /** The members, pooled across every contributing type. */
  records: SetRecord[]
  scanned: number
  /** Where the members came from — one entry per contributing type. A set over
   *  an interface is otherwise unexplainable. */
  byType: SetTypeBreakdown[]
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Checks the selection half of a draft against its subject. Returns [] when the
 *  set is answerable; every message names what to fix. */
export function validateSetDefinition(draft: SetDefinition, subject: SetSubject | undefined): string[] {
  const errors: string[] = []
  // Neutral wording: the same message surfaces in the tool composer and, later,
  // wherever a cohort is named. Neither should read as the other's jargon.
  if (draft.subjectTypeId && draft.subjectInterfaceId) {
    errors.push('Pick one object type or one interface, not both')
  }
  if (!subject) {
    errors.push('Pick an object type or interface to draw from')
    return errors
  }

  const label = subjectLabel(subject)
  const byKey = new Map(subjectProperties(subject).map((p) => [p.key, p]))
  const byParam = new Map(draft.parameters.map((p) => [p.key, p]))
  const seen = new Set<string>()

  for (const p of draft.parameters) {
    if (!/^[a-z][a-z0-9_]*$/.test(p.key)) errors.push(`Parameter key "${p.key}" must be lower_snake_case`)
    if (!p.label.trim()) errors.push(`Parameter "${p.key}" needs a label`)
    if (seen.has(p.key)) errors.push(`Duplicate parameter "${p.key}"`)
    seen.add(p.key)
    // A parameter nothing reads makes the caller supply something that changes
    // nothing — that's a broken set, not a harmless extra.
    if (!draft.filters.some((f) => f.param === p.key)) {
      errors.push(`Parameter "${p.key}" isn't used by any filter`)
    }
  }

  for (const f of draft.filters) {
    if (f.param !== undefined) {
      const p = byParam.get(f.param)
      if (!p) {
        errors.push(`Filter takes its value from "${f.param}", which isn't a declared parameter`)
      } else {
        const target = byKey.get(f.property)
        if (target && p.type !== target.type) {
          errors.push(`Parameter "${p.label}" is ${p.type}, but "${target.label}" is ${target.type}`)
        }
      }
    }
    const p = byKey.get(f.property)
    if (!p) {
      // On an interface this is the load-bearing rule, not a typo check: a
      // property outside the interface would break on the next implementer.
      errors.push(subject.kind === 'interface'
        ? `"${f.property}" is not on the ${label} interface — a set across types can only use the shape they all share`
        : `Filter property "${f.property}" is not on ${label}`)
      continue
    }
    // A required parameter always supplies the value, so its literal is never
    // read — only check the fallback when the caller may omit the argument.
    const literalIsRead = f.param === undefined || byParam.get(f.param)?.required === false
    if (literalIsRead && p.type === 'integer' && typeof f.value !== 'number') {
      errors.push(`Filter on "${p.label}" needs a number`)
    }
    if (literalIsRead && p.type === 'boolean' && typeof f.value !== 'boolean') {
      errors.push(`Filter on "${p.label}" needs true or false`)
    }
    if ((p.type === 'string' || p.type === 'boolean') && f.op !== 'eq' && f.op !== 'neq') {
      errors.push(`"${p.label}" can only be compared with is / is not`)
    }
  }
  return errors
}

// ── Selection ────────────────────────────────────────────────────────────────

/** Substitutes call arguments into the filters that take a parameter. Returns
 *  errors rather than guessing: selecting with the authored fallback when the
 *  caller meant something else is a wrong answer that looks right. */
export function bindSetArgs(
  def: Pick<SetDefinition, 'filters' | 'parameters'>,
  args: SetArgs,
): { filters: SetFilter[]; errors: string[] } {
  const errors: string[] = []
  const byKey = new Map(def.parameters.map((p) => [p.key, p]))

  const filters = def.filters.map((f) => {
    if (f.param === undefined) return f
    const p = byKey.get(f.param)
    if (!p) { errors.push(`Unknown parameter "${f.param}"`); return f }

    const given = args[p.key]
    if (given === undefined || given === null || given === '') {
      if (p.required) errors.push(`Missing required argument "${p.key}" (${p.label})`)
      return { ...f, value: f.value }   // authored fallback
    }
    if (p.type === 'integer') {
      const n = Number(given)
      if (!Number.isFinite(n)) { errors.push(`"${p.key}" must be a number`); return f }
      return { ...f, value: n }
    }
    if (p.type === 'boolean') {
      if (typeof given !== 'boolean') { errors.push(`"${p.key}" must be true or false`); return f }
      return { ...f, value: given }
    }
    return { ...f, value: String(given) }
  })

  return { filters, errors }
}

/** Resolves the set: computed properties first, then filters, then POOL across
 *  every contributing type. Pooling is what makes an interface set one set
 *  rather than several — a consumer that aggregates over the result gets the
 *  real figure, not the mean of each type's mean. */
export function selectObjectSet(
  def: Pick<SetDefinition, 'filters'>,
  groups: ReadonlyArray<RecordGroup>,
): ObjectSetSelection {
  const per = groups.map((g) => {
    const resolved = g.type
      ? g.records.map((r) => ({ ...r, ...computedValues(g.type as ObjectTypeDef, r) }))
      : g.records.slice()
    return { type: g.type, scanned: resolved.length, matched: resolved.filter((r) => isMember(r, def.filters)) }
  })

  return {
    records: per.flatMap((g) => g.matched),
    scanned: per.reduce((s, g) => s + g.scanned, 0),
    byType: per.map((g) => ({
      typeId:  g.type?.id ?? '',
      label:   g.type?.label ?? 'records',
      matched: g.matched.length,
      scanned: g.scanned,
    })),
  }
}

/** Whether one record belongs. Not on the package surface yet — it goes public
 *  when an automation asks it about a single variant instead of reimplementing
 *  the comparison rules. */
export function isMember(record: SetRecord, filters: ReadonlyArray<SetFilter>): boolean {
  return filters.every((f) => passes(record[f.property], f))
}

/** Computed properties as a flat patch, so filters read them like stored ones.
 *  A computed value that can't resolve is simply absent. */
function computedValues(type: ObjectTypeDef, data: SetRecord): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of type.computedProperties) {
    const v = evaluateComputed(c, data)
    if (v !== null) out[c.key] = v
  }
  return out
}

function passes(actual: unknown, f: SetFilter): boolean {
  if (f.op === 'eq')  return normalize(actual) === normalize(f.value)
  if (f.op === 'neq') return normalize(actual) !== normalize(f.value)
  const pair = comparable(actual, f.value)
  if (!pair) return false
  const [a, b] = pair
  switch (f.op) {
    case 'lt':  return a <  b
    case 'lte': return a <= b
    case 'gt':  return a >  b
    case 'gte': return a >= b
  }
}

/** Both sides as one comparable scale — both numbers, or both dates. Never a
 *  mix: a timestamp against 5 is meaningless, so it matches nothing rather than
 *  everything. `Number('2026-06-25')` is NaN, which used to make every date
 *  range filter silently match zero rows and report it confidently. */
function comparable(x: unknown, y: unknown): [number, number] | null {
  const asNumber = (v: unknown): number | null =>
    typeof v === 'number' ? (Number.isFinite(v) ? v : null)
    : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v)
    : null
  const nx = asNumber(x), ny = asNumber(y)
  if (nx !== null && ny !== null) return [nx, ny]

  const asDate = (v: unknown): number | null => {
    if (typeof v !== 'string') return null
    const t = Date.parse(v)
    return Number.isNaN(t) ? null : t
  }
  const dx = asDate(x), dy = asDate(y)
  return dx !== null && dy !== null ? [dx, dy] : null
}

/** Text compares case-insensitively; everything else by value. Keeps
 *  "Urgent" and "urgent" from being different answers. */
function normalize(v: unknown): unknown {
  return typeof v === 'string' ? v.trim().toLowerCase() : v
}

/** The "where …" clause in English, so a set reads like a description of a group
 *  rather than a config blob. Consumers prepend their own verb. */
export function describeSetFilters(
  def: Pick<SetDefinition, 'filters'>,
  subject?: SetSubject,
): string {
  if (def.filters.length === 0) return ''
  const props = subject ? new Map(subjectProperties(subject).map((p) => [p.key, p.label])) : new Map<string, string>()
  // A parameterised filter reads as a placeholder — the set is the shape, not
  // one of its answers.
  return def.filters
    .map((f) => `${props.get(f.property) ?? f.property} ${OP_LABELS[f.op]} ${f.param === undefined ? String(f.value) : `{${f.param}}`}`)
    .join(' and ')
}

export const OP_LABELS: Record<SetFilter['op'], string> = {
  lt: 'is below', lte: 'is at or below', gt: 'is above', gte: 'is at or above',
  eq: 'is', neq: 'is not',
}
