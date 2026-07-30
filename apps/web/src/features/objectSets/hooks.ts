import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchObjectSets, createObjectSet, deleteObjectSet, resolveCohortMembers, fetchDeclaredLinks, fetchLinkRows, type CreateObjectSetInput } from './api'

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

/** Registered link types — searchAround's declaration gate. */
export function useDeclaredLinks() {
  return useQuery({ queryKey: ['declared-links'] as const, queryFn: fetchDeclaredLinks, staleTime: 60_000 })
}

/** Link rows for a traversal chain, read through the relationship_edges view so
 *  the query is the same whatever backing owns each relationship. */
export function useLinkRows(edgeTypes: string[]) {
  const key = [...edgeTypes].sort().join(',')
  return useQuery({
    queryKey: ['link-rows', key] as const,
    enabled: edgeTypes.length > 0,
    staleTime: 30_000,
    queryFn: () => fetchLinkRows(edgeTypes),
  })
}
