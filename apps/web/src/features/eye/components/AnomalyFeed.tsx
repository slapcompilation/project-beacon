// Two panels: idle stock + consumption spikes.

import { useState } from 'react'
import { Icon, Intent, SegmentedControl, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useDeadStock, useConsumptionSpikes } from '../hooks'
import { formatCurrency } from '@/lib/currency'
import { useActiveHotel } from '@/features/hotel/hooks'

function DeadStockPanel() {
  const [idleDays, setIdleDays] = useState<30 | 60 | 90>(30)
  const { data: rows = [], isLoading } = useDeadStock(idleDays)
  const activeHotel = useActiveHotel()
  const currency = activeHotel?.currency ?? 'USD'

  const totalIdleValue = rows.reduce((s, r) => s + r.idle_value, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon icon="archive" size={14} className="text-orange-500" />
          <span className="text-xs font-semibold">Dead Stock</span>
          {rows.length > 0 && (
            <Tag minimal className="!h-4 !px-1.5 !text-[10px] tabular-nums">
              {formatCurrency(totalIdleValue, currency)} idle
            </Tag>
          )}
        </div>
        <SegmentedControl
          options={[
            { value: '30', label: '30d' },
            { value: '60', label: '60d' },
            { value: '90', label: '90d' },
          ]}
          value={String(idleDays)}
          onValueChange={(v) => { setIdleDays(Number(v) as 30 | 60 | 90) }}
          size="small"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-1.5 py-3 text-xs text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /> Scanning for idle stock…
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
                  <Tag
                    minimal
                    intent={severity === 'critical' ? Intent.DANGER : severity === 'warning' ? Intent.WARNING : Intent.NONE}
                    className="!h-4 !px-1.5 !text-[10px] tabular-nums !font-semibold"
                  >
                    {row.days_idle}d idle
                  </Tag>
                  <span className="tabular-nums text-[10px] font-semibold text-foreground">
                    {formatCurrency(row.idle_value, currency)}
                  </span>
                </div>
              </div>
            )
          })}
          {rows.length > 8 && (
            <div className="flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground">
              +{rows.length - 8} more <Icon icon="chevron-right" size={12} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ConsumptionSpikesPanel() {
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(7)
  const { data: rows = [], isLoading } = useConsumptionSpikes(windowDays, 3.0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon icon="flash" size={14} className="text-yellow-500" />
          <span className="text-xs font-semibold">Consumption Spikes</span>
          {rows.length > 0 && (
            <Tag minimal className="!h-4 !px-1.5 !text-[10px] tabular-nums">
              {rows.length} event{rows.length !== 1 ? 's' : ''}
            </Tag>
          )}
        </div>
        <SegmentedControl
          options={[
            { value: '7',  label: '7d' },
            { value: '14', label: '14d' },
            { value: '30', label: '30d' },
          ]}
          value={String(windowDays)}
          onValueChange={(v) => { setWindowDays(Number(v) as 7 | 14 | 30) }}
          size="small"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center gap-1.5 py-3 text-xs text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /> Detecting spikes…
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
            const ratio = row.spike_ratio
            const intent =
              ratio >= 10 ? Intent.DANGER
              : ratio >= 5  ? Intent.WARNING
              :               Intent.WARNING

            return (
              <div key={`${row.variant_id}-${row.spike_date}-${String(idx)}`} className="flex items-center gap-2 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium leading-tight">{displayName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {row.spike_date} · avg {row.avg_daily.toFixed(1)}/day
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="tabular-nums text-[10px] text-muted-foreground">
                    {row.spike_units} units
                  </span>
                  <Tag minimal intent={intent} className={cn('!h-4 !px-1.5 !text-[10px] tabular-nums !font-bold')}>
                    {ratio.toFixed(1)}×
                  </Tag>
                </div>
              </div>
            )
          })}
          {rows.length > 8 && (
            <div className="flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground">
              +{rows.length - 8} more <Icon icon="chevron-right" size={12} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AnomalyFeed() {
  return (
    <div className="space-y-6">
      <DeadStockPanel />
      <ConsumptionSpikesPanel />
    </div>
  )
}
