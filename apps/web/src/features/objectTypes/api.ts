// object_types + object_records CRUD. Config-as-data ontology (P2): written
// directly under RLS. org + author come from column defaults (auth_org_id /
// auth.uid), so the client sends only the definition / the record.

import { supabase } from '@/lib/supabase/client'
import type { ObjectTypeDef, PropertyDef } from '@beacon/reality-graph'

export interface ObjectTypeRow {
  id: string
  organization_id: string
  hotel_id: string | null
  api_name: string
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
  enabled: boolean
  version: number
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export function rowToObjectType(r: ObjectTypeRow): ObjectTypeDef {
  return {
    id: r.id, organizationId: r.organization_id, hotelId: r.hotel_id,
    apiName: r.api_name, label: r.label, icon: r.icon, description: r.description,
    properties: r.properties, enabled: r.enabled, version: r.version,
  }
}

export async function fetchObjectTypes(): Promise<ObjectTypeRow[]> {
  const { data, error } = await supabase.from('object_types').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ObjectTypeRow[]
}

export interface CreateObjectTypeInput {
  hotelId: string | null
  apiName: string
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
}

export async function createObjectType(i: CreateObjectTypeInput): Promise<ObjectTypeRow> {
  const { data, error } = await supabase
    .from('object_types')
    .insert({ hotel_id: i.hotelId, api_name: i.apiName, label: i.label, icon: i.icon, description: i.description, properties: i.properties })
    .select('*')
    .single<ObjectTypeRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteObjectType(id: string): Promise<void> {
  const { error } = await supabase.from('object_types').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export interface ObjectRecordRow {
  id: string
  object_type_id: string
  hotel_id: string | null
  title: string
  data: Record<string, unknown>
  created_at: string
}

export async function fetchObjectRecords(objectTypeId: string): Promise<ObjectRecordRow[]> {
  const { data, error } = await supabase
    .from('object_records').select('id, object_type_id, hotel_id, title, data, created_at')
    .eq('object_type_id', objectTypeId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ObjectRecordRow[]
}

export interface CreateObjectRecordInput {
  objectTypeId: string
  hotelId: string | null
  title: string
  data: Record<string, unknown>
}

export async function createObjectRecord(i: CreateObjectRecordInput): Promise<ObjectRecordRow> {
  const { data, error } = await supabase
    .from('object_records')
    .insert({ object_type_id: i.objectTypeId, hotel_id: i.hotelId, title: i.title, data: i.data })
    .select('id, object_type_id, hotel_id, title, data, created_at')
    .single<ObjectRecordRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteObjectRecord(id: string): Promise<void> {
  const { error } = await supabase.from('object_records').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
