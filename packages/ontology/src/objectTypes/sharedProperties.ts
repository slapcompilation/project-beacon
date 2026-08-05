// Shared properties — one definition of `cost`, used by several object types.
//
// Foundry: "A shared property is a property that can be used on multiple object
// types in your ontology... update metadata in one place instead of on each
// object type." And the sentence that decides the shape:
//
//   "While property metadata is shared across object types, THE UNDERLYING
//    OBJECT DATA IS NOT."
//
// So this resolves METADATA. Every object type still stores its own values; a
// shared property has no data of its own.

import type { PropertyDef, PropertyType } from './index'

export interface SharedPropertyDef {
  id: string
  organizationId: string
  apiName: string
  label: string
  description: string
  baseType: PropertyType
  /** prominent shows first, hidden does not appear. Foundry's words. */
  visibility: 'prominent' | 'normal' | 'hidden'
}

/** A property once its shared definition has been folded in. `key` and
 *  `required` are the object type's own; the rest may be inherited. */
export interface ResolvedProperty {
  key: string
  label: string
  type: PropertyType
  required: boolean
  description: string
  visibility: 'prominent' | 'normal' | 'hidden'
  /** The definition it inherits from, when it has one. */
  shared: string | null
}

/** Fields the object type may no longer edit while attached. Foundry: "direct
 *  edits to property metadata that is inherited from the shared property will be
 *  disabled." An editable copy is the drift shared properties exist to remove. */
export const INHERITED_FIELDS = ['label', 'type', 'description', 'visibility'] as const

/** Fold a shared definition into a property. The property's `key` is NEVER
 *  touched — "the property ID and API name of the object-specific property will
 *  remain unchanged so as to not break existing downstream workflows". A widget
 *  bound to `unit_cost` keeps working when it starts inheriting from `cost`. */
export function resolveProperty(
  p: PropertyDef, shared: ReadonlyMap<string, SharedPropertyDef>,
): ResolvedProperty {
  const def = p.shared ? shared.get(p.shared) : undefined
  return {
    key: p.key,
    required: p.required,
    shared: p.shared ?? null,
    label:       def?.label ?? p.label,
    type:        def?.baseType ?? p.type,
    description: def?.description ?? p.description ?? '',
    visibility:  def?.visibility ?? p.visibility ?? 'normal',
  }
}

export function resolveProperties(
  properties: PropertyDef[], shared: ReadonlyMap<string, SharedPropertyDef>,
): ResolvedProperty[] {
  return properties.map((p) => resolveProperty(p, shared))
}

/** Why attaching would be refused, or null when it is allowed. The database
 *  enforces this (migration 329); saying it here turns a thrown error into a
 *  disabled option with a reason. */
export function attachProblem(p: PropertyDef, def: SharedPropertyDef): string | null {
  // "Base types are related to the underlying column type and must match the
  // column type in order to be applied on an object type."
  if (p.type !== def.baseType) {
    return `"${p.label}" is a ${p.type} property; "${def.apiName}" is ${def.baseType}. The base types have to match.`
  }
  return null
}

/** Object types whose properties inherit from this definition — what changing
 *  it will move, and what stops it being deleted. */
export function usedBy<T extends { label: string; properties: PropertyDef[] }>(
  apiName: string, types: T[],
): T[] {
  return types.filter((t) => t.properties.some((p) => p.shared === apiName))
}
