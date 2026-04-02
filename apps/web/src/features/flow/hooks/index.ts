// Layer: Flow — variant timeline hook
import { useQuery } from '@tanstack/react-query'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { fetchVariantTimeline } from '../api'

export function useVariantTimeline(variantId: string | null, days = 90) {
  const hotelId = useActiveHotelId()

  return useQuery({
    queryKey: ['variant-timeline', hotelId, variantId, days],
    queryFn: () => fetchVariantTimeline(variantId!, days),
    enabled: !!hotelId && !!variantId,
    staleTime: 30_000,
  })
}
