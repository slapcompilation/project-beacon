// Expiry monitor sweep — the effect side of the loop. Reads the deterministic
// metric (expiry batches), applies the operator's tunable trigger, and fires a
// typed WRITE_OFF proposal per fired variant into Decisions. WRITE_OFF is never
// in the auto-exec policy, so every proposal queues for review — by design.

import { useMutation } from '@tanstack/react-query'
import { selectExpiryTriggers, expiryHitToWriteOff, type ExpiryBatch } from '@beacon/reality-graph'
import { fetchExpiryBatches } from '@/features/inventory/api'
import { createProposal } from '@/features/agents/proposalsApi'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useMonitorPolicy } from './hooks'

export interface ExpiryScanResult {
  scanned: number
  fired: number
  proposalsCreated: number
  ranAt: string
}

export function useExpiryMonitorSweep() {
  const userId = useAuthStore((s) => s.userId)
  const hotelId = useActiveHotelId()
  const { data: policy } = useMonitorPolicy()

  return useMutation<ExpiryScanResult>({
    mutationFn: async () => {
      if (!userId || !hotelId) throw new Error('Not signed in')
      const rule = policy?.merged.monitors.expiry
      if (!rule || !rule.enabled) throw new Error('Expiry monitor is disabled')

      // METRIC: pull readings within the tunable window; the TRIGGER decides
      // what fires. No hardcoded band here.
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

      // One proposal per variant — its most urgent batch leads (hits are sorted).
      const seen = new Set<string>()
      let created = 0
      for (const hit of hits) {
        if (seen.has(hit.variantId)) continue
        seen.add(hit.variantId)
        const action = expiryHitToWriteOff(hit, userId)
        const when = hit.daysUntilExpiry <= 0 ? 'has expired' : `expires in ${String(hit.daysUntilExpiry)}d`
        await createProposal({
          hotelId,
          agentName: 'expiry_monitor',
          agentVersion: '1.0.0',
          createdByUserId: userId,
          proposal: {
            action,
            confidence: Math.min(0.95, 0.5 + hit.urgency / 20),
            reasoning: `Expiry monitor fired: ${hit.variantLabel} ${when}, €${hit.costAtRisk.toFixed(0)} at risk. Trigger: days_until_expiry ≤ ${String(rule.threshold_days)}.`,
            provenance: [{ kind: 'tool', ref: 'expiry_monitor', detail: `days_until_expiry=${String(hit.daysUntilExpiry)} ≤ ${String(rule.threshold_days)}` }],
          },
        })
        created++
      }

      return { scanned: batches.length, fired: hits.length, proposalsCreated: created, ranAt: new Date().toISOString() }
    },
  })
}
