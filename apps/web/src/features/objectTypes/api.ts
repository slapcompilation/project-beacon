// object_types CRUD, and the datasources that back them.
// directly under RLS. org + author come from column defaults (auth_org_id /
// auth.uid), so the client sends only the definition / the record.

import { supabase } from '@/lib/supabase/client'
import {
  saveObjectType as saveObjectTypeAction, objectTypeProblems,
  saveLinkType as saveLinkTypeAction, deleteOntologyResource, type Json,
} from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import type {
  ObjectTypeDef, PropertyDef, LinkTypeDef, ComputedPropertyDef, ViewConfigDef,
  OntologyStatus, OntologyVisibility, Deprecation,
} from '@beacon/ontology'
import { EMPTY_VIEW_CONFIG } from '@beacon/ontology'

/** One row of `object_type_properties` (migration 408). Properties left the
 *  object type's jsonb because Foundry gives each its own ID, API name, base
 *  type, source and backing column — none of which a blob can be asked about. */
export interface PropertyRow {
  id: string
  property_id: string
  display_name: string
  api_name: string
  description: string
  base_type: PropertyDef['type']
  source: 'column' | 'user_input'
  datasource_id: string | null
  backing_column: string | null
  shared_property_id: string | null
  required: boolean
  visibility: 'prominent' | 'normal' | 'hidden'
  position: number
  is_primary_key: boolean
  is_title_key: boolean
}

export function rowToProperty(r: PropertyRow): PropertyDef {
  return {
    id: r.id, key: r.property_id, label: r.display_name, apiName: r.api_name,
    type: r.base_type, description: r.description, required: r.required,
    source: r.source, backingColumn: r.backing_column,
    datasourceId: r.datasource_id, sharedPropertyId: r.shared_property_id,
    visibility: r.visibility, position: r.position,
    isPrimaryKey: r.is_primary_key, isTitleKey: r.is_title_key,
  }
}

export function propertyToRow(p: PropertyDef, position: number) {
  return {
    property_id: p.key, display_name: p.label, api_name: p.apiName,
    description: p.description ?? '', base_type: p.type,
    source: p.source ?? 'column',
    datasource_id: p.datasourceId ?? null,
    backing_column: p.source === 'user_input' ? null : p.backingColumn ?? null,
    shared_property_id: p.sharedPropertyId ?? null,
    required: p.required, visibility: p.visibility ?? 'normal', position,
    is_primary_key: p.isPrimaryKey ?? false, is_title_key: p.isTitleKey ?? false,
  }
}

export interface ObjectTypeRow {
  id: string
  ontology_id: string
  api_name: string
  label: string
  icon: string
  description: string
  object_type_properties: PropertyRow[]
  computed_properties: ComputedPropertyDef[] | null
  view_config: ViewConfigDef | null
  enabled: boolean
  version: number
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
    id: r.id, ontologyId: r.ontology_id,
    apiName: r.api_name, label: r.label, icon: r.icon, description: r.description,
    properties: [...r.object_type_properties]
      .sort((a, b) => a.position - b.position).map(rowToProperty),
    computedProperties: r.computed_properties ?? [],
    viewConfig: r.view_config ?? EMPTY_VIEW_CONFIG,
    enabled: r.enabled, version: r.version,
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
  const { data, error } = await supabase.from('object_types')
    .select('*, object_type_properties(*)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as ObjectTypeRow[]
}



/** One call, because the completeness contract is one list over the type and its
 *  properties: "To save a new object type, these object type fields must not be
 *  empty… And these property fields must not be empty…" A client that wrote the
 *  type first and its properties second would pass through the state that list
 *  forbids, and stay there if the second write failed. */
export async function saveObjectType(
  i: { id?: string; apiName?: string; label: string; icon: string; description: string
       properties: PropertyDef[]
       /** Which ontology this type is being created in. Required on create when
        *  the organization has more than one — `default_ontology()` refuses to
        *  guess, because a silent wrong guess writes to the wrong ontology. */
       ontologyId?: string | null },
): Promise<string> {
  return client(saveObjectTypeAction).applyAction({
    p_object_type: { id: i.id ?? null, api_name: i.apiName ?? null, label: i.label, icon: i.icon, description: i.description, ontology_id: i.ontologyId ?? null },
    p_properties: i.properties.map((p, idx) => propertyToRow(p, idx)) as unknown as Json,
  })
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

export async function updateObjectType(i: UpdateObjectTypeInput): Promise<string> {
  const { error } = await supabase.from('object_types')
    .update({ computed_properties: i.computedProperties, view_config: i.viewConfig })
    .eq('id', i.id)
  if (error) throw new Error(error.message)
  return saveObjectType(i)
}

/** Every reason this type cannot be saved — the `❗4 errors` badge's contents.
 *  The rule lives in `object_type_problems()`; restating it here is how the two
 *  drift. */
export interface ObjectTypeProblem { scope: 'object_type' | 'property'; subject: string; problem: string }

export async function fetchObjectTypeProblems(id: string): Promise<ObjectTypeProblem[]> {
  const rows = await client(objectTypeProblems).executeFunction({ p_object_type: id })
  return rows as ObjectTypeProblem[]
}

export interface LinkTypeRow {
  id: string
  source_object_type_id: string
  target_object_type_id: string
  api_name: string
  label: string
}

export function rowToLinkType(r: LinkTypeRow): LinkTypeDef {
  return {
    id: r.id,
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

/** Staged, not written. The row appears in the ontology on save — until then it
 *  is an entry in the Review edits dialog like any other change. */
export async function createLinkType(i: CreateLinkTypeInput): Promise<string> {
  return client(saveLinkTypeAction).applyAction({
    p_link: {
      source_object_type_id: i.sourceTypeId, target_object_type_id: i.targetTypeId,
      api_name: i.apiName, label: i.label,
    } as unknown as Json,
  })
}

export async function deleteLinkType(id: string): Promise<void> {
  await client(deleteOntologyResource).applyAction({ p_kind: 'link_type', p_id: id })
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
