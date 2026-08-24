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

import type { LinkCardinality, LinkBackingKind } from '../ontology/linkCardinality'

import type { Deprecation, ObjectTypeStatus, OntologyStatus, OntologyVisibility } from '../ontology/status'

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
  { value: 'cipher',    label: 'Cipher',    help: 'A type for storing a string value encoded with Cipher.' },
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
  /** "All base types may be used in arrays… excluding the Vector and Time
   *  series types" — plus media references, whose exclusion is stated only on
   *  the media page: "Media reference lists are not supported as a property
   *  type on an object." Required exactly when type is array; never nested. */
  arrayElementType?: PropertyType
  /** Required exactly when the type is vector: "a query vector must be the same
   *  size as the one used for indexing", so there has to be a declared size to
   *  match. Capped at the published 2048. Nothing could save a vector property
   *  at all until 635 carried this through the writer. */
  vectorDimension?: number
  required: boolean
  /** A column in a backing datasource, or `user_input` — an edit-only property,
   *  "not directly mapped to a column in the backing dataset". It still names a
   *  datasource: edit-only properties "must be permissioned to one of the
   *  datasets backing the object type". */
  /** The third source. The property editor enumerates all three with their own
   *  one-line definitions — "Datasource: Back this property with a dataset,
   *  restricted view or stream", "User edits: Back this property exclusively
   *  with edits from user inputs", "Linked objects: Use a property from another
   *  object type" (`media-reference-source.png`). */
  source?: 'column' | 'user_input' | 'linked_objects'
  backingColumn?: string | null
  /** Derived from linked objects: the link chain, one link type per hop, at most
   *  three — the cap counts links, not object types. */
  hops?: string[]
  /** One of `derived_aggregations()`. Count needs no property; the collects take
   *  a limit. */
  derivedAggregation?: string | null
  /** The property on the object type the chain reaches. Null under Count. */
  derivedFromPropertyId?: string | null
  derivedLimit?: number | null
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
  /** "Every object type, property, link type, action, or interface in the
   *  Ontology has a status" — same vocabulary as the rest, without promoted
   *  ("object types only"). Optional so drafts need not carry one; the
   *  database defaults new rows to experimental. */
  status?: OntologyStatus
  deprecationReason?: string | null
  deprecationDeadline?: string | null
  replacedBy?: string | null
}

/** The wizard's Plural name, auto-filled from the label and overridable.
 *  Deliberately naive: Foundry's own example turns `[Example Data] Aircraft`
 *  into `[Example Data] Aircrafts`, so it does not know English irregulars
 *  either, and inventing a cleverer rule would diverge from what it produces. */
export function pluralise(label: string): string {
  const s = label.trimEnd()
  if (s === '') return ''
  if (/(s|x|z|ch|sh)$/i.test(s)) return `${s}es`
  if (/[^aeiou]y$/i.test(s)) return `${s.slice(0, -1)}ies`
  return `${s}s`
}

export interface ObjectTypeDef {
  id: string
  /** The ontology it belongs to. "A space can hold a single ontology", and an
   *  object type never moves between them — its API name is unique per ontology
   *  and its RID resolves inside one. */
  ontologyId?: string
  /** slug, unique per org — the type's stable api name. */
  apiName: string
  label: string
  icon: string
  /** The tile the icon sits in. Foundry fills a rounded square with this colour
   *  and draws the glyph in white — object types and object sets get a
   *  saturated tile, Files and Projects resources a tinted one
   *  (readings/workshop-resource-list.md §3). The picker offers Blueprint's
   *  palette by ramp and step, `Orange 5`, but the page also allows "a
   *  predefined or custom color", so the column stays a hex. Optional for the
   *  same reason `status` is: the database defaults it. */
  iconColor?: string
  /** The Overview's Plural name — "the name shown to anyone accessing multiple
   *  objects of this type" (create-object-type). The wizard derives it from the
   *  label and the operator may override; the database only stores it. */
  pluralLabel?: string
  /** Overview fields 415 and 422 added and nothing read until the metadata card.
   *  Both people fields are auth.users references; neither appears in the object
   *  type API, so the Ontology Manager's own vocabulary is all there is. */
  pointOfContact?: string | null
  contributors?: string[]
  trackEditHistory?: boolean
  /** "Alternative names (synonyms) for the object type, usable as search terms."
   *  The ⌘K search already matched on them; the Overview is where they show. */
  aliases?: string[]
  rid?: string | null
  description: string
  properties: PropertyDef[]
  version: number
  /** Developmental state, and where the type surfaces. Foundry's; see
   *  ontology/status.ts. Optional on the type so a caller building a draft
   *  need not restate the defaults the database applies. */
  status?: ObjectTypeStatus
  visibility?: OntologyVisibility
  deprecation?: Deprecation | null
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
    // An edit-only property escapes the column, not the permissioning.
    if (p.source === 'user_input' && !p.datasourceId) {
      errors.push(`Property "${p.label}" is edit-only, so it must be permissioned to one of the object type's datasources.`)
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

// ── Link types (P2.3) — a named relationship from one object type to another.
// Instances (object_links) connect a source record to a target record.

export interface LinkTypeDef {
  id: string
  sourceTypeId: string
  targetTypeId: string
  /** slug, unique per source type — the relationship's api name. */
  apiName: string
  label: string
  /** A link type is directional twice over: each side carries its own label,
   *  API name and visibility. "each side of a link type has its own API name;
   *  there is no separate reverse link type" (migration 256). Every one of
   *  these was stored and displayed nowhere until the link type view. */
  sourceLabel?: string | null
  targetLabel?: string | null
  sourceApiName?: string | null
  targetApiName?: string | null
  sourceVisibility?: string | null
  targetVisibility?: string | null
  cardinality?: LinkCardinality | null
  backingKind?: LinkBackingKind | null
  backingObjectTypeId?: string | null
  sourceKeyColumn?: string | null
  targetKeyColumn?: string | null
  datasetId?: string | null
  status?: string | null
  rid?: string | null
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
