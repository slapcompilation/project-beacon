// Layer: meta — reads the active hotel's currency code with a USD fallback.
// Use this anywhere you need the currency string; avoids repeating the fallback inline.

import { useActiveHotel } from '@/features/hotel/hooks'

export function useCurrency(): string {
  const hotel = useActiveHotel()
  return hotel?.currency ?? 'USD'
}
