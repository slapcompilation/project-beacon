// Days-until-zero per variant with one-click restock. Waste rate overlaid inline.

import { useState, useMemo } from 'react'
import { Button, HTMLTable, Icon, Intent, NonIdealState, SegmentedControl, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useConsumptionForecast, useWasteRadar } from '../hooks'
import { useCreateRestockRequest } from '@/features/restock/hooks'

function urgencyBand(days: number | null): 'critical' | 'warning' | 'ok' {
  if (days === null) return 'ok'
  if (days <= 7) return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

export function ForecastReport() {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30)
  const { data: rows = [], isLoading } = useConsumptionForecast(rangeDays)
  const { data: wasteRows = [] } = useWasteRadar()
  const createRestock = useCreateRestockRequest()
  const [requesting, setRequesting] = useState<Set<string>>(new Set())

  const wasteMap = useMemo(() => {
    const m = new Map<string, { qty_7d: number; waste_cost_7d: number }>()
    for (const w of wasteRows) m.set(w.variant_id, { qty_7d: w.qty_7d, waste_cost_7d: w.waste_cost_7d })
    return m
  }, [wasteRows])

  const handleRequest = (variantId: string, qty: number) => {
    setRequesting((prev) => new Set(prev).add(variantId))
    createRestock.mutate(
      { variantId, quantityNeeded: qty },
      {
        onSettled: () => {
          setRequesting((prev) => {
            const next = new Set(prev)
            next.delete(variantId)
            return next
          })
        },
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ranked by urgency · consumption window:
        </p>
        <SegmentedControl
          options={[
            { value: '7',  label: '7d' },
            { value: '30', label: '30d' },
            { value: '90', label: '90d' },
          ]}
          value={String(rangeDays)}
          onValueChange={(v) => { setRangeDays(Number(v) as 7 | 30 | 90) }}
          size="small"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
          Calculating forecast…
        </div>
      ) : rows.length === 0 ? (
        <NonIdealState
          icon="search"
          title={`No consumption data in the last ${rangeDays} days.`}
        />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="text-right">In stock</th>
              <th className="text-right">Avg daily</th>
              <th className="text-right">Waste</th>
              <th className="text-right">Days left</th>
              <th className="text-right">Order qty</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const band = urgencyBand(row.days_until_zero)
              const daysLabel =
                row.days_until_zero === null
                  ? '—'
                  : row.days_until_zero <= 0
                    ? 'Out'
                    : String(Math.round(row.days_until_zero))
              const displayName =
                row.variant_name !== 'Standard'
                  ? `${row.product_name} — ${row.variant_name}`
                  : row.product_name
              const isPending = requesting.has(row.variant_id)
              const waste = wasteMap.get(row.variant_id)
              const wasteRate = waste && row.avg_daily > 0
                ? Math.round(((waste.qty_7d / 7) / row.avg_daily) * 100)
                : null

              return (
                <tr
                  key={row.variant_id}
                  className={cn(
                    band === 'critical' && 'bg-red-50/60 dark:bg-red-950/20',
                    band === 'warning' && 'bg-yellow-50/60 dark:bg-yellow-950/20',
                  )}
                >
                  <td className="font-medium">{displayName}</td>
                  <td className="font-mono text-xs text-muted-foreground">{row.sku}</td>
                  <td className="text-right tabular-nums">{row.current_stock}</td>
                  <td className="text-right tabular-nums text-muted-foreground">
                    {row.avg_daily.toFixed(1)}/day
                  </td>
                  <td className="text-right">
                    {wasteRate !== null && wasteRate > 0 ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
                          wasteRate >= 30 ? 'text-red-600' : wasteRate >= 10 ? 'text-orange-500' : 'text-muted-foreground'
                        )}
                        title={`${String(waste?.qty_7d ?? 0)} units written off this week`}
                      >
                        <Icon icon="flame" size={12} className="flex-shrink-0" />
                        {wasteRate}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    <Tag
                      minimal
                      intent={band === 'critical' ? Intent.DANGER : band === 'warning' ? Intent.WARNING : Intent.SUCCESS}
                      className="tabular-nums !font-semibold"
                    >
                      {daysLabel}{daysLabel !== '—' && daysLabel !== 'Out' ? 'd' : ''}
                    </Tag>
                  </td>
                  <td className="text-right tabular-nums font-semibold">
                    {row.recommended_order_qty > 0 ? row.recommended_order_qty : '—'}
                  </td>
                  <td className="text-right">
                    {row.recommended_order_qty > 0 && (
                      row.has_open_request ? (
                        <Tag minimal className="!text-xs">Requested</Tag>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          loading={isPending}
                          disabled={isPending}
                          onClick={() => { handleRequest(row.variant_id, row.recommended_order_qty) }}
                        >
                          Request
                        </Button>
                      )
                    )}
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
