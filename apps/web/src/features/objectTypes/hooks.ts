import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchObjectTypes, createObjectType, deleteObjectType,
  fetchObjectRecords, createObjectRecord, deleteObjectRecord,
  type CreateObjectTypeInput, type CreateObjectRecordInput,
} from './api'

const keys = {
  types: ['object-types'] as const,
  records: (typeId: string) => ['object-records', typeId] as const,
}

export function useObjectTypes() {
  return useQuery({ queryKey: keys.types, queryFn: fetchObjectTypes, staleTime: 30_000 })
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
