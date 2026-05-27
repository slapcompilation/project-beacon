// Variants expiring within the next 12 months, sorted by value at risk.

import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  Button, HTMLTable, Intent, NonIdealState, Spinner, SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { exportToCsv } from '@/lib/csv'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useDateFormat } from '@/features/user/hooks'
import { useExpiringVariants } from '@/features/inventory/hooks'

export function ExpiryReport() {
  const { data: variants = [], isLoading } = useExpiringVariants(365)
  const activeHotel = useActiveHotel()
  const currency = activeHotel?.currency ?? 'USD'
  const fmtDate = useDateFormat()

  const rows = useMemo(
    () =>
      variants
        .filter((v) => v.expiry_date)
        .map((v) => {
          const daysLeft = Math.round((new Date(v.expiry_date ?? '').setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
          return {
            product: v.products?.name ?? '—', variant: v.name, sku: v.sku,
            lot_number: v.lot_number ?? '', current_stock: v.current_stock,
            expiry_date: v.expiry_date ?? '', days_left: daysLeft,
            value_at_risk: v.current_stock * v.cost,
          }
        }),
    [variants],
  )

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} variant{rows.length !== 1 ? 's' : ''} with expiry in next 12 months</p>
        <Button
          size="small"
          variant="outlined"
          icon="download"
          disabled={rows.length === 0}
          onClick={() => { exportToCsv(`expiry-${format(new Date(), 'yyyy-MM-dd')}`, rows) }}
        >
          CSV
        </Button>
      </div>
      {rows.length === 0
        ? <NonIdealState icon="calendar" title="No variants expiring in the next 12 months." />
        : (
          <HTMLTable interactive className="w-full">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Lot</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Value at risk</th>
                <th className="text-right">Expiry</th>
                <th className="text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.sku}-${r.expiry_date}`}>
                  <td className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground text-sm"> — {r.variant}</span>}</td>
                  <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="text-muted-foreground text-sm">{r.lot_number || '—'}</td>
                  <td className="text-right font-semibold tabular-nums">{r.current_stock}</td>
                  <td className={cn('text-right tabular-nums font-semibold text-sm', r.days_left < 0 ? 'text-red-600' : r.days_left <= 30 ? 'text-orange-600' : 'text-muted-foreground')}>
                    {r.value_at_risk > 0 ? formatCurrency(r.value_at_risk, currency) : '—'}
                  </td>
                  <td className="text-right text-sm text-muted-foreground tabular-nums">{fmtDate(new Date(r.expiry_date))}</td>
                  <td className={cn('text-right text-sm font-semibold tabular-nums', r.days_left < 0 ? 'text-red-700' : r.days_left <= 7 ? 'text-red-600' : r.days_left <= 30 ? 'text-yellow-600' : 'text-muted-foreground')}>
                    {r.days_left < 0 ? 'Expired' : r.days_left === 0 ? 'Today' : `${String(r.days_left)}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        )}
    </div>
  )
}
