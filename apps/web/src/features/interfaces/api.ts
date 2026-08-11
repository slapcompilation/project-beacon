// Interfaces — CRUD over ontology_interfaces + object_type_interfaces.
// Conformance is enforced by a database trigger; the UI checks first only so the
// operator sees why before they try.

import { supabase } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/app.store'
import { saveInterface, deleteOntologyResource, implementInterface, type Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import type { InterfaceDef, InterfacePropertyDef } from '@beacon/ontology'

export interface LinkConstraintRow {
  api_name: string
  display_name: string
  required: boolean
  cardinality: 'ONE' | 'MANY'
  target_kind: 'interface' | 'object_type'
  target_interface_id: string | null
  target_object_type_id: string | null
}

export interface ActionConstraintRow {
  api_name: string
  display_name: string
  description: string
  required: boolean
}

export interface InterfaceRow {
  id: string
  /** An interface belongs to one ontology — the column is NOT NULL, so a list
   *  that ignored it would show another ontology's shapes. */
  ontology_id: string
  rid: string | null
  api_name: string
  label: string
  description: string
  /** Rows since migration 450 — the jsonb array is gone. */
  interface_properties: {
    property_id: string; display_name: string; base_type: InterfacePropertyDef['type']
    required: boolean; pk_constraint: 'must' | 'cannot' | 'none'; position: number
  }[]
  interface_link_constraints: LinkConstraintRow[]
  interface_action_constraints: ActionConstraintRow[]
  /** This interface's parents — "An interface inherits the shared properties…
   *  of the interface it extends". */
  extensions: { parent_interface_id: string }[]
}

export interface ImplementationRow {
  id: string
  object_type_id: string
  interface_id: string
}

export function rowToInterface(r: InterfaceRow): InterfaceDef {
  return {
    id: r.id, apiName: r.api_name,
    label: r.label, description: r.description,
    properties: r.interface_properties.map((p) => ({
      key: p.property_id, label: p.display_name, type: p.base_type,
    })),
  }
}

export async function fetchInterfaces(): Promise<InterfaceRow[]> {
  const { data, error } = await supabase.from('ontology_interfaces')
    .select(`*,
      interface_properties(property_id, display_name, base_type, required, pk_constraint, position),
      interface_link_constraints(api_name, display_name, required, cardinality, target_kind, target_interface_id, target_object_type_id),
      interface_action_constraints(api_name, display_name, description, required),
      extensions:interface_extensions!interface_extensions_interface_id_fkey(parent_interface_id)`)
    .order('label')
  if (error) throw new Error(error.message)
  return data as unknown as InterfaceRow[]
}

export async function fetchImplementations(): Promise<ImplementationRow[]> {
  const { data, error } = await supabase.from('object_type_interfaces').select('id, object_type_id, interface_id')
  if (error) throw new Error(error.message)
  return data as ImplementationRow[]
}

export interface CreateInterfaceInput {
  apiName: string
  label: string
  description: string
  properties: InterfacePropertyDef[]
  /** The ontology the manager is pointed at. Left out, the column default calls
   *  `default_ontology()`, which raises rather than guessing when there are two. */
  ontologyId: string
}

/** Staged, not written — the whole contract is one working-state entry (451),
 *  so it appears in Review edits and lands on save like every other resource. */
export async function createInterface(i: CreateInterfaceInput): Promise<string> {
  return client(saveInterface).applyAction({
    p_interface: {
      api_name: i.apiName, label: i.label, description: i.description,
      ontology_id: i.ontologyId, project_id: useAppStore.getState().omaProjectId,
      properties: i.properties.map((p, idx) => ({
        property_id: p.key, display_name: p.label, api_name: p.key,
        base_type: p.type, position: idx,
      })),
    } as unknown as Json,
  })
}

export async function deleteInterface(id: string): Promise<void> {
  await client(deleteOntologyResource).applyAction({ p_kind: 'interface', p_id: id })
}

/** Stage one clause of an existing interface. The apply deletes what a listed
 *  section omits, so callers pass the FULL set for the clause they touch;
 *  clauses left out of the payload stay untouched (absent means unedited). */
export async function stageInterfaceClauses(
  id: string,
  patch: {
    link_constraints?: LinkConstraintRow[]
    action_constraints?: ActionConstraintRow[]
    extends?: string[]
  },
): Promise<string> {
  return client(saveInterface).applyAction({
    p_interface: { id, ...patch } as unknown as Json,
  })
}

/** What the implementer declared per interface property — the wizard's five
 *  menu items. `skip` is a stored row: absence cannot say "deliberately
 *  skipped". */
export interface MappingDraft {
  property_id: string
  resolution: 'choose_existing' | 'replace_existing' | 'choose_backing_column' | 'edit_only' | 'skip'
  object_property_id?: string | null
  backing_column?: string | null
}

/** One call, one transaction: the implementation row and its mappings land
 *  together, and the commit-time conformance trigger judges the whole. A bare
 *  insert cannot pass for an interface with required properties. */
export async function addImplementation(
  objectTypeId: string, interfaceId: string, mappings: MappingDraft[],
): Promise<void> {
  await client(implementInterface).applyAction({
    p_object_type: objectTypeId, p_interface: interfaceId,
    p_mappings: mappings as unknown as Json,
  })
}

export async function removeImplementation(objectTypeId: string, interfaceId: string): Promise<void> {
  const { error } = await supabase.from('object_type_interfaces').delete()
    .eq('object_type_id', objectTypeId).eq('interface_id', interfaceId)
  if (error) throw new Error(error.message)
}
