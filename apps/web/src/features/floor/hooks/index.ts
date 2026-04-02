// Layer: Floor — TanStack Query hooks for pending scan management

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import {
  recordPendingScan,
  fetchPendingScans,
  resolvePendingScan,
  skipPendingScan,
} from '../api'

export const floorKeys = {
  pendingScans: (hotelId: string) => ['floor', 'pending-scans', hotelId] as const,
}

export function usePendingScans() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: floorKeys.pendingScans(hotelId ?? ''),
    queryFn: fetchPendingScans,
    enabled: !!hotelId,
    staleTime: 30 * 1000,
  })
}

export function useRecordPendingScan() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({
      scannedCode,
      locationId,
      approxQuantity,
      notes,
    }: {
      scannedCode: string
      locationId?: string | null
      approxQuantity?: number | null
      notes?: string | null
    }) => recordPendingScan(scannedCode, locationId, approxQuantity, notes),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: floorKeys.pendingScans(hotelId ?? '') })
      toast.success('Logged for manager review')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useResolvePendingScan() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: ({
      scanId,
      variantId,
      updateBarcode,
    }: {
      scanId: string
      variantId: string
      updateBarcode?: boolean
    }) => resolvePendingScan(scanId, variantId, updateBarcode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: floorKeys.pendingScans(hotelId ?? '') })
      toast.success('Scan resolved')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useSkipPendingScan() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (scanId: string) => skipPendingScan(scanId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: floorKeys.pendingScans(hotelId ?? '') })
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
