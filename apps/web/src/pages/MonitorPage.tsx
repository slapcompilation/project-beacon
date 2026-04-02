// Layer: Eye — Live Operations Monitor
// Real-time feed of every stock movement as it happens — the Bloomberg terminal
// for hotel operations. Palantir principle: the world is being actively analysed
// for you; you are not hunting for information.

import { useMemo } from 'react'
import { formatDistanceToNow, startOfDay } from 'date-fns'
import {
  ArrowUpCircle, MinusCircle, AlertCircle, RotateCcw,
  Activity, Package,
  Loader2, RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActivityFeed } from '@/features/monitor/hooks'
import { useRestockRequests } from '@/features/restock/hooks'
import { useProducts } from '@/features/inventory/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import { Button } from '@/components/ui/button'
import type { ActivityEvent } from '@beacon/types'

// ─── Event classification ──────────────────────────────────────────────────────

type EventKind = 'add' | 'consume' | 'writeoff' | 'revert'

function classifyEvent(e: ActivityEvent): EventKind {
  if (e.is_revert)            return 'revert'
  if (e.quantity_change > 0)  return 'add'
  if (e.removal_category)     return 'writeoff'
  return 'consume'
}

const KIND = {
  add:      { Icon: ArrowUpCircle, color: 'text-green-500',  border: 'border-l-green-500',  badge: 'bg-green-500/10 text-green-600 dark:text-green-400',  label: 'Received' },
  consume:  { Icon: MinusCircle,   color: 'text-blue-500',   border: 'border-l-blue-500',   badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',    label: 'Consumed' },
  writeoff: { Icon: AlertCircle,   color: 'text-red-500',    border: 'border-l-red-500',    badge: 'bg-red-500/10 text-red-600 dark:text-red-400',       label: 'Write-off' },
  revert:   { Icon: RotateCcw,     color: 'text-amber-500',  border: 'border-l-amber-500',  badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Reverted' },
} as const

// ─── Single event row ──────────────────────────────────────────────────────────

function EventRow({ event, isNew }: { event: ActivityEvent; isNew: boolean }) {
  const kind   = classifyEvent(event)
  const cfg    = KIND[kind]
  const { Icon } = cfg
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
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', cfg.color)} />

      <div className="flex-1 min-w-0">
        {/* Product + NEW badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm leading-snug">
            {event.product_name}
          </span>
          {event.variant_name && event.variant_name !== 'Standard' && (
            <span className="text-muted-foreground text-xs">— {event.variant_name}</span>
          )}
          {isNew && (
            <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              NEW
            </span>
          )}
        </div>

        {/* Detail row */}
        <div className="flex items-center gap-2.5 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span className={cn(
            'font-bold tabular-nums',
            event.quantity_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
          )}>
            {event.quantity_change > 0 ? '+' : ''}{event.quantity_change}
          </span>
          <span className="text-muted-foreground/60">→</span>
          <span className="tabular-nums">{event.balance_after} on hand</span>
          <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', cfg.badge)}>
            {label}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/50">{event.sku}</span>
        </div>
      </div>

      {/* Actor + time */}
      <div className="flex-shrink-0 text-right space-y-0.5">
        <p className="text-xs font-medium text-muted-foreground">{actor}</p>
        <p className="text-[10px] text-muted-foreground/50 tabular-nums">
          {formatDistanceToNow(new Date(event.happened_at), { addSuffix: true })}
        </p>
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

  // Today stats derived from already-loaded feed (no extra query)
  const todayStart  = startOfDay(new Date()).toISOString()
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

  // Rough waste cost using product costs (available in inventory cache)
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

      {/* Stock health */}
      <div className="rounded-lg border bg-card p-3">
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
      </div>

      {/* Restock queue */}
      <div className="rounded-lg border bg-card p-3">
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
      </div>

      {/* Today activity */}
      <div className="rounded-lg border bg-card p-3">
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
      </div>

      {/* Legend */}
      <div className="rounded-lg border bg-card p-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Legend</p>
        <div className="space-y-1.5">
          {(Object.entries(KIND) as [EventKind, typeof KIND[EventKind]][]).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2">
              <cfg.Icon className={cn('h-3.5 w-3.5', cfg.color)} />
              <span className="text-xs text-muted-foreground">{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Activity className="h-5 w-5 text-emerald-600" />
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
            variant="outline"
            size="sm"
            onClick={() => { void refetch() }}
            disabled={isFetching}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex gap-4 p-4 md:p-6">

        {/* Feed */}
        <div className="flex-1 min-w-0 overflow-y-auto rounded-lg border bg-card">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center px-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Package className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div>
                <p className="font-semibold">No activity recorded yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                  Stock movements, receives, and write-offs will appear here in real time.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {events.map((event) => (
                <EventRow
                  key={event.log_id}
                  event={event}
                  isNew={newIds.has(event.log_id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right rail */}
        <RightRail events={events} currency={currency} />
      </div>
    </div>
  )
}
