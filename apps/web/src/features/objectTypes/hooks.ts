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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { STATUS_META } from '@beacon/ontology'
import {
  fetchObjectTypes, createObjectType, deleteObjectType, setObjectTypeStatus, updateObjectType,
  fetchLinkTypes, createLinkType, deleteLinkType,
  fetchObjectTypeDatasources, addObjectTypeDatasource, removeObjectTypeDatasource,
  type CreateObjectTypeInput, type UpdateObjectTypeInput, type CreateLinkTypeInput,
} from './api'

const keys = {
  types: ['object-types'] as const,
  linkTypes: ['link-types'] as const,
  datasources: (typeId: string) => ['object-type-datasources', typeId] as const,
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
    mutationFn: (input: CreateObjectTypeInput) => createObjectType(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.types }); toast.success('Object type created') },
    onError: (e: Error) => { toast.error(e.message) },
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
  return useQuery({ queryKey: keys.linkTypes, queryFn: fetchLinkTypes, staleTime: 30_000 })
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
    mutationFn: (i: { datasetId: string; branchId: string }) =>
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
