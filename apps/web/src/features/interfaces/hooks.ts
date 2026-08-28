import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useComposeBranch } from '@/features/branching/api'
import { toast } from 'sonner'
import {
  fetchInterfaces, fetchImplementations, createInterface, deleteInterface,
  addImplementation, removeImplementation, stageInterfaceMetadata, stageInterfaceClauses,
  type CreateInterfaceInput, type MappingDraft, type InterfaceRow,
} from './api'

const keys = {
  interfaces: ['ontology-interfaces'] as const,
  implementations: ['object-type-interfaces'] as const,
}

export function useInterfaces() {
  const q = useQuery({ queryKey: keys.interfaces, queryFn: fetchInterfaces, staleTime: 30_000 })
  const compose = useComposeBranch<InterfaceRow>('interface', {
    interface_properties: [], interface_link_constraints: [],
    interface_action_constraints: [], extensions: [],
  })
  const data = useMemo(() => compose(q.data ?? []), [q.data, compose])
  return { ...q, data }
}

export function useImplementations() {
  return useQuery({ queryKey: keys.implementations, queryFn: fetchImplementations, staleTime: 30_000 })
}

export function useCreateInterface() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInterfaceInput) => createInterface(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.interfaces })
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Staged — save to add it to the ontology')
    },
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
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Staged for deletion — save to apply it')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Clause edits stage into the same working-state entry as the rest of the
 *  interface; the extension guards have their say when the save applies. */
export function useStageMetadata() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof stageInterfaceMetadata>[1] }) =>
      stageInterfaceMetadata(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.interfaces })
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Staged — save to apply it')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useStageClauses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof stageInterfaceClauses>[1] }) =>
      stageInterfaceClauses(id, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.interfaces })
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success('Staged — save to apply it')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

/** Implementing goes through the wizard's mappings; the conformance trigger
 *  still has the last word, and its error names the offending property. */
export function useImplement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ objectTypeId, interfaceId, mappings }: {
      objectTypeId: string; interfaceId: string; mappings: MappingDraft[]
    }) => addImplementation(objectTypeId, interfaceId, mappings),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.implementations })
      toast.success('Implementation declared')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useUnimplement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ objectTypeId, interfaceId }: { objectTypeId: string; interfaceId: string }) =>
      removeImplementation(objectTypeId, interfaceId),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.implementations }) },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
