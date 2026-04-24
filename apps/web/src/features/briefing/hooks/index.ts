// Layer: Cross-layer — Briefing action feed hooks
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { approveRestockProposal, captureIntelligenceSnapshot, fetchBriefingActions, fetchIntelligenceHistory, fetchSituationScore } from '../api'
import type { ApproveRestockProposalParams } from '../api'

export const briefingKeys = {
  actions: (hotelId: string) => ['briefing', 'actions', hotelId] as const,
}

export function useBriefingActions() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:             briefingKeys.actions(hotelId ?? ''),
    queryFn:              fetchBriefingActions,
    enabled:              !!hotelId,
    staleTime:            2 * 60 * 1000,    // 2 min — realtime invalidation handles live updates
    refetchOnWindowFocus: true,             // safety net: refetch on tab focus
  })
}

export function useSituationScore() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:        ['situation-score', hotelId ?? ''],
    queryFn:         fetchSituationScore,
    enabled:         !!hotelId,
    staleTime:       5 * 60 * 1000,   // 5 min — fused score; realtime handles live changes
  })
}

/**
 * Fires capture_intelligence_snapshot() once per day.
 * The server is idempotent; the client also guards with localStorage so we
 * don't hammer the RPC on every page re-render.
 */
export function useCaptureSnapshot() {
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: captureIntelligenceSnapshot,
    onSuccess: () => {
      if (hotelId) {
        localStorage.setItem(`snapshot_captured_${hotelId}`, new Date().toISOString().slice(0, 10))
      }
    },
  })
}

/** Returns true if a snapshot has already been captured today for this hotel. */
export function snapshotCapturedToday(hotelId: string | null): boolean {
  if (!hotelId) return true
  return localStorage.getItem(`snapshot_captured_${hotelId}`) === new Date().toISOString().slice(0, 10)
}

export function useIntelligenceHistory(days = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey:  ['intelligence-history', hotelId ?? '', days],
    queryFn:   () => fetchIntelligenceHistory(days),
    enabled:   !!hotelId,
    staleTime: 10 * 60 * 1000,  // history changes at most once per day
  })
}

/** One-tap proposal approval: creates an approved restock request + draft PO. */
export function useApproveRestockProposal() {
  const hotelId = useActiveHotelId()
  const qc      = useQueryClient()
  return useMutation({
    mutationFn: (params: ApproveRestockProposalParams) => approveRestockProposal(params),
    onSuccess: () => {
      // Remove the proposal from the feed and refresh procurement PO list
      void qc.invalidateQueries({ queryKey: briefingKeys.actions(hotelId ?? '') })
      void qc.invalidateQueries({ queryKey: ['procurement'] })
    },
  })
}
