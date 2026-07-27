import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  fetchInterfaces, fetchImplementations, createInterface, deleteInterface,
  addImplementation, removeImplementation, type CreateInterfaceInput,
} from './api'

const keys = {
  interfaces: ['ontology-interfaces'] as const,
  implementations: ['object-type-interfaces'] as const,
}

export function useInterfaces() {
  return useQuery({ queryKey: keys.interfaces, queryFn: fetchInterfaces, staleTime: 30_000 })
}

export function useImplementations() {
  return useQuery({ queryKey: keys.implementations, queryFn: fetchImplementations, staleTime: 30_000 })
}

export function useCreateInterface() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInterfaceInput) => createInterface(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.interfaces }); toast.success('Interface created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteInterface() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInterface(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.interfaces })
      void qc.invalidateQueries({ queryKey: keys.implementations })
      toast.success('Interface deleted')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Toggling an implementation can fail on the conformance trigger — the error
 *  text names exactly which property is missing or mistyped. */
export function useSetImplementation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ objectTypeId, interfaceId, on }: { objectTypeId: string; interfaceId: string; on: boolean }) =>
      on ? addImplementation(objectTypeId, interfaceId) : removeImplementation(objectTypeId, interfaceId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.implementations }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
