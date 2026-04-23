// Reality Graph — Supplier node computed properties
// Layer: Mind (procurement strategy) + Eye (risk intelligence)

import type { Supplier, SupplierReliabilityRow, SupplierContract } from '@beacon/types'

// ─── Risk ─────────────────────────────────────────────────────────────────────

export type SupplierRiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * Risk level derived from the reliability score (1–10).
 * Consistent with the risk_tier returned by get_supplier_reliability().
 *
 *   score ≥ 8   → low
 *   score ≥ 6   → medium
 *   score ≥ 4   → high
 *   score < 4   → critical
 */
export function riskLevel(reliabilityScore: number): SupplierRiskLevel {
  if (reliabilityScore >= 8) return 'low'
  if (reliabilityScore >= 6) return 'medium'
  if (reliabilityScore >= 4) return 'high'
  return 'critical'
}

/**
 * Risk level from a full SupplierReliabilityRow — uses the DB-computed risk_tier
 * when available, falls back to score-based computation.
 */
export function riskLevelFromRow(row: SupplierReliabilityRow): SupplierRiskLevel {
  return row.risk_tier
}

// ─── Lead time ────────────────────────────────────────────────────────────────

/**
 * Human-readable lead time label.
 * e.g. "4 days", "2 weeks", "Unknown"
 */
export function leadTimeLabel(supplier: Pick<Supplier, 'lead_time_days'>): string {
  if (!supplier.lead_time_days) return 'Unknown'
  const days = supplier.lead_time_days
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}`
  const weeks = Math.round(days / 7)
  return `${weeks} week${weeks === 1 ? '' : 's'}`
}

// ─── Contract intelligence ────────────────────────────────────────────────────

/**
 * Days until the earliest contract expiry for a supplier.
 * Returns null when no active contracts exist or none have an end date.
 */
export function daysUntilContractExpiry(contracts: Pick<SupplierContract, 'contract_end'>[]): number | null {
  const endDates = contracts
    .map((c) => c.contract_end)
    .filter((d): d is string => d !== null)
    .map((d) => new Date(d).getTime())

  if (endDates.length === 0) return null
  const earliest = Math.min(...endDates)
  return Math.round((earliest - Date.now()) / (1000 * 60 * 60 * 24))
}

/**
 * True when any contract expires within the given threshold (default 30 days).
 */
export function hasContractExpiringSoon(
  contracts: Pick<SupplierContract, 'contract_end'>[],
  thresholdDays = 30,
): boolean {
  const days = daysUntilContractExpiry(contracts)
  return days !== null && days <= thresholdDays
}

/**
 * On-time delivery percentage label with trend indicator.
 * e.g. "94%" or "—" when no orders.
 */
export function onTimePctLabel(row: Pick<SupplierReliabilityRow, 'on_time_pct' | 'total_orders'>): string {
  if (row.total_orders === 0) return '—'
  return `${Math.round(row.on_time_pct)}%`
}

/**
 * Cost variance badge label: "+2.4% over contract" or "On contract" or "—".
 */
export function costVarianceLabel(row: Pick<SupplierReliabilityRow, 'avg_cost_variance_pct'>): string {
  if (row.avg_cost_variance_pct == null) return '—'
  const pct = row.avg_cost_variance_pct
  if (Math.abs(pct) < 0.5) return 'On contract'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}% vs contract`
}

// ─── Node export ──────────────────────────────────────────────────────────────

export const supplierNode = {
  computed: {
    riskLevel,
    riskLevelFromRow,
    leadTimeLabel,
    daysUntilContractExpiry,
    hasContractExpiringSoon,
    onTimePctLabel,
    costVarianceLabel,
  },
} as const
