// Layer: Flow — hooks for custom removal reason CRUD
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchCustomRemovalReasons,
  createCustomRemovalReason,
  updateCustomRemovalReason,
  deleteCustomRemovalReason,
} from '../api'

export const removalReasonKeys = {
  all: (hotelId: string) => ['removal-reasons', hotelId] as const,
}

export function useCustomRemovalReasons() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: removalReasonKeys.all(hotelId ?? ''),
    queryFn: () => fetchCustomRemovalReasons(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCustomRemovalReason() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ name, sortOrder }: { name: string; sortOrder?: number }) =>
      createCustomRemovalReason(hotelId ?? '', name, sortOrder),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: removalReasonKeys.all(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCustomRemovalReason() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; sort_order?: number } }) =>
      updateCustomRemovalReason(id, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: removalReasonKeys.all(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCustomRemovalReason() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (id: string) => deleteCustomRemovalReason(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: removalReasonKeys.all(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
