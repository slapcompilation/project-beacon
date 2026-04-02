// Layer: Eye — Predictive "Running Low" panel
// Shows variants predicted to hit zero within a configurable threshold,
// based on avg daily consumption from stock_logs.

import { useMemo } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConsumptionStats } from '../hooks'
import { useProducts } from '@/features/inventory/hooks'

interface Props {
  /** Warn when days_until_zero falls below this value. Default 14. */
  thresholdDays?: number
}

export function RunningLow({ thresholdDays = 14 }: Props) {
  const { data: stats = [], isLoading: statsLoading } = useConsumptionStats(30)
  const { data: products = [], isLoading: productsLoading } = useProducts()

  const variantMeta = useMemo(() => {
    const map = new Map<string, { productName: string; variantName: string }>()
    for (const p of products) {
      for (const v of p.product_variants) {
        map.set(v.id, { productName: p.name, variantName: v.name })
      }
    }
    return map
  }, [products])

  const atRisk = useMemo(() =>
    stats
      .filter((s) => s.days_until_zero !== null && s.days_until_zero <= thresholdDays)
      .sort((a, b) => (a.days_until_zero ?? 0) - (b.days_until_zero ?? 0))
      .slice(0, 8),
    [stats, thresholdDays]
  )

  const isLoading = statsLoading || productsLoading

  if (isLoading) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (atRisk.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No variants predicted to run out within {thresholdDays} days.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {atRisk.map((row) => {
        const meta = variantMeta.get(row.variant_id)
        const days = row.days_until_zero ?? 0
        const isUrgent = days <= 3
        const isWarn = days <= 7
        return (
          <div key={row.variant_id} className="flex items-center gap-3 py-1.5">
            <div className={cn(
              'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
              isUrgent ? 'bg-red-100 text-red-600' : isWarn ? 'bg-yellow-100 text-yellow-600' : 'bg-muted text-muted-foreground'
            )}>
              <Clock className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {meta?.productName ?? '—'}
                {meta?.variantName && meta.variantName !== 'Standard' && (
                  <span className="text-muted-foreground font-normal"> — {meta.variantName}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.current_stock} units left · {String(row.avg_daily)}/day avg
              </p>
            </div>
            <span className={cn(
              'flex-shrink-0 text-sm font-semibold tabular-nums',
              isUrgent ? 'text-red-600' : isWarn ? 'text-yellow-600' : 'text-muted-foreground'
            )}>
              ~{String(Math.ceil(days))}d
            </span>
          </div>
        )
      })}
    </div>
  )
}
