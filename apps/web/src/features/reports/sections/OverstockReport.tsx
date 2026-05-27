// Capital tied up above 2× par level — potential cash to release.

import { useMemo } from 'react'
import { format } from 'date-fns'
import { Button, HTMLTable, NonIdealState } from '@blueprintjs/core'
import { formatCurrency } from '@/lib/currency'
import { exportToCsv } from '@/lib/csv'
import type { ProductWithVariants } from '@beacon/types'

export function OverstockReport({ products, currency }: { products: ProductWithVariants[]; currency: string }) {
  const rows = useMemo(
    () =>
      products
        .flatMap((p) =>
          p.product_variants
            .filter((v) => v.low_stock_threshold > 0 && v.current_stock > v.low_stock_threshold * 2)
            .map((v) => ({
              product: p.name, sku: v.sku, variant: v.name,
              current_stock: v.current_stock, threshold: v.low_stock_threshold,
              excess: v.current_stock - v.low_stock_threshold * 2,
              excess_value: (v.current_stock - v.low_stock_threshold * 2) * v.cost,
            }))
        )
        .sort((a, b) => b.excess_value - a.excess_value),
    [products],
  )

  const totalTiedCapital = rows.reduce((s, r) => s + r.excess_value, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length > 0
            ? <><span className="font-semibold text-foreground">{formatCurrency(totalTiedCapital, currency)}</span> in tied-up capital across {String(rows.length)} variant{rows.length !== 1 ? 's' : ''}</>
            : 'No overstock detected'}
        </p>
        <Button
          size="small"
          variant="outlined"
          icon="download"
          disabled={rows.length === 0}
          onClick={() => { exportToCsv(`overstock-${format(new Date(), 'yyyy-MM-dd')}`, rows) }}
        >
          CSV
        </Button>
      </div>
      {rows.length === 0 ? (
        <NonIdealState icon="trending-up" title="No variants exceeding 2× par level." />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Par Level</th>
              <th className="text-right">Excess Units</th>
              <th className="text-right">Tied Capital</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sku}>
                <td className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground"> — {r.variant}</span>}</td>
                <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className="text-right font-semibold tabular-nums">{r.current_stock}</td>
                <td className="text-right text-muted-foreground tabular-nums">{r.threshold}</td>
                <td className="text-right font-semibold text-blue-700 tabular-nums">+{r.excess}</td>
                <td className="text-right font-semibold tabular-nums">{formatCurrency(r.excess_value, currency)}</td>
              </tr>
            ))}
            <tr className="bg-muted/50">
              <td colSpan={5} className="font-semibold">Total tied capital</td>
              <td className="text-right font-bold tabular-nums">{formatCurrency(totalTiedCapital, currency)}</td>
            </tr>
          </tbody>
        </HTMLTable>
      )}
    </div>
  )
}
