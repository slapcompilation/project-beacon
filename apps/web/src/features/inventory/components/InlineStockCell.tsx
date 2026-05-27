// Flow Layer — physical count correction with auto-delta calculation.
// Single-variant click-to-edit. Multi-variant defers to the Adjust Stock modal.

import { useRef, useState } from 'react'
import { Icon } from '@blueprintjs/core'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getTotalStock } from '@beacon/types'
import type { ProductWithVariants } from '@beacon/types'
import type { InventoryIntelligenceRow } from '@/features/eye/api'
import { useAdjustStock } from '@/features/inventory/hooks'

export function InlineStockCell({
  product,
  forecastMap,
  intelligenceMap,
  onOpenModal,
}: {
  product: ProductWithVariants
  forecastMap: Map<string, number>
  intelligenceMap: Map<string, InventoryIntelligenceRow>
  onOpenModal: () => void
}) {
  const adjustStock = useAdjustStock()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const variants = product.product_variants
  const isSingle = variants.length === 1
  const variant = isSingle ? variants[0] : null
  const totalStock = getTotalStock(variants)
  const threshold = variant?.low_stock_threshold ?? 0

  const parRatio = variant && threshold > 0
    ? Math.min(variant.current_stock / threshold, 2)
    : null

  const primaryV = variants.length > 0
    ? variants.reduce((worst, v) => {
        const dw = (forecastMap.get(worst.id) ?? 0) > 0 ? worst.current_stock / (forecastMap.get(worst.id) ?? 1) : Infinity
        const dv = (forecastMap.get(v.id)    ?? 0) > 0 ? v.current_stock    / (forecastMap.get(v.id)    ?? 1) : Infinity
        return dv < dw ? v : worst
      }, variants[0])
    : null
  const avgDailyCell = primaryV ? (forecastMap.get(primaryV.id) ?? null) : null
  const daysCell = avgDailyCell && avgDailyCell > 0 ? Math.round(totalStock / avgDailyCell) : null
  const trendPctCell = primaryV ? (intelligenceMap.get(primaryV.id)?.trend_pct ?? null) : null

  const startEdit = () => {
    if (!isSingle || !variant) { onOpenModal(); return }
    setValue(String(variant.current_stock))
    setEditing(true)
    setTimeout(() => { inputRef.current?.select() }, 0)
  }

  const commit = async () => {
    if (!variant) { setEditing(false); return }
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed < 0) { setEditing(false); return }
    const delta = parsed - variant.current_stock
    if (delta === 0) { setEditing(false); return }
    try {
      await adjustStock.mutateAsync({ variantId: variant.id, delta, reason: 'Physical count' })
      toast.success(`Stock corrected: ${delta > 0 ? '+' : ''}${String(delta)}`)
    } catch {
      toast.error('Failed to update stock')
    }
    setEditing(false)
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => { setValue(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => { void commit() }}
          className="h-7 w-20 rounded border border-primary bg-background px-2 text-right text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoFocus
        />
      ) : (
        <button
          onClick={startEdit}
          className={cn(
            'rounded px-1 py-0.5 text-sm font-semibold tabular-nums transition-colors -mr-1',
            isSingle ? 'hover:bg-muted cursor-pointer' : 'cursor-default',
            totalStock === 0 && 'text-red-600',
          )}
          title={isSingle ? 'Click to enter physical count' : 'Open Adjust Stock to edit multi-variant'}
        >
          {totalStock}{isSingle && variant?.unit_of_measure ? ` ${variant.unit_of_measure}` : ''}
        </button>
      )}

      {!editing && (daysCell !== null || trendPctCell !== null) && (
        <div className="flex items-center gap-1 text-[10px] tabular-nums">
          {trendPctCell !== null && Math.abs(trendPctCell) > 1 && (
            <span className={cn(
              'inline-flex items-center gap-0.5',
              trendPctCell > 5  ? 'text-rose-600 dark:text-rose-400' :
              trendPctCell < -5 ? 'text-emerald-600 dark:text-emerald-400' :
              'text-muted-foreground',
            )}>
              <Icon icon={trendPctCell > 1 ? 'trending-up' : 'trending-down'} size={10} />
              {Math.abs(Math.round(trendPctCell))}%
            </span>
          )}
          {daysCell !== null && (
            <span className={cn(
              'font-medium',
              daysCell <= 7  ? 'text-red-600' :
              daysCell <= 14 ? 'text-yellow-600 dark:text-yellow-500' :
              'text-muted-foreground',
            )}>
              ~{daysCell}d
            </span>
          )}
          {avgDailyCell !== null && avgDailyCell > 0 && (
            <span className="text-muted-foreground/70" title="Based on 30-day avg consumption">
              · {avgDailyCell.toFixed(1)}/day
            </span>
          )}
        </div>
      )}

      {parRatio !== null && !editing && (
        <div className="w-14 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              parRatio === 0 ? 'bg-red-500' :
              parRatio <= 1 ? 'bg-yellow-500' :
              parRatio <= 1.5 ? 'bg-green-500' : 'bg-blue-400'
            )}
            style={{ width: `${String(Math.min(parRatio / 2, 1) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}
