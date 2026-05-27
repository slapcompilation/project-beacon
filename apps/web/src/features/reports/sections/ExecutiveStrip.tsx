// "What is the state of my operation right now?" — answered in 4 numbers.

import { useMemo } from 'react'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { Trend } from '@/components/Trend'
import type { ProductWithVariants } from '@beacon/types'
import type { StockMovementRow } from '@/features/inventory/api/reports'
import { buildCostMap, rowCost } from './_shared'

export function ExecutiveStrip({
  products,
  mtdMovements,
  priorMovements,
  currency,
}: {
  products: ProductWithVariants[]
  mtdMovements: StockMovementRow[]
  priorMovements: StockMovementRow[]
  currency: string
}) {
  const costMap = useMemo(() => buildCostMap(products), [products])

  const totalValue = useMemo(
    () => products.reduce((s, p) => s + p.product_variants.reduce((sv, v) => sv + v.current_stock * v.cost, 0), 0),
    [products],
  )
  const outOfStock = products.filter((p) => p.product_variants.every((v) => v.current_stock === 0)).length
  const lowStock   = products.filter((p) => p.product_variants.some((v) => v.low_stock_threshold > 0 && v.current_stock > 0 && v.current_stock <= v.low_stock_threshold)).length

  const wasteCost = (rows: StockMovementRow[]) =>
    rows.filter((r) => !r.is_revert && r.quantity_change < 0 && r.removal_category)
        .reduce((s, r) => s + rowCost(r, costMap), 0)

  const mtdWaste   = wasteCost(mtdMovements)
  const priorWaste = wasteCost(priorMovements)

  const mtdConsumed = mtdMovements
    .filter((r) => !r.is_revert && r.quantity_change < 0)
    .reduce((s, r) => s + rowCost(r, costMap), 0)

  const priorConsumed = priorMovements
    .filter((r) => !r.is_revert && r.quantity_change < 0)
    .reduce((s, r) => s + rowCost(r, costMap), 0)

  const kpis: { label: string; value: string; sub: React.ReactNode; icon: IconName; color: string; bg: string }[] = [
    {
      label: 'Inventory Value',
      value: formatCurrency(totalValue, currency),
      sub: `${String(products.length)} products`,
      icon: 'box',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Consumed MTD',
      value: formatCurrency(mtdConsumed, currency),
      sub: <Trend current={mtdConsumed} prior={priorConsumed} />,
      icon: 'pulse',
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      label: 'Waste Cost MTD',
      value: formatCurrency(mtdWaste, currency),
      sub: <Trend current={mtdWaste} prior={priorWaste} invertColor />,
      icon: 'trending-down',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Needs Attention',
      value: String(outOfStock + lowStock),
      sub: `${String(outOfStock)} out · ${String(lowStock)} low`,
      icon: 'warning-sign',
      color: outOfStock > 0 ? 'text-red-600 dark:text-red-400' : lowStock > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600',
      bg: outOfStock > 0 ? 'bg-red-50 dark:bg-red-950/30' : lowStock > 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-green-50 dark:bg-green-950/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpis.map(({ label, value, sub, icon, color, bg }) => (
        <div key={label} className="rounded-lg border bg-card p-4 flex items-start gap-3">
          <div className={cn('rounded-md p-2 shrink-0', bg)}>
            <Icon icon={icon} size={16} className={color} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
