import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchObjectTypes, fetchObjectTypeCards, createObjectType, deleteObjectType,
  updateObjectType, fetchRevisions, restoreRevision,
  fetchObjectRecords, fetchObjectRecord, createObjectRecord, deleteObjectRecord,
  fetchLinkTypes, createLinkType, deleteLinkType,
  fetchLinksForRecord, createObjectLink, deleteObjectLink,
  type CreateObjectTypeInput, type CreateObjectRecordInput,
  type UpdateObjectTypeInput, type ObjectTypeRevisionRow,
  type CreateLinkTypeInput, type CreateObjectLinkInput,
} from './api'

const keys = {
  types: ['object-types'] as const,
  cards: ['object-type-cards'] as const,
  records: (typeId: string) => ['object-records', typeId] as const,
  linkTypes: ['link-types'] as const,
  recordLinks: (recordId: string) => ['record-links', recordId] as const,
  revisions: (typeId: string) => ['object-type-revisions', typeId] as const,
}

export function useObjectTypes() {
  return useQuery({ queryKey: keys.types, queryFn: fetchObjectTypes, staleTime: 30_000 })
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

export function useObjectRecords(typeId: string | null) {
  return useQuery({
    queryKey: keys.records(typeId ?? ''),
    queryFn: () => fetchObjectRecords(typeId ?? ''),
    enabled: !!typeId,
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
