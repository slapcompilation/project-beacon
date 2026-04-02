import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchRestockRequests,
  createRestockRequest,
  updateRestockStatus,
  approveRestock,
  rejectRestock,
  fetchApprovalThresholds,
  updateApprovalThresholds,
  receiveRestock,
  fetchReceives,
  autoPropose,
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

export function useCreateRestockRequest() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId = useAuthStore((s) => s.userId)

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
      // Guard: if there's already an open (pending/approved) request for this variant,
      // don't create a duplicate. Return a sentinel instead.
      const cached = queryClient.getQueryData<import('../api').RestockRequestRow[]>(
        restockKeys.all(hotelId ?? ''),
      )
      const alreadyOpen = cached?.find(
        (r) => r.variant_id === variantId &&
          ['pending', 'pending_manager', 'pending_director', 'approved'].includes(r.status),
      )
      if (alreadyOpen) return { alreadyOpen: true as const }

      const created = await createRestockRequest(
        hotelId ?? '', userId ?? '', variantId, quantityNeeded, supplier, notes,
      )
      return { alreadyOpen: false as const, created }
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

export function useReceiveRestock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: ({
      requestId,
      quantityReceived,
      lotNumber,
      notes,
      unitCost,
      expiryDate,
      supplierId,
    }: {
      requestId: string
      quantityReceived: number
      lotNumber?: string | null
      notes?: string | null
      unitCost?: number | null
      expiryDate?: string | null
      supplierId?: string | null
    }) => receiveRestock(requestId, quantityReceived, lotNumber, notes, unitCost, expiryDate, supplierId),
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
        vars.status === 'approved'
          ? 'Request approved'
          : vars.status === 'fulfilled'
            ? 'Marked as fulfilled'
            : 'Request cancelled'
      toast.success(label)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useApproveRestock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string | null }) =>
      approveRestock(id, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId ?? '') })
      toast.success('Request approved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useRejectRestock() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string | null }) =>
      rejectRestock(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: restockKeys.all(hotelId ?? '') })
      toast.success('Request rejected')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

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

// ─── Approval analytics ────────────────────────────────────────────────────────

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
