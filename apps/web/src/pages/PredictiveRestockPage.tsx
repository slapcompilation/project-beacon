// Layer: Eye — Predictive Restock Queue
// Palantir principle: decision support not data display.
// Shows variants that must be ordered before their lead time window closes.
// Operators see urgency, deadline, recommended qty, and one-click request.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { AlertTriangle, Clock, CheckCircle2, Loader2, TrendingDown, Zap, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useProducts, useStockoutProbabilities } from '@/features/inventory/hooks'
import { useConsumptionForecast, computePredictiveRestocks } from '@/features/eye/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useRestockRequests, useCreateRestockRequest } from '@/features/restock/hooks'
import { ProbabilisticMetric } from '@/components/ProbabilisticMetric'
import type { Supplier, StockoutProbabilityRow } from '@beacon/types'
import type { PredictiveRestockRow } from '@/features/eye/hooks'

// ─── Urgency badge ────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: PredictiveRestockRow['urgency'] }) {
  if (urgency === 'critical') {
    return (
      <Badge className="bg-red-600 text-white gap-1 shrink-0">
        <AlertTriangle className="h-3 w-3" />
        Critical
      </Badge>
    )
  }
  if (urgency === 'warning') {
    return (
      <Badge className="bg-amber-500 text-white gap-1 shrink-0">
        <Clock className="h-3 w-3" />
        Warning
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1 shrink-0 text-muted-foreground">
      <Zap className="h-3 w-3" />
      Watch
    </Badge>
  )
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function RestockRow({ row, probRow }: { row: PredictiveRestockRow; probRow?: StockoutProbabilityRow }) {
  const createRequest = useCreateRestockRequest()
  const displayName = row.variantName !== 'Standard'
    ? `${row.productName} — ${row.variantName}`
    : row.productName

  const handleRequest = () => {
    createRequest.mutate({
      variantId: row.variantId,
      quantityNeeded: row.recommendedQty,
      notes: `Predictive restock: ${String(row.daysUntilZero)}d stock left at avg ${row.avgDaily.toFixed(1)}/d`,
    })
  }

  const deadlineLabel = row.orderDeadlineDays <= 0
    ? 'Order window closed'
    : row.orderDeadlineDays === 1
    ? 'Order by tomorrow'
    : `Order by ${format(row.orderDeadlineDate, 'MMM d')}`

  return (
    <div className={cn(
      'flex items-start gap-4 rounded-lg border px-5 py-4 transition-colors',
      row.urgency === 'critical' && 'border-red-200 bg-red-50/40 dark:border-red-900 dark:bg-red-950/20',
      row.urgency === 'warning'  && 'border-amber-200 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20',
      row.urgency === 'watch'    && 'bg-muted/30',
    )}>
      {/* Identity */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/variant/${row.variantId}`}
            className="font-medium text-sm hover:text-primary hover:underline transition-colors"
          >
            {displayName}
          </Link>
          <UrgencyBadge urgency={row.urgency} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3" />
            <span className="tabular-nums font-medium text-foreground">{String(row.currentStock)}</span> in stock
          </span>
          <span className="tabular-nums">
            ~{String(row.daysUntilZero)}d until empty
            {' '}· stockout {format(row.stockoutDate, 'MMM d')}
          </span>
          <span className="tabular-nums text-[10px] opacity-70">
            based on {row.avgDaily.toFixed(1)}/day avg · {String(row.leadTimeDays)}d lead time
          </span>
        </div>
        {/* Probabilistic confidence chip */}
        {probRow && (
          <div className="mt-1.5">
            <ProbabilisticMetric row={probRow} horizon={7} compact />
          </div>
        )}
        <p className={cn(
          'mt-1 text-xs font-medium',
          row.orderDeadlineDays <= 0 ? 'text-red-600 dark:text-red-400' :
          row.orderDeadlineDays <= 1 ? 'text-amber-600 dark:text-amber-400' :
          'text-muted-foreground',
        )}>
          {deadlineLabel}
        </p>
      </div>

      {/* Action */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <p className="text-xs text-muted-foreground">
          Rec. qty: <span className="font-semibold text-foreground">{String(row.recommendedQty)}</span>
        </p>
        {row.hasOpenRequest ? (
          <Badge variant="outline" className="text-green-700 dark:text-green-500 border-green-300 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Requested
          </Badge>
        ) : (
          <Button
            size="sm"
            variant={row.urgency === 'critical' ? 'destructive' : 'default'}
            className="h-8 text-xs"
            disabled={createRequest.isPending}
            onClick={handleRequest}
          >
            {createRequest.isPending
              ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
              : null}
            Request Restock
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PredictiveRestockPage() {
  const { data: forecast = [], isLoading: loadingForecast } = useConsumptionForecast(30)
  const { data: products = [], isLoading: loadingProducts }  = useProducts()
  const { data: suppliers = [], isLoading: loadingSuppliers } = useSuppliers()
  const { data: requests = [] }                               = useRestockRequests()
  const { data: probData = [] }                               = useStockoutProbabilities()

  const isLoading = loadingForecast || loadingProducts || loadingSuppliers

  const probMap = useMemo(
    () => new Map(probData.map((r) => [r.variant_id, r])),
    [probData],
  )

  const suppliersMap = useMemo(
    () => new Map((suppliers as Supplier[]).map((s) => [s.id, s])),
    [suppliers]
  )

  const openRestockVariantIds = useMemo(
    () => new Set(
      requests
        .filter((r) => ['pending', 'pending_manager', 'pending_director', 'approved'].includes(r.status))
        .map((r) => r.variant_id)
    ),
    [requests]
  )

  const rows = useMemo(
    () => computePredictiveRestocks(forecast, products, suppliersMap, openRestockVariantIds),
    [forecast, products, suppliersMap, openRestockVariantIds]
  )

  const [showAll, setShowAll] = useState(false)

  const critical  = rows.filter((r) => r.urgency === 'critical')
  const warning   = rows.filter((r) => r.urgency === 'warning')
  const watch     = rows.filter((r) => r.urgency === 'watch')
  const displayed = showAll ? rows : rows.filter((r) => r.urgency !== 'watch')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Analysing stock…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
          <CheckCircle2 className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <p className="font-semibold">No orders needed in the next 14 days</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            All variants with a configured supplier have sufficient stock through their lead time.
            Based on 30-day consumption averages.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header strip */}
      <div className="flex items-center justify-between border-b px-8 py-4 shrink-0 bg-background">
        <div>
          <h1 className="text-base font-semibold">Eye · Predictive Restock Queue</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Based on 30-day consumption avg · showing variants whose order window closes within 14 days
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {critical.length > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              {String(critical.length)} critical
            </span>
          )}
          {warning.length > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
              <Clock className="h-3.5 w-3.5" />
              {String(warning.length)} warning
            </span>
          )}
          {watch.length > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              {String(watch.length)} watch
            </span>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-8 py-4 space-y-2.5">
        {displayed.map((row) => (
          <RestockRow key={row.variantId} row={row} probRow={probMap.get(row.variantId)} />
        ))}

        {watch.length > 0 && !showAll && (
          <button
            className="w-full rounded-lg border border-dashed py-2.5 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
            onClick={() => { setShowAll(true) }}
          >
            + Show {String(watch.length)} watch-level item{watch.length !== 1 ? 's' : ''} (order window &gt; 3 days)
          </button>
        )}
      </div>
    </div>
  )
}
