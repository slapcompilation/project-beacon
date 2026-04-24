// Layer: Flow — variant timeline + shift handover hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { fetchVariantTimeline, fetchShiftHandovers, createShiftHandover } from '../api'
import type { HandoverFlaggedItem } from '../api'

export function useVariantTimeline(variantId: string | null, days = 90) {
  const hotelId = useActiveHotelId()

  return useQuery({
    queryKey: ['variant-timeline', hotelId, variantId, days],
    queryFn: () => fetchVariantTimeline(variantId ?? '', days),
    enabled: !!hotelId && !!variantId,
    staleTime: 30_000,
  })
}

export function useShiftHandovers(limit = 10) {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['shift-handovers', hotelId, limit],
    queryFn: () => fetchShiftHandovers(limit),
    enabled: !!hotelId,
    staleTime: 60_000,
  })
}

export function useCreateShiftHandover() {
  const queryClient = useQueryClient()
  const hotelId = useActiveHotelId()
  return useMutation({
    mutationFn: (payload: {
      window_hours: number
      started_at:   string
      notes:        string | null
      flagged_items: HandoverFlaggedItem[]
    }) => createShiftHandover(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shift-handovers', hotelId] })
      toast.success('Shift handover recorded')
    },
    onError: (err: Error) => {
      toast.error(`Failed to save handover: ${err.message}`)
    },
  })
}
