// Reality Graph — user-authored object types (Studio P2, "Ontology authoring").
// Foundry's Ontology Manager, as data: an operator defines a new kind of thing
// (a "Maintenance Request", a "Guest Complaint") with typed properties, then
// creates records of it — all without a code deploy. The engine reads these
// user-defined types alongside the code substrate (Variant, Supplier, …).
//
// Discipline (mirrors P1 + STUDIO-AUTHORING-PLAN): a bounded typed grammar
// (property types are a closed set), validated before persistence, versioned,
// admin/owner-authored, scope-gated.

export type PropertyType = 'text' | 'number' | 'boolean' | 'date'

export const PROPERTY_TYPES: { value: PropertyType; label: string; help: string }[] = [
  { value: 'text',    label: 'Text',    help: 'Free text — names, notes, descriptions.' },
  { value: 'number',  label: 'Number',  help: 'A numeric value.' },
  { value: 'boolean', label: 'Yes / No', help: 'A true/false flag.' },
  { value: 'date',    label: 'Date',    help: 'A calendar date.' },
]

export interface PropertyDef {
  /** api name — a slug, unique within the type. */
  key: string
  label: string
  type: PropertyType
  required: boolean
}

export interface ObjectTypeDef {
  id: string
  organizationId: string
  hotelId: string | null
  /** slug, unique per org — the type's stable api name. */
  apiName: string
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
  /** Derived values computed from stored properties at read time (P2.4). */
  computedProperties: ComputedPropertyDef[]
  enabled: boolean
  version: number
}

// ── Computed properties (P2.4) — derived, not entered. A bounded function over
// existing stored properties (no free-form formula parser — same discipline as
// the automation grammar), evaluated at read time.

export type ComputedFn = 'sum' | 'difference' | 'product' | 'days_since' | 'days_until'

export interface ComputedFnDef {
  value: ComputedFn
  label: string
  inputType: 'number' | 'date'
  arity: 'many' | 'two' | 'one'
  help: string
}

export const COMPUTED_FNS: ComputedFnDef[] = [
  { value: 'sum',        label: 'Sum of',        inputType: 'number', arity: 'many', help: 'Adds the selected number properties.' },
  { value: 'product',    label: 'Product of',    inputType: 'number', arity: 'many', help: 'Multiplies the selected number properties.' },
  { value: 'difference', label: 'Difference (a − b)', inputType: 'number', arity: 'two', help: 'First input minus second.' },
  { value: 'days_since', label: 'Days since',    inputType: 'date',   arity: 'one',  help: 'Whole days elapsed since a date property.' },
  { value: 'days_until', label: 'Days until',    inputType: 'date',   arity: 'one',  help: 'Whole days remaining until a date property.' },
]

export interface ComputedPropertyDef {
  key: string
  label: string
  fn: ComputedFn
  /** stored-property keys this computed value reads. */
  inputs: string[]
}

function parseDate(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isNaN(t) ? null : t
}

const DAY_MS = 86_400_000

/** Evaluate a computed property against a record's stored data. null when the
 *  inputs aren't present/typed — computed values are display-only, never stored. */
export function evaluateComputed(def: ComputedPropertyDef, data: Record<string, unknown>, now: Date = new Date()): number | null {
  const num = (k: string): number | null => {
    const v = data[k]
    return typeof v === 'number' ? v : null
  }
  if (def.fn === 'sum' || def.fn === 'product') {
    const xs = def.inputs.map(num).filter((v): v is number => v !== null)
    if (xs.length === 0) return null
    return def.fn === 'sum' ? xs.reduce((a, b) => a + b, 0) : xs.reduce((a, b) => a * b, 1)
  }
  if (def.fn === 'difference') {
    const a = num(def.inputs[0])
    const b = num(def.inputs[1])
    return a !== null && b !== null ? a - b : null
  }
  const d = parseDate(data[def.inputs[0]])
  if (d === null) return null
  return def.fn === 'days_until' ? Math.floor((d - now.getTime()) / DAY_MS) : Math.floor((now.getTime() - d) / DAY_MS)
}

export function validateComputedProperty(draft: ComputedPropertyDef, properties: PropertyDef[]): Validation {
  const errors: string[] = []
  if (!draft.label.trim()) errors.push('Every computed property needs a label.')
  if (!SLUG_RE.test(draft.key)) errors.push(`Computed "${draft.label}" has an invalid key — use lower_snake_case.`)
  else if (RESERVED_PROPERTY_KEYS.has(draft.key)) errors.push(`"${draft.key}" is a reserved key.`)
  else if (properties.some((p) => p.key === draft.key)) errors.push(`"${draft.key}" clashes with a stored property.`)
  const fn = COMPUTED_FNS.find((f) => f.value === draft.fn)
  if (!fn) return { ok: false, errors: [...errors, 'Unknown function.'] }
  if (fn.arity === 'two' && draft.inputs.length !== 2) errors.push(`${fn.label} needs exactly two inputs.`)
  if (fn.arity === 'one' && draft.inputs.length !== 1) errors.push(`${fn.label} needs one input.`)
  if (fn.arity === 'many' && draft.inputs.length < 1) errors.push(`${fn.label} needs at least one input.`)
  for (const key of draft.inputs) {
    const prop = properties.find((p) => p.key === key)
    if (!prop) errors.push(`Input "${key}" is not a property of this type.`)
    else if (prop.type !== fn.inputType) errors.push(`${fn.label} needs ${fn.inputType} inputs, but "${prop.label}" is ${prop.type}.`)
  }
  return { ok: errors.length === 0, errors }
}

// Keys the record envelope already owns — a property can't shadow them.
export const RESERVED_PROPERTY_KEYS = new Set([
  'id', 'title', 'type', 'created_at', 'updated_at', 'organization_id', 'hotel_id', 'object_type_id',
])

const SLUG_RE = /^[a-z][a-z0-9_]*$/

export function toSlug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

export type ObjectTypeDraft = Pick<ObjectTypeDef, 'apiName' | 'label' | 'properties'>

export interface Validation { ok: boolean; errors: string[] }

export function validateObjectTypeDraft(draft: ObjectTypeDraft): Validation {
  const errors: string[] = []
  if (!draft.label.trim()) errors.push('Label is required.')
  if (!SLUG_RE.test(draft.apiName)) errors.push('API name must be lower_snake_case (letters, digits, underscores; starting with a letter).')

  const seen = new Set<string>()
  for (const p of draft.properties) {
    if (!p.label.trim()) { errors.push('Every property needs a label.'); continue }
    if (!SLUG_RE.test(p.key)) { errors.push(`Property "${p.label}" has an invalid key — use lower_snake_case.`); continue }
    if (RESERVED_PROPERTY_KEYS.has(p.key)) { errors.push(`"${p.key}" is a reserved key.`); continue }
    if (seen.has(p.key)) { errors.push(`Duplicate property key "${p.key}".`); continue }
    seen.add(p.key)
    if (!PROPERTY_TYPES.some((t) => t.value === p.type)) errors.push(`Property "${p.label}" has an unknown type.`)
  }
  return { ok: errors.length === 0, errors }
}

// ── Link types (P2.3) — a named relationship from one object type to another.
// Instances (object_links) connect a source record to a target record.

export interface LinkTypeDef {
  id: string
  organizationId: string
  hotelId: string | null
  sourceTypeId: string
  targetTypeId: string
  /** slug, unique per source type — the relationship's api name. */
  apiName: string
  label: string
}

export type LinkTypeDraft = Pick<LinkTypeDef, 'apiName' | 'label' | 'sourceTypeId' | 'targetTypeId'>

export function validateLinkTypeDraft(draft: LinkTypeDraft): Validation {
  const errors: string[] = []
  if (!draft.label.trim()) errors.push('Label is required.')
  if (!SLUG_RE.test(draft.apiName)) errors.push('API name must be lower_snake_case.')
  if (!draft.sourceTypeId) errors.push('A source type is required.')
  if (!draft.targetTypeId) errors.push('A target type is required.')
  return { ok: errors.length === 0, errors }
}

export interface RecordDraft {
  title: string
  data: Record<string, unknown>
}

/** Validate a record's values against the type's property schema. Lenient
 *  coercion isn't done here — the caller coerces via coerceValue first. */
export function validateRecord(properties: PropertyDef[], draft: RecordDraft): Validation {
  const errors: string[] = []
  if (!draft.title.trim()) errors.push('Title is required.')
  for (const p of properties) {
    const raw = draft.data[p.key]
    const empty = raw === undefined || raw === null || raw === ''
    if (p.required && empty) { errors.push(`${p.label} is required.`); continue }
    if (empty) continue
    if (p.type === 'number' && typeof raw !== 'number') errors.push(`${p.label} must be a number.`)
    if (p.type === 'boolean' && typeof raw !== 'boolean') errors.push(`${p.label} must be true or false.`)
    if (p.type === 'date' && !(typeof raw === 'string' && !Number.isNaN(Date.parse(raw)))) errors.push(`${p.label} must be a valid date.`)
    if (p.type === 'text' && typeof raw !== 'string') errors.push(`${p.label} must be text.`)
  }
  return { ok: errors.length === 0, errors }
}

/** Coerce a raw form value (usually a string) into the property's type, or null
 *  when it can't be represented. Used before validateRecord + persistence. */
export function coerceValue(type: PropertyType, raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === '') return null
  switch (type) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(raw)
      return Number.isFinite(n) ? n : null
    }
    case 'boolean':
      return typeof raw === 'boolean' ? raw : raw === 'true' ? true : raw === 'false' ? false : null
    case 'date':
      return typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) ? raw : null
    case 'text':
      return typeof raw === 'string' ? raw : String(raw)
  }
}
