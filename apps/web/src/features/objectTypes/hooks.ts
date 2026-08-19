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
import {
  fetchObjectTypes, saveObjectType, deleteObjectType, setObjectTypeStatus, updateObjectType,
  fetchObjectTypeProblems,
  fetchLinkTypes, createLinkType, deleteLinkType,
  fetchObjectTypeDatasources, addObjectTypeDatasource, removeObjectTypeDatasource,
  setDatasourcePrimaryKeyColumn,
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

/** One computed property's definition, straight from the ontology — so the value
 *  and the sentence explaining it travel together as data. */
export function useOntologyComputed(apiName: string, key: string) {
  const { data: rows = [] } = useObjectTypes()
  const row = rows.find((r) => r.api_name === apiName)
  return row?.computed_properties?.find((c) => c.key === key)
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
    mutationFn: (i: { datasetId?: string; branchId?: string; restrictedViewId?: string }) =>
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
