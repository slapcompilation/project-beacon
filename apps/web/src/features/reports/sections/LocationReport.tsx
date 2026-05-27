// Variants below par grouped by storage location.

import { useMemo } from 'react'
import {
  HTMLTable, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { useLowStockByLocation } from '@/features/locations/hooks'

export function LocationReport() {
  const { data: rows = [], isLoading } = useLowStockByLocation()
  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = row.location_path ?? '— No location assigned'
      const arr = map.get(key) ?? []
      arr.push(row)
      map.set(key, arr)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
    </div>
  )
  if (rows.length === 0) return <NonIdealState icon="tick-circle" title="All stocked items are above par level" />

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{rows.length} variant{rows.length !== 1 ? 's' : ''} below par across locations</p>
      {grouped.map(([path, items]) => (
        <div key={path} className="space-y-2">
          <p className="text-sm font-semibold">{path}</p>
          <HTMLTable interactive className="w-full">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Par</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.variant_id}>
                  <td className="font-medium">{r.product_name}</td>
                  <td className="text-muted-foreground">{r.variant_name}</td>
                  <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="text-right font-semibold tabular-nums">{r.current_stock}</td>
                  <td className="text-right text-muted-foreground tabular-nums">{r.low_stock_threshold}</td>
                  <td>
                    {r.current_stock === 0
                      ? <Tag minimal intent={Intent.DANGER} className="!text-[10px]">Out</Tag>
                      : <Tag minimal intent={Intent.WARNING} className="!text-[10px]">Low</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </div>
      ))}
    </div>
  )
}
