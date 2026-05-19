// Layer: Eye — Demand Sensing · Occupancy-Adjusted Forecast
// Palantir principle: forward-looking intelligence, not backwards-looking data.
// The consumption forecast uses historical burn rate. This page makes it predictive:
// enter upcoming occupancy, get an adjusted burn rate before stockouts happen.
// Formula: adjusted_daily = avg_daily × (upcoming_avg_occ / historical_avg_occ)
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState, useCallback } from 'react'
import {
  Callout,
  Card,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import {
  format, addDays, subDays, startOfWeek, isSameDay, isBefore, isAfter,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { useConsumptionForecast } from '@/features/eye/hooks'
import {
  useOccupancyLogs, useUpsertOccupancy, useDeleteOccupancy,
  usePMSHealth, useBookingForecasts, useUpsertBookingForecast, useDeleteBookingForecast,
} from '@/features/eye/hooks'
import type { OccupancyLog, PMSHealthRow, BookingForecast } from '@beacon/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const FORECAST_WINDOW  = 14   // days to average for adjustment
const HISTORICAL_DAYS  = 30   // days of history for baseline
const DEFAULT_BASELINE = 65   // assumed baseline occupancy if no historical data

// ─── Occupancy factor computation ─────────────────────────────────────────────

interface OccupancyContext {
  factor: number            // adjustment multiplier (1.0 = no change)
  historicalAvg: number     // past 30-day avg occupancy %
  upcomingAvg: number       // next 14-day avg occupancy % (from entered data)
  daysEntered: number       // how many future days have data
  isElevated: boolean
  isSuppressed: boolean
}

function computeOccupancyContext(
  historical: OccupancyLog[],
  upcoming: OccupancyLog[],
): OccupancyContext {
  const historicalAvg = historical.length > 0
    ? historical.reduce((s, l) => s + l.occupancy_pct, 0) / historical.length
    : DEFAULT_BASELINE

  const upcomingAvg = upcoming.length > 0
    ? upcoming.reduce((s, l) => s + l.occupancy_pct, 0) / upcoming.length
    : historicalAvg  // no data → assume same as baseline (factor = 1.0)

  const factor = historicalAvg > 0 ? upcomingAvg / historicalAvg : 1.0

  return {
    factor,
    historicalAvg,
    upcomingAvg,
    daysEntered: upcoming.length,
    isElevated:   factor > 1.1,
    isSuppressed: factor < 0.9,
  }
}

// ─── Occupancy colour ─────────────────────────────────────────────────────────

function occColor(pct: number): string {
  if (pct >= 90) return 'bg-red-50 border-red-200 dark:bg-red-950/25 dark:border-red-800'
  if (pct >= 75) return 'bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800'
  if (pct >= 60) return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/15 dark:border-yellow-800'
  return 'bg-green-50 border-green-200 dark:bg-green-950/15 dark:border-green-800'
}

function occTextColor(pct: number): string {
  if (pct >= 90) return 'text-red-700 dark:text-red-400'
  if (pct >= 75) return 'text-orange-700 dark:text-orange-400'
  if (pct >= 60) return 'text-yellow-700 dark:text-yellow-400'
  return 'text-green-700 dark:text-green-400'
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({
  date,
  log,
  isPast: past,
  onSave,
  onClear,
}: {
  date: Date
  log?: OccupancyLog
  isPast: boolean
  onSave: (date: string, pct: number) => void
  onClear: (date: string) => void
}) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')

  const pct = log?.occupancy_pct ?? null

  const handleBlur = () => {
    setEditing(false)
    const val = parseFloat(input)
    if (!isNaN(val) && val >= 0 && val <= 100) {
      onSave(dateStr, Math.round(val * 10) / 10)
    } else if (input === '' && pct != null) {
      onClear(dateStr)
    }
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { (e.currentTarget as HTMLElement).blur() }
    if (e.key === 'Escape') { setEditing(false); setInput('') }
  }

  const today = isSameDay(date, new Date())

  return (
    <div
      className={cn(
        'relative flex flex-col rounded border p-1.5 cursor-pointer transition-all min-h-[56px]',
        pct != null ? occColor(pct) : 'border-border/40 hover:bg-muted/30',
        past && 'opacity-50',
        today && 'ring-1 ring-primary/40',
      )}
      onClick={() => { if (!past) { setEditing(true); setInput(pct != null ? String(pct) : '') } }}
    >
      <p className={cn('text-[9px] font-medium uppercase', today ? 'text-primary' : 'text-muted-foreground')}>
        {format(date, 'EEE')}
      </p>
      <p className={cn('text-[10px] font-semibold', today ? 'text-primary' : 'text-foreground')}>
        {format(date, 'MMM d')}
      </p>

      {editing ? (
        <input
          autoFocus
          type="number"
          min={0}
          max={100}
          step={1}
          value={input}
          onChange={(e) => { setInput(e.target.value) }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="mt-0.5 w-full rounded border border-primary/40 bg-background px-1 py-0 text-xs text-center outline-none tabular-nums"
          placeholder="0–100"
          onClick={(e) => { e.stopPropagation() }}
        />
      ) : (
        <p className={cn('mt-0.5 text-xs font-bold tabular-nums text-center', pct != null ? occTextColor(pct) : 'text-muted-foreground/40')}>
          {pct != null ? `${pct}%` : '—'}
        </p>
      )}
    </div>
  )
}

// ─── Weekly quick-fill ────────────────────────────────────────────────────────

function WeekFillBar({ weekDates, onFill }: { weekDates: Date[]; onFill: (dates: string[], pct: number) => void }) {
  const [open, setOpen] = useState(false)
  const futureDates = weekDates.filter((d) => !isBefore(d, new Date())).map((d) => format(d, 'yyyy-MM-dd'))
  if (futureDates.length === 0) return null

  return (
    <div className="relative">
      <button
        className="text-[9px] text-muted-foreground hover:text-foreground transition-colors px-1"
        onClick={() => { setOpen((v) => !v) }}
      >
        Fill week ▾
      </button>
      {open && (
        <div className="absolute top-full left-0 z-20 mt-1 rounded-lg border bg-popover shadow-lg p-1 flex gap-1 text-[10px]">
          {[50, 65, 75, 85, 95].map((p) => (
            <button
              key={p}
              className="rounded px-2 py-1 hover:bg-muted font-medium tabular-nums"
              onClick={() => { onFill(futureDates, p); setOpen(false) }}
            >
              {p}%
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Occupancy calendar ───────────────────────────────────────────────────────

function OccupancyCalendar({
  fromDate, toDate, logs, onSave, onClear,
}: {
  fromDate: Date
  toDate: Date
  logs: OccupancyLog[]
  onSave: (date: string, pct: number) => void
  onClear: (date: string) => void
}) {
  const logMap = useMemo(() => {
    const m = new Map<string, OccupancyLog>()
    for (const l of logs) m.set(l.date, l)
    return m
  }, [logs])

  // Generate weeks
  const weeks = useMemo(() => {
    const result: Date[][] = []
    let current = startOfWeek(fromDate, { weekStartsOn: 1 }) // Mon start
    const end = toDate
    while (!isAfter(current, end)) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        const d = addDays(current, i)
        week.push(d)
      }
      result.push(week)
      current = addDays(current, 7)
    }
    return result
  }, [fromDate, toDate])

  const handleFillWeek = (dates: string[], pct: number) => {
    for (const d of dates) onSave(d, pct)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-medium text-muted-foreground px-0.5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="space-y-0.5">
          <WeekFillBar weekDates={week} onFill={handleFillWeek} />
          <div className="grid grid-cols-7 gap-0.5">
            {week.map((date) => {
              const ds = format(date, 'yyyy-MM-dd')
              const past = isBefore(date, subDays(new Date(), 1))
              return (
                <DayCell
                  key={ds}
                  date={date}
                  log={logMap.get(ds)}
                  isPast={past}
                  onSave={onSave}
                  onClear={onClear}
                />
              )
            })}
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground text-center pt-1">
        Click any future cell to enter occupancy %. Press Enter to save.
      </p>
    </div>
  )
}

// ─── Adjusted forecast row ────────────────────────────────────────────────────

interface AdjustedRow {
  variantId: string
  productName: string
  variantName: string
  sku: string
  currentStock: number
  baselineDaily: number
  adjustedDaily: number
  baselineDays: number | null
  adjustedDays: number | null
  becomesCritical: boolean   // was >7 days, now ≤7 days
  delta: number | null       // adjustedDays - baselineDays
}

function ForecastTable({
  rows, factor,
}: {
  rows: AdjustedRow[]
  factor: number
}) {
  const [showAll, setShowAll] = useState(false)
  const critical = rows.filter((r) => (r.adjustedDays ?? Infinity) <= 7)
  const warning  = rows.filter((r) => { const d = r.adjustedDays ?? Infinity; return d > 7 && d <= 14 })
  const rest     = rows.filter((r) => (r.adjustedDays ?? Infinity) > 14)
  const displayed = showAll ? rows : [...critical, ...warning, ...rest.slice(0, 5)]

  if (rows.length === 0) {
    return (
      <NonIdealState
        icon="office"
        title="No consumption data"
        description="Items need usage history for demand-adjusted forecasting. Stock movements over the last 30 days generate the baseline."
      />
    )
  }

  return (
    <Card className="!p-0 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            <th className="py-2.5 px-4 text-left">Product</th>
            <th className="py-2.5 px-3 text-right">Stock</th>
            <th className="py-2.5 px-3 text-right">Baseline /d</th>
            <th className="py-2.5 px-3 text-right">Adj /d</th>
            <th className="py-2.5 px-3 text-right">Baseline days</th>
            <th className="py-2.5 px-3 text-right">Adj days (est.)</th>
            <th className="py-2.5 px-4 text-right">Change</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((r) => {
            const adjCritical = (r.adjustedDays ?? Infinity) <= 7
            const adjWarning  = (r.adjustedDays ?? Infinity) <= 14

            return (
              <tr
                key={r.variantId}
                className={cn(
                  'border-b transition-colors',
                  r.becomesCritical   ? 'bg-red-50/40 dark:bg-red-950/15'
                  : adjCritical       ? 'bg-red-50/20 dark:bg-red-950/10'
                  : adjWarning        ? 'bg-yellow-50/20 dark:bg-yellow-950/10'
                  : 'hover:bg-muted/20',
                )}
              >
                <td className="py-2.5 px-4">
                  <p className="text-sm font-medium leading-tight">
                    {r.variantName !== 'Standard' ? `${r.productName} — ${r.variantName}` : r.productName}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">{r.sku}</p>
                  {r.becomesCritical && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                      <Icon icon="warning-sign" size={10} />
                      Newly critical at this occupancy
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-sm font-medium">
                  {r.currentStock}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-xs text-muted-foreground">
                  {r.baselineDaily.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-xs font-semibold">
                  <span className={cn(
                    factor > 1.1 ? 'text-orange-600 dark:text-orange-400'
                    : factor < 0.9 ? 'text-green-600 dark:text-green-400'
                    : 'text-foreground',
                  )}>
                    {r.adjustedDaily.toFixed(1)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-xs text-muted-foreground">
                  {r.baselineDays != null ? `${r.baselineDays}d` : '—'}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <p className={cn(
                    'tabular-nums text-xs font-semibold',
                    adjCritical ? 'text-red-600 dark:text-red-400'
                    : adjWarning  ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-foreground',
                  )}>
                    {r.adjustedDays != null ? `~${r.adjustedDays}d` : '∞'}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 tabular-nums">
                    avg {r.baselineDaily.toFixed(1)}/d · 30d
                  </p>
                </td>
                <td className="py-2.5 px-4 text-right">
                  {r.delta != null && r.delta !== 0 ? (
                    <span className={cn(
                      'inline-flex items-center gap-0.5 text-[11px] font-semibold',
                      r.delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
                    )}>
                      <Icon icon={r.delta < 0 ? 'trending-down' : 'trending-up'} size={10} />
                      {r.delta > 0 ? '+' : ''}{r.delta}d
                    </span>
                  ) : (
                    <Icon icon="minus" size={10} className="text-muted-foreground/40 ml-auto" />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {rows.length > critical.length + warning.length + 5 && (
        <div className="border-t px-4 py-2 bg-muted/20">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setShowAll((v) => !v) }}
          >
            {showAll ? 'Show fewer' : `Show all ${String(rows.length)} items`}
          </button>
        </div>
      )}
    </Card>
  )
}

// ─── PMS health badge ──────────────────────────────────────────────────────────

function PMSHealthBadge({ rows }: { rows: PMSHealthRow[] }) {
  if (rows.length === 0) return null

  const worst = rows.reduce<PMSHealthRow | null>((acc, r) => {
    const order = { connected: 0, warning: 1, disconnected: 2, never_connected: 3 }
    if (!acc) return r
    return (order[r.status] ?? 0) > (order[acc.status] ?? 0) ? r : acc
  }, null)

  if (!worst) return null

  const STATUS: Record<string, { icon: IconName; color: string; bg: string; label: string }> = {
    connected:       { icon: 'globe-network', color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-950/30',  label: 'PMS connected' },
    warning:         { icon: 'time',          color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/20', label: 'PMS delayed' },
    disconnected:    { icon: 'offline',       color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-950/20',       label: 'PMS disconnected' },
    never_connected: { icon: 'offline',       color: 'text-muted-foreground',                bg: 'bg-muted/40',                        label: 'PMS not connected' },
  }

  const cfg = STATUS[worst.status]
  const detail = worst.status === 'never_connected'
    ? `${worst.source_system} · no events received`
    : worst.status === 'connected'
      ? `${worst.source_system} · ${String(worst.total_events)} events`
      : `${worst.source_system} · ${worst.hours_since_last != null ? `${String(worst.hours_since_last)}h ago` : 'unknown'}`

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1', cfg.bg)}>
      <Icon icon={cfg.icon} size={12} className={cfg.color} />
      <span className={cn('text-[11px] font-medium', cfg.color)}>{cfg.label}</span>
      <span className="text-[10px] text-muted-foreground">· {detail}</span>
    </div>
  )
}

// ─── Booking horizon section ───────────────────────────────────────────────────
// Managers enter 7/14/30-day expected occupancy. PMS sources write here too.
// Distinct from occupancy_logs (actuals) — these are *forecast* entries.

function BookingHorizonCell({
  date,
  forecast,
  isPast,
  onSave,
  onClear,
}: {
  date: Date
  forecast?: BookingForecast
  isPast: boolean
  onSave: (date: string, pct: number) => void
  onClear: (date: string) => void
}) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState('')

  const pct    = forecast?.expected_occupancy_pct ?? null
  const source = forecast?.horizon_source ?? null
  const today  = isSameDay(date, new Date())

  const handleBlur = () => {
    setEditing(false)
    const val = parseFloat(input)
    if (!isNaN(val) && val >= 0 && val <= 100) {
      onSave(dateStr, Math.round(val * 10) / 10)
    } else if (input === '' && pct != null) {
      onClear(dateStr)
    }
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter')  { (e.currentTarget as HTMLElement).blur() }
    if (e.key === 'Escape') { setEditing(false); setInput('') }
  }

  return (
    <div
      className={cn(
        'relative flex flex-col rounded border p-1.5 cursor-pointer transition-all min-h-[56px]',
        pct != null ? occColor(pct) : 'border-border/40 hover:bg-muted/30',
        isPast && 'opacity-40 cursor-default',
        today && 'ring-1 ring-primary/40',
      )}
      onClick={() => { if (!isPast) { setEditing(true); setInput(pct != null ? String(pct) : '') } }}
    >
      <p className={cn('text-[9px] font-medium uppercase', today ? 'text-primary' : 'text-muted-foreground')}>
        {format(date, 'EEE')}
      </p>
      <p className={cn('text-[10px] font-semibold', today ? 'text-primary' : 'text-foreground')}>
        {format(date, 'MMM d')}
      </p>

      {editing ? (
        <input
          autoFocus
          type="number"
          min={0}
          max={100}
          step={1}
          value={input}
          onChange={(e) => { setInput(e.target.value) }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="mt-0.5 w-full rounded border border-primary/40 bg-background px-1 py-0 text-xs text-center outline-none tabular-nums"
          placeholder="0–100"
          onClick={(e) => { e.stopPropagation() }}
        />
      ) : (
        <>
          <p className={cn('mt-0.5 text-xs font-bold tabular-nums text-center', pct != null ? occTextColor(pct) : 'text-muted-foreground/40')}>
            {pct != null ? `${pct}%` : '—'}
          </p>
          {source === 'pms' && (
            <span className="absolute top-1 right-1 text-[8px] text-blue-500 font-semibold">PMS</span>
          )}
        </>
      )}
    </div>
  )
}

function BookingHorizonPanel({
  fromDate,
  toDate,
  forecasts,
  onSave,
  onClear,
}: {
  fromDate: Date
  toDate: Date
  forecasts: BookingForecast[]
  onSave: (date: string, pct: number) => void
  onClear: (date: string) => void
}) {
  const forecastMap = useMemo(() => {
    const m = new Map<string, BookingForecast>()
    for (const f of forecasts) m.set(f.date, f)
    return m
  }, [forecasts])

  const weeks = useMemo(() => {
    const result: Date[][] = []
    let current = startOfWeek(fromDate, { weekStartsOn: 1 })
    while (!isAfter(current, toDate)) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) week.push(addDays(current, i))
      result.push(week)
      current = addDays(current, 7)
    }
    return result
  }, [fromDate, toDate])

  const pmsCount = forecasts.filter((f) => f.horizon_source === 'pms').length

  return (
    <div className="space-y-2">
      {pmsCount > 0 && (
        <p className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <Icon icon="globe-network" size={10} />
          {pmsCount} days populated by PMS · manual edits override
        </p>
      )}
      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-medium text-muted-foreground">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 gap-0.5">
          {week.map((date) => {
            const ds   = format(date, 'yyyy-MM-dd')
            const past = isBefore(date, subDays(new Date(), 1))
            return (
              <BookingHorizonCell
                key={ds}
                date={date}
                forecast={forecastMap.get(ds)}
                isPast={past}
                onSave={onSave}
                onClear={onClear}
              />
            )
          })}
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground text-center pt-1">
        Expected occupancy · click to enter · PMS entries shown with blue badge
      </p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OccupancyForecastPage() {
  const today       = new Date()
  const fromDate    = today
  const toDate      = addDays(today, 27)  // 4 weeks ahead
  const histFrom    = format(subDays(today, HISTORICAL_DAYS), 'yyyy-MM-dd')
  const histTo      = format(subDays(today, 1), 'yyyy-MM-dd')
  const futureFrom  = format(today, 'yyyy-MM-dd')
  const futureTo    = format(addDays(today, FORECAST_WINDOW - 1), 'yyyy-MM-dd')
  const horizonTo   = format(addDays(today, 29), 'yyyy-MM-dd')  // 30-day booking horizon

  const { data: historical = [], isLoading: histLoading } = useOccupancyLogs(histFrom, histTo)
  const { data: upcoming  = [], isLoading: upcomingLoading } = useOccupancyLogs(futureFrom, futureTo)
  const { data: allLogs   = [] } = useOccupancyLogs(futureFrom, format(toDate, 'yyyy-MM-dd'))
  const { data: forecast  = [], isLoading: forecastLoading } = useConsumptionForecast(HISTORICAL_DAYS)
  const { data: pmsHealth = [] } = usePMSHealth()
  const { data: bookingForecasts = [] } = useBookingForecasts(futureFrom, horizonTo)

  const [view, setView] = useState<'actuals' | 'horizon'>('actuals')

  const upsert        = useUpsertOccupancy()
  const remove        = useDeleteOccupancy()
  const upsertForecast = useUpsertBookingForecast()
  const removeForecast = useDeleteBookingForecast()

  const handleSave = useCallback((date: string, pct: number) => {
    upsert.mutate({ date, pct })
  }, [upsert])

  const handleClear = useCallback((date: string) => {
    remove.mutate(date)
  }, [remove])

  const handleForecastSave = useCallback((date: string, pct: number) => {
    upsertForecast.mutate({ date, pct })
  }, [upsertForecast])

  const handleForecastClear = useCallback((date: string) => {
    removeForecast.mutate(date)
  }, [removeForecast])

  const ctx = useMemo(
    () => computeOccupancyContext(historical, upcoming),
    [historical, upcoming],
  )

  // Build adjusted forecast rows
  const adjustedRows = useMemo<AdjustedRow[]>(() => {
    return forecast
      .filter((r) => r.avg_daily > 0)
      .map((r) => {
        const adjustedDaily = r.avg_daily * ctx.factor
        const baselineDays  = r.days_until_zero != null ? Math.round(r.days_until_zero) : null
        const adjustedDays  = adjustedDaily > 0
          ? Math.round(r.current_stock / adjustedDaily)
          : null
        const delta = adjustedDays != null && baselineDays != null
          ? adjustedDays - baselineDays
          : null
        const becomesCritical = (baselineDays ?? Infinity) > 7 && (adjustedDays ?? Infinity) <= 7

        return {
          variantId: r.variant_id,
          productName: r.product_name,
          variantName: r.variant_name,
          sku: r.sku,
          currentStock: r.current_stock,
          baselineDaily: r.avg_daily,
          adjustedDaily,
          baselineDays,
          adjustedDays,
          becomesCritical,
          delta,
        }
      })
      .sort((a, b) => (a.adjustedDays ?? Infinity) - (b.adjustedDays ?? Infinity))
  }, [forecast, ctx.factor])

  const newlyCritical = adjustedRows.filter((r) => r.becomesCritical).length
  const isLoading     = histLoading || upcomingLoading || forecastLoading

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Eye · Demand Sensing</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : ctx.daysEntered === 0
                ? 'Enter upcoming occupancy to activate demand-adjusted forecasting'
                : `${String(ctx.daysEntered)} days entered · next ${String(FORECAST_WINDOW)}d avg ${ctx.upcomingAvg.toFixed(0)}% vs ${ctx.historicalAvg.toFixed(0)}% baseline → ${ctx.factor.toFixed(2)}× factor`}
          </p>
        </div>
        {pmsHealth.length > 0 && <PMSHealthBadge rows={pmsHealth} />}
      </div>

      {/* KPI strip */}
      {!isLoading && (
        <div className="flex items-stretch border-b flex-shrink-0">
          {[
            {
              label: 'Baseline occupancy',
              value: `${ctx.historicalAvg.toFixed(0)}%`,
              sub: `30-day historical avg${historical.length === 0 ? ' (default)' : ` · ${String(historical.length)} days`}`,
              color: 'text-foreground',
            },
            {
              label: `Upcoming (next ${String(FORECAST_WINDOW)}d)`,
              value: ctx.daysEntered > 0 ? `${ctx.upcomingAvg.toFixed(0)}%` : '—',
              sub: ctx.daysEntered > 0 ? `${String(ctx.daysEntered)} days entered` : 'No occupancy entered yet',
              color: ctx.isElevated ? 'text-orange-600 dark:text-orange-400' : ctx.isSuppressed ? 'text-blue-600 dark:text-blue-400' : 'text-foreground',
            },
            {
              label: 'Demand factor',
              value: ctx.daysEntered > 0 ? `${ctx.factor.toFixed(2)}×` : '1.00×',
              sub: ctx.isElevated ? 'Elevated — more stock needed' : ctx.isSuppressed ? 'Suppressed — lighter demand' : 'Normal — no adjustment',
              color: ctx.isElevated ? 'text-orange-600 dark:text-orange-400' : ctx.isSuppressed ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
            },
            {
              label: 'Newly critical items',
              value: String(newlyCritical),
              sub: newlyCritical > 0 ? 'Would be fine at baseline — flag at this occupancy' : 'No new critical items at this occupancy',
              color: newlyCritical > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="flex-1 px-6 py-4 border-r last:border-r-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn('text-2xl font-bold tabular-nums mt-0.5', color)}>{value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Newly critical alert */}
      {newlyCritical > 0 && ctx.daysEntered > 0 && (
        <div className="mx-8 mt-4 flex-shrink-0">
          <Callout intent={Intent.DANGER} icon="warning-sign">
            <span className="font-semibold">{newlyCritical} item{newlyCritical !== 1 ? 's' : ''} become critical</span>
            {' '}at {ctx.upcomingAvg.toFixed(0)}% occupancy that would be fine at baseline —
            demand sensing detected before stockout.
          </Callout>
        </div>
      )}

      {/* Methodology note */}
      <div className="px-8 py-2 border-b flex-shrink-0">
        <Callout intent={Intent.NONE} icon="info-sign" compact>
          Adjusted days = current_stock ÷ (avg_daily × demand_factor) ·
          Demand factor = upcoming_{FORECAST_WINDOW}d avg ÷ historical_{HISTORICAL_DAYS}d avg ·
          {ctx.daysEntered === 0 ? ` No occupancy data — factor defaults to 1.0×` : ` Based on ${ctx.daysEntered} entered days`}
        </Callout>
      </div>

      {/* Body — split layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — occupancy calendar + booking horizon */}
        <div className="w-80 flex-shrink-0 border-r flex flex-col overflow-hidden">
          {/* Tab toggle */}
          <div className="px-3 py-2 border-b flex-shrink-0">
            <SegmentedControl
              size="small"
              fill
              value={view}
              onValueChange={(v) => { setView(v as 'actuals' | 'horizon') }}
              options={[
                { value: 'actuals', label: 'Actuals' },
                { value: 'horizon', label: 'Booking Horizon' },
              ]}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
              </div>
            ) : view === 'horizon' ? (
              <BookingHorizonPanel
                fromDate={fromDate}
                toDate={addDays(today, 29)}
                forecasts={bookingForecasts}
                onSave={handleForecastSave}
                onClear={handleForecastClear}
              />
            ) : (
              <OccupancyCalendar
                fromDate={fromDate}
                toDate={toDate}
                logs={allLogs}
                onSave={handleSave}
                onClear={handleClear}
              />
            )}
          </div>
        </div>

        {/* Right — adjusted forecast */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b px-6 py-3 flex-shrink-0">
            <div>
              <p className="text-xs font-semibold">Demand-Adjusted Forecast</p>
              <p className="text-[10px] text-muted-foreground">
                {ctx.daysEntered > 0
                  ? `${forecast.filter((r) => r.avg_daily > 0).length} items · adjusted at ${ctx.factor.toFixed(2)}× · sorted by urgency`
                  : `${forecast.filter((r) => r.avg_daily > 0).length} items · enter occupancy to see adjustments`}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {forecastLoading ? (
              <div className="flex items-center justify-center h-32">
                <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
              </div>
            ) : (
              <ForecastTable rows={adjustedRows} factor={ctx.factor} />
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
