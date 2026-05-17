// Layer: Eye — Autonomous-loop health hook
// Powers the Cron Health panel in Settings → Autonomous Operations.

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { fetchCronHealthSummary } from '../api'

export const monitorKeys = {
  cronHealth: () => ['monitor', 'cron-health'] as const,
}

/**
 * Cron health for the Settings → Autonomous Operations panel.
 * Backed by `get_cron_health_summary()` (admin/owner only — gated server-side).
 * Disabled for non-admin/owner roles to avoid 42501 noise in the console.
 */
export function useCronHealthSummary() {
  const role = useAuthStore((s) => s.role)
  const enabled = role === 'admin' || role === 'owner'
  return useQuery({
    queryKey:  monitorKeys.cronHealth(),
    queryFn:   fetchCronHealthSummary,
    enabled,
    staleTime: 60_000,        // 1 min — the underlying monitor runs every 5 min
    refetchInterval: 60_000,  // refresh while panel is open
  })
}
