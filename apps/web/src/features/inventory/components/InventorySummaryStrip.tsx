// Top-of-table inventory roll-up: product count, total value, out/low badges.

import { useMemo } from 'react'
import { formatCurrency } from '@/lib/currency'
import type { ProductWithVariants } from '@beacon/types'

export function InventorySummaryStrip({
  products,
  currency,
}: {
  products: ProductWithVariants[]
  currency: string
}) {
  const { totalValue, outOfStock, lowStock } = useMemo(() => {
    let total = 0
    let oos = 0
    let low = 0
    for (const p of products) {
      let allZero = true
      let anyLow = false
      for (const v of p.product_variants) {
        total += v.current_stock * v.cost
        if (v.current_stock > 0) allZero = false
        if (v.low_stock_threshold > 0 && v.current_stock > 0 && v.current_stock <= v.low_stock_threshold) anyLow = true
      }
      if (allZero && p.product_variants.length > 0) oos++
      if (anyLow) low++
    }
    return { totalValue: total, outOfStock: oos, lowStock: low }
  }, [products])

  return (
    <div className="flex flex-wrap items-center gap-6 border-b px-8 py-2.5 bg-muted/30 text-sm">
      <span className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{products.length}</span> products
        {' · '}
        <span className="font-semibold text-foreground">{formatCurrency(totalValue, currency)}</span> total value
      </span>
      {outOfStock > 0 && (
        <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="font-semibold tabular-nums">{outOfStock}</span> out of stock
        </span>
      )}
      {lowStock > 0 && (
        <span className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-600">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          <span className="font-semibold tabular-nums">{lowStock}</span> low stock
        </span>
      )}
    </div>
  )
}
