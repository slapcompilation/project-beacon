// Phase E1 — read/write the operator-tunable autonomy policy. Backed by
// get_org_policy() + set_org_policy() (migration 151). Defaults live in
// @beacon/reality-graph (DEFAULT_ORG_POLICY); the UI shows merged values
// and saves the full document.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/auth.store'
import { DEFAULT_ORG_POLICY, mergeOrgPolicy, type OrgPolicy } from '@beacon/reality-graph'

const POLICY_KEY = ['mind', 'org-policy'] as const

async function fetchOrgPolicy(): Promise<{ raw: unknown; merged: OrgPolicy }> {
  const result = await supabase.rpc('get_org_policy') as unknown as {
    data:  unknown
    error: { message: string; code?: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return { raw: result.data, merged: mergeOrgPolicy(result.data) }
}

/** Reads the caller's org policy, merged with DEFAULT_ORG_POLICY for display.
 *  `raw` is the persisted override (or empty); `merged` is what the system will
 *  honour once E2 plumbs callers. Admin/owner only at the RPC level. */
export function useOrgPolicy() {
  const role = useAuthStore((s) => s.role)
  const enabled = role === 'admin' || role === 'owner'
  return useQuery({
    queryKey:  POLICY_KEY,
    queryFn:   fetchOrgPolicy,
    enabled,
    staleTime: 60_000,
  })
}

export function useSetOrgPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (policy: OrgPolicy) => {
      const result = await supabase.rpc('set_org_policy', { p_policy: policy }) as unknown as {
        data:  unknown
        error: { message: string; code?: string } | null
      }
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: POLICY_KEY })
    },
  })
}

export { DEFAULT_ORG_POLICY, mergeOrgPolicy }
export type { OrgPolicy }
