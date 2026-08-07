// Interfaces — the shape an object type promises to have.
//
// Foundry: "an interface is an Ontology type that describes the shape of an
// object type and its capabilities … if new object types that implement the
// interface are introduced, the workflow will be immediately compatible with the
// new object types without additional refactors."
//
// That last clause is why we need them. An authored tool or agent binds to ONE
// object type today, so a second similar type forces re-authoring everything. A
// tool written against an interface runs across every implementer, including
// ones authored later.
//
// Interfaces are abstract: no records, not instantiable. The load-bearing rule
// is conformance — a type may only claim an interface if it actually has the
// shape, checked here and again in the database.

import type { ObjectTypeDef, PropertyDef, PropertyType } from '../objectTypes/index'

/** A property the interface requires of every implementer. */
export interface InterfacePropertyDef {
  key: string
  label: string
  type: PropertyType
}

export interface InterfaceDef {
  id: string
  organizationId: string
  apiName: string
  label: string
  description: string
  properties: InterfacePropertyDef[]
}

// ── Validation ───────────────────────────────────────────────────────────────

export function validateInterfaceDraft(
  draft: Pick<InterfaceDef, 'apiName' | 'label' | 'properties'>,
): string[] {
  const errors: string[] = []
  if (!draft.label.trim())   errors.push('Label is required')
  if (!draft.apiName.trim()) errors.push('API name is required')
  if (draft.properties.length === 0) {
    errors.push('An interface with no properties promises nothing — add at least one')
  }
  const keys = new Set<string>()
  for (const p of draft.properties) {
    if (!p.key.trim())   errors.push('Every interface property needs a key')
    if (!p.label.trim()) errors.push(`Property "${p.key}" needs a label`)
    if (keys.has(p.key)) errors.push(`Duplicate property "${p.key}"`)
    keys.add(p.key)
  }
  return errors
}

/** Why a type does NOT satisfy an interface. Empty array = it conforms.
 *  A type may carry extra properties; it may not be missing or re-type one. */
export function conformanceErrors(type: ObjectTypeDef, iface: InterfaceDef): string[] {
  const byKey = new Map<string, PropertyDef>(type.properties.map((p) => [p.key, p]))
  const errors: string[] = []
  for (const req of iface.properties) {
    const has = byKey.get(req.key)
    if (!has) {
      errors.push(`${type.label} is missing "${req.label}" (${req.key}: ${req.type})`)
      continue
    }
    if (has.type !== req.type) {
      errors.push(`${type.label}.${req.key} is ${has.type}, but ${iface.label} requires ${req.type}`)
    }
  }
  return errors
}

export function implementsInterface(type: ObjectTypeDef, iface: InterfaceDef): boolean {
  return conformanceErrors(type, iface).length === 0
}

/** Every type that could implement the interface — used to offer the honest set
 *  in the UI rather than letting someone claim a shape they don't have. */
export function typesConforming(
  types: ReadonlyArray<ObjectTypeDef>,
  iface: InterfaceDef,
): ObjectTypeDef[] {
  return types.filter((t) => implementsInterface(t, iface))
}

/** The interface's own properties as PropertyDefs, so a tool composer can offer
 *  interface-level fields without knowing which implementer it will run on. */
export function interfaceProperties(iface: InterfaceDef): PropertyDef[] {
  // Synthesised, not stored: an interface property is not a row in
  // object_type_properties, so the row-only fields are blank.
  return iface.properties.map((p) => ({
    key: p.key, label: p.label, apiName: p.key, type: p.type, required: true,
  }))
}
