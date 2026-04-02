import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../api'

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

  return useMutation({
    mutationFn: ({ name, parentId }: { name: string; parentId?: string | null }) =>
      createCategory(hotelId ?? '', name, parentId),
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

  return useMutation({
    mutationFn: ({
      id,
      name,
      parentId,
      requirePhotoOver,
    }: {
      id: string
      name: string
      parentId?: string | null
      requirePhotoOver?: number | null
    }) => updateCategory(id, name, parentId, requirePhotoOver),
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

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKey(hotelId ?? '') })
      toast.success('Category deleted')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
