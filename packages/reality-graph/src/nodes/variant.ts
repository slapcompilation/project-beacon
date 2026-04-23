// Reality Graph — Variant node computed properties
// Layer: Floor (stock status) + Eye (consumption intelligence)
//
// Rule: every derived value shown in the UI about a variant must be computed
// here, not inside a component or hook. Components import and call these
// functions — they never re-implement the logic.

import type { ProductVariant, ConsumptionForecastRow } from '@beacon/types'

// ─── Stock urgency ─────────────────────────────────────────────────────────────

export type StockUrgency = 'critical' | 'low' | 'ok' | 'overstocked'

/**
 * Semantic urgency level for a variant's current stock vs its PAR level.
 * - critical:    stock is zero or negative
 * - low:         at or below PAR threshold
 * - ok:          above PAR, within 2× PAR (normal operating range)
 * - overstocked: more than 2× PAR (capital tied up, waste risk)
 */
export function stockUrgency(v: ProductVariant): StockUrgency {
  if (v.current_stock <= 0) return 'critical'
  if (v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold) return 'low'
  if (v.low_stock_threshold > 0 && v.current_stock > v.low_stock_threshold * 2) return 'overstocked'
  return 'ok'
}

// ─── Consumption-based projections ────────────────────────────────────────────

/**
 * Days until stock reaches zero at the current average daily consumption rate.
 * Returns null when consumption rate is zero or unknown (no forecast data).
 */
export function daysUntilZero(
  v: ProductVariant,
  avgDailyConsumption: number,
): number | null {
  if (avgDailyConsumption <= 0) return null
  return Math.max(0, v.current_stock / avgDailyConsumption)
}

/**
 * Urgency level derived from days-until-zero and lead time.
 * - critical: stockout before a reorder would arrive
 * - warning:  order deadline within 3 days
 * - watch:    order window closing within 14 days
 * - ok:       comfortable coverage
 */
export type ConsumptionUrgency = 'critical' | 'warning' | 'watch' | 'ok'

export function consumptionUrgency(
  daysLeft: number | null,
  leadTimeDays: number,
): ConsumptionUrgency {
  if (daysLeft === null) return 'ok'
  const orderDeadlineDays = daysLeft - leadTimeDays
  if (orderDeadlineDays <= 0) return 'critical'
  if (orderDeadlineDays <= 3) return 'warning'
  if (orderDeadlineDays <= 14) return 'watch'
  return 'ok'
}

/**
 * Recommended restock quantity.
 * Covers PAR level + consumption during lead time, rounded up to nearest integer.
 * Falls back to lead-time consumption × 1.5 when no PAR is set.
 */
export function restockRecommendedQty(
  v: ProductVariant,
  avgDailyConsumption: number,
  leadTimeDays: number,
): number {
  const leadTimeConsumption = avgDailyConsumption * leadTimeDays
  if (v.low_stock_threshold > 0) {
    return Math.max(
      Math.ceil(v.low_stock_threshold - v.current_stock + leadTimeConsumption),
      v.low_stock_threshold,
    )
  }
  return Math.max(Math.ceil(leadTimeConsumption * 1.5), 1)
}

// ─── Forecast row shortcut ────────────────────────────────────────────────────

/**
 * Extract the forecast row for a specific variant from a forecast array.
 * Returns null when no forecast data exists (variant has never been consumed).
 */
export function forecastForVariant(
  variantId: string,
  forecast: ConsumptionForecastRow[],
): ConsumptionForecastRow | null {
  return forecast.find((r) => r.variant_id === variantId) ?? null
}

// ─── Node export — follows the variantNode.computed pattern ──────────────────

export const variantNode = {
  computed: {
    stockUrgency,
    daysUntilZero,
    consumptionUrgency,
    restockRecommendedQty,
    forecastForVariant,
  },
} as const
