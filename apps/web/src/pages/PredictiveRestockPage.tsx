// Layer: Eye — Predictive Restock Queue
// Palantir principle: decision support not data display.
// Shows variants that must be ordered before their lead time window closes.
// Operators see urgency, deadline, recommended qty, and one-click request.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Button,
  Icon,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useProducts, useStockoutProbabilities } from '@/features/inventory/hooks'
import { useConsumptionForecast, computePredictiveRestocks } from '@/features/eye/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useRestockRequests, useCreateRestockRequest } from '@/features/restock/hooks'
import { ProbabilisticMetric } from '@/components/ProbabilisticMetric'
import type { StockoutProbabilityRow } from '@beacon/types'
import type { PredictiveRestockRow } from '@/features/eye/hooks'

// ─── Urgency badge ────────────────────────────────────────────────────────────

function UrgencyBadge({ urgency }: { urgency: PredictiveRestockRow['urgency'] }) {
  if (urgency === 'critical') {
    return (
      <Tag intent={Intent.DANGER} icon="warning-sign" className="shrink-0">
        Critical
      </Tag>
    )
  }
  if (urgency === 'warning') {
    return (
      <Tag intent={Intent.WARNING} icon="time" className="shrink-0">
        Warning
      </Tag>
    )
  }
  return (
    <Tag minimal icon="flash" className="shrink-0">
      Watch
    </Tag>
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
            <Icon icon="trending-down" size={12} />
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
          <Tag intent={Intent.SUCCESS} icon="tick-circle" minimal>
            Requested
          </Tag>
        ) : (
          <Button
            size="small"
            intent={row.urgency === 'critical' ? Intent.DANGER : Intent.PRIMARY}
            loading={createRequest.isPending}
            onClick={handleRequest}
          >
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
    () => new Map((suppliers).map((s) => [s.id, s])),
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
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
        Analysing stock…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <NonIdealState
        icon="tick-circle"
        title="No orders needed in the next 14 days"
        description="All variants with a configured supplier have sufficient stock through their lead time. Based on 30-day consumption averages."
      />
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
              <Icon icon="warning-sign" size={14} />
              {String(critical.length)} critical
            </span>
          )}
          {warning.length > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 font-semibold">
              <Icon icon="time" size={14} />
              {String(warning.length)} warning
            </span>
          )}
          {watch.length > 0 && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Icon icon="box" size={14} />
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
          <Button
            variant="outlined"
            fill
            className="!border-dashed"
            onClick={() => { setShowAll(true) }}
          >
            + Show {String(watch.length)} watch-level item{watch.length !== 1 ? 's' : ''} (order window &gt; 3 days)
          </Button>
        )}
      </div>
    </div>
  )
}
