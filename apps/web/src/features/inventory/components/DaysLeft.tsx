// Eye Layer — days-until-zero indicator with burn-rate trend.
// Principle 3: intelligence everywhere. Compresses forecast + trend +
// last-receive into one cell.

import { Icon } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import type { InventoryIntelligenceRow } from '@/features/eye/api'

export function DaysLeft({ variantIds, currentStocks, forecastMap, intelligenceMap }: {
  variantIds: string[]
  currentStocks: number[]
  forecastMap: Map<string, number>
  intelligenceMap: Map<string, InventoryIntelligenceRow>
}) {
  if (variantIds.length === 0) return <span className="text-muted-foreground">—</span>
  let minDays = Infinity
  let anyData = false
  let primaryAvg: number | undefined
  let primaryVariantId: string | undefined
  for (let i = 0; i < variantIds.length; i++) {
    const stock = currentStocks[i] ?? 0
    if (stock === 0) return <span className="text-red-600 font-medium text-xs">Out</span>
    const avgDaily = forecastMap.get(variantIds[i] ?? '')
    if (avgDaily && avgDaily > 0) {
      anyData = true
      const days = stock / avgDaily
      if (days < minDays) { minDays = days; primaryAvg = avgDaily; primaryVariantId = variantIds[i] }
    }
  }
  if (!anyData) return null
  const d = Math.round(minDays)
  const intel = primaryVariantId ? intelligenceMap.get(primaryVariantId) : undefined
  const trendPct = intel?.trend_pct ?? null
  const lastRecvDays = intel?.last_received_days_ago ?? null

  return (
    <div className="text-xs leading-tight space-y-0.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('font-medium', d <= 7 ? 'text-red-600' : d <= 14 ? 'text-yellow-600' : 'text-muted-foreground')}>
          ~{d}d
        </span>
        {trendPct !== null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 tabular-nums',
            trendPct > 5  ? 'text-rose-600 dark:text-rose-400' :
            trendPct < -5 ? 'text-emerald-600 dark:text-emerald-400' :
            'text-muted-foreground',
          )}>
            <Icon
              icon={trendPct > 5 ? 'trending-up' : trendPct < -5 ? 'trending-down' : 'minus'}
              size={10}
            />
            {Math.abs(Math.round(trendPct))}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
        {primaryAvg != null && <span>~{primaryAvg.toFixed(1)}/d · 30d avg</span>}
        {lastRecvDays != null && <span>· recv {lastRecvDays}d ago</span>}
      </div>
    </div>
  )
}
