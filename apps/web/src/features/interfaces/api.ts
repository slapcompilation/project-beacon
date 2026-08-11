// Interfaces — CRUD over ontology_interfaces + object_type_interfaces.
// Conformance is enforced by a database trigger; the UI checks first only so the
// operator sees why before they try.

import { supabase } from '@/lib/supabase/client'
import { saveInterface, deleteOntologyResource, type Json } from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import type { InterfaceDef, InterfacePropertyDef } from '@beacon/ontology'

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
  interface_properties: { property_id: string; display_name: string; base_type: InterfacePropertyDef['type'] }[]
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
    .select('*, interface_properties(property_id, display_name, base_type)').order('label')
  if (error) throw new Error(error.message)
  return data as InterfaceRow[]
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
      ontology_id: i.ontologyId,
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

export async function addImplementation(objectTypeId: string, interfaceId: string): Promise<void> {
  const { error } = await supabase.from('object_type_interfaces')
    .insert({ object_type_id: objectTypeId, interface_id: interfaceId })
  if (error) throw new Error(error.message)
}

export async function removeImplementation(objectTypeId: string, interfaceId: string): Promise<void> {
  const { error } = await supabase.from('object_type_interfaces').delete()
    .eq('object_type_id', objectTypeId).eq('interface_id', interfaceId)
  if (error) throw new Error(error.message)
}
