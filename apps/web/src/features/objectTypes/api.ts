// object_types CRUD, and the datasources that back them.
// directly under RLS. org + author come from column defaults (auth_org_id /
// auth.uid), so the client sends only the definition / the record.

import { supabase } from '@/lib/supabase/client'
import {
  saveObjectType as saveObjectTypeAction, objectTypeProblems,
  saveLinkType as saveLinkTypeAction, deleteOntologyResource, type Json,
} from '@beacon/platform'
import { client } from '@/lib/supabase/ontologyClient'
import { useAppStore } from '@/stores/app.store'
import type {
  ObjectTypeDef, PropertyDef, LinkTypeDef,
  OntologyStatus, ObjectTypeStatus, OntologyVisibility, Deprecation,
  LinkBackingKind, LinkCardinality,
} from '@beacon/ontology'


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
  array_element_type: PropertyDef['type'] | null
  vector_dimension: number | null
  source: 'column' | 'user_input' | 'linked_objects'
  datasource_id: string | null
  backing_column: string | null
  derived_aggregation: string | null
  derived_from_property_id: string | null
  derived_limit: number | null
  /** The chain, one row per link. Embedded unordered, so `rowToProperty` sorts. */
  derived_property_hops?: { position: number; link_type_id: string }[]
  shared_property_id: string | null
  required: boolean
  visibility: 'prominent' | 'normal' | 'hidden'
  position: number
  is_primary_key: boolean
  is_title_key: boolean
  /** Render hints (migration 475): searchable is the parent — sortable and
   *  selectable require it. Strings sort only when sortable; numeric and date
   *  always do. */
  searchable: boolean
  sortable: boolean
  selectable: boolean
  analyzer: string
  /** Migration 458 — the same vocabulary as every resource, minus promoted. */
  status: 'active' | 'experimental' | 'deprecated' | 'example'
  deprecation_reason: string | null
  deprecation_deadline: string | null
  replaced_by: string | null
}

export function rowToProperty(r: PropertyRow): PropertyDef {
  return {
    id: r.id, key: r.property_id, label: r.display_name, apiName: r.api_name,
    type: r.base_type, arrayElementType: r.array_element_type ?? undefined,
    vectorDimension: r.vector_dimension ?? undefined,
    description: r.description, required: r.required,
    source: r.source, backingColumn: r.backing_column,
    datasourceId: r.datasource_id, sharedPropertyId: r.shared_property_id,
    hops: [...(r.derived_property_hops ?? [])]
      .sort((a, b) => a.position - b.position).map((h) => h.link_type_id),
    derivedAggregation: r.derived_aggregation,
    derivedFromPropertyId: r.derived_from_property_id,
    derivedLimit: r.derived_limit,
    visibility: r.visibility, position: r.position,
    isPrimaryKey: r.is_primary_key, isTitleKey: r.is_title_key,
    status: r.status, deprecationReason: r.deprecation_reason,
    deprecationDeadline: r.deprecation_deadline, replacedBy: r.replaced_by,
  }
}

export function propertyToRow(p: PropertyDef, position: number) {
  return {
    property_id: p.key, display_name: p.label, api_name: p.apiName,
    description: p.description ?? '', base_type: p.type,
    array_element_type: p.type === 'array' ? p.arrayElementType ?? null : null,
    // An equality in the CHECK: a vector has a dimension and nothing else
    // does, so a stale value on a retyped property refuses the row.
    vector_dimension: p.type === 'vector' ? p.vectorDimension ?? null : null,
    source: p.source ?? 'column',
    // The CHECK admits exactly three shapes: a column names one, user input
    // names a datasource and no column, and a derived property names neither —
    // "the hops carry the meaning". Sending a stale value in the wrong shape is
    // how the row gets refused.
    datasource_id: p.source === 'linked_objects' ? null : p.datasourceId ?? null,
    backing_column: p.source === 'column' ? p.backingColumn ?? null : null,
    ...(p.source === 'linked_objects' ? {
      hops: p.hops ?? [],
      derived_aggregation: p.derivedAggregation ?? null,
      derived_from_property_id: p.derivedFromPropertyId ?? null,
      derived_limit: p.derivedLimit ?? null,
    } : { hops: [], derived_aggregation: null, derived_from_property_id: null, derived_limit: null }),
    shared_property_id: p.sharedPropertyId ?? null,
    required: p.required, visibility: p.visibility ?? 'normal', position,
    is_primary_key: p.isPrimaryKey ?? false, is_title_key: p.isTitleKey ?? false,
    // Absent means unchanged: the session's status pass only touches rows
    // whose payload carries the key, so drafts without one change nothing.
    ...(p.status ? {
      status: p.status,
      deprecation_reason: p.status === 'deprecated' ? p.deprecationReason ?? null : null,
      deprecation_deadline: p.status === 'deprecated' ? p.deprecationDeadline ?? null : null,
      replaced_by: p.status === 'deprecated' ? p.replacedBy ?? null : null,
    } : {}),
  }
}

export interface ObjectTypeRow {
  id: string
  ontology_id: string
  api_name: string
  label: string
  icon: string
  icon_color: string
  plural_label: string
  point_of_contact: string | null
  contributors: string[]
  track_edit_history: boolean
  description: string
  rid: string | null
  /** Other names this type answers to — what the header search means by
   *  "Search by name, RID, aliases…". */
  aliases: string[] | null
  object_type_properties: PropertyRow[]
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
    apiName: r.api_name, label: r.label, icon: r.icon,
    iconColor: r.icon_color, pluralLabel: r.plural_label,
    pointOfContact: r.point_of_contact, contributors: r.contributors,
    trackEditHistory: r.track_edit_history, aliases: r.aliases ?? [], rid: r.rid,
    description: r.description,
    properties: [...r.object_type_properties]
      .sort((a, b) => a.position - b.position).map(rowToProperty),
    version: r.version,
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
    .select('*, object_type_properties(*, derived_property_hops(position, link_type_id))')
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
       /** Derived from the label by the surface, overridable — 598. */
       pluralLabel?: string
       properties: PropertyDef[]
       /** Which ontology this type is being created in. Required on create when
        *  the organization has more than one — `default_ontology()` refuses to
        *  guess, because a silent wrong guess writes to the wrong ontology. */
       ontologyId?: string | null
       projectId?: string | null
       /** The wizard's step-1 choice travels WITH the staged type and lands
        *  when the save does — the backing cannot be attached afterwards,
        *  because both attachment paths need the landed row and the linter
        *  refuses landing without backing (creation review, F1). */
       datasources?: { datasetId: string; branchId: string }[] },
): Promise<string> {
  return client(saveObjectTypeAction).applyAction({
    p_object_type: { id: i.id ?? null, api_name: i.apiName ?? null, label: i.label, icon: i.icon,
      plural_label: i.pluralLabel ?? null, description: i.description,
      ontology_id: i.ontologyId ?? null, project_id: i.projectId ?? null,
      ...(i.datasources ? {
        datasources: i.datasources.map((d) => ({ dataset_id: d.datasetId, branch_id: d.branchId })),
      } : {}) },
    p_properties: i.properties.map((p, idx) => propertyToRow(p, idx)) as unknown as Json,
    p_branch: useAppStore.getState().omaBranchId ?? undefined,
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
  i: { id: string; status: ObjectTypeStatus; visibility: OntologyVisibility; deprecation: Deprecation | null },
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
}

export async function updateObjectType(i: UpdateObjectTypeInput): Promise<string> {
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
  /** A link type belongs to one ontology, like everything else here. */
  ontology_id: string
  source_object_type_id: string
  target_object_type_id: string
  api_name: string
  label: string
  source_label: string | null
  target_label: string | null
  source_api_name: string | null
  target_api_name: string | null
  source_visibility: string | null
  target_visibility: string | null
  cardinality: LinkCardinality | null
  backing_kind: LinkBackingKind | null
  backing_object_type_id: string | null
  source_key_column: string | null
  target_key_column: string | null
  dataset_id: string | null
  status: string | null
  rid: string | null
}

export function rowToLinkType(r: LinkTypeRow): LinkTypeDef {
  return {
    id: r.id,
    sourceTypeId: r.source_object_type_id, targetTypeId: r.target_object_type_id,
    apiName: r.api_name, label: r.label,
    sourceLabel: r.source_label, targetLabel: r.target_label,
    sourceApiName: r.source_api_name, targetApiName: r.target_api_name,
    sourceVisibility: r.source_visibility, targetVisibility: r.target_visibility,
    cardinality: r.cardinality, backingKind: r.backing_kind,
    backingObjectTypeId: r.backing_object_type_id,
    sourceKeyColumn: r.source_key_column, targetKeyColumn: r.target_key_column,
    datasetId: r.dataset_id, status: r.status, rid: r.rid,
  }
}

export async function fetchLinkTypes(): Promise<LinkTypeRow[]> {
  const { data, error } = await supabase.from('link_types').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data as LinkTypeRow[]
}

export interface CreateLinkTypeInput {
  sourceTypeId: string; targetTypeId: string; apiName: string; label: string; ontologyId: string
  projectId?: string | null
  /** The helper's FIRST choice — the relationship type and its cardinality
   *  (create-link-type). Unset used to mean a silent many_to_many default
   *  and no backing at all; since 717 the linter refuses an undeclared
   *  relationship, so the surface collects the whole choice. */
  cardinality: string
  backingKind: 'foreign_key' | 'join_table' | 'object_backed'
  /** foreign_key: the FK column on the source type. */
  backingColumn?: string | null
  /** join_table: the dataset, its branch, and one column per primary key. */
  datasetId?: string | null
  branchId?: string | null
  sourceKeyColumn?: string | null
  targetKeyColumn?: string | null
  /** object_backed: the intermediary type. */
  backingObjectTypeId?: string | null
  /** Per-side display names — "A link type has exactly two sides". */
  sourceLabel?: string | null
  targetLabel?: string | null
  sourceApiName?: string | null
  targetApiName?: string | null
}

/** Staged, not written. The row appears in the ontology on save — until then it
 *  is an entry in the Review edits dialog like any other change. */
export async function createLinkType(i: CreateLinkTypeInput): Promise<string> {
  return client(saveLinkTypeAction).applyAction({
    p_link: {
      source_object_type_id: i.sourceTypeId, target_object_type_id: i.targetTypeId,
      api_name: i.apiName, label: i.label, ontology_id: i.ontologyId,
      project_id: i.projectId ?? null,
      cardinality: i.cardinality, backing_kind: i.backingKind,
      backing_column: i.backingColumn ?? null,
      dataset_id: i.datasetId ?? null, branch_id: i.branchId ?? null,
      source_key_column: i.sourceKeyColumn ?? null, target_key_column: i.targetKeyColumn ?? null,
      backing_object_type_id: i.backingObjectTypeId ?? null,
      source_label: i.sourceLabel ?? null, target_label: i.targetLabel ?? null,
      source_api_name: i.sourceApiName ?? null, target_api_name: i.targetApiName ?? null,
    } as unknown as Json,
    p_branch: useAppStore.getState().omaBranchId ?? undefined,
  })
}

export async function deleteLinkType(id: string): Promise<void> {
  await client(deleteOntologyResource).applyAction({ p_kind: 'link_type', p_id: id })
}

// ── Backing datasources (migration 405) ─────────────────────────────────────
// "In order to populate property values for objects of this type with data, you
// must add a backing datasource." A datasource is a dataset ON A BRANCH, and one
// may back only one object type.

/** A dataset on a branch, or a restricted view — never both (migration 484). */
export interface ObjectTypeDatasource {
  id: string
  datasetId: string | null
  branchId: string | null
  restrictedViewId: string | null
  /** Set on a media set view datasource (585), which backs media properties
   *  directly and has no dataset, no branch and nothing to join. */
  mediaSetViewRid: string | null
  /** The column holding the object type's primary key, when this datasource
   *  spells it differently from the key property. Null means inherit. */
  primaryKeyColumn: string | null
  datasetName: string
  branchName: string
  restrictedViewName: string
}

/** "The Map primary key helper will appear and prompt you for a column with
 *  values matching the primary key of the object type." Stored as an override:
 *  null means the key property's own backing column. */
export async function setDatasourcePrimaryKeyColumn(id: string, column: string | null): Promise<void> {
  const { error } = await supabase.from('object_type_datasources')
    .update({ primary_key_column: column === '' ? null : column }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function fetchObjectTypeDatasources(objectTypeId: string): Promise<ObjectTypeDatasource[]> {
  const { data, error } = await supabase.from('object_type_datasources')
    .select('id, dataset_id, branch_id, restricted_view_id, media_set_view_rid, primary_key_column, ' +
            'datasets(name), dataset_branches(name), restricted_views(name)')
    .eq('object_type_id', objectTypeId)
  if (error) throw new Error(error.message)
  return (data as unknown as {
    id: string; dataset_id: string | null; branch_id: string | null; restricted_view_id: string | null
    media_set_view_rid: string | null; primary_key_column: string | null
    datasets: { name: string } | null; dataset_branches: { name: string } | null
    restricted_views: { name: string } | null
  }[]).map((r) => ({
    id: r.id, datasetId: r.dataset_id, branchId: r.branch_id, restrictedViewId: r.restricted_view_id,
    mediaSetViewRid: r.media_set_view_rid, primaryKeyColumn: r.primary_key_column,
    datasetName: r.datasets?.name ?? '', branchName: r.dataset_branches?.name ?? '',
    restrictedViewName: r.restricted_views?.name ?? '',
  }))
}

export async function addObjectTypeDatasource(
  i: { objectTypeId: string; datasetId?: string; branchId?: string; restrictedViewId?: string
       mediaSetRid?: string; mediaSetViewRid?: string },
): Promise<void> {
  // Three backing kinds, and `one_backing` refuses any mixture of them. A media
  // set view is "an independent collection of Media Items" and carries both
  // RIDs — the set it belongs to and the view itself.
  const row = i.mediaSetRid
    ? { object_type_id: i.objectTypeId, media_set_rid: i.mediaSetRid, media_set_view_rid: i.mediaSetViewRid }
    : i.restrictedViewId
      ? { object_type_id: i.objectTypeId, restricted_view_id: i.restrictedViewId }
      : { object_type_id: i.objectTypeId, dataset_id: i.datasetId, branch_id: i.branchId }
  const { error } = await supabase.from('object_type_datasources').insert(row)
  if (error) throw new Error(error.message)
}

/** Which media datasource backs a media reference property. The binding is its
 *  own table because a property may be bound to one and a datasource may back
 *  several — `media_property_problems()` reports a media property with none. */
export async function fetchMediaBindings(objectTypeId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase.from('object_type_media_sources')
    .select('datasource_id, property_id, object_type_properties!inner(object_type_id)')
    .eq('object_type_properties.object_type_id', objectTypeId)
  if (error) throw new Error(error.message)
  return Object.fromEntries(
    (data as unknown as { datasource_id: string; property_id: string }[])
      .map((r) => [r.property_id, r.datasource_id]))
}

export async function setMediaBinding(propertyId: string, datasourceId: string | null): Promise<void> {
  const del = await supabase.from('object_type_media_sources').delete().eq('property_id', propertyId)
  if (del.error) throw new Error(del.error.message)
  if (datasourceId === null) return
  const { error } = await supabase.from('object_type_media_sources')
    .insert({ property_id: propertyId, datasource_id: datasourceId })
  if (error) throw new Error(error.message)
}

export async function removeObjectTypeDatasource(id: string): Promise<void> {
  const { error } = await supabase.from('object_type_datasources').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
