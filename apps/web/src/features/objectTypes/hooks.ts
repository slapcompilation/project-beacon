// Object types, link types, and the datasources that back them.
//
// Halved by migration 405. Everything to do with object_records,
// object_type_revisions and object_links went with the tables themselves
// (migrations 382/385/387) — those hooks had been querying dropped tables since,
// invisibly, because check:surfaces walks the import graph at file granularity
// and the file was still reachable.
//
// The authored-versus-built-in split went too: "Foundry classifies object types
// by their datasource and has no notion of a built-in one", so the two readers
// that used to differ now agree.

import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useComposeBranch } from '@/features/branching/api'
import { STATUS_META } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'
import { toSlug } from '@beacon/ontology'
import type { Backing } from './BackingStep'
import {
  fetchObjectTypes, saveObjectType, deleteObjectType, setObjectTypeStatus, updateObjectType,
  fetchObjectTypeProblems,
  fetchLinkTypes, createLinkType, deleteLinkType,
  fetchObjectTypeDatasources, addObjectTypeDatasource, removeObjectTypeDatasource,
  setDatasourcePrimaryKeyColumn, fetchMediaBindings, setMediaBinding,
  type UpdateObjectTypeInput, type CreateLinkTypeInput, type LinkTypeRow,
} from './api'

const keys = {
  types: ['object-types'] as const,
  linkTypes: ['link-types'] as const,
  datasources: (typeId: string) => ['object-type-datasources', typeId] as const,
  problems: (typeId: string) => ['object-type-problems', typeId] as const,
}

export function useObjectTypes() {
  return useQuery({ queryKey: keys.types, queryFn: fetchObjectTypes, staleTime: 30_000 })
}

export function useCreateObjectType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Parameters<typeof saveObjectType>[0]) => saveObjectType(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.types }); toast.success('Object type created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** The `❗4 errors` badge. Asked of the database, because that is where the
 *  completeness contract lives. */
export function useObjectTypeProblems(typeId: string | null) {
  return useQuery({
    queryKey: keys.problems(typeId ?? ''),
    queryFn: () => fetchObjectTypeProblems(typeId as string),
    enabled: !!typeId,
  })
}

export function useDeleteObjectType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteObjectType(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.types }); toast.success('Object type deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetObjectTypeStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: Parameters<typeof setObjectTypeStatus>[0]) => setObjectTypeStatus(i),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: keys.types })
      toast.success(`Status set to ${STATUS_META[v.status].label}`)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** "There is the option to also apply the `active` status to all properties
 *  on the object type" — an option at activation time, never a cascade
 *  (active never cascades on its own). */
export function useApplyActiveToProperties(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('object_type_properties')
        .update({ status: 'active' }).eq('object_type_id', typeId)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.types }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useUpdateObjectType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateObjectTypeInput) => updateObjectType(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.types })
      toast.success('Saved')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useLinkTypes() {
  const q = useQuery({ queryKey: keys.linkTypes, queryFn: fetchLinkTypes, staleTime: 30_000 })
  // On a branch the list shows the branch's version (461's overlay).
  const compose = useComposeBranch<LinkTypeRow>('link_type', {})
  const data = useMemo(() => compose(q.data ?? []), [q.data, compose])
  return { ...q, data }
}

export function useCreateLinkType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateLinkTypeInput) => createLinkType(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.linkTypes }); toast.success('Link type created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteLinkType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteLinkType(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.linkTypes }); toast.success('Link type deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

// ── Backing datasources ──────────────────────────────────────────────────────

export function useObjectTypeDatasources(objectTypeId: string | null) {
  return useQuery({
    queryKey: keys.datasources(objectTypeId ?? ''),
    enabled: objectTypeId !== null,
    queryFn: () => fetchObjectTypeDatasources(objectTypeId ?? ''),
  })
}

export function useAddObjectTypeDatasource(objectTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { datasetId?: string; branchId?: string; restrictedViewId?: string
                      mediaSetRid?: string; mediaSetViewRid?: string }) =>
      addObjectTypeDatasource({ objectTypeId, ...i }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.datasources(objectTypeId) })
      toast.success('Backing datasource added')
    },
    // The database raises Phonograph2:DatasetAndBranchAlreadyRegistered and the
    // two limit errors by name; showing them verbatim beats a generic failure.
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Step 1 of the create wizard, resolved BEFORE the type is staged: the
 *  staged payload carries the backing inline, and both land together on save.
 *  The old order — stage, then attach — deadlocked, because both attachment
 *  paths need the landed row and the linter refuses landing without backing
 *  (creation review, F1). The generate branch makes the empty dataset first,
 *  the way 590 does: dataset + master branch in the chosen folder, empty
 *  because that is the point. */
export function useResolveBacking() {
  const organizationId = useAuthStore((s) => s.organizationId)
  return async (
    b: Backing, projectId: string | null, typeLabel: string,
  ): Promise<{ datasetId: string; branchId: string }> => {
    if (b.kind === 'existing') {
      if (!b.datasetId || !b.branchId) {
        throw new Error('Choose the dataset and branch that back this type.')
      }
      return { datasetId: b.datasetId, branchId: b.branchId }
    }
    if (!organizationId || !projectId) {
      throw new Error('Choose a project first — the backing dataset needs a location.')
    }
    const name = b.name.trim() || `${typeLabel.trim() || 'Backing'} backing`
    const { data, error } = await supabase.from('datasets').insert({
      organization_id: organizationId, project_id: projectId,
      folder_id: b.folderId, api_name: toSlug(name), name,
    }).select('id').single()
    if (error) throw new Error(error.message)
    const datasetId = (data as { id: string }).id
    const { data: br, error: bErr } = await supabase.from('dataset_branches')
      .insert({ dataset_id: datasetId, name: 'master' }).select('id').single()
    if (bErr) throw new Error(bErr.message)
    return { datasetId, branchId: (br as { id: string }).id }
  }
}

/** Property id → the media datasource backing it. */
export function useMediaBindings(objectTypeId: string | null) {
  return useQuery({
    queryKey: ['media-bindings', objectTypeId ?? ''],
    enabled: objectTypeId !== null,
    queryFn: () => fetchMediaBindings(objectTypeId as string),
  })
}

export function useSetMediaBinding(objectTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { propertyId: string; datasourceId: string | null }) =>
      setMediaBinding(i.propertyId, i.datasourceId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['media-bindings', objectTypeId] })
      void qc.invalidateQueries({ queryKey: ['ontology-violations'] })
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useSetDatasourcePrimaryKeyColumn(objectTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (i: { id: string; column: string | null }) =>
      setDatasourcePrimaryKeyColumn(i.id, i.column),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.datasources(objectTypeId) })
      void qc.invalidateQueries({ queryKey: ['ontology-violations'] })
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRemoveObjectTypeDatasource(objectTypeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => removeObjectTypeDatasource(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.datasources(objectTypeId) })
      toast.success('Backing datasource removed')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
