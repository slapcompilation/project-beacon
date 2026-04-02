import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchCustomFieldDefs,
  createCustomFieldDef,
  updateCustomFieldDef,
  deleteCustomFieldDef,
  updateVariantCustomValues,
} from '../api'
import type { CustomFieldType } from '@beacon/types'

const cfKeys = {
  defs: (hotelId: string) => ['custom-field-defs', hotelId] as const,
}

export function useCustomFieldDefs() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: cfKeys.defs(hotelId ?? ''),
    queryFn: () => fetchCustomFieldDefs(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCustomFieldDef() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (input: { name: string; field_type: CustomFieldType }) =>
      createCustomFieldDef(hotelId ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.defs(hotelId ?? '') })
      toast.success('Custom field added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateCustomFieldDef() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; field_type?: CustomFieldType; required?: boolean; sort_order?: number } }) =>
      updateCustomFieldDef(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.defs(hotelId ?? '') })
      toast.success('Field updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteCustomFieldDef() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (id: string) => deleteCustomFieldDef(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: cfKeys.defs(hotelId ?? '') })
      toast.success('Field removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateVariantCustomValues() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ variantId, values }: { variantId: string; values: Record<string, unknown> }) =>
      updateVariantCustomValues(variantId, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products', hotelId] })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
