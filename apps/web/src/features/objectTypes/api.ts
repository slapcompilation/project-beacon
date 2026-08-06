// object_types CRUD, and the datasources that back them.
// directly under RLS. org + author come from column defaults (auth_org_id /
// auth.uid), so the client sends only the definition / the record.

import { supabase } from '@/lib/supabase/client'
import type {
  ObjectTypeDef, PropertyDef, LinkTypeDef, ComputedPropertyDef, ViewConfigDef,
  OntologyStatus, OntologyVisibility, Deprecation,
} from '@beacon/ontology'
import { EMPTY_VIEW_CONFIG } from '@beacon/ontology'

export interface ObjectTypeRow {
  id: string
  organization_id: string
  api_name: string
  label: string
  icon: string
  description: string
  properties: PropertyDef[]
  computed_properties: ComputedPropertyDef[] | null
  view_config: ViewConfigDef | null
  enabled: boolean
  version: number
  title_key: string | null
  /** Developmental state (migration 321). Anything new starts experimental. */
  status: OntologyStatus
  visibility: OntologyVisibility
  deprecation_reason: string | null
  deprecation_deadline: string | null
  replaced_by: string | null
  created_by_user_id: string | null
  created_at: string
  updated_at: string
}

export function rowToObjectType(r: ObjectTypeRow): ObjectTypeDef {
  return {
    id: r.id, organizationId: r.organization_id,
    apiName: r.api_name, label: r.label, icon: r.icon, description: r.description,
    properties: r.properties, computedProperties: r.computed_properties ?? [],
    viewConfig: r.view_config ?? EMPTY_VIEW_CONFIG,
    enabled: r.enabled, version: r.version,
    titleKey: r.title_key,
    status: r.status, visibility: r.visibility,
    deprecation: r.deprecation_reason && r.deprecation_deadline
      ? { reason: r.deprecation_reason, deadline: r.deprecation_deadline, replacedBy: r.replaced_by }
      : null,
  }
}

/** Every object type. There is no authored-versus-built-in split: "Foundry
 *  classifies object types by their datasource and has no notion of a built-in
 *  one", so the two readers that used to differ now agree. */
export async function fetchObjectTypes(): Promise<ObjectTypeRow[]> {
  const { data, error } = await supabase.from('object_types').select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ObjectTypeRow[]
}

export interface CreateObjectTypeInput {
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
    .insert({ api_name: i.apiName, label: i.label, icon: i.icon, description: i.description, properties: i.properties, computed_properties: i.computedProperties })
    .select('*')
    .single<ObjectTypeRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteObjectType(id: string): Promise<void> {
  const { error } = await supabase.from('object_types').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Retire a type instead of deleting it. The database refuses a deprecation
 *  with no reason or deadline, and refuses to delete anything active — this is
 *  the surface that makes both reachable. */
export async function setObjectTypeStatus(
  i: { id: string; status: OntologyStatus; visibility: OntologyVisibility; deprecation: Deprecation | null },
): Promise<void> {
  const { error } = await supabase.from('object_types').update({
    status: i.status,
    visibility: i.visibility,
    deprecation_reason:   i.status === 'deprecated' ? i.deprecation?.reason ?? null : null,
    deprecation_deadline: i.status === 'deprecated' ? i.deprecation?.deadline ?? null : null,
    replaced_by:          i.status === 'deprecated' ? i.deprecation?.replacedBy ?? null : null,
  }).eq('id', i.id)
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

export interface LinkTypeRow {
  id: string
  organization_id: string
  source_object_type_id: string
  target_object_type_id: string
  api_name: string
  label: string
}

export function rowToLinkType(r: LinkTypeRow): LinkTypeDef {
  return {
    id: r.id, organizationId: r.organization_id,
    sourceTypeId: r.source_object_type_id, targetTypeId: r.target_object_type_id,
    apiName: r.api_name, label: r.label,
  }
}

export async function fetchLinkTypes(): Promise<LinkTypeRow[]> {
  const { data, error } = await supabase.from('link_types').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as LinkTypeRow[]
}

export interface CreateLinkTypeInput { sourceTypeId: string; targetTypeId: string; apiName: string; label: string }

export async function createLinkType(i: CreateLinkTypeInput): Promise<LinkTypeRow> {
  const { data, error } = await supabase.from('link_types')
    .insert({ source_object_type_id: i.sourceTypeId, target_object_type_id: i.targetTypeId, api_name: i.apiName, label: i.label })
    .select('*').single<LinkTypeRow>()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteLinkType(id: string): Promise<void> {
  const { error } = await supabase.from('link_types').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Backing datasources (migration 405) ─────────────────────────────────────
// "In order to populate property values for objects of this type with data, you
// must add a backing datasource." A datasource is a dataset ON A BRANCH, and one
// may back only one object type.

export interface ObjectTypeDatasource {
  id: string
  datasetId: string
  branchId: string
  datasetName: string
  branchName: string
}

export async function fetchObjectTypeDatasources(objectTypeId: string): Promise<ObjectTypeDatasource[]> {
  const { data, error } = await supabase.from('object_type_datasources')
    .select('id, dataset_id, branch_id, datasets(name), dataset_branches(name)')
    .eq('object_type_id', objectTypeId)
  if (error) throw new Error(error.message)
  return (data as unknown as {
    id: string; dataset_id: string; branch_id: string
    datasets: { name: string } | null; dataset_branches: { name: string } | null
  }[]).map((r) => ({
    id: r.id, datasetId: r.dataset_id, branchId: r.branch_id,
    datasetName: r.datasets?.name ?? '', branchName: r.dataset_branches?.name ?? '',
  }))
}

export async function addObjectTypeDatasource(
  i: { objectTypeId: string; datasetId: string; branchId: string },
): Promise<void> {
  const { error } = await supabase.from('object_type_datasources')
    .insert({ object_type_id: i.objectTypeId, dataset_id: i.datasetId, branch_id: i.branchId })
  if (error) throw new Error(error.message)
}

export async function removeObjectTypeDatasource(id: string): Promise<void> {
  const { error } = await supabase.from('object_type_datasources').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
