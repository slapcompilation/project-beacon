import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import type { BeaconAction } from '@beacon/reality-graph'
import {
  decidePendingApproval,
  fetchPendingApprovals,
  type PendingApprovalRow,
} from './api'

export const pendingApprovalKeys = {
  list: (hotelId: string) => ['pending-approvals', hotelId] as const,
}

export function usePendingApprovals() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: pendingApprovalKeys.list(hotelId ?? ''),
    queryFn:  () => (hotelId ? fetchPendingApprovals(hotelId) : Promise.resolve([])),
    enabled:  !!hotelId,
    staleTime: 30_000,
  })
}

/** Approves a pending row by replaying the original BeaconAction with
 *  skipConstraintCheck=true, then flipping the approval row to 'approved'. */
export function useApprovePending() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async (row: PendingApprovalRow) => {
      if (!userId) throw new Error('Not signed in')
      const action = row.action_payload as unknown as BeaconAction
      const result = await dispatchAction(action, {
        hotelId:             row.hotel_id,
        actorId:             row.original_actor_id ?? userId,
        triggeredBy:         row.original_triggered_by,
        organizationId:      row.organization_id,
        skipConstraintCheck: true,
      })
      if (!result.success) {
        throw new Error(result.error.message)
      }
      await decidePendingApproval({
        id:              row.id,
        status:          'approved',
        decidedByUserId: userId,
      })
    },
    onSuccess: () => {
      toast.success('Approved — action dispatched')
      void qc.invalidateQueries({ queryKey: pendingApprovalKeys.list(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRejectPending() {
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)
  const qc      = useQueryClient()

  return useMutation({
    mutationFn: async (args: { id: string; reason?: string }) => {
      if (!userId) throw new Error('Not signed in')
      await decidePendingApproval({
        id:              args.id,
        status:          'rejected',
        decidedByUserId: userId,
        decisionNote:    args.reason ?? null,
      })
    },
    onSuccess: () => {
      toast.success('Rejected')
      void qc.invalidateQueries({ queryKey: pendingApprovalKeys.list(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
