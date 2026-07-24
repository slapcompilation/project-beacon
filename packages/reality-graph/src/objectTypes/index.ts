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
  enabled: boolean
  version: number
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
