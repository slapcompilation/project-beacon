import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { OntologyGap } from '@beacon/reality-graph'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'
import {
  decideOntologyGap,
  fetchApprovedExtensions,
  fetchApprovedMovementCategories,
  fetchApprovedRemovalCategories,
  fetchOntologyGaps,
  fetchScopedHotelIds,
} from './api'

/** Approved removal categories for a hotel — the grown ontology, consumed by the
 *  write-off / adjust-stock forms. Explicit hotelId so the action modal can pass
 *  the one bound to the form; gated by `enabled` so other actions don't fetch. */
export function useApprovedRemovalCategories(hotelId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ontology-extensions', 'removal-categories', hotelId ?? ''],
    queryFn:  () => fetchApprovedRemovalCategories(hotelId ?? ''),
    enabled:  enabled && !!hotelId,
    staleTime: 60_000,
  })
}

/** Approved movement categories — suggested on stock additions (positive adjust). */
export function useApprovedMovementCategories(hotelId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['ontology-extensions', 'movement-categories', hotelId ?? ''],
    queryFn:  () => fetchApprovedMovementCategories(hotelId ?? ''),
    enabled:  enabled && !!hotelId,
    staleTime: 60_000,
  })
}

// Portfolio-aware: in org scope hotelId is null → scan every readable property
// (RLS-scoped). Enabled once the scope is resolved, so a chain user gets a real
// portfolio scan instead of a false "failed to scan".
export function useOntologyGaps() {
  const hotelId   = useActiveHotelId()
  const scopeMode = useAppStore((s) => s.scopeMode)
  const ready = scopeMode === 'organization' || !!hotelId
  return useQuery({
    queryKey: ['ontology-gaps', hotelId ?? 'portfolio'],
    queryFn:  () => fetchOntologyGaps(hotelId),
    enabled:  ready,
    staleTime: 60_000,
  })
}

export function useApprovedExtensions() {
  const hotelId   = useActiveHotelId()
  const scopeMode = useAppStore((s) => s.scopeMode)
  const ready = scopeMode === 'organization' || !!hotelId
  return useQuery({
    queryKey: ['ontology-extensions', hotelId ?? 'portfolio'],
    queryFn:  () => fetchApprovedExtensions(hotelId),
    enabled:  ready,
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
      if (!userId) throw new Error('Missing user context')
      // Hotel scope → that property; portfolio scope → fan out to all readable hotels.
      const hotelIds = hotelId ? [hotelId] : await fetchScopedHotelIds()
      await decideOntologyGap({ hotelIds, userId, gap, status })
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
