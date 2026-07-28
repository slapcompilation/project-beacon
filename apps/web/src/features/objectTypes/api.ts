// object_types + object_records CRUD. Config-as-data ontology (P2): written
// directly under RLS. org + author come from column defaults (auth_org_id /
// auth.uid), so the client sends only the definition / the record.

import { supabase } from '@/lib/supabase/client'
import type { ObjectTypeDef, PropertyDef, LinkTypeDef, ComputedPropertyDef, ViewConfigDef } from '@beacon/reality-graph'
import { EMPTY_VIEW_CONFIG } from '@beacon/reality-graph'

export interface ObjectTypeRow {
  id: string
  organization_id: string
  hotel_id: string | null
  api_name: string
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
  computed_properties: ComputedPropertyDef[] | null
  view_config: ViewConfigDef | null
  enabled: boolean
  version: number
  /** authored = operator-defined, records in object_records.
   *  builtin  = code-owned registration; records live in source_table. */
  kind: 'authored' | 'builtin'
  source_table: string | null
  created_by_user_id: string
  created_at: string
  updated_at: string
}

export function rowToObjectType(r: ObjectTypeRow): ObjectTypeDef {
  return {
    id: r.id, organizationId: r.organization_id, hotelId: r.hotel_id,
    apiName: r.api_name, label: r.label, icon: r.icon, description: r.description,
    properties: r.properties, computedProperties: r.computed_properties ?? [],
    viewConfig: r.view_config ?? EMPTY_VIEW_CONFIG,
    enabled: r.enabled, version: r.version,
    kind: r.kind, sourceTable: r.source_table,
  }
}

/** Authored types only — what the operator owns and can edit. The built-in
 *  registrations (migration 223) are code-owned and would otherwise appear as
 *  empty editable types in the browser and the type editor. */
export async function fetchObjectTypes(): Promise<ObjectTypeRow[]> {
  const { data, error } = await supabase.from('object_types').select('*')
    .eq('kind', 'authored').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ObjectTypeRow[]
}

/** The WHOLE ontology — authored types plus the built-in registrations. Used
 *  where the point is the ontology itself: the canvas, and link-type endpoints
 *  (a Maintenance Request may now link to a Variant). */
export async function fetchOntologyTypes(): Promise<ObjectTypeRow[]> {
  const { data, error } = await supabase.from('object_types').select('*')
    .order('kind', { ascending: true }).order('label', { ascending: true })
  if (error) throw new Error(error.message)
  return data as ObjectTypeRow[]
}

// For the /objects browser: each custom type + how many records it holds.
export interface ObjectTypeCard { id: string; apiName: string; label: string; icon: string; count: number }

export async function fetchObjectTypeCards(): Promise<ObjectTypeCard[]> {
  const { data, error } = await supabase
    .from('object_types')
    .select('id, api_name, label, icon, object_records(count)')
    .eq('kind', 'authored')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  interface Row { id: string; api_name: string; label: string; icon: string; object_records: { count: number }[] | null }
  return (data as unknown as Row[]).map((r) => ({
    id: r.id, apiName: r.api_name, label: r.label, icon: r.icon, count: r.object_records?.[0]?.count ?? 0,
  }))
}

export interface CreateObjectTypeInput {
  hotelId: string | null
  apiName: string
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
  computedProperties: ComputedPropertyDef[]
}

export async function createObjectType(i: CreateObjectTypeInput): Promise<ObjectTypeRow> {
  const { data, error } = await supabase
    .from('object_types')
    .insert({ hotel_id: i.hotelId, api_name: i.apiName, label: i.label, icon: i.icon, description: i.description, properties: i.properties, computed_properties: i.computedProperties })
    .select('*')
    .single<ObjectTypeRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteObjectType(id: string): Promise<void> {
  const { error } = await supabase.from('object_types').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Schema edits + revision history (P2.5) ───────────────────────────────────
// Version bumps + snapshots happen in DB triggers (migration 217) — the client
// just writes the new shape and re-reads.

export interface UpdateObjectTypeInput {
  id: string
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
  computedProperties: ComputedPropertyDef[]
  viewConfig: ViewConfigDef
}

export async function updateObjectType(i: UpdateObjectTypeInput): Promise<ObjectTypeRow> {
  const { data, error } = await supabase
    .from('object_types')
    .update({ label: i.label, icon: i.icon, description: i.description, properties: i.properties, computed_properties: i.computedProperties, view_config: i.viewConfig })
    .eq('id', i.id)
    .select('*')
    .single<ObjectTypeRow>()
  if (error) throw new Error(error.message)
  return data
}

export interface ObjectTypeRevisionRow {
  id: string
  object_type_id: string
  version: number
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
  computed_properties: ComputedPropertyDef[]
  view_config: ViewConfigDef | null
  changed_by_user_id: string | null
  created_at: string
}

export async function fetchRevisions(objectTypeId: string): Promise<ObjectTypeRevisionRow[]> {
  const { data, error } = await supabase
    .from('object_type_revisions')
    .select('*')
    .eq('object_type_id', objectTypeId)
    .order('version', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ObjectTypeRevisionRow[]
}

/** Restore = write the old snapshot's schema back onto the live row. The bump
 *  trigger mints a NEW version and snapshots it — history is never rewritten. */
export async function restoreRevision(rev: ObjectTypeRevisionRow): Promise<ObjectTypeRow> {
  return await updateObjectType({
    id: rev.object_type_id,
    label: rev.label,
    icon: rev.icon,
    description: rev.description,
    properties: rev.properties,
    computedProperties: rev.computed_properties,
    viewConfig: rev.view_config ?? EMPTY_VIEW_CONFIG,
  })
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

/** Records for several types in one read — what an interface-targeted tool needs,
 *  since its record set spans every implementer. */
export async function fetchObjectRecordsForTypes(typeIds: string[]): Promise<ObjectRecordRow[]> {
  if (typeIds.length === 0) return []
  const { data, error } = await supabase
    .from('object_records').select('id, object_type_id, hotel_id, title, data, created_at')
    .in('object_type_id', typeIds)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ObjectRecordRow[]
}

/** A built-in type's record, read from its backing table and shaped like an
 *  object_records row so the generated view consumes it unchanged.
 *
 *  Goes through PostgREST under the caller's JWT, so each table's own RLS still
 *  decides what is visible — never a service-role shortcut. */
export async function fetchBuiltinRecord(
  type: ObjectTypeDef, id: string,
): Promise<ObjectRecordRow | null> {
  if (!type.sourceTable) return null
  // The table name is data, so PostgREST can't type this — say so explicitly
  // rather than letting an `any` leak into the record shape.
  const { data, error } = await supabase
    .from(type.sourceTable).select('*').eq('id', id).maybeSingle() as unknown as {
      data: Record<string, unknown> | null
      error: { message: string } | null
    }
  if (error) throw new Error(error.message)
  if (!data) return null

  const row = data
  // Provisional title: the first text property. G2 replaces this with the
  // explicit title key Foundry requires on every object type.
  const titleKey = type.properties.find((p) => p.type === 'text')?.key
  const raw = titleKey ? row[titleKey] : undefined
  const title = typeof raw === 'string' && raw !== '' ? raw : `${type.label} ${id.slice(0, 8)}`

  return {
    id,
    object_type_id: type.id,
    hotel_id: typeof row.hotel_id === 'string' ? row.hotel_id : null,
    title,
    data: row,
    created_at: typeof row.created_at === 'string' ? row.created_at : '',
  }
}

export async function fetchObjectRecord(id: string): Promise<ObjectRecordRow | null> {
  const { data, error } = await supabase
    .from('object_records').select('id, object_type_id, hotel_id, title, data, created_at')
    .eq('id', id).maybeSingle<ObjectRecordRow>()
  if (error) throw new Error(error.message)
  return data
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

// ── Link types + links (P2.3) ────────────────────────────────────────────────

export interface LinkTypeRow {
  id: string
  organization_id: string
  hotel_id: string | null
  source_object_type_id: string
  target_object_type_id: string
  api_name: string
  label: string
}

export function rowToLinkType(r: LinkTypeRow): LinkTypeDef {
  return {
    id: r.id, organizationId: r.organization_id, hotelId: r.hotel_id,
    sourceTypeId: r.source_object_type_id, targetTypeId: r.target_object_type_id,
    apiName: r.api_name, label: r.label,
  }
}

export async function fetchLinkTypes(): Promise<LinkTypeRow[]> {
  const { data, error } = await supabase.from('link_types').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as LinkTypeRow[]
}

export interface CreateLinkTypeInput { hotelId: string | null; sourceTypeId: string; targetTypeId: string; apiName: string; label: string }

export async function createLinkType(i: CreateLinkTypeInput): Promise<LinkTypeRow> {
  const { data, error } = await supabase.from('link_types')
    .insert({ hotel_id: i.hotelId, source_object_type_id: i.sourceTypeId, target_object_type_id: i.targetTypeId, api_name: i.apiName, label: i.label })
    .select('*').single<LinkTypeRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteLinkType(id: string): Promise<void> {
  const { error } = await supabase.from('link_types').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export interface RecordLink { id: string; linkTypeLabel: string; targetRecordId: string; targetTitle: string }

export async function fetchLinksForRecord(sourceRecordId: string): Promise<RecordLink[]> {
  const { data, error } = await supabase.from('object_links')
    .select('id, target_record_id, link_types(label)')
    .eq('source_record_id', sourceRecordId)
  if (error) throw new Error(error.message)
  interface Row { id: string; target_record_id: string; link_types: { label: string } | { label: string }[] | null }
  const rows = data as unknown as Row[]
  const ids = [...new Set(rows.map((r) => r.target_record_id))]
  const titles = new Map<string, string>()
  if (ids.length > 0) {
    const { data: recs } = await supabase.from('object_records').select('id, title').in('id', ids)
    for (const rec of (recs ?? []) as { id: string; title: string }[]) titles.set(rec.id, rec.title)
  }
  return rows.map((r) => {
    const lt = Array.isArray(r.link_types) ? r.link_types[0] : r.link_types
    return { id: r.id, linkTypeLabel: lt?.label ?? 'link', targetRecordId: r.target_record_id, targetTitle: titles.get(r.target_record_id) ?? '(record)' }
  })
}

export interface CreateObjectLinkInput { linkTypeId: string; hotelId: string | null; sourceRecordId: string; targetRecordId: string }

export async function createObjectLink(i: CreateObjectLinkInput): Promise<void> {
  const { error } = await supabase.from('object_links')
    .insert({ link_type_id: i.linkTypeId, hotel_id: i.hotelId, source_record_id: i.sourceRecordId, target_record_id: i.targetRecordId })
  if (error) throw new Error(error.message)
}

export async function deleteObjectLink(id: string): Promise<void> {
  const { error } = await supabase.from('object_links').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
