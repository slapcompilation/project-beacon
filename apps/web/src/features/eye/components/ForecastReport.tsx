// Layer: Eye — Consumption Forecast Report
// Shows predicted days-until-zero for every active variant alongside recommended
// order quantities. Allows one-click restock request creation per row.
// Cross-domain: overlays waste radar signal — if depletion is partially driven by
// waste, the operator sees a flame indicator before placing a restock order.

import { useState, useMemo } from 'react'
import { PackageSearch, Loader2, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useConsumptionForecast, useWasteRadar } from '../hooks'
import { useCreateRestockRequest } from '@/features/restock/hooks'

const RANGE_OPTIONS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

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

  // Cross-domain synthesis: map variantId → waste signal for inline display
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
      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ranked by urgency · consumption window:
        </p>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => { setRangeDays(opt.days) }}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                rangeDays === opt.days
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Calculating forecast…
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <PackageSearch className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No consumption data in the last {rangeDays} days.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">In stock</TableHead>
              <TableHead className="text-right">Avg daily</TableHead>
              <TableHead className="text-right">Waste</TableHead>
              <TableHead className="text-right">Days left</TableHead>
              <TableHead className="text-right">Order qty</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
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
              // Waste rate: wasted / (wasted + consumed) as a fraction of avg_daily
              const wasteRate = waste && Number(row.avg_daily) > 0
                ? Math.round(((waste.qty_7d / 7) / Number(row.avg_daily)) * 100)
                : null

              return (
                <TableRow
                  key={row.variant_id}
                  className={cn(
                    band === 'critical' && 'bg-red-50/60 dark:bg-red-950/20',
                    band === 'warning' && 'bg-yellow-50/60 dark:bg-yellow-950/20',
                  )}
                >
                  <TableCell className="font-medium">{displayName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{row.sku}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.current_stock}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {Number(row.avg_daily).toFixed(1)}/day
                  </TableCell>
                  <TableCell className="text-right">
                    {wasteRate !== null && wasteRate > 0 ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
                          wasteRate >= 30 ? 'text-red-600' : wasteRate >= 10 ? 'text-orange-500' : 'text-muted-foreground'
                        )}
                        title={`${String(waste?.qty_7d ?? 0)} units written off this week`}
                      >
                        <Flame className="h-3 w-3 flex-shrink-0" />
                        {wasteRate}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground/30 text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={cn(
                        'tabular-nums font-semibold',
                        band === 'critical' && 'border-red-300 text-red-700 dark:text-red-400',
                        band === 'warning' && 'border-yellow-300 text-yellow-700 dark:text-yellow-400',
                        band === 'ok' && 'border-green-300 text-green-700 dark:text-green-400',
                      )}
                    >
                      {daysLabel}{daysLabel !== '—' && daysLabel !== 'Out' ? 'd' : ''}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {row.recommended_order_qty > 0 ? row.recommended_order_qty : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.recommended_order_qty > 0 && (
                      row.has_open_request ? (
                        <Badge variant="secondary" className="text-xs">Requested</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={isPending}
                          onClick={() => { handleRequest(row.variant_id, row.recommended_order_qty) }}
                        >
                          {isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                          Request
                        </Button>
                      )
                    )}
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
