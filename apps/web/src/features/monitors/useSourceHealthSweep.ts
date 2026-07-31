// Source-health sweep — the effect side. Reads the classified health (metric
// from the source registry, tunable trigger from org policy) and raises one
// deduped operator notification per source that is down or has never fed us.
// The RPC only persists + dedups; the down/never judgement stays in code.
//
// Replaces useIntegrationHealthSweep, which read the retired
// get_integration_health. Phase B deleted that hook and orphaned the RPC — the
// shape ratchet caught it on its first run, which is the argument for the gate.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { classifyIntegrationHealth } from '@beacon/reality-graph'
import { supabase } from '@/lib/supabase/client'
import { useMonitorPolicy } from './hooks'
import { useSourceRegistry } from './useSourceRegistry'

export interface HealthSweepResult {
  actionable: number
  raised: number
  ranAt: string
}

export function useSourceHealthSweep() {
  const qc = useQueryClient()
  const { data: sources = [] } = useSourceRegistry()
  const { data: policy } = useMonitorPolicy()
  const rule = policy?.merged.monitors.integration

  return useMutation<HealthSweepResult>({
    mutationFn: async () => {
      if (!rule?.enabled) return { actionable: 0, raised: 0, ranAt: new Date().toISOString() }

      const hits = sources.map((s) => classifyIntegrationHealth({
        sourceKey:       s.api_name,
        label:           s.label,
        kind:            s.pending_count === null ? 'pos' : 'documents',
        lastActivityAt:  s.data_changed_at,
        totalEvents:     0,
        pendingCount:    s.pending_count ?? undefined,
        oldestPendingAt: s.oldest_pending_at,
      }, rule))

      const actionable = hits.filter((h) => h.status === 'down' || h.status === 'never')
      let raised = 0
      for (const h of actionable) {
        const result = await supabase.rpc('raise_integration_health_alert', {
          p_source_key: h.sourceKey,
          p_label:      h.label,
          p_status:     h.status,
          p_detail:     h.detail,
        }) as unknown as { data: number | null; error: { message: string } | null }
        if (result.error) throw new Error(result.error.message)
        raised += result.data ?? 0
      }
      return { actionable: actionable.length, raised, ranAt: new Date().toISOString() }
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['notifications'] }) },
  })
}
