// Mind Layer: every delivery where the invoice price deviated from the
// master cost. Sorted by financial impact (|variance_amount| DESC) so
// the biggest exposures surface first.

import { useState } from 'react'
import {
  HTMLTable, Intent, NonIdealState, SegmentedControl, Spinner, SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { getCurrencySymbol } from '@/lib/currency'
import { useDateFormat } from '@/features/user/hooks'
import { useCostVarianceReport } from '@/features/mind/hooks'

export function CostVarianceReport({ currency }: { currency: string }) {
  const fmtDate = useDateFormat()
  const [days, setDays] = useState<30 | 60 | 90>(90)
  const { data = [], isLoading } = useCostVarianceReport(days)

  const totalOvercharge = data.reduce((s, r) => s + (r.variance_amount ?? 0), 0)
  const overchargeCount = data.filter((r) => (r.variance_amount ?? 0) > 0).length
  const discountCount   = data.filter((r) => (r.variance_amount ?? 0) < 0).length

  const sym = getCurrencySymbol(currency)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Cost Variance — Invoice Matching</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deliveries where the invoice price deviated from the master unit cost. Positive = overcharged.
          </p>
        </div>
        <SegmentedControl
          options={[
            { value: '30', label: '30d' },
            { value: '60', label: '60d' },
            { value: '90', label: '90d' },
          ]}
          value={String(days)}
          onValueChange={(v) => { setDays(Number(v) as 30 | 60 | 90) }}
          size="small"
        />
      </div>

      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className={cn('rounded-lg border p-3', totalOvercharge > 0 ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-green-200 bg-green-50 dark:bg-green-950/20')}>
            <p className="text-xs text-muted-foreground">Net exposure</p>
            <p className={cn('text-lg font-bold tabular-nums', totalOvercharge > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400')}>
              {totalOvercharge >= 0 ? '+' : ''}{sym}{Math.abs(totalOvercharge).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{data.length} lines recorded</p>
          </div>
          <div className="rounded-lg border p-3 border-red-200 bg-red-50 dark:bg-red-950/20">
            <p className="text-xs text-muted-foreground">Overcharged</p>
            <p className="text-lg font-bold tabular-nums text-red-700 dark:text-red-400">{overchargeCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">deliveries above expected</p>
          </div>
          <div className="rounded-lg border p-3 border-green-200 bg-green-50 dark:bg-green-950/20">
            <p className="text-xs text-muted-foreground">Discounts received</p>
            <p className="text-lg font-bold tabular-nums text-green-700 dark:text-green-400">{discountCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">deliveries below expected</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
        </div>
      ) : data.length === 0 ? (
        <NonIdealState
          icon="manual"
          title="No cost data recorded yet"
          description={
            <>
              Enter the invoice unit cost when receiving stock to start tracking price variances.
              When receiving in <strong>Restocks → Approved → Receive</strong>, enter the invoice unit cost.
            </>
          }
        />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Supplier</th>
              <th className="text-right">Received</th>
              <th className="text-right">Expected</th>
              <th className="text-right">Invoice</th>
              <th className="text-right">Δ%</th>
              <th className="text-right">Impact</th>
              <th className="text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const pct    = r.variance_pct ?? 0
              const impact = r.variance_amount ?? 0
              const isOver = impact > 0
              const pctColor = Math.abs(pct) <= 2
                ? 'text-muted-foreground'
                : isOver
                  ? Math.abs(pct) > 10 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-yellow-600 dark:text-yellow-400'
                  : 'text-green-600 dark:text-green-400'
              return (
                <tr key={r.receive_id}>
                  <td className="font-medium">
                    {r.product_name}
                    {r.variant_name && r.variant_name !== 'Standard' && (
                      <span className="text-muted-foreground text-sm"> — {r.variant_name}</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="text-sm text-muted-foreground">{r.supplier}</td>
                  <td className="text-right tabular-nums text-sm">{r.quantity_received}</td>
                  <td className="text-right tabular-nums text-sm">{sym}{r.unit_cost_expected.toFixed(2)}</td>
                  <td className="text-right tabular-nums text-sm">{sym}{r.unit_cost_actual.toFixed(2)}</td>
                  <td className={cn('text-right tabular-nums text-sm', pctColor)}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </td>
                  <td className={cn('text-right tabular-nums font-semibold text-sm', impact > 0 ? 'text-red-600 dark:text-red-400' : impact < 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                    {impact >= 0 ? '+' : ''}{sym}{Math.abs(impact).toFixed(2)}
                  </td>
                  <td className="text-right text-xs text-muted-foreground tabular-nums">
                    {fmtDate(new Date(r.received_at))}
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
