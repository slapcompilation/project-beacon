// Layer: Flow — hooks for custom removal reason CRUD
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import { fetchCustomRemovalReasons } from '../api'

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
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async ({ name, sortOrder }: { name: string; sortOrder?: number }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'CREATE_REMOVAL_REASON', hotelId, name, sortOrder: sortOrder ?? 0 },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: removalReasonKeys.all(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCustomRemovalReason() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { name?: string; sort_order?: number } }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'UPDATE_REMOVAL_REASON', reasonId: id, hotelId, name: patch.name, sortOrder: patch.sort_order },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: removalReasonKeys.all(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCustomRemovalReason() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')
  return useMutation({
    mutationFn: async (id: string) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'DELETE_REMOVAL_REASON', reasonId: id, hotelId },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: removalReasonKeys.all(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
