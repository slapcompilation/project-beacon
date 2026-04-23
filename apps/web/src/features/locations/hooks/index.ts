import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  fetchLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  fetchLowStockByLocation,
  fetchInventoryByLocation,
  reassignVariantLocation,
} from '../api'

const locKeys = {
  all:         (hotelId: string) => ['locations', hotelId] as const,
  lowStock:    (hotelId: string) => ['low-stock-by-location', hotelId] as const,
  inventory:   (hotelId: string) => ['inventory-by-location', hotelId] as const,
}

export function useLocations() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: locKeys.all(hotelId ?? ''),
    queryFn: () => fetchLocations(hotelId ?? ''),
    enabled: !!hotelId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateLocation() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (input: { name: string; parent_id?: string | null }) =>
      createLocation(hotelId ?? '', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locKeys.all(hotelId ?? '') })
      toast.success('Location added')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateLocation() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: { name?: string; parent_id?: string | null } }) =>
      updateLocation(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locKeys.all(hotelId ?? '') })
      toast.success('Location updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteLocation() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (id: string) => deleteLocation(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locKeys.all(hotelId ?? '') })
      toast.success('Location removed')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useLowStockByLocation() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: locKeys.lowStock(hotelId ?? ''),
    queryFn: () => fetchLowStockByLocation(),
    enabled: !!hotelId,
    staleTime: 60 * 1000,
  })
}

export function useInventoryByLocation() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: locKeys.inventory(hotelId ?? ''),
    queryFn:  fetchInventoryByLocation,
    enabled:  !!hotelId,
    staleTime: 60 * 1000,
  })
}

export function useReassignVariantLocation() {
  const queryClient = useQueryClient()
  const hotelId     = useActiveHotelId()
  return useMutation({
    mutationFn: ({ variantId, locationId }: { variantId: string; locationId: string | null }) =>
      reassignVariantLocation(variantId, locationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: locKeys.inventory(hotelId ?? '') })
      void queryClient.invalidateQueries({ queryKey: locKeys.lowStock(hotelId ?? '') })
      toast.success('Location updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
