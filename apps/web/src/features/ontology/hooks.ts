import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { OntologyGap } from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { decideOntologyGap, fetchApprovedExtensions, fetchOntologyGaps } from './api'

export function useOntologyGaps() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['ontology-gaps', hotelId ?? ''],
    queryFn:  () => fetchOntologyGaps(hotelId ?? ''),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

export function useApprovedExtensions() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['ontology-extensions', hotelId ?? ''],
    queryFn:  () => fetchApprovedExtensions(hotelId ?? ''),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}

/** Approve (grow the ontology) or dismiss a detected gap. Either way the
 *  decision persists and the gap drops off the live list on refetch. */
export function useDecideOntologyGap() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async ({ gap, status }: { gap: OntologyGap; status: 'approved' | 'rejected' }) => {
      if (!hotelId || !userId) throw new Error('Missing hotel or user context')
      await decideOntologyGap({ hotelId, userId, gap, status })
      return status
    },
    onSuccess: (status, { gap }) => {
      toast.success(status === 'approved' ? `Added "${gap.proposed}" to the ontology` : `Dismissed "${gap.proposed}"`)
      void qc.invalidateQueries({ queryKey: ['ontology-gaps'] })
      void qc.invalidateQueries({ queryKey: ['ontology-extensions'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
