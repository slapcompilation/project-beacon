import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { dispatchAction } from '@/lib/actions/dispatch'
import {
  fetchRestockRequests,
  updateRestockStatus,
  autoPropose,
  fetchApprovalThresholds,
  updateApprovalThresholds,
  fetchReceives,
  fetchApprovalVelocity,
  fetchSpendTrend,
} from '../api'
import type { RestockRequest } from '@beacon/types'

export const restockKeys = {
  all: (hotelId: string) => ['restock-requests', hotelId] as const,
}

export function useRestockRequests() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: restockKeys.all(hotelId ?? ''),
    queryFn: () => fetchRestockRequests(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 60 * 1000, // realtime subscription handles live updates
  })
}

// ─── CREATE_RESTOCK_REQUEST → dispatches REQUEST_RESTOCK ──────────────────────

export function useCreateRestockRequest() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)

  return useMutation({
    mutationFn: async ({
      variantId,
      quantityNeeded,
      supplier,
      notes,
    }: {
      variantId: string
      quantityNeeded: number
      supplier?: string | null
      notes?: string | null
    }) => {
      // Guard: if there's already an open (pending/approved) request for this
      // variant, don't create a duplicate. Checked at hook level since it reads
      // from TanStack Query cache — not a concern of the action registry.
      const cached = queryClient.getQueryData<import('../api').RestockRequestRow[]>(
        restockKeys.all(hotelId ?? ''),
      )
      const alreadyOpen = cached?.find(
        (r) => r.variant_id === variantId &&
          ['pending', 'pending_manager', 'pending_director', 'approved'].includes(r.status),
      )
      if (alreadyOpen) return { alreadyOpen: true as const }

      const result = await dispatchAction(
        {
          type:           'REQUEST_RESTOCK',
          hotelId:        hotelId ?? '',
          requestorId:    userId ?? '',
          variantId,
          quantityNeeded,
          supplier,
          notes,
        },
        { hotelId: hotelId ?? '', actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error)
      return { alreadyOpen: false as const, result }
    },
    onSuccess: (data) => {
      if (data.alreadyOpen) {
        toast.info('Already in queue — open request exists for this item', {
          action: { label: 'View Restocks →', onClick: () => { window.location.href = '/restocks' } },
          duration: 4000,
        })
        return
      }
      void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId ?? '') })
      toast.success('Restock request submitted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── RECEIVE_STOCK → dispatches RECEIVE_STOCK ─────────────────────────────────

export function useReceiveRestock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)

  return useMutation({
    mutationFn: async ({
      requestId,
      variantId = '',
      quantityReceived,
      lotNumber,
      notes,
      unitCost,
      expiryDate,
      supplierId,
    }: {
      requestId: string
      variantId?: string
      quantityReceived: number
      lotNumber?: string | null
      notes?: string | null
      unitCost?: number | null
      expiryDate?: string | null
      supplierId?: string | null
    }) => {
      const result = await dispatchAction(
        {
          type: 'RECEIVE_STOCK',
          requestId,
          variantId,
          quantityReceived,
          hotelId: hotelId ?? '',
          lotNumber,
          notes,
          unitCost,
          expiryDate,
          supplierId,
        },
        { hotelId: hotelId ?? '', actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error)
      // Return shape expected by call sites: { fulfilled, newBalance }
      return result.data as import('@beacon/reality-graph').ReceiveStockResult
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['products', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['eye', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['mind', hotelId] })
      void queryClient.invalidateQueries({ queryKey: ['expiry-batches', hotelId] })
      if (data.fulfilled) {
        toast.success('Fully received — request fulfilled', {
          action: {
            label: 'View movement report →',
            onClick: () => { window.location.href = '/reports?tab=movement' },
          },
        })
      } else {
        toast.success('Partial receive recorded')
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useReceives(requestId: string | null) {
  return useQuery({
    queryKey: ['restock-receives', requestId],
    queryFn: () => fetchReceives(requestId ?? ''),
    enabled: !!requestId,
  })
}

export function useAutoPropose() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: ({ thresholdDays, restockDays }: { thresholdDays?: number; restockDays?: number }) =>
      autoPropose(thresholdDays, restockDays),
    onSuccess: (count) => {
      void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId ?? '') })
      if (count === 0) {
        toast.info('No new proposals — all at-risk variants already have open requests')
      } else {
        toast.success(`${String(count)} restock proposal${count !== 1 ? 's' : ''} created`)
      }
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateRestockStatus() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RestockRequest['status'] }) =>
      updateRestockStatus(id, status),
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId ?? '') })
      const label =
        vars.status === 'approved'   ? 'Request approved'   :
        vars.status === 'fulfilled'  ? 'Marked as fulfilled' :
        'Request cancelled'
      toast.success(label)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── APPROVE_RESTOCK → dispatches APPROVE_RESTOCK ────────────────────────────

export function useApproveRestock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)

  return useMutation({
    mutationFn: async ({
      id,
      notes,
    }: {
      id: string
      notes?: string | null
    }) => {
      const result = await dispatchAction(
        { type: 'APPROVE_RESTOCK', requestId: id, hotelId: hotelId ?? '', notes },
        { hotelId: hotelId ?? '', actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId ?? '') })
      toast.success('Request approved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── REJECT_RESTOCK → dispatches REJECT_RESTOCK ──────────────────────────────

export function useRejectRestock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.userId)

  return useMutation({
    mutationFn: async ({
      id,
      reason,
    }: {
      id: string
      reason?: string | null
    }) => {
      const result = await dispatchAction(
        { type: 'REJECT_RESTOCK', requestId: id, hotelId: hotelId ?? '', reason },
        { hotelId: hotelId ?? '', actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId ?? '') })
      toast.success('Request rejected')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Approval thresholds ──────────────────────────────────────────────────────

export function useApprovalThresholds() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['approval-thresholds', hotelId],
    queryFn: () => fetchApprovalThresholds(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useUpdateApprovalThresholds() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: ({
      managerThreshold,
      directorThreshold,
      escalationTimeoutHours,
    }: {
      managerThreshold: number
      directorThreshold: number
      escalationTimeoutHours: number
    }) => updateApprovalThresholds(managerThreshold, directorThreshold, escalationTimeoutHours),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['approval-thresholds', hotelId] })
      toast.success('Approval thresholds updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── Approval analytics ───────────────────────────────────────────────────────

export function useApprovalVelocity(days = 30) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['approval-velocity', hotelId, days],
    queryFn: () => fetchApprovalVelocity(days),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSpendTrend(months = 6) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['spend-trend', hotelId, months],
    queryFn: () => fetchSpendTrend(months),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}
