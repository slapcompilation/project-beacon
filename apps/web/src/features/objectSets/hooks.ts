import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchObjectSets, createObjectSet, deleteObjectSet, resolveCohortMembers, type CreateObjectSetInput } from './api'

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

/** Membership of one cohort, shaped for evaluateAutomation. Used by the
 *  automations composer so its preview answers the same question the cycle will. */
export function useCohortMembers(setId: string | null) {
  return useQuery({
    queryKey: ['cohort-members', setId ?? ''] as const,
    enabled: !!setId,
    staleTime: 15_000,
    queryFn: () => resolveCohortMembers([setId as string]),
  })
}
