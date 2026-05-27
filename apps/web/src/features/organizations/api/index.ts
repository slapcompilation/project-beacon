// Layer: meta — Organizations API (Phase R1, Network tier)
// Reads:  fetchAccessibleOrganizations — RLS-gated org list (members + parents-of-hotels)
//         fetchUserOrgMemberships     — current user's org-level role assignments
// Writes: deferred to admin UI (Phase R2)

import { supabase } from '@/lib/supabase/client'
import type { Organization, UserOrgMembership } from '@beacon/types'

/**
 * Returns every organization the current user can read (RLS-filtered).
 * Includes:
 *   - The org that owns the user's primary hotel (auth_org_id)
 *   - Any organizations where the user has a row in user_org_memberships
 */
export async function fetchAccessibleOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name')
  if (error) throw new Error(error.message)
  return data as Organization[]
}

/**
 * Returns the current user's org-level role assignments.
 * Empty array means the user is hotel-scoped only (no portfolio role).
 */
export async function fetchUserOrgMemberships(): Promise<UserOrgMembership[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('user_org_memberships')
    .select('*')
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
  return data as UserOrgMembership[]
}
