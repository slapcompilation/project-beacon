// Variants below par ranked by urgency; out-of-stock items at the top.

import { useMemo } from 'react'
import { format } from 'date-fns'
import { Button, HTMLTable, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import { formatCurrency } from '@/lib/currency'
import { exportToCsv } from '@/lib/csv'
import { getStockStatus } from '@beacon/types'
import type { ProductWithVariants } from '@beacon/types'

export function LowStockReport({ products, currency }: { products: ProductWithVariants[]; currency: string }) {
  const rows = useMemo(
    () =>
      products
        .filter((p) => { const s = getStockStatus(p.product_variants); return s === 'low_stock' || s === 'out_of_stock' })
        .flatMap((p) =>
          p.product_variants
            .filter((v) => v.current_stock === 0 || (v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold))
            .map((v) => ({
              product: p.name, sku: v.sku, variant: v.name,
              current_stock: v.current_stock, threshold: v.low_stock_threshold,
              value_at_stake: v.current_stock * v.cost,
              gap: Math.max(0, v.low_stock_threshold - v.current_stock),
              status: v.current_stock === 0 ? 'out_of_stock' : 'low_stock',
            }))
        )
        .sort((a, b) => a.current_stock - b.current_stock),
    [products],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.filter((r) => r.status === 'out_of_stock').length > 0 && <span className="text-red-600 font-semibold">{rows.filter((r) => r.status === 'out_of_stock').length} out of stock · </span>}
          {rows.filter((r) => r.status === 'low_stock').length > 0 && <span className="text-yellow-600 font-semibold">{rows.filter((r) => r.status === 'low_stock').length} low stock</span>}
          {rows.length === 0 && 'All products above par level'}
        </p>
        <Button
          size="small"
          variant="outlined"
          icon="download"
          disabled={rows.length === 0}
          onClick={() => { exportToCsv(`low-stock-${format(new Date(), 'yyyy-MM-dd')}`, rows) }}
        >
          CSV
        </Button>
      </div>
      {rows.length === 0 ? (
        <NonIdealState icon="tick-circle" title="All products are above par level" />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Par Level</th>
              <th className="text-right">Gap</th>
              <th className="text-right">Stock Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sku}>
                <td className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground text-sm"> — {r.variant}</span>}</td>
                <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className="text-right font-semibold tabular-nums">{r.current_stock}</td>
                <td className="text-right text-muted-foreground tabular-nums">{r.threshold || '—'}</td>
                <td className="text-right text-red-600 font-medium tabular-nums">{r.gap > 0 ? `-${String(r.gap)}` : '—'}</td>
                <td className="text-right tabular-nums text-sm">{r.value_at_stake > 0 ? formatCurrency(r.value_at_stake, currency) : <span className="text-muted-foreground">—</span>}</td>
                <td>
                  {r.status === 'out_of_stock'
                    ? <Tag minimal intent={Intent.DANGER} className="!text-[10px]">Out of Stock</Tag>
                    : <Tag minimal intent={Intent.WARNING} className="!text-[10px]">Low Stock</Tag>}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      )}
    </div>
  )
}
