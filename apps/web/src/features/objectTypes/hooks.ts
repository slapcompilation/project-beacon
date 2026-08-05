import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { ObjectTypeDef } from '@beacon/ontology'
import { STATUS_META, isBacked } from '@beacon/ontology'
import {
  fetchObjectTypes, fetchOntologyTypes, fetchObjectTypeCards, createObjectType, deleteObjectType,
  setObjectTypeStatus,
  updateObjectType, fetchRevisions, restoreRevision,
  fetchObjectRecords, fetchObjectRecordsForTypes, fetchObjectRecord, fetchBuiltinRecord,
  createObjectRecord, deleteObjectRecord,
  fetchLinkTypes, createLinkType, deleteLinkType,
  fetchLinksForRecord, createObjectLink, deleteObjectLink,
  type CreateObjectTypeInput, type CreateObjectRecordInput,
  type UpdateObjectTypeInput, type ObjectTypeRevisionRow,
  type CreateLinkTypeInput, type CreateObjectLinkInput,
} from './api'

const keys = {
  types: ['object-types'] as const,
  ontology: ['ontology-types'] as const,
  cards: ['object-type-cards'] as const,
  records: (typeId: string) => ['object-records', typeId] as const,
  linkTypes: ['link-types'] as const,
  recordLinks: (recordId: string) => ['record-links', recordId] as const,
  revisions: (typeId: string) => ['object-type-revisions', typeId] as const,
}

export function useObjectTypes() {
  return useQuery({ queryKey: keys.types, queryFn: fetchObjectTypes, staleTime: 30_000 })
}

/** The whole ontology — authored plus built-in registrations. */
export function useOntologyTypes() {
  return useQuery({ queryKey: keys.ontology, queryFn: fetchOntologyTypes, staleTime: 30_000 })
}

/** One computed property's definition, straight from the ontology. Bespoke pages
 *  used to work out derived values inline — `variant.cost * variant.current_stock`
 *  sat in a component while GLOSSARY held its explanation elsewhere. The
 *  definition and the sentence describing it now travel together as data. */
export function useOntologyComputed(apiName: string, key: string) {
  const { data: rows = [] } = useOntologyTypes()
  const row = rows.find((r) => r.api_name === apiName)
  return row?.computed_properties?.find((c) => c.key === key)
}

export function useObjectTypeCards() {
  return useQuery({ queryKey: keys.cards, queryFn: fetchObjectTypeCards, staleTime: 30_000 })
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
    mutationFn: setObjectTypeStatus,
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: keys.types })
      void qc.invalidateQueries({ queryKey: keys.ontology })
      // A link type follows the weaker of its two ends, in a trigger.
      void qc.invalidateQueries({ queryKey: keys.linkTypes })
      toast.success(`Now ${STATUS_META[v.status].label.toLowerCase()}`)
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useObjectRecords(typeId: string | null) {
  return useQuery({
    queryKey: keys.records(typeId ?? ''),
    queryFn: () => fetchObjectRecords(typeId ?? ''),
    enabled: !!typeId,
    staleTime: 15_000,
  })
}

export function useObjectRecordsForTypes(typeIds: string[]) {
  const key = [...typeIds].sort().join(',')
  return useQuery({
    queryKey: ['object-records-multi', key] as const,
    queryFn: () => fetchObjectRecordsForTypes(typeIds),
    staleTime: 15_000,
  })
}

/** A record of any type — built-ins read from their backing table, authored
 *  ones from object_records. One hook so the generated view needs no branch. */
export function useOntologyRecord(type: ObjectTypeDef | undefined, recordId: string | null) {
  return useQuery({
    queryKey: ['ontology-record', type?.id ?? '', recordId ?? ''] as const,
    queryFn: () => (type && isBacked(type)
      ? fetchBuiltinRecord(type, recordId ?? '')
      : fetchObjectRecord(recordId ?? '')),
    enabled: !!type && !!recordId,
    staleTime: 15_000,
  })
}

export function useObjectRecord(recordId: string | null) {
  return useQuery({
    queryKey: ['object-record', recordId ?? ''],
    queryFn: () => fetchObjectRecord(recordId ?? ''),
    enabled: !!recordId,
    staleTime: 15_000,
  })
}

export function useCreateObjectRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateObjectRecordInput) => createObjectRecord(input),
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: keys.records(v.objectTypeId) }); toast.success('Record added') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteObjectRecord(typeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteObjectRecord(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.records(typeId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useUpdateObjectType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateObjectTypeInput) => updateObjectType(input),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: keys.types })
      void qc.invalidateQueries({ queryKey: keys.cards })
      void qc.invalidateQueries({ queryKey: keys.revisions(v.id) })
      toast.success('Saved — new version snapshotted')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useRevisions(typeId: string | null) {
  return useQuery({
    queryKey: keys.revisions(typeId ?? ''),
    queryFn: () => fetchRevisions(typeId ?? ''),
    enabled: !!typeId,
    staleTime: 15_000,
  })
}

export function useRestoreRevision() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rev: ObjectTypeRevisionRow) => restoreRevision(rev),
    onSuccess: (_d, rev) => {
      void qc.invalidateQueries({ queryKey: keys.types })
      void qc.invalidateQueries({ queryKey: keys.revisions(rev.object_type_id) })
      toast.success(`Restored v${String(rev.version)} as a new version`)
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

export function useRecordLinks(recordId: string) {
  return useQuery({ queryKey: keys.recordLinks(recordId), queryFn: () => fetchLinksForRecord(recordId), staleTime: 15_000 })
}

export function useCreateObjectLink(sourceRecordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateObjectLinkInput) => createObjectLink(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.recordLinks(sourceRecordId) }); toast.success('Linked') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteObjectLink(sourceRecordId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteObjectLink(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.recordLinks(sourceRecordId) }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Impact of dropping a type, or of dropping the given properties from it. */
