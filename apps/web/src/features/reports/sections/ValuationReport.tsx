// Inventory valuation: stock value by product, sorted by total value.

import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  Button, HTMLTable, Intent, Tag,
} from '@blueprintjs/core'
import { formatCurrency, getCurrencySymbol } from '@/lib/currency'
import { exportToCsv } from '@/lib/csv'
import { exportToPdf } from '@/lib/pdf'
import type { ProductWithVariants } from '@beacon/types'

export function ValuationReport({
  products,
  currency,
}: {
  products: ProductWithVariants[]
  currency: string
}) {
  const sym = getCurrencySymbol(currency)

  const rows = useMemo(
    () =>
      products.flatMap((p) =>
        p.product_variants.map((v) => ({
          product:     p.name,
          sku:         v.sku,
          variant:     v.name,
          category:    p.categories?.name ?? '—',
          stock:       v.current_stock,
          threshold:   v.low_stock_threshold,
          unit_cost:   v.cost,
          total_value: v.current_stock * v.cost,
          // Health: 0=out, 1=low, 2=ok, 3=overstock
          health: v.current_stock === 0 ? 0
            : v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold ? 1
            : v.low_stock_threshold > 0 && v.current_stock > v.low_stock_threshold * 3 ? 3
            : 2,
        }))
      ).sort((a, b) => b.total_value - a.total_value),
    [products],
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) map.set(r.category, (map.get(r.category) ?? 0) + r.total_value)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  const grandTotal = rows.reduce((s, r) => s + r.total_value, 0)
  const zeroValueRows = rows.filter((r) => r.total_value === 0).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCurrency(grandTotal, currency)}</span>
          {' '}total across {String(rows.length)} variants
          {zeroValueRows > 0 && <span className="ml-2 text-yellow-600">· {String(zeroValueRows)} with no cost set</span>}
        </div>
        <div className="flex gap-2">
          <Button
            size="small"
            variant="outlined"
            icon="download"
            onClick={() => { exportToCsv(`valuation-${format(new Date(), 'yyyy-MM-dd')}`, rows.map((r) => ({ ...r, unit_cost: r.unit_cost.toFixed(2), total_value: r.total_value.toFixed(2) }))) }}
          >
            CSV
          </Button>
          <Button
            size="small"
            variant="outlined"
            icon="document"
            onClick={() => { exportToPdf(`Inventory Valuation ${format(new Date(), 'yyyy-MM-dd')}`, ['Product', 'SKU', 'Variant', 'Category', 'Stock', `Unit Cost (${sym})`, `Total (${sym})`], rows.map((r) => [r.product, r.sku, r.variant, r.category, r.stock, r.unit_cost.toFixed(2), r.total_value.toFixed(2)])) }}
          >
            PDF
          </Button>
        </div>
      </div>

      {byCategory.length > 1 && (
        <div className="rounded-lg border divide-y">
          {byCategory.map(([cat, value]) => (
            <div key={cat} className="flex items-center gap-4 px-4 py-2.5">
              <span className="text-sm font-medium w-36 truncate">{cat}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${String(grandTotal > 0 ? (value / grandTotal) * 100 : 0)}%` }} />
              </div>
              <span className="font-semibold text-sm w-24 text-right tabular-nums">{formatCurrency(value, currency)}</span>
              <span className="text-xs text-muted-foreground w-8 text-right">{grandTotal > 0 ? `${String(Math.round((value / grandTotal) * 100))}%` : '0%'}</span>
            </div>
          ))}
        </div>
      )}

      <HTMLTable interactive className="w-full">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Variant</th>
            <th>Category</th>
            <th className="text-right">Stock</th>
            <th className="text-right">Par Level</th>
            <th className="text-right">Unit Cost</th>
            <th className="text-right">Total Value</th>
            <th>Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sku}>
              <td className="font-medium">{r.product}</td>
              <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
              <td className="text-muted-foreground text-sm">{r.variant}</td>
              <td className="text-sm text-muted-foreground">{r.category}</td>
              <td className="text-right font-semibold tabular-nums">{r.stock}</td>
              <td className="text-right text-muted-foreground text-sm tabular-nums">{r.threshold > 0 ? r.threshold : '—'}</td>
              <td className="text-right text-sm text-muted-foreground tabular-nums">{sym}{r.unit_cost.toFixed(2)}</td>
              <td className="text-right font-semibold tabular-nums">{sym}{r.total_value.toFixed(2)}</td>
              <td>
                {r.health === 0 && <Tag minimal intent={Intent.DANGER} className="!text-[10px]">Out</Tag>}
                {r.health === 1 && <Tag minimal intent={Intent.WARNING} className="!text-[10px]">Low</Tag>}
                {r.health === 3 && <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">Overstock</Tag>}
                {r.health === 2 && <span className="text-[10px] text-green-600">OK</span>}
              </td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="bg-muted/50">
              <td colSpan={7} className="font-semibold">Grand Total</td>
              <td className="text-right font-bold tabular-nums">{formatCurrency(grandTotal, currency)}</td>
              <td />
            </tr>
          )}
        </tbody>
      </HTMLTable>
    </div>
  )
}
