// Expiry monitor PREVIEW — what would fire, without writing anything.
//
// This used to create proposals directly, which was a second write path that
// never saw decideAutoExecution. Firing now happens inside the intelligence
// cycle (buildExpiryProposals feeds the one gate), so the operator affordance
// here is "show me what this threshold catches" — useful while tuning, and
// incapable of writing.

import { useMutation } from '@tanstack/react-query'
import { selectExpiryTriggers, type ExpiryBatch } from '@beacon/reality-graph'
import { fetchExpiryBatches } from '@/features/inventory/api'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useMonitorPolicy } from './hooks'

export interface ExpiryScanResult {
  scanned: number
  fired: number
  /** Distinct variants the next cycle would raise a write-off proposal for. */
  wouldPropose: number
  ranAt: string
}

export function useExpiryMonitorSweep() {
  const hotelId = useActiveHotelId()
  const { data: policy } = useMonitorPolicy()

  return useMutation<ExpiryScanResult>({
    mutationFn: async () => {
      if (!hotelId) throw new Error('Not signed in')
      const rule = policy?.merged.monitors.expiry
      if (!rule?.enabled) throw new Error('Expiry monitor is disabled')

      // METRIC: readings within the tunable window; the TRIGGER decides what fires.
      const rows = await fetchExpiryBatches(Math.max(rule.threshold_days, 1))
      const batches: ExpiryBatch[] = rows.map((r) => ({
        variantId: r.variant_id,
        variantLabel: r.variant_name && r.variant_name !== 'Standard'
          ? `${r.product_name} · ${r.variant_name}`
          : r.product_name,
        quantity: r.quantity,
        daysUntilExpiry: r.days_until_expiry,
        costAtRisk: r.cost_at_risk,
        hotelId,
      }))

      const hits = selectExpiryTriggers(batches, rule)
      return {
        scanned: batches.length,
        fired: hits.length,
        wouldPropose: new Set(hits.map((h) => h.variantId)).size,
        ranAt: new Date().toISOString(),
      }
    },
  })
}
