// Full immutable audit trail of every stock change in the period.

import { format } from 'date-fns'
import {
  Button, HTMLTable, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { exportToCsv } from '@/lib/csv'
import { useDateRange, DateRangeBar } from '@/components/DateRangeBar'
import { useDateFormat } from '@/features/user/hooks'
import { useStockMovementReport } from '@/features/inventory/hooks/reports'

export function StockMovementReport() {
  const fmtDate = useDateFormat()
  const dateRange = useDateRange({ defaultPreset: '30d' })
  const { dateFrom, dateTo } = dateRange
  const { data: rows = [], isLoading } = useStockMovementReport(dateFrom, dateTo)

  const additions = rows.filter((r) => !r.is_revert && r.quantity_change > 0).length
  const removals  = rows.filter((r) => !r.is_revert && r.quantity_change < 0).length
  const reverts   = rows.filter((r) => r.is_revert).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar {...dateRange} />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="text-green-600 font-medium">+{additions} in</span>
          <span className="text-red-600 font-medium">{removals} out</span>
          {reverts > 0 && <span className="text-muted-foreground">{reverts} undo</span>}
          <Button
            size="small"
            variant="outlined"
            icon="download"
            onClick={() => { exportToCsv(`movement-${dateFrom}-to-${dateTo}`, rows.map((r) => ({ date: format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'), product: r.product_name, variant: r.variant_name, change: r.quantity_change, balance: r.balance_after, reason: r.reason, type: r.is_revert ? 'Undo' : r.quantity_change > 0 ? 'In' : 'Out' }))) }}
          >
            CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
        </div>
      ) : rows.length === 0 ? (
        <NonIdealState icon="swap-horizontal" title="No movements in this date range" />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Variant</th>
              <th>SKU</th>
              <th className="text-right">Change</th>
              <th className="text-right">Balance</th>
              <th>Reason</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-sm text-muted-foreground whitespace-nowrap">{`${fmtDate(new Date(r.timestamp))}, ${format(new Date(r.timestamp), 'HH:mm')}`}</td>
                <td className="font-medium">{r.product_name}</td>
                <td className="text-muted-foreground text-sm">{r.variant_name}</td>
                <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className={cn('text-right font-semibold tabular-nums', r.is_revert ? 'text-muted-foreground' : r.quantity_change > 0 ? 'text-green-700' : 'text-red-700')}>
                  {r.quantity_change > 0 ? '+' : ''}{r.quantity_change}
                </td>
                <td className="text-right tabular-nums">{r.balance_after}</td>
                <td className="max-w-xs truncate text-sm">{r.reason}</td>
                <td>
                  {r.is_revert
                    ? <Tag minimal className="!text-[10px]">Undo</Tag>
                    : r.quantity_change > 0
                      ? <Tag minimal intent={Intent.SUCCESS} className="!text-[10px]">In</Tag>
                      : <Tag minimal intent={Intent.DANGER} className="!text-[10px]">Out</Tag>}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      )}
    </div>
  )
}
