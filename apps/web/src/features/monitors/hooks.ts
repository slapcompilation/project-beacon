// Monitors — read/write the tunable trigger config. Backed by get_org_policy()
// + set_org_policy() (migration 151), the same doc the Policy tab edits. Reads
// are open to any authenticated role (the running app needs the threshold to
// detect); writes are admin/owner-only, enforced at the RPC.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { mergeOrgPolicy, type OrgPolicy } from '@beacon/reality-graph'

const MONITORS_KEY = ['monitors', 'org-policy'] as const

async function fetchPolicy(): Promise<{ raw: unknown; merged: OrgPolicy }> {
  const result = await supabase.rpc('get_org_policy') as unknown as {
    data: unknown; error: { message: string } | null
  }
  if (result.error) throw new Error(result.error.message)
  return { raw: result.data, merged: mergeOrgPolicy(result.data) }
}

export function useMonitorPolicy() {
  return useQuery({ queryKey: MONITORS_KEY, queryFn: fetchPolicy, staleTime: 60_000 })
}

export function useSetMonitors() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (monitors: OrgPolicy['monitors']) => {
      // set_org_policy replaces the whole doc — read current, swap the monitor
      // section, write back the full merged document (last-writer-wins).
      const current = await fetchPolicy()
      const next: OrgPolicy = { ...current.merged, monitors }
      const result = await supabase.rpc('set_org_policy', { p_policy: next }) as unknown as {
        data: unknown; error: { message: string } | null
      }
      if (result.error) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MONITORS_KEY })
      void qc.invalidateQueries({ queryKey: ['mind', 'org-policy'] })
    },
  })
}
