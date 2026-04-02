// Layer: Eye — Anomaly Detection Feed
// Two panels: Dead Stock (idle capital) + Consumption Spikes (sudden demand signals).
// Operator decision support: not just what happened, but what to act on.

import { useState } from 'react'
import { Loader2, Archive, Zap, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useDeadStock, useConsumptionSpikes } from '../hooks'
import { formatCurrency } from '@/lib/currency'
import { useActiveHotel } from '@/features/hotel/hooks'

// ─── Dead Stock Panel ──────────────────────────────────────────────────────────

function DeadStockPanel() {
  const [idleDays, setIdleDays] = useState<30 | 60 | 90>(30)
  const { data: rows = [], isLoading } = useDeadStock(idleDays)
  const activeHotel = useActiveHotel()
  const currency = activeHotel?.currency ?? 'USD'

  const totalIdleValue = rows.reduce((s, r) => s + Number(r.idle_value), 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Archive className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-semibold">Dead Stock</span>
          {rows.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
              {formatCurrency(totalIdleValue, currency)} idle
            </Badge>
          )}
        </div>
        <div className="flex gap-0.5">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => { setIdleDays(d) }}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                idleDays === d
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-1.5 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Scanning for idle stock…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">No idle stock in the last {idleDays} days.</p>
      ) : (
        <div className="divide-y divide-border rounded-md border">
          {rows.slice(0, 8).map((row) => {
            const displayName =
              row.variant_name !== 'Standard'
                ? `${row.product_name} — ${row.variant_name}`
                : row.product_name
            const severity = row.days_idle >= 60 ? 'critical' : row.days_idle >= 30 ? 'warning' : 'ok'

            return (
              <div key={row.variant_id} className="flex items-center gap-2 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium leading-tight">{displayName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{row.sku}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {row.current_stock} units
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'h-4 px-1.5 text-[10px] tabular-nums font-semibold',
                      severity === 'critical' && 'border-red-300 text-red-700 dark:text-red-400',
                      severity === 'warning' && 'border-yellow-300 text-yellow-700 dark:text-yellow-400',
                      severity === 'ok' && 'border-muted-foreground/30 text-muted-foreground',
                    )}
                  >
                    {row.days_idle}d idle
                  </Badge>
                  <span className="tabular-nums text-[10px] font-semibold text-foreground">
                    {formatCurrency(Number(row.idle_value), currency)}
                  </span>
                </div>
              </div>
            )
          })}
          {rows.length > 8 && (
            <div className="flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground">
              +{rows.length - 8} more <ChevronRight className="h-3 w-3" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Consumption Spikes Panel ──────────────────────────────────────────────────

function ConsumptionSpikesPanel() {
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(7)
  const { data: rows = [], isLoading } = useConsumptionSpikes(windowDays, 3.0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-500" />
          <span className="text-xs font-semibold">Consumption Spikes</span>
          {rows.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] tabular-nums">
              {rows.length} event{rows.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex gap-0.5">
          {([7, 14, 30] as const).map((d) => (
            <button
              key={d}
              onClick={() => { setWindowDays(d) }}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                windowDays === d
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-1.5 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Detecting spikes…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-xs text-muted-foreground">No consumption spikes in the last {windowDays} days (threshold: 3× daily avg).</p>
      ) : (
        <div className="divide-y divide-border rounded-md border">
          {rows.slice(0, 8).map((row, idx) => {
            const displayName =
              row.variant_name !== 'Standard'
                ? `${row.product_name} — ${row.variant_name}`
                : row.product_name
            const ratio = Number(row.spike_ratio)
            const spikeClass =
              ratio >= 10 ? 'border-red-300 text-red-700 dark:text-red-400'
              : ratio >= 5  ? 'border-orange-300 text-orange-700 dark:text-orange-400'
              :               'border-yellow-300 text-yellow-700 dark:text-yellow-400'

            return (
              <div key={`${row.variant_id}-${row.spike_date}-${idx}`} className="flex items-center gap-2 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium leading-tight">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {row.spike_date} · avg {Number(row.avg_daily).toFixed(1)}/day
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {row.spike_units} units
                  </span>
                  <Badge
                    variant="outline"
                    className={cn('h-4 px-1.5 text-[10px] tabular-nums font-bold', spikeClass)}
                  >
                    {ratio.toFixed(1)}×
                  </Badge>
                </div>
              </div>
            )
          })}
          {rows.length > 8 && (
            <div className="flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground">
              +{rows.length - 8} more <ChevronRight className="h-3 w-3" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── AnomalyFeed (composed) ────────────────────────────────────────────────────

export function AnomalyFeed() {
  return (
    <div className="space-y-6">
      <DeadStockPanel />
      <ConsumptionSpikesPanel />
    </div>
  )
}
