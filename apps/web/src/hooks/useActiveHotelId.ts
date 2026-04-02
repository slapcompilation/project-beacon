import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'

/**
 * Returns the currently active hotel ID.
 * If an owner has switched to a different hotel via the hotel switcher,
 * that overrides the hotel ID from the auth session.
 */
export function useActiveHotelId(): string | null {
  const authHotelId = useAuthStore((s) => s.hotelId)
  const overrideHotelId = useAppStore((s) => s.activeHotelId)
  return overrideHotelId ?? authHotelId
}
