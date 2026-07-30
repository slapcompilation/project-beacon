// Named object sets — cohorts. The definition is data; membership is computed
// by selectObjectSet in reality-graph, never here and never materialised.

import { supabase } from '@/lib/supabase/client'
import { selectObjectSet, type ObjectSetDef, type SetFilter, type SetParamDef } from '@beacon/reality-graph'
import {
  fetchBuiltinRecords, fetchObjectRecordsForTypes, rowToObjectType, type ObjectTypeRow,
} from '@/features/objectTypes/api'

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

/** Members of the given cohorts, as the id set each automation fires on.
 *
 *  Plain async rather than a hook: the intelligence cycle resolves these inside
 *  a mutation, and a cohort-backed automation that silently saw no membership
 *  would look like a healthy quiet run instead of a missing input.
 */
export async function resolveCohortMembers(setIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>()
  if (setIds.length === 0) return out

  const { data, error } = await supabase.from('object_sets').select('*').in('id', setIds)
  if (error) throw new Error(error.message)
  const sets = (data as ObjectSetRow[]).filter((s) => s.subject_type_id !== null)
  if (sets.length === 0) return out

  const { data: typeRows, error: typeErr } = await supabase
    .from('object_types').select('*').in('id', sets.map((s) => s.subject_type_id as string))
  if (typeErr) throw new Error(typeErr.message)
  const types = new Map((typeRows as ObjectTypeRow[]).map((t) => [t.id, rowToObjectType(t)]))

  for (const s of sets) {
    const type = types.get(s.subject_type_id as string)
    if (!type) continue
    const records = type.kind === 'builtin'
      ? (await fetchBuiltinRecords(type)).rows
      : await fetchObjectRecordsForTypes([type.id])
    const selection = selectObjectSet(rowToObjectSet(s), [{ type, records: records.map((r) => r.data) }])
    // A member with no string id can't be matched to a reading, so it isn't one.
    out.set(s.id, new Set(selection.records.flatMap((r) => (typeof r.id === 'string' ? [r.id] : []))))
  }
  return out
}
