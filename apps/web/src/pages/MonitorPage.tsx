// Layer: Eye — Live Operations Monitor
// Real-time feed of every stock movement as it happens — the Bloomberg terminal
// for hotel operations. Palantir principle: the world is being actively analysed
// for you; you are not hunting for information.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { memo, useMemo, useRef } from 'react'
import { formatDistanceToNow, startOfDay } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import { useActivityFeed } from '@/features/monitor/hooks'
import { useRestockRequests } from '@/features/restock/hooks'
import { useProducts } from '@/features/inventory/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import type { ActivityEvent } from '@beacon/types'

// ─── Event classification ──────────────────────────────────────────────────────

type EventKind = 'add' | 'consume' | 'writeoff' | 'revert'

function classifyEvent(e: ActivityEvent): EventKind {
  if (e.is_revert)            return 'revert'
  if (e.quantity_change > 0)  return 'add'
  if (e.removal_category)     return 'writeoff'
  return 'consume'
}

interface KindCfg {
  icon: IconName
  color: string
  border: string
  intent: Intent
  label: string
}

const KIND: Record<EventKind, KindCfg> = {
  add:      { icon: 'arrow-up',     color: 'text-green-500', border: 'border-l-green-500', intent: Intent.SUCCESS, label: 'Received' },
  consume:  { icon: 'minus',        color: 'text-blue-500',  border: 'border-l-blue-500',  intent: Intent.PRIMARY, label: 'Consumed' },
  writeoff: { icon: 'warning-sign', color: 'text-red-500',   border: 'border-l-red-500',   intent: Intent.DANGER,  label: 'Write-off' },
  revert:   { icon: 'undo',         color: 'text-amber-500', border: 'border-l-amber-500', intent: Intent.WARNING, label: 'Reverted' },
}

// ─── Single event row ──────────────────────────────────────────────────────────

const EventRow = memo(function EventRow({ event, isNew }: { event: ActivityEvent; isNew: boolean }) {
  const kind   = classifyEvent(event)
  const cfg    = KIND[kind]
  const actor  = event.actor_email === 'system' ? 'system' : (event.actor_email.split('@')[0] ?? event.actor_email)
  const label  = event.removal_category ?? (
    event.reason === 'Received against restock request' ? 'Received' :
    event.reason.length > 0 ? event.reason : cfg.label
  )

  return (
    <div
      className={cn(
        'group flex items-start gap-3 border-l-2 pl-3 py-2.5 pr-3 transition-colors duration-500',
        cfg.border,
        isNew
          ? 'bg-amber-50 dark:bg-amber-950/25'
          : 'hover:bg-muted/40',
      )}
    >
      <Icon icon={cfg.icon} size={14} className={cn('mt-0.5 flex-shrink-0', cfg.color)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm leading-snug">
            {event.product_name}
          </span>
          {event.variant_name && event.variant_name !== 'Standard' && (
            <span className="text-muted-foreground text-xs">— {event.variant_name}</span>
          )}
          {isNew && (
            <Tag intent={Intent.WARNING} minimal>NEW</Tag>
          )}
        </div>

        <div className="flex items-center gap-2.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span className={cn(
            'font-bold tabular-nums',
            event.quantity_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
          )}>
            {event.quantity_change > 0 ? '+' : ''}{event.quantity_change}
          </span>
          <span className="text-muted-foreground/60">→</span>
          <span className="tabular-nums">{event.balance_after} on hand</span>
          <Tag intent={cfg.intent} minimal>{label}</Tag>
          <span className="font-mono text-[10px] text-muted-foreground/50">{event.sku}</span>
        </div>
      </div>

      <div className="flex-shrink-0 text-right space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground">{actor}</p>
        <p className="text-[10px] text-muted-foreground/50 tabular-nums">
          {formatDistanceToNow(new Date(event.happened_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  )
})

// ─── Virtualized feed ─────────────────────────────────────────────────────────

function VirtualizedFeed({ events, newIds }: { events: ActivityEvent[]; newIds: ReadonlySet<string> }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: events.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="h-full overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${String(virtualizer.getTotalSize())}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const event = events[virtualRow.index]
          return (
            <div
              key={event.log_id}
              className="absolute left-0 top-0 w-full border-b border-border/50"
              style={{ height: `${String(virtualRow.size)}px`, transform: `translateY(${String(virtualRow.start)}px)` }}
            >
              <EventRow event={event} isNew={newIds.has(event.log_id)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Right-rail KPIs ──────────────────────────────────────────────────────────

function RightRail({
  events,
  currency,
}: {
  events: ActivityEvent[]
  currency: string
}) {
  const { data: requests = [] } = useRestockRequests()
  const { data: products = [] } = useProducts()

  const pending  = useMemo(() => requests.filter((r) => r.status === 'pending').length, [requests])
  const approved = useMemo(() => requests.filter((r) => r.status === 'approved').length, [requests])

  const outOfStock = useMemo(
    () => products.filter((p) => p.product_variants.every((v) => v.current_stock === 0)).length,
    [products],
  )
  const lowStock = useMemo(
    () => products.filter((p) =>
      p.product_variants.some((v) => v.low_stock_threshold > 0 && v.current_stock > 0 && v.current_stock <= v.low_stock_threshold)
    ).length,
    [products],
  )

  const todayStart  = useMemo(() => startOfDay(new Date()).toISOString(), [])
  const todayEvents = useMemo(() => events.filter((e) => e.happened_at >= todayStart), [events, todayStart])

  const todayMovements = todayEvents.length
  const todayWriteoffs = useMemo(
    () => todayEvents.filter((e) => e.removal_category !== null && !e.is_revert).length,
    [todayEvents],
  )
  const todayReceived  = useMemo(
    () => todayEvents.filter((e) => e.quantity_change > 0 && !e.is_revert).length,
    [todayEvents],
  )

  const todayWasteCost = useMemo(() => {
    const costMap = new Map<string, number>()
    for (const p of products) {
      for (const v of p.product_variants) costMap.set(v.id, v.cost)
    }
    return todayEvents
      .filter((e) => e.removal_category !== null && !e.is_revert)
      .reduce((s, e) => s + Math.abs(e.quantity_change) * (costMap.get(e.variant_id) ?? 0), 0)
  }, [todayEvents, products])

  return (
    <div className="space-y-3 w-64 flex-shrink-0">

      <Card compact>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Stock Health</p>
        <div className="space-y-2">
          <KpiRow
            label="Out of stock"
            value={outOfStock}
            color={outOfStock > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600'}
          />
          <KpiRow
            label="Low stock"
            value={lowStock}
            color={lowStock > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}
          />
        </div>
      </Card>

      <Card compact>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Restock Queue</p>
        <div className="space-y-2">
          <KpiRow
            label="Awaiting approval"
            value={pending}
            color={pending > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}
          />
          <KpiRow
            label="Ready to receive"
            value={approved}
            color={approved > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground'}
          />
        </div>
      </Card>

      <Card compact>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Today</p>
        <div className="space-y-2">
          <KpiRow label="Total movements" value={todayMovements} />
          <KpiRow
            label="Items received"
            value={todayReceived}
            color="text-green-600 dark:text-green-400"
          />
          <KpiRow
            label="Write-offs"
            value={todayWriteoffs}
            color={todayWriteoffs > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}
          />
          {todayWasteCost > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Waste cost</span>
              <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatCurrency(todayWasteCost, currency)}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card compact>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Legend</p>
        <div className="space-y-1.5">
          {(Object.entries(KIND) as [EventKind, KindCfg][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2">
              <Icon icon={cfg.icon} size={14} className={cfg.color} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function KpiRow({
  label, value, color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-bold tabular-nums', color ?? 'text-foreground')}>
        {value}
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MonitorPage() {
  const currency    = useCurrency()

  const { data: events = [], isLoading, isFetching, refetch, newIds } = useActivityFeed(150)

  const totalToday = useMemo(() => {
    const todayStart = startOfDay(new Date()).toISOString()
    return events.filter((e) => e.happened_at >= todayStart).length
  }, [events])

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 border-b px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-emerald-100 dark:bg-emerald-900/30">
              <Icon icon="pulse" size={20} className="text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold leading-none">Live Operations Monitor</h1>
                {/* Live indicator */}
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">
                    Live
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Eye · real-time stock movements · {totalToday} events today
              </p>
            </div>
          </div>

          <Button
            icon="refresh"
            size="small"
            onClick={() => { void refetch() }}
            loading={isFetching}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4 md:p-6">

        {/* Feed */}
        <Card compact className="flex-1 min-w-0 !p-0 overflow-hidden">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Spinner size={SpinnerSize.STANDARD} />
            </div>
          ) : events.length === 0 ? (
            <NonIdealState
              icon="box"
              title="No activity recorded yet"
              description="Stock movements, receives, and write-offs will appear here in real time."
            />
          ) : (
            <VirtualizedFeed events={events} newIds={newIds} />
          )}
        </Card>

        {/* Right rail */}
        <RightRail events={events} currency={currency} />
      </div>
    </div>
  )
}
