import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import {
  fetchSuppliers,
  updateSupplier,
  deleteSupplier,
  fetchSupplierScorecard,
  fetchSupplierLeverage,
  fetchSupplierPriceHistory,
  logDeliveryEvent,
  type SupplierInput,
} from '../api'
import type { DeliveryEventInput } from '@beacon/types'

export const supplierKeys = {
  all:          (hotelId: string) => ['suppliers', hotelId] as const,
  scorecard:    (hotelId: string) => ['suppliers', 'scorecard', hotelId] as const,
  deliveries:   (hotelId: string) => ['delivery_events', hotelId] as const,
  leverage:     (hotelId: string, days: number) => ['suppliers', 'leverage', hotelId, days] as const,
  priceHistory: (hotelId: string, supplierId: string, days: number) => ['suppliers', 'price-history', hotelId, supplierId, days] as const,
}

export function useSuppliers() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: supplierKeys.all(hotelId ?? ''),
    queryFn: () => fetchSuppliers(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,  // suppliers change infrequently
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')

  return useMutation({
    mutationFn: async (input: SupplierInput) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        {
          type:        'CREATE_SUPPLIER',
          hotelId,
          name:        input.name,
          contactName: input.contact_name,
          email:       input.email,
          phone:       input.phone,
          notes:       input.notes,
        },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
      return result
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all(hotelId ?? '') })
      toast.success('Supplier added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SupplierInput> }) =>
      updateSupplier(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all(hotelId ?? '') })
      toast.success('Supplier updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.all(hotelId ?? '') })
      toast.success('Supplier removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSupplierScorecard() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: supplierKeys.scorecard(hotelId ?? ''),
    queryFn: () => fetchSupplierScorecard(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,  // scorecard is aggregate data, not real-time
  })
}

export function useSupplierLeverage(days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: supplierKeys.leverage(hotelId ?? '', days),
    queryFn: () => fetchSupplierLeverage(days),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useSupplierPriceHistory(supplierId: string | null, days = 90) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: supplierKeys.priceHistory(hotelId ?? '', supplierId ?? '', days),
    queryFn: () => fetchSupplierPriceHistory(supplierId ?? '', days),
    enabled: !!hotelId && !!supplierId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLogDelivery() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()

  return useMutation({
    mutationFn: (input: DeliveryEventInput) => logDeliveryEvent(hotelId ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: supplierKeys.scorecard(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: supplierKeys.deliveries(hotelId ?? '') })
      toast.success('Delivery logged')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
