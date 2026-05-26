import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { dispatchAction } from '@/lib/actions/dispatch'
import { fetchCategories } from '../api'

const categoriesKey = (hotelId: string) => ['categories', hotelId] as const

export function useCategories() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: categoriesKey(hotelId ?? ''),
    queryFn: () => fetchCategories(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000, // categories rarely change — 5 min
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')

  return useMutation({
    mutationFn: async ({ name, parentId }: { name: string; parentId?: string | null }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'CREATE_CATEGORY', hotelId, name, parentId: parentId ?? null },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKey(hotelId ?? '') })
      toast.success('Category created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')

  return useMutation({
    mutationFn: async ({
      id,
      name,
      parentId,
      requirePhotoOver,
    }: {
      id: string
      name: string
      parentId?: string | null
      requirePhotoOver?: number | null
    }) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'UPDATE_CATEGORY', categoryId: id, hotelId, name, parentId: parentId ?? null, requirePhotoOver: requirePhotoOver ?? null },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKey(hotelId ?? '') })
      toast.success('Category updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  const userId  = useAuthStore((s) => s.session?.user.id ?? '')

  return useMutation({
    mutationFn: async (id: string) => {
      if (!hotelId) throw new Error('No active hotel')
      const result = await dispatchAction(
        { type: 'DELETE_CATEGORY', categoryId: id, hotelId },
        { hotelId, actorId: userId, triggeredBy: 'user' },
      )
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKey(hotelId ?? '') })
      toast.success('Category deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
