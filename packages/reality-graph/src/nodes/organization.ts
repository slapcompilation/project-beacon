// Reality Graph — Organization node computed properties
// Layer: Mind (portfolio strategy) + Network tier primitive
//
// FRAMING — the three influences:
//   Foundry   Organization is a first-class ontology node with typed edges
//             (`belongs_to_org` from hotels, `benchmarks` between peer orgs).
//   AIP       Org-scope agents operate here; proposals aggregated across
//             member hotels surface on the portfolio briefing.
//   Gallatin  Network-as-primitive. Even single-property customers have a
//             1:1 auto-org so the tier is always present and consistent.

import type { Organization, Hotel, UserOrgMembership, OrgRole, Scope } from '@beacon/types'

// ─── Basic predicates ────────────────────────────────────────────────────────

/**
 * True when an organization owns multiple hotels (genuinely multi-property).
 * Single-hotel auto-orgs return false.
 */
export function isMultiProperty(hotels: Pick<Hotel, 'organization_id'>[]): boolean {
  return hotels.length > 1
}

/**
 * Count of hotels belonging to this organization.
 */
export function hotelCount(
  org: Pick<Organization, 'id'>,
  hotels: Pick<Hotel, 'organization_id'>[],
): number {
  return hotels.filter((h) => h.organization_id === org.id).length
}

/**
 * Display label for the echelon tier — used in Topbar / Briefing headers.
 * e.g., "Marriott · 47 properties" or "Hotel Bella · 1 property"
 */
export function echelonLabel(
  org: Pick<Organization, 'name'>,
  hotels: Pick<Hotel, 'organization_id'>[],
): string {
  const count = hotels.length
  if (count === 0) return org.name
  return `${org.name} · ${count} ${count === 1 ? 'property' : 'properties'}`
}

// ─── Role hierarchy (echelon mirrors military logistics) ────────────────────

/**
 * Ordered hierarchy: higher index = broader scope.
 * org_director > regional_manager > hotel_admin > hotel_manager > team_member
 *
 * Used for "can this role read down" / "can this role approve at this tier" checks.
 * Hotel-scope roles remain in UserRole (packages/types); org-scope roles are OrgRole.
 */
export const ECHELON_RANK: Record<OrgRole, number> = {
  regional_manager: 1,
  org_director:     2,
}

/**
 * True if the caller's org role has at least the required authority.
 * Example: canActAtOrgScope(myRole, 'org_director')
 */
export function canActAtOrgScope(
  callerRole: OrgRole | null,
  requiredMinimum: OrgRole,
): boolean {
  if (callerRole == null) return false
  return ECHELON_RANK[callerRole] >= ECHELON_RANK[requiredMinimum]
}

/**
 * Resolves the effective scope for a user — 'organization' when they have an
 * org-level membership, 'hotel' otherwise. Agents use this to pick their
 * scope at dispatch time.
 */
export function effectiveScope(
  orgMemberships: Pick<UserOrgMembership, 'role'>[],
): Scope {
  return orgMemberships.length > 0 ? 'organization' : 'hotel'
}

// ─── Membership lookups ──────────────────────────────────────────────────────

/**
 * True if the user has any org-level role on this organization.
 */
export function hasOrgMembership(
  userId: string,
  orgId: string,
  memberships: Pick<UserOrgMembership, 'user_id' | 'organization_id'>[],
): boolean {
  return memberships.some(
    (m) => m.user_id === userId && m.organization_id === orgId,
  )
}

/**
 * Returns the user's role in this org, or null.
 */
export function orgRoleFor(
  userId: string,
  orgId: string,
  memberships: Pick<UserOrgMembership, 'user_id' | 'organization_id' | 'role'>[],
): OrgRole | null {
  const m = memberships.find(
    (x) => x.user_id === userId && x.organization_id === orgId,
  )
  return m?.role ?? null
}

// ─── Node export ─────────────────────────────────────────────────────────────

export const organizationNode = {
  computed: {
    isMultiProperty,
    hotelCount,
    echelonLabel,
    canActAtOrgScope,
    effectiveScope,
    hasOrgMembership,
    orgRoleFor,
  },
} as const
