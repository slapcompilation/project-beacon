// Layer: meta — Network tier scope hook (Phase R1)
//
// Returns the currently active organization ID, mirroring useActiveHotelId().
// Resolution order:
//   1. activeOrgId from app store (explicit org switcher selection)
//   2. NULL if no org membership and no explicit selection
//
// Useful surfaces:
//   - Portfolio briefing pages (org-scope queries)
//   - Cross-property aggregations
//   - Org-level agent context

import { useAppStore } from '@/stores/app.store'
import { useUserOrgMemberships } from '@/features/organizations/hooks'

/**
 * Currently active organization ID.
 * Resolution: explicit selection > primary org membership > null.
 */
export function useActiveOrgId(): string | null {
  const explicit = useAppStore((s) => s.activeOrgId)
  const { data: memberships = [] } = useUserOrgMemberships()
  return explicit ?? memberships[0]?.organization_id ?? null
}

/** Current scope mode — 'hotel' (one property) or 'organization' (portfolio). */
export function useScopeMode() {
  return useAppStore((s) => s.scopeMode)
}

/** True when viewing a single property; false when viewing the portfolio. */
export function useIsHotelScope(): boolean {
  return useScopeMode() === 'hotel'
}

/** True when viewing the portfolio across multiple hotels. */
export function useIsOrgScope(): boolean {
  return useScopeMode() === 'organization'
}
