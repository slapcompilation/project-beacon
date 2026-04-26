// Layer: meta — Organizations hooks (Phase R1, Network tier)
//
// useOrganizations          — RLS-gated list of orgs the user can read
// useUserOrgMemberships     — user's org-level role assignments
// useHasOrgScope            — boolean: does the user have ANY org-level role?
//                             (gates whether portfolio switcher is shown)

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { fetchAccessibleOrganizations, fetchUserOrgMemberships } from '../api'

const STALE = 5 * 60 * 1000  // 5 min — org membership changes rarely

export function useOrganizations() {
  const userId = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey: ['organizations', userId ?? ''],
    queryFn:  fetchAccessibleOrganizations,
    enabled:  !!userId,
    staleTime: STALE,
  })
}

export function useUserOrgMemberships() {
  const userId = useAuthStore((s) => s.userId)
  return useQuery({
    queryKey: ['user-org-memberships', userId ?? ''],
    queryFn:  fetchUserOrgMemberships,
    enabled:  !!userId,
    staleTime: STALE,
  })
}

/**
 * True when the user has at least one org-level role assignment
 * (org_director or regional_manager). Gates the portfolio switcher.
 */
export function useHasOrgScope(): boolean {
  const { data: memberships = [] } = useUserOrgMemberships()
  return memberships.length > 0
}
