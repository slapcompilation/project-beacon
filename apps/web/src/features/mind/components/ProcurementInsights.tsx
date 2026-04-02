// Layer: Mind — Procurement leverage panel
// Shows supplier spend, order volume, and avg fulfillment time.

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useProcurementInsights } from '../hooks'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const RANGE_OPTIONS = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y',  days: 365 },
] as const

export function ProcurementInsights() {
  const [days, setDays] = useState<30 | 90 | 365>(90)
  const { data: rows = [], isLoading } = useProcurementInsights(days)
  const activeHotel = useActiveHotel()
  const currency = activeHotel?.currency ?? 'USD'

  return (
    <div className="space-y-3">
      <div className="flex gap-1 justify-end">
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => { setDays(opt.days) }}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium transition-colors',
              days === opt.days
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="h-32 flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No restock requests found in this period.
        </p>
      )}

      {!isLoading && rows.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead className="text-right">Fulfilled</TableHead>
              <TableHead className="text-right">Avg. Lead Time</TableHead>
              <TableHead className="text-right">Total Spend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const fulfillRate = row.total_orders > 0
                ? Math.round((row.fulfilled_orders / row.total_orders) * 100)
                : 0
              return (
                <TableRow key={row.supplier_name}>
                  <TableCell className="font-medium">{row.supplier_name}</TableCell>
                  <TableCell className="text-right">{row.total_orders}</TableCell>
                  <TableCell className={cn(
                    'text-right text-sm',
                    fulfillRate < 50 ? 'text-red-600 font-medium' : 'text-muted-foreground'
                  )}>
                    {row.fulfilled_orders} <span className="text-xs">({fulfillRate}%)</span>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {row.avg_fulfillment_days != null
                      ? `${String(row.avg_fulfillment_days)}d`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(row.total_spend, currency)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
