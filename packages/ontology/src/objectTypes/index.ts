// Object types and their properties — Foundry's Ontology Manager, as data.
//
// "A property of an object type is the schema definition of a characteristic of a
// real-world entity or event." Analogous to a COLUMN, as a property value is to a
// field (`object-link-types/properties-overview`).
//
// The vocabulary below mirrors SQL (migration 408). It is restated here because
// it must cross a language boundary, and `check:datasets` asserts the two agree —
// a conformance test, not an allowlist: two implementations of one documented
// fact, compared.

import type { Deprecation, OntologyStatus, OntologyVisibility } from '../ontology/status'

/** The twenty-two base types from properties-overview's table. A closed set —
 *  an unknown value is a typo, not an extension. */
export type PropertyType =
  | 'string' | 'integer' | 'short' | 'date' | 'timestamp' | 'boolean' | 'byte' | 'long'
  | 'float' | 'double' | 'decimal' | 'vector' | 'array' | 'struct' | 'media_reference'
  | 'time_series' | 'geotemporal_series' | 'attachment' | 'geopoint' | 'geoshape'
  | 'marking' | 'cipher'

export const PROPERTY_TYPES: { value: PropertyType; label: string; help: string }[] = [
  { value: 'string',    label: 'String',    help: 'Text. The safest primary key.' },
  { value: 'integer',   label: 'Integer',   help: 'A whole number, 32 bits.' },
  { value: 'short',     label: 'Short',     help: 'A whole number, 16 bits.' },
  { value: 'long',      label: 'Long',      help: 'A whole number, 64 bits.' },
  { value: 'byte',      label: 'Byte',      help: 'A whole number, 8 bits.' },
  { value: 'float',     label: 'Float',     help: 'An approximate decimal, 32 bits.' },
  { value: 'double',    label: 'Double',    help: 'An approximate decimal, 64 bits.' },
  { value: 'decimal',   label: 'Decimal',   help: 'An exact decimal.' },
  { value: 'boolean',   label: 'Boolean',   help: 'True or false.' },
  { value: 'date',      label: 'Date',      help: 'A calendar date.' },
  { value: 'timestamp', label: 'Timestamp', help: 'A point in time.' },
  { value: 'array',     label: 'Array',     help: 'Several values of one type. Cannot contain nulls.' },
  { value: 'struct',    label: 'Struct',    help: 'Named fields grouped into one value. No nesting, no array fields.' },
  { value: 'geopoint',  label: 'Geopoint',  help: 'A point on the map, as latitude,longitude.' },
  { value: 'geoshape',  label: 'Geoshape',  help: 'A polygon or line.' },
  { value: 'media_reference', label: 'Media reference', help: 'Points at a media item rather than copying it.' },
  { value: 'attachment', label: 'Attachment', help: 'A file stored on the object.' },
  { value: 'time_series', label: 'Time series', help: 'A series of points over time.' },
  { value: 'geotemporal_series', label: 'Geotemporal series', help: 'A track through space and time.' },
  { value: 'vector',    label: 'Vector',    help: 'An embedding, for semantic search. Written by a pipeline, never typed.' },
  { value: 'cipher',    label: 'Cipher',    help: 'A value encrypted with Cipher.' },
  { value: 'marking',   label: 'Marking',   help: 'A mandatory control property. Secures every other property in the same datasource.' },
]

/** yes | discouraged | no. Three tiers, not two — only `no` is a constraint. */
export type KeyEligibility = 'yes' | 'discouraged' | 'no'

const PK_YES: ReadonlyArray<PropertyType> = ['string', 'integer', 'short']
const PK_DISCOURAGED: ReadonlyArray<PropertyType> = ['date', 'timestamp', 'boolean', 'byte', 'long']

export function primaryKeyEligibility(t: PropertyType): KeyEligibility {
  if (PK_YES.includes(t)) return 'yes'
  if (PK_DISCOURAGED.includes(t)) return 'discouraged'
  return 'no'
}

/** The documented reason, which is the whole value of the middle tier — a
 *  warning without its reason is just an obstacle. */
export function primaryKeyAdvice(t: PropertyType): string | null {
  switch (t) {
    case 'date': case 'timestamp':
      return 'Time values are inappropriate as primary keys, due to potentially unexpected collisions / uniqueness based on the storage format differing from the display format. In most cases, use String instead.'
    case 'boolean':
      return 'Boolean limits your object type to two object instances.'
    case 'byte':
      return 'Byte properties can only be assigned in Actions via an Integer parameter, so in most cases use Integer instead.'
    case 'long':
      return 'Long has representational issues in Javascript, so not all frontend libraries and code work well with Long values greater than 1e15. In most cases, use String instead.'
    default:
      return null
  }
}

/** A separate axis, and not the complement: fourteen base types can title an
 *  object where three can key one. */
export const TITLE_KEY_INELIGIBLE: ReadonlyArray<PropertyType> = [
  'vector', 'struct', 'media_reference', 'time_series', 'geotemporal_series',
  'attachment', 'geoshape', 'marking',
]

/** "there are a number of reserved keywords that cannot be used for API names" */
export const RESERVED_API_NAMES: ReadonlyArray<string> = [
  'ontology', 'object', 'property', 'link', 'relation', 'rid',
  'primaryKey', 'typeId', 'ontologyObject',
]

/** Foundry: "Geopoint values are stored as a comma-separated string in the
 *  format `latitude,longitude` (for example, `57.64911,10.40744`)." Copied
 *  exactly — a point that round-trips through their format travels to any
 *  consumer that expects one. */
export function parseGeopoint(v: unknown): { lat: number; lng: number } | null {
  if (typeof v !== 'string') return null
  const [a, b, ...rest] = v.split(',')
  if (rest.length > 0 || b === undefined) return null
  // Number('') is 0, so an empty half would silently place the point on a
  // meridian instead of failing. Both halves have to be there.
  if (a.trim() === '' || b.trim() === '') return null
  const lat = Number(a.trim())
  const lng = Number(b.trim())
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  // Out of range is a transposed pair or a bad parse, not a place.
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export const formatGeopoint = (lat: number, lng: number): string => `${String(lat)},${String(lng)}`

export const canBeTitleKey = (t: PropertyType): boolean => !TITLE_KEY_INELIGIBLE.includes(t)

/** The display name for one record, resolved the way Foundry defines it: the
 *  title key is "the property that acts as a display name for objects of this
 *  type". Authored records instead carry a NOT NULL `title` column, which is the
 *  same idea fixed to one property by the storage model.
 *
 *  The only surface allowed to answer this question. Three call sites used to
 *  answer it differently — two by guessing the first text property — so a record
 *  could be titled one way in a list and another in a set. */
export function titleKeyOf(type: { properties: PropertyDef[] }): PropertyDef | null {
  return type.properties.find((p) => p.isTitleKey === true) ?? null
}

export function primaryKeyOf(type: { properties: PropertyDef[] }): PropertyDef | null {
  return type.properties.find((p) => p.isPrimaryKey === true) ?? null
}

export function objectTitle(
  type: { properties: PropertyDef[]; label: string },
  row: Record<string, unknown>,
): string {
  const tk = titleKeyOf(type)
  const keyed = tk ? row[tk.apiName] ?? row[tk.key] : undefined
  // Dates and numbers title perfectly well — a stock log is "when it happened".
  if (keyed != null && keyed !== '') return String(keyed)
  if (typeof row.title === 'string' && row.title !== '') return row.title
  // Only the four relational line types reach here; nothing in the row names it.
  const id = typeof row.id === 'string' ? row.id : ''
  return id === '' ? type.label : `${type.label} ${id.slice(0, 8)}`
}

/** Used for two things, deliberately: a stored row in object_type_properties, and
 *  a synthesised property that has no row — an interface field, a computed value.
 *  The row-only fields are therefore optional, and a caller that needs a real row
 *  asks through {@link primaryKeyOf} / {@link titleKeyOf} rather than reading the
 *  flags raw. */
export interface PropertyDef {
  id?: string
  /** "primarily used to reference objects of this type when configuring a user
   *  application" — and "any change to the property ID will break the
   *  application". Never regenerate one. */
  key: string
  label: string
  /** camelCase, unique within the object type, never a reserved keyword. This is
   *  what a generated client exposes. */
  apiName: string
  type: PropertyType
  required: boolean
  /** A column in a backing datasource, or `user_input` — the creation wizard
   *  offers both as a Source. */
  source?: 'column' | 'user_input'
  backingColumn?: string | null
  /** Which of the object type's datasources. NULL on the primary key, which
   *  "must exist in every input datasource". */
  datasourceId?: string | null
  /** The shared property this inherits its metadata from. A real reference now,
   *  not an api-name string in jsonb. */
  sharedPropertyId?: string | null
  description?: string
  visibility?: 'prominent' | 'normal' | 'hidden'
  isPrimaryKey?: boolean
  isTitleKey?: boolean
  position?: number
}

export interface ObjectTypeDef {
  id: string
  organizationId: string
  /** slug, unique per org — the type's stable api name. */
  apiName: string
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
  /** Derived values computed from stored properties at read time (P2.4). */
  computedProperties: ComputedPropertyDef[]
  /** How records of this type present (P3). Empty config → standard view. */
  viewConfig: ViewConfigDef
  enabled: boolean
  version: number
  /** Developmental state, and where the type surfaces. Foundry's; see
   *  ontology/status.ts. Optional on the type so a caller building a draft
   *  need not restate the defaults the database applies. */
  status?: OntologyStatus
  visibility?: OntologyVisibility
  deprecation?: Deprecation | null
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
  /** Same job as PropertyDef.description — a derived value needs explaining more
   *  than a stored one, since its inputs are not on screen. */
  description?: string
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

/** Whether a base type belongs to the family a computed function consumes. */
export const acceptsInput = (family: 'number' | 'date', t: PropertyType): boolean =>
  family === 'number' ? NUMERIC.includes(t) : t === 'date' || t === 'timestamp'

export function validateComputedProperty(draft: ComputedPropertyDef, properties: PropertyDef[]): Validation {
  const errors: string[] = []
  if (!draft.label.trim()) errors.push('Every computed property needs a label.')
  if (!SLUG_RE.test(draft.key)) errors.push(`Computed "${draft.label}" has an invalid key — use lower_snake_case.`)
  else if (properties.some((p) => p.key === draft.key)) errors.push(`"${draft.key}" clashes with a stored property.`)
  const fn = COMPUTED_FNS.find((f) => f.value === draft.fn)
  if (!fn) return { ok: false, errors: [...errors, 'Unknown function.'] }
  if (fn.arity === 'two' && draft.inputs.length !== 2) errors.push(`${fn.label} needs exactly two inputs.`)
  if (fn.arity === 'one' && draft.inputs.length !== 1) errors.push(`${fn.label} needs one input.`)
  if (fn.arity === 'many' && draft.inputs.length < 1) errors.push(`${fn.label} needs at least one input.`)
  for (const key of draft.inputs) {
    const prop = properties.find((p) => p.key === key)
    if (!prop) errors.push(`Input "${key}" is not a property of this type.`)
    // A family, not a single type: `integer`, `long`, `decimal` and three more
    // are all numeric. Comparing to one name rejected every valid input.
    else if (!acceptsInput(fn.inputType, prop.type)) {
      errors.push(`${fn.label} needs ${fn.inputType} inputs, but "${prop.label}" is ${prop.type}.`)
    }
  }
  return { ok: errors.length === 0, errors }
}

// Keys the record envelope already owns — a property can't shadow them.
// Three spellings, and the page is explicit that they differ. An object type's
// API name must "Begin with an uppercase character... written in PascalCase...
// unique across all object types... between 1 and 100 characters"; a property's
// must "Begin with a lowercase character... written in camelCase... unique
// across all properties belonging to the same object type". A property ID is
// looser again: "lowercase or uppercase letters, numbers, dashes, and
// underscores. Should start with a letter."
const TYPE_API_RE = /^[A-Z][A-Za-z0-9]{0,99}$/
const PROP_API_RE = /^[a-z][A-Za-z0-9]{0,99}$/
const PROP_ID_RE  = /^[A-Za-z][A-Za-z0-9_-]*$/
// Computed properties and link types keep the old spelling; neither casing is
// settled by a page I have read.
const SLUG_RE = /^[a-z][a-z0-9_]*$/

const words = (input: string): string[] =>
  input.trim().split(/[^A-Za-z0-9]+/).filter(Boolean)

export function toSlug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

/** A label to a property API name. */
export function toCamel(input: string): string {
  const [first, ...rest] = words(input.toLowerCase())
  if (first === undefined) return ''
  return first + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('')
}

/** A label to an object type API name. */
export function toPascal(input: string): string {
  return words(input.toLowerCase()).map((w) => w[0].toUpperCase() + w.slice(1)).join('')
}

export type ObjectTypeDraft = Pick<ObjectTypeDef, 'apiName' | 'label' | 'properties'>

export interface Validation { ok: boolean; errors: string[] }

export function validateObjectTypeDraft(draft: ObjectTypeDraft): Validation {
  const errors: string[] = []
  if (!draft.label.trim()) errors.push('Label is required.')
  if (!TYPE_API_RE.test(draft.apiName)) {
    errors.push('API name must be PascalCase — a letter first, letters and digits only, up to 100 characters.')
  }

  // "these property fields must not be empty: Property ID, Property display
  // name, Backing column, Property API name, Title key, Primary key". The two
  // keys are checked over the set, the rest per property.
  const ids = new Set<string>()
  const apiNames = new Set<string>()
  for (const p of draft.properties) {
    if (!p.label.trim()) { errors.push('Every property needs a display name.'); continue }
    if (!PROP_ID_RE.test(p.key)) { errors.push(`Property "${p.label}" has an invalid ID — a letter first, then letters, digits, dashes or underscores.`); continue }
    if (ids.has(p.key)) { errors.push(`Duplicate property ID "${p.key}".`); continue }
    ids.add(p.key)

    if (!PROP_API_RE.test(p.apiName)) {
      errors.push(`Property "${p.label}" needs a camelCase API name.`)
    } else if (RESERVED_API_NAMES.includes(p.apiName)) {
      errors.push(`"${p.apiName}" is a reserved API name.`)
    } else if (apiNames.has(p.apiName)) {
      errors.push(`Duplicate property API name "${p.apiName}".`)
    }
    apiNames.add(p.apiName)

    if (!PROPERTY_TYPES.some((t) => t.value === p.type)) errors.push(`Property "${p.label}" has an unknown type.`)
    // "A backing datasource for an object type may not contain MapType or
    // StructType columns" is the datasource's rule; this is the property's:
    // a column-sourced property names the column it reads.
    if ((p.source ?? 'column') === 'column' && !(p.backingColumn ?? '').trim()) {
      errors.push(`Property "${p.label}" needs a backing column, or a source of user input.`)
    }
  }

  if (draft.properties.length > 0) {
    const pk = draft.properties.find((p) => p.isPrimaryKey)
    if (!pk) errors.push('A primary key is required.')
    else if (!pk.required) errors.push(`The primary key "${pk.label}" must be required — a nullable key is not a key.`)
    if (!draft.properties.some((p) => p.isTitleKey)) errors.push('A title key is required.')
  }
  return { ok: errors.length === 0, errors }
}

// ── Object View config (P3) — how a type's records PRESENT. Foundry's model:
// a standard view is derived for every type; a configured view overrides it.
// Config is data on the type (versioned with the schema by the same triggers).

export interface ViewSection {
  title: string
  /** property or computed-property keys shown in this section. */
  keys: string[]
}

export interface ViewConfigDef {
  /** keys surfaced in the metric strip at the top (property or computed). */
  prominent: string[]
  /** grouped body sections. Empty → one auto section with everything. */
  sections: ViewSection[]
}

export const EMPTY_VIEW_CONFIG: ViewConfigDef = { prominent: [], sections: [] }

/** All presentable keys of a type: stored properties + computed. */
function presentableKeys(type: Pick<ObjectTypeDef, 'properties' | 'computedProperties'>): Set<string> {
  return new Set([...type.properties.map((p) => p.key), ...type.computedProperties.map((c) => c.key)])
}

/** The standard (derived) view: configured values win; anything not placed in a
 *  configured section lands in a trailing "Details" section, so a schema change
 *  never silently hides a property. */
export function resolveViewConfig(
  type: Pick<ObjectTypeDef, 'properties' | 'computedProperties'>,
  config: ViewConfigDef | null | undefined,
): ViewConfigDef {
  const all = presentableKeys(type)
  const cfg = config ?? EMPTY_VIEW_CONFIG
  const prominent = cfg.prominent.filter((k) => all.has(k))
  const sections: ViewSection[] = cfg.sections
    .map((s) => ({ title: s.title, keys: s.keys.filter((k) => all.has(k)) }))
    .filter((s) => s.keys.length > 0)
  const placed = new Set(sections.flatMap((s) => s.keys))
  const rest = [...all].filter((k) => !placed.has(k))
  if (rest.length > 0) sections.push({ title: sections.length > 0 ? 'Details' : 'Properties', keys: rest })
  return { prominent, sections }
}

export function validateViewConfig(
  config: ViewConfigDef,
  type: Pick<ObjectTypeDef, 'properties' | 'computedProperties'>,
): Validation {
  const all = presentableKeys(type)
  const errors: string[] = []
  for (const k of config.prominent) if (!all.has(k)) errors.push(`Prominent key "${k}" is not a property of this type.`)
  const seen = new Set<string>()
  for (const s of config.sections) {
    if (!s.title.trim()) errors.push('Every section needs a title.')
    for (const k of s.keys) {
      if (!all.has(k)) errors.push(`Section "${s.title}" references unknown key "${k}".`)
      else if (seen.has(k)) errors.push(`Key "${k}" appears in more than one section.`)
      seen.add(k)
    }
  }
  return { ok: errors.length === 0, errors }
}

// ── Link types (P2.3) — a named relationship from one object type to another.
// Instances (object_links) connect a source record to a target record.

export interface LinkTypeDef {
  id: string
  organizationId: string
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
    if (NUMERIC.includes(p.type) && typeof raw !== 'number') errors.push(`${p.label} must be a number.`)
    if (p.type === 'boolean' && typeof raw !== 'boolean') errors.push(`${p.label} must be true or false.`)
    if (p.type === 'date' && !(typeof raw === 'string' && !Number.isNaN(Date.parse(raw)))) errors.push(`${p.label} must be a valid date.`)
    if (TEXTUAL.includes(p.type) && typeof raw !== 'string') errors.push(`${p.label} must be text.`)
    if (p.type === 'media_reference' && !(typeof raw === 'string' && raw.includes('/'))) {
      errors.push(`${p.label} must point at a stored file, as bucket/path.`)
    }
    if (p.type === 'geopoint' && parseGeopoint(raw) === null) {
      errors.push(`${p.label} must be latitude,longitude — for example 37.9838,23.7275.`)
    }
    if (p.type === 'vector' && !Array.isArray(raw)) {
      errors.push(`${p.label} is an embedding — it is written by the pipeline, not entered.`)
    }
  }
  return { ok: errors.length === 0, errors }
}

/** The base types that carry a JavaScript number, and those that carry a string.
 *  Named once because six types are numeric where the old vocabulary had one. */
export const NUMERIC: ReadonlyArray<PropertyType> =
  ['integer', 'short', 'long', 'byte', 'float', 'double', 'decimal']
export const TEXTUAL: ReadonlyArray<PropertyType> = ['string', 'cipher']

/** Coerce a raw form value (usually a string) into the property's type, or null
 *  when it can't be represented. Used before validateRecord + persistence. */
export function coerceValue(type: PropertyType, raw: unknown): unknown {
  if (raw === undefined || raw === null || raw === '') return null
  if (NUMERIC.includes(type)) {
    const n = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(n) ? n : null
  }
  if (TEXTUAL.includes(type)) return typeof raw === 'string' ? raw : String(raw)
  switch (type) {
    case 'boolean':
      return typeof raw === 'boolean' ? raw : raw === 'true' ? true : raw === 'false' ? false : null
    case 'date':
      return typeof raw === 'string' && !Number.isNaN(Date.parse(raw)) ? raw : null
    // A media reference is a POINTER, not the file: "media references enable you
    // to use a media item in Foundry without having to make copies of the media
    // item itself." Ours is `bucket/path`, which is what the storage client takes.
    case 'media_reference':
      return typeof raw === 'string' && raw.includes('/') ? raw : null
    // A vector is written by an embedder, never typed. Accept an array of finite
    // numbers and nothing else, so a stray string cannot poison a search index.
    case 'vector':
      return Array.isArray(raw) && raw.every((n) => typeof n === 'number' && Number.isFinite(n))
        ? raw : null
    // Normalised through their format, so a value that survives coercion is one
    // any geopoint consumer can read.
    case 'geopoint': {
      const p = parseGeopoint(raw)
      return p ? formatGeopoint(p.lat, p.lng) : null
    }
  }
}
