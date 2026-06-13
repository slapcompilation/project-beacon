import { useQuery } from '@tanstack/react-query'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { fetchOntologyGaps } from './api'

export function useOntologyGaps() {
  const hotelId = useActiveHotelId()
  return useQuery({
    queryKey: ['ontology-gaps', hotelId ?? ''],
    queryFn:  () => fetchOntologyGaps(hotelId ?? ''),
    enabled:  !!hotelId,
    staleTime: 60_000,
  })
}
