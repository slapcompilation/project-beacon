// Eye Layer — surfaces forecast + waste + par + lead-time context inline
// on every product row. Principle 3: intelligence everywhere. Turns a data
// row into a decision surface.
//
// Format: 47 units · par 60 · ↓12% · ~6d left · [Request Restock]

import { Icon } from '@blueprintjs/core'
import { addDays, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { WhyButton } from '@/components/WhySheet'
import { getTotalStock } from '@beacon/types'
import type { ProductWithVariants, ProductVariant, Supplier } from '@beacon/types'
import type { InventoryIntelligenceRow } from '@/features/eye/api'
import { pickWorstVariant } from './forecastUtils'

export function RowIntelStrip({
  product,
  forecastMap,
  intelligenceMap,
  wasteRadarIds,
  openRestockIds,
  suppliersMap,
  onRequestRestock,
}: {
  product: ProductWithVariants
  forecastMap: Map<string, number>
  intelligenceMap: Map<string, InventoryIntelligenceRow>
  wasteRadarIds: Set<string>
  openRestockIds: Set<string>
  suppliersMap: Map<string, Supplier>
  onRequestRestock: (variantId: string, qty: number) => void
}) {
  const variants = product.product_variants
  if (variants.length === 0) return null

  const totalStock = getTotalStock(variants)
  const primaryVariant = pickWorstVariant(variants, forecastMap) ?? variants[0]

  const par       = primaryVariant.low_stock_threshold
  const avgDaily  = forecastMap.get(primaryVariant.id)
  const days      = avgDaily && avgDaily > 0 ? Math.round(totalStock / avgDaily) : null
  const intel     = intelligenceMap.get(primaryVariant.id)
  const trendPct  = intel?.trend_pct ?? null
  const hasWaste  = variants.some((v) => wasteRadarIds.has(v.id))
  const hasOpen   = variants.some((v) => openRestockIds.has(v.id))
  const showCta   = days !== null && days <= 14 && !hasOpen && totalStock > 0

  const supplierEntry = (primaryVariant as ProductVariant & { default_supplier_id?: string }).default_supplier_id
    ? suppliersMap.get((primaryVariant as ProductVariant & { default_supplier_id?: string }).default_supplier_id)
    : undefined
  const leadTimeDays = (supplierEntry as (Supplier & { lead_time_days?: number | null }) | undefined)?.lead_time_days ?? null
  const supplyGap = days !== null && leadTimeDays !== null ? days - leadTimeDays : null

  const hasAnySig = days !== null || (trendPct !== null && Math.abs(trendPct) > 3) || hasWaste || (par > 0)
  if (!hasAnySig) return null

  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap min-w-0">
      {par > 0 && (
        <span className={cn(
          'text-[10px] tabular-nums',
          totalStock <= par ? 'text-yellow-600 dark:text-yellow-500 font-medium' : 'text-muted-foreground',
        )}>
          par {par}
        </span>
      )}

      {trendPct !== null && Math.abs(trendPct) > 3 && (
        <span className={cn(
          'inline-flex items-center gap-0.5 text-[10px] tabular-nums',
          trendPct > 5  ? 'text-rose-600 dark:text-rose-400' :
          trendPct < -5 ? 'text-emerald-600 dark:text-emerald-400' :
          'text-muted-foreground',
        )}>
          <Icon icon={trendPct > 3 ? 'trending-up' : 'trending-down'} size={10} />
          {Math.abs(Math.round(trendPct))}%
        </span>
      )}

      {days !== null && (
        <span className={cn(
          'text-[10px] font-medium tabular-nums',
          days === 0   ? 'text-red-600' :
          days <= 7   ? 'text-red-600' :
          days <= 14  ? 'text-yellow-600 dark:text-yellow-500' :
          'text-muted-foreground',
        )}>
          ~{days}d
        </span>
      )}

      {hasWaste && (
        <span className="text-[10px] text-orange-600 dark:text-orange-400">waste↑</span>
      )}

      {showCta && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            const reorderQty = (() => {
              if (par > 0 && avgDaily && avgDaily > 0 && leadTimeDays !== null) {
                return Math.max(Math.ceil(par - totalStock + avgDaily * leadTimeDays), par)
              }
              if (par > 0) return Math.max(par * 2 - totalStock, par)
              return Math.max(primaryVariant.current_stock * 2, 10)
            })()
            onRequestRestock(primaryVariant.id, reorderQty)
          }}
          className={cn(
            'inline-flex items-center gap-0.5 rounded border px-1.5 py-px text-[10px] font-medium transition-colors',
            supplyGap !== null && supplyGap <= 0
              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50'
              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50',
          )}
        >
          {supplyGap !== null && supplyGap <= 0 ? '⚠ Order Now' : '↗ Restock'}
        </button>
      )}

      {hasOpen && days !== null && days <= 14 && (
        <span className="text-[10px] text-muted-foreground italic">restock pending</span>
      )}

      {supplyGap !== null && days !== null && (
        supplyGap <= 0 ? (
          <span className="inline-flex items-center gap-0.5 rounded border border-red-200 bg-red-50 px-1.5 py-px text-[10px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            ⚠ order now · stockout {format(addDays(new Date(), days), 'MMM d')}
          </span>
        ) : supplyGap <= 7 ? (
          <span className={cn(
            'text-[10px] font-medium',
            supplyGap <= 3 ? 'text-yellow-600 dark:text-yellow-500' : 'text-muted-foreground',
          )}>
            order by {format(addDays(new Date(), supplyGap), 'MMM d')} · {String(days)}d left
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            lead {String(leadTimeDays)}d
          </span>
        )
      )}

      {days !== null && days <= 14 && (
        <WhyButton
          variantId={primaryVariant.id}
          variantName={variants.length > 1 ? `${product.name} — ${primaryVariant.name}` : product.name}
          currentStock={totalStock}
        />
      )}
    </div>
  )
}
