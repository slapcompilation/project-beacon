// "Where is my money going and how fast?" — the report managers actually need.

import { useMemo } from 'react'
import {
  Button, HTMLTable, Intent, NonIdealState, Spinner, SpinnerSize,
} from '@blueprintjs/core'
import { formatCurrency } from '@/lib/currency'
import { exportToCsv } from '@/lib/csv'
import { useDateRange, DateRangeBar } from '@/components/DateRangeBar'
import { useStockMovementReport } from '@/features/inventory/hooks/reports'
import type { ProductWithVariants } from '@beacon/types'
import { buildCostMap, rowCost } from './_shared'

export function ConsumptionReport({
  products,
  currency,
}: {
  products: ProductWithVariants[]
  currency: string
}) {
  const dateRange = useDateRange({ defaultPreset: '30d' })
  const { dateFrom, dateTo } = dateRange
  const { data: rows = [], isLoading } = useStockMovementReport(dateFrom, dateTo)

  const costMap = useMemo(() => buildCostMap(products), [products])

  const periodDays = useMemo(() => {
    const d1 = new Date(dateFrom)
    const d2 = new Date(dateTo)
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
  }, [dateFrom, dateTo])

  const removals = useMemo(
    () => rows.filter((r) => !r.is_revert && r.quantity_change < 0),
    [rows],
  )

  const byProduct = useMemo(() => {
    const map = new Map<string, { units: number; cost: number; sku: string; category: string | null }>()
    for (const r of removals) {
      const key = `${r.product_name}||${r.variant_name}`
      const prev = map.get(key) ?? { units: 0, cost: 0, sku: r.sku, category: r.category_name }
      map.set(key, {
        units:    prev.units + Math.abs(r.quantity_change),
        cost:     prev.cost + rowCost(r, costMap),
        sku:      r.sku,
        category: r.category_name,
      })
    }
    return [...map.entries()]
      .map(([key, v]) => {
        const [product = '', variant = ''] = key.split('||')
        return {
          product,
          variant,
          ...v,
          daily_units: v.units / periodDays,
          daily_cost:  v.cost  / periodDays,
        }
      })
      .sort((a, b) => b.cost - a.cost)
  }, [removals, costMap, periodDays])

  const byCategory = useMemo(() => {
    const map = new Map<string, { units: number; cost: number }>()
    for (const r of removals) {
      const cat = r.category_name ?? '— Uncategorised'
      const prev = map.get(cat) ?? { units: 0, cost: 0 }
      map.set(cat, { units: prev.units + Math.abs(r.quantity_change), cost: prev.cost + rowCost(r, costMap) })
    }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost)
  }, [removals, costMap])

  const totalCost  = byProduct.reduce((s, r) => s + r.cost, 0)
  const totalUnits = byProduct.reduce((s, r) => s + r.units, 0)

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
    </div>
  )

  if (removals.length === 0) return (
    <NonIdealState
      icon="pulse"
      title="No stock removals in this period."
      description='Stock removals are recorded via "Adjust Stock" or the Scan page.'
    />
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar {...dateRange} />
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCurrency(totalCost, currency)}</span>
          {' '}consumed · <span className="font-semibold text-foreground">{String(totalUnits)}</span> units
          {' '}· <span className="font-semibold">{formatCurrency(totalCost / periodDays, currency)}/day</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold mb-2">Cost consumed by category</p>
          <div className="rounded-lg border divide-y">
            {byCategory.map(([cat, { units, cost }]) => (
              <div key={cat} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cat}</p>
                  <p className="text-xs text-muted-foreground">{String(units)} units</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(cost, currency)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(cost / periodDays, currency)}/day</p>
                </div>
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${String(totalCost > 0 ? (cost / totalCost) * 100 : 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-2">Top products by cost consumed</p>
          <div className="rounded-lg border divide-y">
            {byProduct.slice(0, 10).map((r, rank) => (
              <div key={r.sku} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-muted-foreground w-4 tabular-nums">{rank + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.product}{r.variant !== 'Standard' ? <span className="text-muted-foreground"> — {r.variant}</span> : ''}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{r.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(r.cost, currency)}</p>
                  <p className="text-[10px] text-muted-foreground">{r.daily_units.toFixed(1)} units/day</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">All products</p>
          <Button
            size="small"
            variant="outlined"
            icon="download"
            onClick={() => { exportToCsv(`consumption-${dateFrom}-to-${dateTo}`, byProduct.map((r) => ({ ...r, cost: r.cost.toFixed(2), daily_cost: r.daily_cost.toFixed(2), daily_units: r.daily_units.toFixed(2) }))) }}
          >
            CSV
          </Button>
        </div>
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th className="text-right">Units consumed</th>
              <th className="text-right">Cost consumed</th>
              <th className="text-right">Daily rate</th>
            </tr>
          </thead>
          <tbody>
            {byProduct.map((r) => (
              <tr key={r.sku}>
                <td className="font-medium">
                  {r.product}
                  {r.variant !== 'Standard' && <span className="text-muted-foreground"> — {r.variant}</span>}
                </td>
                <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className="text-sm text-muted-foreground">{r.category ?? '—'}</td>
                <td className="text-right tabular-nums">{r.units}</td>
                <td className="text-right font-semibold tabular-nums">{formatCurrency(r.cost, currency)}</td>
                <td className="text-right text-sm text-muted-foreground tabular-nums">
                  {formatCurrency(r.daily_cost, currency)}/d
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </div>
    </div>
  )
}
