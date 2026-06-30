// Layer: compute (Logic Tool, category 'logic'). Turns the demand forecast into a
// statistically-sized reorder point + safety stock — replacing a hand-tuned par
// factor. Safety stock buffers the demand variability over the supplier's lead
// time at a chosen service level (the prediction interval made operational):
//
//   reorder point = μ_d · L + SS
//   safety stock  = z · √( L·σ_d²  +  μ_d²·σ_L² )
//
// μ_d = mean daily demand, σ_d = its std (the demand interval), L = lead time,
// σ_L = lead-time std (set 0 when unknown), z = the service-level factor. The
// σ_L term means a flaky supplier earns a bigger buffer than a steady one.

import { z as zod } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'
import { buildDailySeries } from '../../objectives/consumption_forecast/daily_series'

const LOOKBACK_DAYS = 30

const inputSchema = zod.object({
  variantId:          zod.string().uuid(),
  /** Supplier lead time in days. Omit to use the variant's fastest supplier. */
  leadTimeDays:       zod.number().positive().optional(),
  /** Lead-time std (days). Defaults to 0 → safety stock from demand variability only. */
  leadTimeStddevDays: zod.number().nonnegative().default(0),
  /** Target in-stock probability over the lead time. 0.95 → z≈1.65. */
  serviceLevel:       zod.number().min(0.5).max(0.999).default(0.95),
})

const outputSchema = zod.object({
  variantId:          zod.string().uuid(),
  reorderPoint:       zod.number().nonnegative(),
  safetyStock:        zod.number().nonnegative(),
  demandOverLeadTime: zod.number().nonnegative(),
  dailyMean:          zod.number().nonnegative(),
  dailySigma:         zod.number().nonnegative(),
  leadTimeDays:       zod.number().nonnegative(),
  serviceLevel:       zod.number(),
  z:                  zod.number(),
  basis:              zod.string(),
  confidence:         zod.number().min(0).max(1),
})

export type ComputeReorderPointInput = zod.input<typeof inputSchema>   // callers may omit defaulted fields
export type ComputeReorderPointOutput = zod.infer<typeof outputSchema>

// Normal z for common service levels (one-sided).
function zForServiceLevel(sl: number): number {
  if (sl >= 0.99)  return 2.33
  if (sl >= 0.975) return 1.96
  if (sl >= 0.95)  return 1.65
  if (sl >= 0.90)  return 1.28
  if (sl >= 0.85)  return 1.04
  if (sl >= 0.80)  return 0.84
  return 0.52
}

export function makeComputeReorderPointTool(reader: GraphReader): LogicTool<ComputeReorderPointInput, ComputeReorderPointOutput> {
  return {
    name: 'compute_reorder_point',
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Returns the reorder point + safety stock for a variant, sized from its daily-demand mean and ' +
      'variability over the supplier lead time at a target service level. Use to decide WHEN to reorder ' +
      'and HOW MUCH buffer to hold — instead of a hand-tuned par level.',
    inputSchema,
    outputSchema,
    traversableLinks: ['consumes', 'restocks'],
    invoke: async (input) => {
      const logs = await reader.getStockLogs(input.variantId, LOOKBACK_DAYS + 5)
      const series = buildDailySeries(logs, Date.now(), LOOKBACK_DAYS)

      const n = series.length
      const mean = n ? series.reduce((s, v) => s + v, 0) / n : 0
      const variance = n ? series.reduce((s, v) => s + (v - mean) ** 2, 0) / n : 0
      const sigmaD = Math.sqrt(variance)

      let leadTime = input.leadTimeDays
      if (leadTime == null) {
        const suppliers = await reader.getSuppliersForVariant(input.variantId)
        const leads = suppliers.map((s) => s.lead_time_days).filter((d): d is number => d != null && d > 0)
        leadTime = leads.length ? Math.min(...leads) : 7
      }
      const sigmaL = input.leadTimeStddevDays ?? 0
      const sl = input.serviceLevel ?? 0.95
      const z = zForServiceLevel(sl)

      const safetyStock        = Math.round(z * Math.sqrt(leadTime * sigmaD ** 2 + mean ** 2 * sigmaL ** 2))
      const demandOverLeadTime = Math.round(mean * leadTime)

      // Confidence in the sizing tracks how many distinct days carried demand —
      // a reorder point off two data points is barely a number.
      const activeDays = series.filter((v) => v > 0).length
      const confidence = Number(Math.max(0.3, Math.min(0.95, 0.4 + (activeDays / LOOKBACK_DAYS) * 0.5)).toFixed(2))

      return {
        variantId:          input.variantId,
        reorderPoint:       demandOverLeadTime + safetyStock,
        safetyStock,
        demandOverLeadTime,
        dailyMean:          Number(mean.toFixed(2)),
        dailySigma:         Number(sigmaD.toFixed(2)),
        leadTimeDays:       leadTime,
        serviceLevel:       sl,
        z,
        basis:              'reorder-point-normal-v1',
        confidence,
      }
    },
  }
}
