// Layer: meta — Hotel scope hook
//
// Resolution:
//   - scopeMode='organization' → returns NULL (queries become unfiltered;
//     hotel_is_in_user_scope() RLS lets the org-level user see all hotels)
//   - scopeMode='hotel'         → activeHotelId override > auth-session hotel_id
//
// Returning NULL for org scope is the deliberate signal: feature hooks that
// gate on `enabled: !!hotelId` will simply not fire — replace those with
// org-scope queries (e.g. SELECT FROM hotels WHERE organization_id = …).
// In existing screens, queries that filter by hotel_id will return rows from
// every hotel the user can read via RLS.

import { useAuthStore } from '@/stores/auth.store'
import { useAppStore } from '@/stores/app.store'

/**
 * Returns the currently active hotel ID, OR null when in org scope.
 * Single-hotel users always get a hotel id (their own).
 * Org-scope users get null while viewing the portfolio.
 */
export function useActiveHotelId(): string | null {
  const scopeMode       = useAppStore((s) => s.scopeMode)
  const authHotelId     = useAuthStore((s) => s.hotelId)
  const overrideHotelId = useAppStore((s) => s.activeHotelId)

  if (scopeMode === 'organization') return null
  return overrideHotelId ?? authHotelId
}
