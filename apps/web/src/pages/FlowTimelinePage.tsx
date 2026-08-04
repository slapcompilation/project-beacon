// Layer: Flow — Stock narrative timeline
// Palantir principle: auditability is a first-class feature, not a debug tool.
// Operators must always see WHY the world is the way it is — with cost impact,
// team attribution, and causal correction chains laid out as a visual story.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { formatDistanceToNow, format, isSameDay } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts'
import {
  Button,
  Card,
  HTMLSelect,
  Icon,
  InputGroup,
  NonIdealState,
  SegmentedControl,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import { useProducts, useUndoStock } from '@/features/inventory/hooks'
import { StockAdjustModal } from '@/features/inventory/components/StockAdjustModal'
import { VoiceAdjustButton } from '@/components/VoiceAdjustButton'
import { useVariantTimeline } from '@/features/flow/hooks'
import { AipSignalsProvider } from '@/features/aipSignals/AipSignalsProvider'
import { AipRowBadge } from '@/features/aipSignals/AipRowBadge'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'
import type { TimelineRow } from '@/features/flow/api'

// ─── Event classification ──────────────────────────────────────────────────────

type EventType = 'receive' | 'consume' | 'writeoff' | 'revert'

function classifyEvent(row: TimelineRow): EventType {
  if (row.is_revert)          return 'revert'
  if (row.quantity_change > 0) return 'receive'
  if (row.category)   return 'writeoff'
  return 'consume'
}

const EVENT_META: Record<EventType, {
  label: string
  icon: IconName
  dot: string          // chart dot fill (hex)
  badge: string        // tailwind badge classes
  border: string       // left-border color
  text: string         // text color
}> = {
  receive:  {
    label:  'Received',
    icon:   'arrow-up',
    dot:    '#10b981',
    badge:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    border: 'border-emerald-400',
    text:   'text-emerald-600 dark:text-emerald-400',
  },
  consume:  {
    label:  'Consumed',
    icon:   'minus',
    dot:    '#64748b',
    badge:  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    border: 'border-slate-300',
    text:   'text-slate-500',
  },
  writeoff: {
    label:  'Write-off',
    icon:   'warning-sign',
    dot:    '#f43f5e',
    badge:  'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400',
    border: 'border-rose-400',
    text:   'text-rose-600 dark:text-rose-400',
  },
  revert:   {
    label:  'Correction',
    icon:   'undo',
    dot:    '#f59e0b',
    badge:  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    border: 'border-amber-400',
    text:   'text-amber-600 dark:text-amber-400',
  },
}

// ─── Chart ─────────────────────────────────────────────────────────────────────

interface ChartPoint {
  ts:             number
  balance:        number
  eventType:      EventType
  logId:          string
  quantityChange: number
  costImpact:     number
  actorEmail:     string | null
  reason:         string
}

function EventDot(props: {
  cx?: number; cy?: number; payload?: ChartPoint; index?: number
}) {
  const { cx, cy, payload } = props
  if (cx == null || cy == null || !payload) return null
  const color = EVENT_META[payload.eventType].dot
  return (
    <circle
      key={`dot-${payload.logId}`}
      cx={cx} cy={cy} r={4}
      fill={color} stroke="white" strokeWidth={1.5}
    />
  )
}

function ChartTooltip({
  active, payload, currency,
}: {
  active?: boolean
  payload?: { payload: ChartPoint }[]
  currency: string
}) {
  const fmtDate = useDateFormat()
  if (!active || !payload?.[0]) return null
  const p  = payload[0].payload
  const meta = EVENT_META[p.eventType]
  const sign = p.quantityChange > 0 ? '+' : ''
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn('font-semibold', meta.text)}>{meta.label}</span>
        <span className="text-muted-foreground">
          {fmtDate(new Date(p.ts))}, {format(new Date(p.ts), 'HH:mm')}
        </span>
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        <div>
          Δ <span className={cn('font-mono font-semibold', p.quantityChange > 0 ? 'text-emerald-600' : 'text-rose-600')}>
            {sign}{p.quantityChange}
          </span>{' '}
          → balance <span className="font-semibold text-foreground">{p.balance}</span>
        </div>
        {p.costImpact !== 0 && (
          <div>
            Cost impact:{' '}
            <span className={cn('font-semibold', p.costImpact > 0 ? 'text-emerald-600' : 'text-rose-600')}>
              {p.costImpact > 0 ? '+' : ''}{formatCurrency(Math.abs(p.costImpact), currency)}
            </span>
          </div>
        )}
        {p.actorEmail && <div>By: {p.actorEmail}</div>}
        {p.reason && <div className="italic">{p.reason}</div>}
      </div>
    </div>
  )
}

// Recharts constants (stable references prevent unnecessary chart re-renders)
const STOCK_CHART_MARGIN = { top: 12, right: 16, left: 0, bottom: 0 }
const MUTED_AXIS_TICK = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' }

function StockChart({
  rows, parLevel, currency,
}: {
  rows: TimelineRow[]
  parLevel: number
  currency: string
}) {
  const data = useMemo<ChartPoint[]>(() => {
    const points = rows.map((r) => ({
      ts:             new Date(r.happened_at).getTime(),
      balance:        r.balance_after,
      eventType:      classifyEvent(r),
      logId:          r.log_id,
      quantityChange: r.quantity_change,
      costImpact:     r.cost_impact,
      actorEmail:     r.actor_email,
      reason:         r.reason,
    }))
    // Add a "now" point so the line extends to present
    if (points.length > 0) {
      points.push({
        ...points[points.length - 1],
        ts:        Date.now(),
        logId:     'now',
        costImpact: 0,
      })
    }
    return points
  }, [rows])

  const maxBalance = Math.max(...data.map((d) => d.balance), parLevel, 1)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={STOCK_CHART_MARGIN}>
        <defs>
          <linearGradient id="stockGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis
          dataKey="ts"
          type="number"
          domain={['dataMin', 'dataMax']}
          scale="time"
          tickFormatter={(v: number) => format(new Date(v), 'MMM d')}
          tick={MUTED_AXIS_TICK}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[0, Math.ceil(maxBalance * 1.15)]}
          tick={MUTED_AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <RechartsTooltip
          content={<ChartTooltip currency={currency} />}
          cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1 }}
        />
        {parLevel > 0 && (
          <ReferenceLine
            y={parLevel}
            stroke="#f59e0b"
            strokeDasharray="5 3"
            label={{ value: `Par ${String(parLevel)}`, position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
          />
        )}
        <Area
          type="stepAfter"
          dataKey="balance"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#stockGrad)"
          dot={(props) => <EventDot {...(props as Parameters<typeof EventDot>[0])} />}
          activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Event card ────────────────────────────────────────────────────────────────

function EventCard({
  row,
  isCorrected,
  correctedByTime,
  canUndo,
  onUndo,
  currency,
}: {
  row: TimelineRow
  isCorrected: boolean
  correctedByTime: string | null
  canUndo: boolean
  onUndo: (id: string) => void
  currency: string
}) {
  const fmtDate = useDateFormat()
  const type = classifyEvent(row)
  const meta = EVENT_META[type]
  const sign = row.quantity_change > 0 ? '+' : ''
  const timeAgo = formatDistanceToNow(new Date(row.happened_at), { addSuffix: true })
  const fullTime = `${fmtDate(new Date(row.happened_at))}, ${format(new Date(row.happened_at), 'HH:mm')}`

  return (
    <div className={cn(
      'relative border-l-2 pl-4 pb-5',
      type === 'revert'   ? 'border-l-amber-400' :
      type === 'receive'  ? 'border-l-emerald-400' :
      type === 'writeoff' ? 'border-l-rose-400' :
      'border-l-slate-300 dark:border-l-slate-600',
    )}>
      <div className={cn(
        'absolute -left-[5px] top-1 h-2 w-2 rounded-full',
        type === 'revert'   ? 'bg-amber-400' :
        type === 'receive'  ? 'bg-emerald-400' :
        type === 'writeoff' ? 'bg-rose-400' :
        'bg-slate-400',
      )} />

      <div className={cn(
        'rounded-md border bg-card px-3 py-2.5',
        isCorrected && 'opacity-60',
      )}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-xs font-semibold rounded px-1.5 py-0.5', meta.badge)}>
              <Icon icon={meta.icon} size={12} />
              {meta.label}
            </span>
            {isCorrected && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold rounded px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                <Icon icon="warning-sign" size={12} />
                Corrected {correctedByTime}
              </span>
            )}
            {row.is_revert && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                ↺ Corrects earlier event
              </span>
            )}
            {row.was_offline && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Icon icon="offline" size={10} /> offline
              </span>
            )}
          </div>
          <time title={fullTime} className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {timeAgo}
          </time>
        </div>

        {/* Delta + balance */}
        <div className="flex items-baseline gap-3 mb-1">
          <span className={cn(
            'text-sm font-bold tabular-nums',
            row.quantity_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
          )}>
            {sign}{row.quantity_change} units
          </span>
          <span className="text-xs text-muted-foreground">
            → balance <span className="font-semibold text-foreground">{row.balance_after}</span>
          </span>
          {row.cost_impact !== 0 && (
            <span className={cn(
              'ml-auto text-xs font-semibold tabular-nums',
              row.cost_impact > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
            )}>
              {row.cost_impact > 0 ? '+' : ''}{formatCurrency(Math.abs(row.cost_impact), currency)}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {row.reason && (
            <span className="italic truncate max-w-[200px]">{row.reason}</span>
          )}
          {row.category && (
            <span className="font-medium text-rose-600 dark:text-rose-400">{row.category}</span>
          )}
          {row.actor_email && (
            <span className="ml-auto truncate max-w-[160px]">{row.actor_email}</span>
          )}
          {row.photo_url && (
            <Icon icon="camera" size={12} className="shrink-0 text-blue-500" />
          )}
        </div>

        {/* Undo */}
        {canUndo && !row.is_revert && (
          <div className="mt-2 pt-2 border-t">
            <Button
              variant="minimal"
              size="small"
              icon="undo"
              onClick={() => { onUndo(row.log_id) }}
            >
              Undo adjustment
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Summary panel ─────────────────────────────────────────────────────────────

function SummaryPanel({ rows, currency, days }: { rows: TimelineRow[]; currency: string; days: number }) {
  const stats = useMemo(() => {
    const nonRevert = rows.filter((r) => !r.is_revert)
    const received  = nonRevert.filter((r) => r.quantity_change > 0)
    const consumed  = nonRevert.filter((r) => r.quantity_change < 0 && !r.category)
    const writtenOff = nonRevert.filter((r) => r.category)
    const corrections = rows.filter((r) => r.is_revert)

    const totalReceived   = received.reduce((s, r) => s + r.quantity_change, 0)
    const totalConsumed   = consumed.reduce((s, r) => s + Math.abs(r.quantity_change), 0)
    const totalWrittenOff = writtenOff.reduce((s, r) => s + Math.abs(r.quantity_change), 0)
    const netCost         = rows.reduce((s, r) => s + r.cost_impact, 0)

    const currentBalance = rows.length > 0 ? rows[rows.length - 1].balance_after : 0
    const parLevel       = rows.length > 0 ? rows[0].par_level : 0

    const avgDaily = totalConsumed > 0 ? totalConsumed / days : 0
    const daysLeft = avgDaily > 0 ? Math.floor(currentBalance / avgDaily) : null

    return {
      totalReceived, totalConsumed, totalWrittenOff, corrections: corrections.length,
      netCost, currentBalance, parLevel, daysLeft,
      receivedCost:   received.reduce((s, r) => s + r.cost_impact, 0),
      consumedCost:   Math.abs(consumed.reduce((s, r) => s + r.cost_impact, 0)),
      writtenOffCost: Math.abs(writtenOff.reduce((s, r) => s + r.cost_impact, 0)),
    }
  }, [rows, days])

  const stockStatus =
    stats.parLevel > 0 && stats.currentBalance <= stats.parLevel * 0.5 ? 'critical' :
    stats.parLevel > 0 && stats.currentBalance <= stats.parLevel        ? 'warning'  : 'healthy'

  return (
    <div className="space-y-4">
      {/* Current stock */}
      <Card className={cn(
        '!p-4',
        stockStatus === 'critical' ? '!border-rose-300 !bg-rose-50 dark:!border-rose-800 dark:!bg-rose-950/20' :
        stockStatus === 'warning'  ? '!border-amber-300 !bg-amber-50 dark:!border-amber-800 dark:!bg-amber-950/20' :
        '!border-emerald-300 !bg-emerald-50 dark:!border-emerald-800 dark:!bg-emerald-950/20',
      )}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Current Stock</p>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{stats.currentBalance}</span>
          <span className="text-sm text-muted-foreground">units</span>
        </div>
        {stats.parLevel > 0 && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Par: {stats.parLevel} · {stats.currentBalance > stats.parLevel ? (
              <span className="text-emerald-600 dark:text-emerald-400">+{stats.currentBalance - stats.parLevel} above par</span>
            ) : stats.currentBalance < stats.parLevel ? (
              <span className="text-rose-600 dark:text-rose-400">{stats.parLevel - stats.currentBalance} below par</span>
            ) : 'at par'}
          </p>
        )}
        {stats.daysLeft !== null && (
          <p className="mt-1 text-xs inline-flex items-center gap-1">
            <Icon icon="time" size={12} />
            {stats.daysLeft > 30 ? (
              <span className="text-emerald-600 dark:text-emerald-400">~{stats.daysLeft}d left at current rate</span>
            ) : stats.daysLeft > 7 ? (
              <span className="text-amber-600 dark:text-amber-400">~{stats.daysLeft}d left at current rate</span>
            ) : (
              <span className="text-rose-600 dark:text-rose-400">~{stats.daysLeft}d left — restock soon</span>
            )}
          </p>
        )}
      </Card>

      {/* {days}-day summary */}
      <Card className="!p-4 space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {days}-Day Summary
        </p>
        <div className="space-y-2">
          <StatRow
            icon={<Icon icon="trending-up" size={12} className="text-emerald-500" />}
            label="Received"
            units={stats.totalReceived}
            cost={stats.receivedCost}
            currency={currency}
            positive
          />
          <StatRow
            icon={<Icon icon="minus" size={12} className="text-slate-500" />}
            label="Consumed"
            units={stats.totalConsumed}
            cost={stats.consumedCost}
            currency={currency}
          />
          <StatRow
            icon={<Icon icon="warning-sign" size={12} className="text-rose-500" />}
            label="Written Off"
            units={stats.totalWrittenOff}
            cost={stats.writtenOffCost}
            currency={currency}
          />
          {stats.corrections > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon icon="undo" size={12} className="text-amber-500" />
              <span>{stats.corrections} correction{stats.corrections > 1 ? 's' : ''} made</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Net cost impact</span>
            <span className={cn(
              'font-bold tabular-nums',
              stats.netCost >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
            )}>
              {stats.netCost >= 0 ? '+' : ''}{formatCurrency(stats.netCost, currency)}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}

function StatRow({
  icon, label, units, cost, currency, positive,
}: {
  icon: React.ReactNode
  label: string
  units: number
  cost: number
  currency: string
  positive?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {icon}
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-semibold tabular-nums">{units} u</span>
      <span className={cn(
        'tabular-nums text-muted-foreground',
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      )}>
        {positive ? '+' : '-'}{formatCurrency(cost, currency)}
      </span>
    </div>
  )
}

// ─── Variant selector ──────────────────────────────────────────────────────────

interface FlatVariant {
  variantId:   string
  variantName: string
  productName: string
  sku:         string
}

function VariantSelector({
  value, onChange,
}: {
  value: string | null
  onChange: (id: string) => void
}) {
  const [search, setSearch] = useState('')
  const { data: products = [] } = useProducts()

  const variants = useMemo<FlatVariant[]>(() => {
    return products.flatMap((p) =>
      p.product_variants.map((v) => ({
        variantId:   v.id,
        variantName: v.name,
        productName: p.name,
        sku:         v.sku,
      }))
    )
  }, [products])

  const filtered = useMemo(() => {
    if (!search.trim()) return variants
    const q = search.toLowerCase()
    return variants.filter(
      (v) =>
        v.productName.toLowerCase().includes(q) ||
        v.variantName.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q),
    )
  }, [variants, search])

  // Only what is on screen — the selector lists every variant in the property,
  // and the signal RPC takes the ids it is given.
  const visible = filtered.slice(0, 60)

  return (
    <AipSignalsProvider variantIds={visible.map((v) => v.variantId)}>
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b">
        <InputGroup
          leftIcon="search"
          placeholder="Search products…"
          value={search}
          onChange={(e) => { setSearch(e.target.value) }}
          size="small"
        />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {visible.map((v) => (
          <button
            key={v.variantId}
            type="button"
            onClick={() => { onChange(v.variantId) }}
            className={cn(
              'w-full text-left px-3 py-2 text-sm transition-colors hover:bg-muted',
              value === v.variantId && 'bg-muted font-medium',
            )}
          >
            <div className="font-medium text-foreground truncate">{v.productName}</div>
            <div className="flex items-center gap-1.5">
              <div className="text-[11px] text-muted-foreground">
                {v.variantName !== 'Standard' ? `${v.variantName} · ` : ''}{v.sku}
              </div>
              <AipRowBadge variantIds={[v.variantId]} />
            </div>
          </button>
        ))}
        {filtered.length > visible.length && (
          <p className="px-3 py-2 text-[11px] text-muted-foreground text-center">
            +{filtered.length - visible.length} more — narrow the search
          </p>
        )}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-xs text-muted-foreground text-center">No products match</p>
        )}
      </div>
    </div>
    </AipSignalsProvider>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const DAY_OPTIONS = [
  { value: '30',  label: 'Last 30 days' },
  { value: '60',  label: 'Last 60 days' },
  { value: '90',  label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
]

interface TimelineNavState {
  focusVariantId?: string
  focusLabel?: string
}

type EventFilter = 'all' | 'receive' | 'writeoff' | 'consume' | 'revert'

const EVENT_FILTER_OPTS: { value: EventFilter; label: string }[] = [
  { value: 'all',      label: 'All events'   },
  { value: 'receive',  label: 'Receives'     },
  { value: 'writeoff', label: 'Write-offs'   },
  { value: 'consume',  label: 'Consumed'     },
  { value: 'revert',   label: 'Corrections'  },
]

export default function FlowTimelinePage() {
  const location = useLocation()
  const navState = location.state as TimelineNavState | null
  const role     = useAuthStore((s) => s.role)
  const currency = useCurrency()
  const [variantId, setVariantId]     = useState<string | null>(navState?.focusVariantId ?? null)
  const [days, setDays]               = useState(90)
  const [adjustOpen, setAdjustOpen]   = useState(false)
  const [eventFilter, setEventFilter] = useState<EventFilter>('all')

  const canUndo = !!role && hasPermission(role, 'can_undo_logs')

  const { data: products = [] } = useProducts()
  const { data: rows = [], isLoading } = useVariantTimeline(variantId, days)
  const { mutate: undoStock } = useUndoStock()

  const selectedProduct = useMemo(() =>
    variantId ? products.find((p) => p.product_variants.some((v) => v.id === variantId)) ?? null : null,
    [variantId, products]
  )

  const correctionMap = useMemo(() => {
    const map = new Map<string, { revertLogId: string; revertTime: string }>()
    for (const r of rows) {
      if (r.is_revert && r.revert_of) {
        map.set(r.revert_of, { revertLogId: r.log_id, revertTime: r.happened_at })
      }
    }
    return map
  }, [rows])

  const timelineRows = useMemo(() => {
    const reversed = [...rows].reverse()
    if (eventFilter === 'all') return reversed
    return reversed.filter((r) => classifyEvent(r) === eventFilter)
  }, [rows, eventFilter])

  type DayGroup = { date: Date; rows: TimelineRow[]; netCost: number; netUnits: number }
  const dayGroups = useMemo<DayGroup[]>(() => {
    const groups: DayGroup[] = []
    for (const row of timelineRows) {
      const rowDate = new Date(row.happened_at)
      const last = groups.at(-1)
      if (last && isSameDay(last.date, rowDate)) {
        last.rows.push(row)
        last.netCost  += row.cost_impact
        last.netUnits += row.quantity_change
      } else {
        groups.push({ date: rowDate, rows: [row], netCost: row.cost_impact, netUnits: row.quantity_change })
      }
    }
    return groups
  }, [timelineRows])

  const parLevel    = rows[0]?.par_level ?? 0
  const productName = rows[0]?.product_name
  const variantName = rows[0]?.variant_name

  const headerSubtitle = variantId
    ? (productName ? `${productName}${variantName && variantName !== 'Standard' ? ` · ${variantName}` : ''}` : '')
    : null

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* Left: variant selector */}
      <aside className="w-56 shrink-0 border-r flex flex-col bg-muted/20">
        <div className="px-3 py-3 border-b">
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Flow · Timeline</p>
          <p className="text-sm font-semibold text-foreground mt-0.5">Stock Narrative</p>
        </div>
        <VariantSelector value={variantId} onChange={setVariantId} />
      </aside>

      {/* Right: content */}
      <main className="flex-1 overflow-y-auto">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3 border-b bg-background/95 backdrop-blur">
          <div className="flex-1 min-w-0">
            {headerSubtitle ? (
              <>
                <div className="flex items-center gap-2">
                  <Icon icon="pulse" size={14} className="text-indigo-500 shrink-0" />
                  <span className="text-sm font-semibold truncate">{headerSubtitle}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 ml-6">
                  {rows.length} event{rows.length !== 1 ? 's' : ''} · select a product on the left to change
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon icon="box" size={14} />
                Select a product to view its stock narrative
              </div>
            )}
          </div>
          {selectedProduct && (
            <div className="flex items-center gap-1.5">
              <VoiceAdjustButton
                onCommand={(_q, delta, reason) => {
                  void delta; void reason
                  setAdjustOpen(true)
                }}
                className="h-8"
              />
              <Button
                size="small"
                variant="outlined"
                icon="edit"
                onClick={() => { setAdjustOpen(true) }}
              >
                Adjust Stock
              </Button>
            </div>
          )}
          {/* Event type filter */}
          <SegmentedControl
            size="small"
            value={eventFilter}
            onValueChange={(v) => { setEventFilter(v as EventFilter) }}
            options={EVENT_FILTER_OPTS}
          />

          <HTMLSelect
            value={String(days)}
            onChange={(e) => { setDays(Number(e.target.value)) }}
            options={DAY_OPTIONS}
            minimal
          />
        </div>

        {!variantId ? (
          /* Empty state */
          <NonIdealState
            icon="pulse"
            title="No product selected"
            description="Choose a product from the left panel to see its complete stock story — every receive, consume, write-off, and correction, with cost impact."
          />
        ) : isLoading ? (
          /* Loading skeleton */
          <div className="p-6 space-y-4">
            <div className="h-56 rounded-lg bg-muted animate-pulse" />
            <div className="grid grid-cols-[1fr_280px] gap-6">
              <div className="space-y-3">
                {[1,2,3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
              <div className="h-64 rounded-lg bg-muted animate-pulse" />
            </div>
          </div>
        ) : rows.length === 0 ? (
          /* No events in period */
          <NonIdealState
            icon="box"
            title="No events in this period"
            description={`No stock movements recorded for this product in the last ${String(days)} days. Try extending the time range.`}
          />
        ) : (
          <div className="p-6 space-y-6">
            {/* Stock chart */}
            <Card className="!p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Stock Level Over Time
                </p>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  {Object.entries(EVENT_META).map(([type, meta]) => (
                    <span key={type} className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full inline-block"
                        style={{ backgroundColor: meta.dot }}
                      />
                      {meta.label}
                    </span>
                  ))}
                  {parLevel > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="h-0.5 w-4 bg-amber-400 inline-block" />
                      Par
                    </span>
                  )}
                </div>
              </div>
              <StockChart rows={rows} parLevel={parLevel} currency={currency} />
            </Card>

            {/* Timeline + Summary */}
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_288px] gap-6 items-start">

              {/* Event timeline — grouped by day */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Event History · {timelineRows.length} event{timelineRows.length !== 1 ? 's' : ''}
                  {eventFilter !== 'all' && (
                    <span className="ml-1 normal-case font-normal text-muted-foreground/70">
                      (filtered: {EVENT_FILTER_OPTS.find((o) => o.value === eventFilter)?.label})
                    </span>
                  )}
                </p>
                <div className="space-y-6 pl-1">
                  {dayGroups.map((group) => (
                    <div key={group.date.toISOString()}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                          {format(group.date, 'EEE, MMM d')}
                        </span>
                        <div className="flex-1 h-px bg-border" />
                        <span className={cn(
                          'text-[10px] font-semibold tabular-nums whitespace-nowrap',
                          group.netCost > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                        )}>
                          {group.netCost >= 0 ? '+' : ''}{formatCurrency(group.netCost, currency)}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {group.netUnits >= 0 ? '+' : ''}{group.netUnits} units
                        </span>
                      </div>
                      <div className="space-y-0">
                        {group.rows.map((row) => {
                          const correction = correctionMap.get(row.log_id)
                          return (
                            <EventCard
                              key={row.log_id}
                              row={row}
                              isCorrected={!!correction}
                              correctedByTime={
                                correction
                                  ? formatDistanceToNow(new Date(correction.revertTime), { addSuffix: true })
                                  : null
                              }
                              canUndo={canUndo && !correction}
                              onUndo={(id) => { undoStock(id) }}
                              currency={currency}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary panel */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Intelligence Summary
                </p>
                <SummaryPanel rows={rows} currency={currency} days={days} />
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Quick adjust modal */}
      {adjustOpen && selectedProduct && (
        <StockAdjustModal
          open
          onClose={() => { setAdjustOpen(false) }}
          product={selectedProduct}
        />
      )}
    </div>
  )
}
