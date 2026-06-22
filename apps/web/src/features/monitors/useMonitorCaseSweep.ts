// Waste + supplier monitor effects — close the loop. These signals are judgment
// calls (why is waste high? should we keep this supplier?), so the effect is an
// investigation Case in Decisions, not a one-click typed action. Same tunable
// trigger as the Signals feed; one Case per fired variant/supplier, reused
// across runs. Supplier Cases carry a typed { kind:'supplier' } input_ref — the
// first supplier→Decisions link (groundwork for provenance enrichment).

import { useMutation } from '@tanstack/react-query'
import {
  selectWasteTriggers, selectSupplierTriggers,
  type WasteReading, type SupplierReading,
} from '@beacon/reality-graph'
import { useWasteRadar, useSupplierReliability } from '@/features/eye/hooks'
import { createCase, fetchOpenCaseForVariant, fetchOpenCaseForSupplier } from '@/features/cases/api'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useMonitorPolicy } from './hooks'

export type MonitorKind = 'waste' | 'supplier'

export interface CaseSweepResult {
  kind: MonitorKind
  fired: number
  opened: number
  reused: number
}

export function useMonitorCaseSweep() {
  const userId = useAuthStore((s) => s.userId)
  const hotelId = useActiveHotelId()
  const { data: policy } = useMonitorPolicy()
  const { data: wasteRadar = [] } = useWasteRadar()
  const { data: reliability = [] } = useSupplierReliability(90)

  return useMutation<CaseSweepResult, Error, MonitorKind>({
    mutationFn: async (kind) => {
      if (!userId || !hotelId) throw new Error('Not signed in')
      const monitors = policy?.merged.monitors
      if (!monitors) throw new Error('Monitors not loaded')

      let fired = 0, opened = 0, reused = 0

      if (kind === 'waste') {
        if (!monitors.waste.enabled) throw new Error('Waste monitor is disabled')
        const readings: WasteReading[] = wasteRadar.map((r) => ({
          variantId: r.variant_id, variantLabel: r.variant_label,
          anomalyScore: r.anomaly_score, pctAboveBaseline: r.pct_above_baseline, qty7d: r.qty_7d,
        }))
        const hits = selectWasteTriggers(readings, monitors.waste)
        fired = hits.length
        for (const hit of hits) {
          const existing = await fetchOpenCaseForVariant(hotelId, hit.variantId)
          if (existing) { reused++; continue }
          await createCase({
            hotelId, openedByUserId: userId,
            title: `${hit.variantLabel} — waste investigation`,
            inputRefs: [{ kind: 'variant', ref: hit.variantId }, { kind: 'note', ref: `waste anomaly ${hit.anomalyScore.toFixed(1)}/10 · ${hit.pctAboveBaseline.toFixed(0)}% above baseline` }],
          })
          opened++
        }
      } else {
        if (!monitors.supplier.enabled) throw new Error('Supplier monitor is disabled')
        const readings: SupplierReading[] = reliability.map((r) => ({
          supplierId: r.supplier_id, supplierName: r.supplier_name,
          reliabilityScore: r.reliability_score, onTimePct: r.on_time_pct,
          avgDelayDays: r.avg_delay_days, riskTier: r.risk_tier,
        }))
        const hits = selectSupplierTriggers(readings, monitors.supplier)
        // Can only open/dedup a Case for a resolved supplier id.
        const withId = hits.filter((h) => !!h.supplierId)
        fired = withId.length
        for (const hit of withId) {
          const sid = hit.supplierId as string
          const existing = await fetchOpenCaseForSupplier(hotelId, sid)
          if (existing) { reused++; continue }
          await createCase({
            hotelId, openedByUserId: userId,
            title: `${hit.supplierName} — supplier risk review`,
            inputRefs: [{ kind: 'supplier', ref: sid }, { kind: 'note', ref: `reliability ${hit.reliabilityScore.toFixed(1)}/10 · ${hit.onTimePct.toFixed(0)}% on-time · ${hit.riskTier} risk` }],
          })
          opened++
        }
      }

      return { kind, fired, opened, reused }
    },
  })
}
