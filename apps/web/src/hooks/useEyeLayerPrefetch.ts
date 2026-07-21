// Layer: Eye — primes the shared Eye Layer cache at AppLayout level.
// Only prefetches when the user is on an Eye or Mind layer route so that
// unrelated pages (Settings, Team, etc.) do not fire expensive RPCs.
// TanStack Query deduplicates by queryKey, so subsequent calls from
// individual pages hit the cache instead of the network.

import { useQuery } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { eyeKeys } from '@/features/eye/hooks'
import {
  fetchConsumptionForecast,
  fetchWasteRadar,
  fetchDeadStock,
} from '@/features/eye/api'

const EYE_MIND_ROUTES = [
  '/dashboard',
  '/briefing',
  '/alerts',
  '/reports',
  '/chain',
  '/leverage',
  '/purchase-orders',
  '/optimize-pars',
  '/events',
]

export function useEyeLayerPrefetch() {
  const location = useLocation()
  const hotelId  = useActiveHotelId()

  const isEyeOrMind = EYE_MIND_ROUTES.some((path) =>
    location.pathname.startsWith(path)
  )

  useQuery({
    queryKey: eyeKeys.forecast(hotelId ?? '', 30),
    queryFn:  () => fetchConsumptionForecast(30),
    enabled:  !!hotelId && isEyeOrMind,
    staleTime: 5 * 60 * 1000,
  })

  useQuery({
    queryKey: eyeKeys.wasteRadar(hotelId ?? ''),
    queryFn:  fetchWasteRadar,
    enabled:  !!hotelId && isEyeOrMind,
    staleTime: 5 * 60 * 1000,
  })

  useQuery({
    queryKey: eyeKeys.deadStock(hotelId ?? '', 30),
    queryFn:  () => fetchDeadStock(30),
    enabled:  !!hotelId && isEyeOrMind,
    staleTime: 10 * 60 * 1000,
  })
}
