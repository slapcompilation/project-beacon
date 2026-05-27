// Cost cross-reference helpers shared by every report.
// Approximates cost-at-event using current variant cost — accurate enough
// for management reporting; exact cost-at-time requires a cost-history join.

import type { ProductWithVariants } from '@beacon/types'
import type { StockMovementRow } from '@/features/inventory/api/reports'

export function buildCostMap(products: ProductWithVariants[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of products) {
    for (const v of p.product_variants) {
      map.set(v.id, v.cost)
    }
  }
  return map
}

export function rowCost(row: StockMovementRow, costMap: Map<string, number>): number {
  return (costMap.get(row.variant_id) ?? 0) * Math.abs(row.quantity_change)
}
