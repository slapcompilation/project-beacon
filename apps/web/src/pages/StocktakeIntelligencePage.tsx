// Layer: Flow → Eye cross-layer synthesis
// Palantir principle: auditability as a first-class feature.
// After every stocktake, surface the unexplained variance — the gap between
// what the system accounts for (write-offs + receives) and what was physically counted.
// Unexplained deficit = potential shrinkage/theft signal that needs investigation.

import { useState } from 'react'
import { format, formatDuration, intervalToDuration } from 'date-fns'
import {
  AlertTriangle, CheckCircle2, Loader2, Search, TrendingDown,
  TrendingUp, Minus, Package, ClipboardList, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useStocktakeSessions, useStocktakeVariance } from '@/features/eye/hooks'
import type { StocktakeSessionSummary, StocktakeVarianceRow } from '@beacon/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, currency: string): string {
  return formatCurrency(n, currency)
}

function sessionDuration(mins: number | null): string {
  if (mins === null || mins <= 0) return '—'
  const d = intervalToDuration({ start: 0, end: mins * 60 * 1000 })
  return formatDuration(d, { format: ['hours', 'minutes'] }) || '<1 min'
}

function completionPct(session: StocktakeSessionSummary): number {
  if (session.total_lines === 0) return 0
  return Math.round((session.counted_lines / session.total_lines) * 100)
}

// ─── Session Selector ─────────────────────────────────────────────────────────

function SessionCard({
  session,
  selected,
  onSelect,
  currency,
}: {
  session: StocktakeSessionSummary
  selected: boolean
  onSelect: () => void
  currency: string
}) {
  const pct = completionPct(session)
  const hasAnomalies = session.anomaly_items > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg border px-4 py-3 transition-colors space-y-2',
        selected
          ? 'border-primary bg-primary/5'
          : 'hover:bg-muted/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold truncate">
            {session.committed_at
              ? format(new Date(session.committed_at), 'dd MMM yyyy · HH:mm')
              : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            By {session.created_by_email ?? 'unknown'} · {sessionDuration(session.duration_minutes)}
          </p>
          {session.note && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5 italic">{session.note}</p>
          )}
        </div>
        {hasAnomalies && (
          <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
        )}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="tabular-nums">{pct}% counted ({session.counted_lines}/{session.total_lines})</span>
        {session.variance_items > 0 && (
          <span className="text-amber-600 dark:text-amber-400">
            {session.variance_items} variance
          </span>
        )}
        {hasAnomalies && (
          <span className="text-red-600 dark:text-red-400 font-semibold">
            {session.anomaly_items} anomaly{session.anomaly_items !== 1 ? 'ies' : ''}
          </span>
        )}
      </div>

      {session.total_variance_cost > 0 && (
        <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 tabular-nums">
          {fmt(session.total_variance_cost, currency)} unexplained variance
        </p>
      )}
    </button>
  )
}

// ─── Summary Strip ────────────────────────────────────────────────────────────

function SessionSummaryStrip({
  session,
  currency,
}: {
  session: StocktakeSessionSummary
  currency: string
}) {
  const pct = completionPct(session)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Coverage</p>
        <p className="text-2xl font-bold tabular-nums">{pct}%</p>
        <p className="text-[10px] text-muted-foreground">{session.counted_lines} of {session.total_lines} variants counted</p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Variance Items</p>
        <p className="text-2xl font-bold tabular-nums">{session.variance_items}</p>
        <p className="text-[10px] text-muted-foreground">counted ≠ system snapshot</p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Anomalies</p>
        <p className={cn('text-2xl font-bold tabular-nums', session.anomaly_items > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400')}>
          {session.anomaly_items}
        </p>
        <p className="text-[10px] text-muted-foreground">unexplained ≥3 units or ≥$25</p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Unexplained Value</p>
        <p className={cn('text-2xl font-bold tabular-nums', session.total_variance_cost > 0 ? 'text-red-600 dark:text-red-400' : '')}>
          {fmt(session.total_variance_cost, currency)}
        </p>
        <p className="text-[10px] text-muted-foreground">|unexplained| × unit cost</p>
      </div>
    </div>
  )
}

// ─── Variance Table ───────────────────────────────────────────────────────────

const DIRECTION_META = {
  deficit:  { icon: TrendingDown, cls: 'text-red-600 dark:text-red-400',     label: 'Deficit'  },
  surplus:  { icon: TrendingUp,   cls: 'text-amber-600 dark:text-amber-400', label: 'Surplus'  },
  exact:    { icon: Minus,        cls: 'text-emerald-600 dark:text-emerald-400', label: 'Exact' },
} as const

function VarianceRow({
  row,
  currency,
}: {
  row: StocktakeVarianceRow
  currency: string
}) {
  const [open, setOpen] = useState(false)
  const meta = DIRECTION_META[row.direction]
  const Icon = meta.icon

  return (
    <>
      <tr
        className={cn(
          'hover:bg-muted/20 transition-colors cursor-pointer',
          row.is_anomaly && 'bg-red-50/40 dark:bg-red-950/10',
        )}
        onClick={() => { setOpen((v) => !v) }}
      >
        {/* Anomaly flag */}
        <td className="px-4 py-2.5 w-6">
          {row.is_anomaly && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
        </td>
        {/* Item */}
        <td className="px-4 py-2.5">
          <p className="text-xs font-medium">{row.variant_label}</p>
          {row.category_name && (
            <p className="text-[10px] text-muted-foreground">{row.category_name}</p>
          )}
        </td>
        {/* System → Counted */}
        <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
          {row.system_qty} → <span className="text-foreground font-medium">{row.counted_qty}</span>
        </td>
        {/* Raw variance */}
        <td className="px-4 py-2.5 text-right tabular-nums text-xs">
          <span className={row.raw_variance < 0 ? 'text-red-600 dark:text-red-400' : row.raw_variance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}>
            {row.raw_variance > 0 ? '+' : ''}{row.raw_variance}
          </span>
        </td>
        {/* Explained movement */}
        <td className="px-4 py-2.5 text-right tabular-nums text-[10px] text-muted-foreground">
          {row.write_offs_during > 0 || row.receives_during > 0 ? (
            <span>
              {row.write_offs_during > 0 && <span className="text-red-500">−{row.write_offs_during}</span>}
              {row.receives_during > 0 && (
                <span className="text-emerald-500 ml-1">+{row.receives_during}</span>
              )}
            </span>
          ) : (
            <span>—</span>
          )}
        </td>
        {/* Unexplained */}
        <td className="px-4 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1">
            <Icon className={cn('h-3 w-3', meta.cls)} />
            <span className={cn('text-xs font-semibold tabular-nums', meta.cls)}>
              {row.unexplained_variance > 0 ? '+' : ''}{row.unexplained_variance}
            </span>
          </div>
        </td>
        {/* Cost */}
        <td className="px-4 py-2.5 text-right tabular-nums text-xs">
          {row.variance_cost > 0 ? (
            <span className={cn('font-semibold', row.is_anomaly ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
              {fmt(row.variance_cost, currency)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      </tr>

      {/* Expanded detail */}
      {open && (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-8 py-4">
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Variance Breakdown</p>
                  <div className="space-y-0.5 text-muted-foreground">
                    <p>System snapshot: <span className="text-foreground font-medium tabular-nums">{row.system_qty}</span></p>
                    {row.write_offs_during > 0 && (
                      <p>Write-offs during count: <span className="text-red-500 tabular-nums">−{row.write_offs_during}</span></p>
                    )}
                    {row.receives_during > 0 && (
                      <p>Receives during count: <span className="text-emerald-500 tabular-nums">+{row.receives_during}</span></p>
                    )}
                    <p className="border-t pt-0.5 mt-0.5">Adjusted expected: <span className="text-foreground font-medium tabular-nums">{row.adjusted_expected}</span></p>
                    <p>Physical count: <span className="text-foreground font-medium tabular-nums">{row.counted_qty}</span></p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Unexplained Gap</p>
                  <p className={cn('text-xl font-bold tabular-nums', meta.cls)}>
                    {row.unexplained_variance > 0 ? '+' : ''}{row.unexplained_variance} units
                  </p>
                  {row.variance_cost > 0 && (
                    <p className="text-muted-foreground tabular-nums">{fmt(row.variance_cost, currency)} at unit cost</p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Investigation Guidance</p>
                  {row.direction === 'deficit' && row.is_anomaly && (
                    <div className="space-y-1">
                      <p className="flex items-start gap-1 text-red-700 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        Unexplained deficit — check for unlogged write-offs, miscounts, or theft
                      </p>
                      {row.write_offs_during === 0 && (
                        <p className="text-muted-foreground">No write-offs were logged during this session. Items may have been removed without logging.</p>
                      )}
                    </div>
                  )}
                  {row.direction === 'surplus' && row.is_anomaly && (
                    <p className="text-amber-700 dark:text-amber-400">
                      Unexpected surplus — verify no double-receives or miscount. Could indicate items from another location.
                    </p>
                  )}
                  {!row.is_anomaly && row.direction !== 'exact' && (
                    <p className="text-muted-foreground">Small variance — within acceptable tolerance. No action required.</p>
                  )}
                  {row.direction === 'exact' && (
                    <p className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Perfect match — no unexplained variance
                    </p>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function VarianceTable({
  rows,
  currency,
}: {
  rows: StocktakeVarianceRow[]
  currency: string
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'anomalies' | 'deficits'>('all')

  const filtered = rows.filter((r) => {
    if (filter === 'anomalies' && !r.is_anomaly) return false
    if (filter === 'deficits' && r.direction !== 'deficit') return false
    if (search) return r.variant_label.toLowerCase().includes(search.toLowerCase()) ||
                        (r.category_name ?? '').toLowerCase().includes(search.toLowerCase())
    return true
  })

  const anomalyCount  = rows.filter((r) => r.is_anomaly).length
  const deficitCount  = rows.filter((r) => r.direction === 'deficit').length

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-2 bg-muted/30 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-md border p-0.5 bg-background">
          {[
            { id: 'all'       as const, label: `All (${rows.length})` },
            { id: 'anomalies' as const, label: `Anomalies (${anomalyCount})` },
            { id: 'deficits'  as const, label: `Deficits (${deficitCount})` },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setFilter(f.id) }}
              className={cn(
                'px-2.5 py-1 text-[10px] rounded transition-colors',
                filter === f.id
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-1 min-w-32">
          <Search className="h-3 w-3 text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
            placeholder="Filter by item…"
            className="text-xs bg-transparent border-0 outline-none flex-1 placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/10">
              <th className="w-6 px-4 py-2" />
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Item</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">System → Counted</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Raw Δ</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Explained</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Unexplained</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Cost</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-xs text-muted-foreground">
                  No items match the current filter.
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <VarianceRow key={row.variant_id} row={row} currency={currency} />
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t bg-muted/10">
        <p className="text-[10px] text-muted-foreground">
          Click a row to expand the variance breakdown and investigation guidance ·
          Anomaly = unexplained ≥3 units OR ≥{fmt(25, currency)}
        </p>
      </div>
    </div>
  )
}

// ─── Empty States ─────────────────────────────────────────────────────────────

function NoSessions() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
      <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
      <div className="space-y-1">
        <p className="text-sm font-medium">No committed stocktakes yet</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Complete a stocktake session from the Floor workspace to see variance intelligence here.
          The system snapshots stock at the start and explains every discrepancy after commit.
        </p>
      </div>
    </div>
  )
}

function NoVariance() {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center px-8">
      <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
      <div className="space-y-1">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">No unexplained variance</p>
        <p className="text-xs text-muted-foreground">
          Every discrepancy in this session is accounted for by logged write-offs or receives.
        </p>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StocktakeIntelligencePage() {
  const currency = useCurrency()
  const { data: sessions = [], isLoading: sessionsLoading } = useStocktakeSessions(15)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Auto-select the most recent session
  const activeId = selectedId ?? sessions[0]?.session_id ?? null
  const activeSession = sessions.find((s) => s.session_id === activeId) ?? null

  const { data: varianceRows = [], isLoading: varianceLoading } = useStocktakeVariance(activeId)

  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return <NoSessions />
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Session list sidebar ── */}
      <div className="w-64 shrink-0 border-r overflow-y-auto flex flex-col">
        <div className="px-3 py-2 border-b bg-muted/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <ClipboardList className="inline h-3 w-3 mr-1 -mt-px" />
            Stocktake Sessions
          </p>
        </div>
        <div className="p-2 space-y-1.5 flex-1">
          {sessions.map((s) => (
            <SessionCard
              key={s.session_id}
              session={s}
              selected={s.session_id === activeId}
              onSelect={() => { setSelectedId(s.session_id) }}
              currency={currency}
            />
          ))}
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {!activeSession ? (
          <p className="text-xs text-muted-foreground">Select a session to view variance.</p>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">
                    Variance Report ·{' '}
                    {activeSession.committed_at
                      ? format(new Date(activeSession.committed_at), 'dd MMM yyyy')
                      : '—'}
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground">
                  By {activeSession.created_by_email ?? 'unknown'} ·{' '}
                  Duration: {sessionDuration(activeSession.duration_minutes)} ·{' '}
                  {activeSession.note && <em>{activeSession.note}</em>}
                </p>
              </div>
              {activeSession.anomaly_items > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 font-semibold border border-red-200 dark:border-red-900 rounded-md px-2 py-1 bg-red-50 dark:bg-red-950/20 shrink-0">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {activeSession.anomaly_items} item{activeSession.anomaly_items !== 1 ? 's' : ''} need investigation
                </div>
              )}
            </div>

            <SessionSummaryStrip session={activeSession} currency={currency} />

            {varianceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : varianceRows.every((r) => r.direction === 'exact') ? (
              <NoVariance />
            ) : (
              <VarianceTable rows={varianceRows} currency={currency} />
            )}
          </>
        )}
      </div>
    </div>
  )
}
