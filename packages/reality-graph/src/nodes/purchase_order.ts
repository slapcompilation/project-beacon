// Reality Graph — PurchaseOrder node computed properties
// Layer: Mind (procurement strategy) + Flow (receiving progress)

import type { PurchaseOrder, POLine, POInvoice } from '@beacon/types'

// ─── Receiving progress ───────────────────────────────────────────────────────

/**
 * Percentage of ordered quantity that has been received across all lines.
 * Returns 0 when there are no lines or total ordered qty is 0.
 */
export function fulfillmentPct(lines: Pick<POLine, 'ordered_qty' | 'received_qty'>[]): number {
  const totalOrdered  = lines.reduce((s, l) => s + l.ordered_qty, 0)
  const totalReceived = lines.reduce((s, l) => s + l.received_qty, 0)
  if (totalOrdered <= 0) return 0
  return Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
}

/**
 * Count of lines fully received (received_qty >= ordered_qty).
 */
export function fulfilledLineCount(lines: Pick<POLine, 'ordered_qty' | 'received_qty'>[]): number {
  return lines.filter((l) => l.received_qty >= l.ordered_qty).length
}

// ─── Cost variance ────────────────────────────────────────────────────────────

/**
 * Aggregate invoice variance as a percentage of the PO total.
 * Positive = invoiced more than ordered (overcharge).
 * Negative = invoiced less (credit or discount).
 * Returns null when no invoices exist.
 */
export function costVariancePct(
  po: Pick<PurchaseOrder, 'total_amount'>,
  invoices: Pick<POInvoice, 'invoice_amount'>[],
): number | null {
  if (invoices.length === 0 || po.total_amount <= 0) return null
  const totalInvoiced = invoices.reduce((s, i) => s + i.invoice_amount, 0)
  return ((totalInvoiced - po.total_amount) / po.total_amount) * 100
}

/**
 * Absolute invoice variance amount (invoiced − ordered).
 * Returns null when no invoices exist.
 */
export function costVarianceAmount(
  po: Pick<PurchaseOrder, 'total_amount'>,
  invoices: Pick<POInvoice, 'invoice_amount'>[],
): number | null {
  if (invoices.length === 0) return null
  const totalInvoiced = invoices.reduce((s, i) => s + i.invoice_amount, 0)
  return totalInvoiced - po.total_amount
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

/**
 * True when the expected delivery date has passed and the PO is still open.
 */
export function isOverdue(po: Pick<PurchaseOrder, 'status' | 'expected_delivery_date'>): boolean {
  const closedStatuses = ['closed', 'cancelled']
  if (closedStatuses.includes(po.status)) return false
  if (!po.expected_delivery_date) return false
  return new Date(po.expected_delivery_date) < new Date()
}

/**
 * Days since the PO was sent to the supplier.
 * Returns null when the PO hasn't been sent yet.
 */
export function daysOpenSinceSent(po: Pick<PurchaseOrder, 'sent_at'>): number | null {
  if (!po.sent_at) return null
  return Math.round((Date.now() - new Date(po.sent_at).getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Days until the expected delivery date.
 * Negative = overdue. Null = no delivery date set.
 */
export function daysUntilDelivery(po: Pick<PurchaseOrder, 'expected_delivery_date'>): number | null {
  if (!po.expected_delivery_date) return null
  return Math.round(
    (new Date(po.expected_delivery_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
}

// ─── Node export ──────────────────────────────────────────────────────────────

export const purchaseOrderNode = {
  computed: {
    fulfillmentPct,
    fulfilledLineCount,
    costVariancePct,
    costVarianceAmount,
    isOverdue,
    daysOpenSinceSent,
    daysUntilDelivery,
  },
} as const
