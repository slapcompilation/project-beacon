// Interfaces — CRUD over ontology_interfaces + object_type_interfaces.
// Conformance is enforced by a database trigger; the UI checks first only so the
// operator sees why before they try.

import { supabase } from '@/lib/supabase/client'
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
  properties: InterfacePropertyDef[]
}

export interface ImplementationRow {
  id: string
  object_type_id: string
  interface_id: string
}

export function rowToInterface(r: InterfaceRow): InterfaceDef {
  return {
    id: r.id, apiName: r.api_name,
    label: r.label, description: r.description, properties: r.properties,
  }
}

export async function fetchInterfaces(): Promise<InterfaceRow[]> {
  const { data, error } = await supabase.from('ontology_interfaces').select('*').order('label')
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

export async function createInterface(i: CreateInterfaceInput): Promise<InterfaceRow> {
  const { data, error } = await supabase.from('ontology_interfaces')
    .insert({
      api_name: i.apiName, label: i.label, description: i.description,
      properties: i.properties, ontology_id: i.ontologyId,
    })
    .select('*').single<InterfaceRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteInterface(id: string): Promise<void> {
  const { error } = await supabase.from('ontology_interfaces').delete().eq('id', id)
  if (error) throw new Error(error.message)
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
