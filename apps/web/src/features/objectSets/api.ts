// Named object sets — cohorts. The definition is data; membership is computed
// by selectObjectSet in reality-graph, never here and never materialised.

import { supabase } from '@/lib/supabase/client'
import type { ObjectSetDef, SetFilter, SetParamDef } from '@beacon/reality-graph'

export interface ObjectSetRow {
  id: string
  organization_id: string
  hotel_id: string | null
  name: string
  api_name: string
  description: string
  /** Exactly one is set: one type, or an interface (every implementer). */
  subject_type_id: string | null
  subject_interface_id: string | null
  parameters: SetParamDef[]
  filters: SetFilter[]
  created_at: string
}

export function rowToObjectSet(r: ObjectSetRow): ObjectSetDef {
  return {
    id: r.id, organizationId: r.organization_id, hotelId: r.hotel_id,
    name: r.name, apiName: r.api_name, description: r.description,
    subjectTypeId: r.subject_type_id, subjectInterfaceId: r.subject_interface_id,
    parameters: r.parameters, filters: r.filters,
  }
}

export async function fetchObjectSets(): Promise<ObjectSetRow[]> {
  const { data, error } = await supabase
    .from('object_sets').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ObjectSetRow[]
}

export interface CreateObjectSetInput {
  name: string
  apiName: string
  description: string
  subjectTypeId: string | null
  subjectInterfaceId: string | null
  parameters: SetParamDef[]
  filters: SetFilter[]
}

/** org + author land from column DEFAULTs, so the client sends only the set. */
export async function createObjectSet(i: CreateObjectSetInput): Promise<ObjectSetRow> {
  const { data, error } = await supabase.from('object_sets')
    .insert({
      name: i.name, api_name: i.apiName, description: i.description,
      subject_type_id: i.subjectTypeId, subject_interface_id: i.subjectInterfaceId,
      parameters: i.parameters, filters: i.filters,
    })
    .select('*').single<ObjectSetRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteObjectSet(id: string): Promise<void> {
  const { error } = await supabase.from('object_sets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
