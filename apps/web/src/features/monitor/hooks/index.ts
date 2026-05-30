// Layer: Eye — Autonomous-loop health hook
// Powers the Cron Health panel in Settings → Autonomous Operations.

import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { fetchCronHealthSummary, fetchAgentCycleHistory } from '../api'

export const monitorKeys = {
  cronHealth:        () => ['monitor', 'cron-health'] as const,
  agentCycleHistory: (limit: number) => ['monitor', 'agent-cycle-history', limit] as const,
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

/**
 * Recent intelligence_cycle_agent_run events for the Mind Command home.
 * Backed by `get_agent_cycle_history()` (admin/owner only — gated server-side).
 */
export function useAgentCycleHistory(limit = 5) {
  const role = useAuthStore((s) => s.role)
  const enabled = role === 'admin' || role === 'owner'
  return useQuery({
    queryKey:  monitorKeys.agentCycleHistory(limit),
    queryFn:   () => fetchAgentCycleHistory(limit),
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,  // the cron runs daily; lighter refresh than cron-health
  })
}
