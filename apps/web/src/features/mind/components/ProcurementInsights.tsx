// Supplier spend, order volume, fulfillment time.

import { useState } from 'react'
import { HTMLTable, SegmentedControl } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useProcurementInsights } from '../hooks'

export function ProcurementInsights() {
  const [days, setDays] = useState<30 | 90 | 365>(90)
  const { data: rows = [], isLoading } = useProcurementInsights(days)
  const activeHotel = useActiveHotel()
  const currency = activeHotel?.currency ?? 'USD'

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <SegmentedControl
          options={[
            { value: '30',  label: '30d' },
            { value: '90',  label: '90d' },
            { value: '365', label: '1y' },
          ]}
          value={String(days)}
          onValueChange={(v) => { setDays(Number(v) as 30 | 90 | 365) }}
          size="small"
        />
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
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Supplier</th>
              <th className="text-right">Orders</th>
              <th className="text-right">Fulfilled</th>
              <th className="text-right">Avg. Lead Time</th>
              <th className="text-right">Total Spend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const fulfillRate = row.total_orders > 0
                ? Math.round((row.fulfilled_orders / row.total_orders) * 100)
                : 0
              return (
                <tr key={row.supplier_name}>
                  <td className="font-medium">{row.supplier_name}</td>
                  <td className="text-right">{row.total_orders}</td>
                  <td className={cn(
                    'text-right text-sm',
                    fulfillRate < 50 ? 'text-red-600 font-medium' : 'text-muted-foreground'
                  )}>
                    {row.fulfilled_orders} <span className="text-xs">({fulfillRate}%)</span>
                  </td>
                  <td className="text-right text-sm text-muted-foreground">
                    {row.avg_fulfillment_days != null
                      ? `${String(row.avg_fulfillment_days)}d`
                      : '—'}
                  </td>
                  <td className="text-right font-semibold">
                    {formatCurrency(row.total_spend, currency)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </HTMLTable>
      )}
    </div>
  )
}
