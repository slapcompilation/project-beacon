// Reality Graph — RestockRequest node computed properties
// Layer: Flow (request lifecycle) + Eye (urgency scoring)

import type { RestockRequest, RestockReceive } from '@beacon/types'

// ─── Fulfillment ───────────────────────────────────────────────────────────────

/**
 * Percentage of the requested quantity that has been received.
 * Returns 0 when quantity_needed is 0 (defensive).
 */
export function fulfillmentPct(
  req: Pick<RestockRequest, 'quantity_needed'>,
  receives: Pick<RestockReceive, 'quantity_received'>[],
): number {
  if (req.quantity_needed <= 0) return 0
  const received = receives.reduce((s, r) => s + r.quantity_received, 0)
  return Math.min(100, Math.round((received / req.quantity_needed) * 100))
}

/**
 * Total quantity received against a request.
 */
export function totalReceived(
  receives: Pick<RestockReceive, 'quantity_received'>[],
): number {
  return receives.reduce((s, r) => s + r.quantity_received, 0)
}

/**
 * Remaining quantity still to be received.
 */
export function remainingQty(
  req: Pick<RestockRequest, 'quantity_needed'>,
  receives: Pick<RestockReceive, 'quantity_received'>[],
): number {
  return Math.max(0, req.quantity_needed - totalReceived(receives))
}

// ─── Urgency ──────────────────────────────────────────────────────────────────

export type RestockUrgency = 'critical' | 'high' | 'medium' | 'low'

/**
 * Urgency score for a pending restock request.
 *
 * - critical: approved but not received, and stock is already at zero
 * - high:     pending approval while stock is critically low
 * - medium:   pending/approved, stock is low
 * - low:      pending, stock is comfortable
 */
export function restockUrgency(
  req: Pick<RestockRequest, 'status'>,
  currentStock: number,
  lowStockThreshold: number,
  daysLeft: number | null,
): RestockUrgency {
  const isCriticalStock = currentStock <= 0 || (daysLeft !== null && daysLeft <= 3)
  const isLowStock      = lowStockThreshold > 0 && currentStock <= lowStockThreshold

  if (req.status === 'approved' && isCriticalStock) return 'critical'
  if (isCriticalStock) return 'high'
  if (isLowStock) return 'medium'
  return 'low'
}

// ─── Staleness ────────────────────────────────────────────────────────────────

/**
 * True when a request has been pending for longer than the threshold without
 * being approved, rejected, or fulfilled. Surfaced as an escalation signal.
 */
export function isStale(
  req: Pick<RestockRequest, 'status' | 'created_at'>,
  thresholdDays = 3,
): boolean {
  const pendingStatuses = ['pending', 'pending_manager', 'pending_director']
  if (!pendingStatuses.includes(req.status)) return false
  const ageDays = (Date.now() - new Date(req.created_at).getTime()) / (1000 * 60 * 60 * 24)
  return ageDays > thresholdDays
}

// ─── Estimated cost ───────────────────────────────────────────────────────────

/**
 * Estimated total cost for this request.
 * Uses PO-agreed unit cost when available, falls back to variant cost.
 */
export function estimatedCost(
  req: Pick<RestockRequest, 'quantity_needed' | 'estimated_cost'>,
  poUnitCost: number | null,
  variantCost: number | null,
): number | null {
  if (req.estimated_cost != null) return Number(req.estimated_cost)
  const unitCost = poUnitCost ?? variantCost
  if (unitCost == null) return null
  return unitCost * req.quantity_needed
}

// ─── Node export ──────────────────────────────────────────────────────────────

export const restockRequestNode = {
  computed: {
    fulfillmentPct,
    totalReceived,
    remainingQty,
    restockUrgency,
    isStale,
    estimatedCost,
  },
} as const
