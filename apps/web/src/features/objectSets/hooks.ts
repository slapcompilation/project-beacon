import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchObjectSets, createObjectSet, deleteObjectSet, type CreateObjectSetInput } from './api'

const keys = { sets: ['object-sets'] as const }

export function useObjectSets() {
  return useQuery({ queryKey: keys.sets, queryFn: fetchObjectSets, staleTime: 30_000 })
}

export function useCreateObjectSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateObjectSetInput) => createObjectSet(input),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.sets }); toast.success('Cohort created') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}

export function useDeleteObjectSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteObjectSet(id),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: keys.sets }); toast.success('Cohort deleted') },
    onError: (e: Error) => { toast.error(e.message) },
  })
}
