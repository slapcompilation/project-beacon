// Integration-health sweep — the effect side. Reads the classified health
// (metric + tunable trigger, both from useIntegrationHealth) and raises one
// deduped operator notification per feed that's down or never-connected. The
// RPC only persists + dedups; the down/never judgement stays in code.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useIntegrationHealth } from './useIntegrationHealth'

export interface HealthSweepResult {
  actionable: number
  raised: number
  ranAt: string
}

export function useIntegrationHealthSweep() {
  const qc = useQueryClient()
  const { hits } = useIntegrationHealth()

  return useMutation<HealthSweepResult>({
    mutationFn: async () => {
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
