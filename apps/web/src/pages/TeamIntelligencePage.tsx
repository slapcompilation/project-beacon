// Layer: Mind — Team Performance Intelligence
// Palantir principle #6: cross-domain synthesis.
// stock_logs + users + restock activity → per-member waste attribution,
// outlier detection, and team-relative benchmarking.
// Only admin/owner can view. Outliers float to top.

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle, ChevronDown, ChevronUp, Users, TrendingUp, TrendingDown,
  Minus, ShieldAlert, Loader2, Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useTeamPerformance } from '@/features/eye/hooks'
import type { TeamPerformanceRow } from '@beacon/types'

// ─── Window selector ──────────────────────────────────────────────────────────

const WINDOWS = [
  { days: 7,  label: '7d'  },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rateColor(rate: number): string {
  if (rate >= 2.5) return 'text-red-600 dark:text-red-400'
  if (rate >= 1.5) return 'text-amber-600 dark:text-amber-400'
  if (rate <= 0.6) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-foreground'
}

function rateIcon(rate: number) {
  if (rate >= 1.5) return <TrendingUp className="h-3 w-3 inline -mt-px" />
  if (rate <= 0.6) return <TrendingDown className="h-3 w-3 inline -mt-px" />
  return <Minus className="h-3 w-3 inline -mt-px text-muted-foreground" />
}

function wasteRateBar(pct: number | null) {
  if (pct === null) return (
    <span className="text-[10px] text-muted-foreground">—</span>
  )
  const capped = Math.min(pct, 100)
  const color = pct > 40 ? 'bg-red-500' : pct > 20 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden shrink-0">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${capped}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>
    </div>
  )
}

// ─── Expanded detail panel ────────────────────────────────────────────────────

function MemberDetail({ row, currency }: { row: TeamPerformanceRow; currency: string }) {
  const totalWriteOffs = row.write_off_units
  const breakPct = totalWriteOffs > 0 ? Math.round((row.breakage_units / totalWriteOffs) * 100) : 0
  const theftPct  = totalWriteOffs > 0 ? Math.round((row.theft_units  / totalWriteOffs) * 100) : 0
  const spoilPct  = totalWriteOffs > 0 ? Math.round((row.spoilage_units / totalWriteOffs) * 100) : 0

  return (
    <div className="px-4 pb-4 pt-2 pl-16 border-t border-border/30 bg-muted/20">
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4 text-xs mt-1">

        {/* Write-off breakdown */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Write-off Breakdown
          </p>
          <div className="space-y-1">
            {[
              { label: 'Breakage', units: row.breakage_units, pct: breakPct, color: 'bg-amber-400' },
              { label: 'Theft',    units: row.theft_units,    pct: theftPct,  color: 'bg-red-500'  },
              { label: 'Spoilage', units: row.spoilage_units, pct: spoilPct,  color: 'bg-orange-400' },
            ].map(({ label, units, pct, color }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={cn('h-1.5 rounded-full shrink-0', color)} style={{ width: `${Math.max(pct, 2)}%`, maxWidth: '60px', minWidth: '4px' }} />
                <span className="text-muted-foreground">{label}</span>
                <span className="tabular-nums font-medium ml-auto">{units}u · {pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Activity stats */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Activity
          </p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Consumption</span>
              <span className="tabular-nums font-medium">{row.consumption_units}u / {row.consumption_logs} logs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Additions</span>
              <span className="tabular-nums font-medium">{row.additions_logged}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active days</span>
              <span className="tabular-nums font-medium">{row.active_days}</span>
            </div>
          </div>
        </div>

        {/* Restock activity */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Restock
          </p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Requests filed</span>
              <span className="tabular-nums font-medium">{row.restock_requests_filed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receives processed</span>
              <span className="tabular-nums font-medium">{row.stock_receives_processed}</span>
            </div>
          </div>
        </div>

        {/* Rates */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Rates
          </p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Avg write-off/day</span>
              <span className="tabular-nums font-medium">{row.avg_write_off_per_day.toFixed(2)}u</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Write-off cost</span>
              <span className="tabular-nums font-medium">{formatCurrency(row.write_off_cost, currency)}</span>
            </div>
            {row.last_active_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last active</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(row.last_active_at), { addSuffix: true })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outlier reason inline */}
      {row.outlier_reason && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 dark:text-red-300">{row.outlier_reason}</p>
        </div>
      )}
    </div>
  )
}

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  row,
  currency,
  rank,
  teamSize,
}: {
  row: TeamPerformanceRow
  currency: string
  rank: number
  teamSize: number
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={cn(
      'border-b last:border-0 transition-colors',
      row.is_outlier && 'bg-red-50/50 dark:bg-red-950/10',
    )}>
      <button
        type="button"
        className="w-full text-left"
        onClick={() => { setExpanded((v) => !v) }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Outlier badge / rank */}
          <div className="w-6 shrink-0 text-center">
            {row.is_outlier
              ? <ShieldAlert className="h-4 w-4 text-red-500 mx-auto" />
              : <span className="text-[10px] text-muted-foreground tabular-nums">{rank}</span>
            }
          </div>

          {/* Email + role */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium truncate">{row.email}</p>
              <span className="text-[9px] uppercase tracking-wide text-muted-foreground border rounded px-1 py-0.5 shrink-0">
                {row.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {row.active_days > 0
                ? `${row.active_days} active day${row.active_days !== 1 ? 's' : ''}`
                : 'No activity this period'
              }
              {row.last_active_at && (
                <> · last {formatDistanceToNow(new Date(row.last_active_at), { addSuffix: true })}</>
              )}
            </p>
          </div>

          {/* Write-off units */}
          <div className="hidden sm:block text-right w-20 shrink-0">
            <p className="text-xs tabular-nums font-semibold">{row.write_off_units}u</p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {formatCurrency(row.write_off_cost, currency)}
            </p>
          </div>

          {/* Waste rate bar */}
          <div className="hidden md:flex items-center w-24 shrink-0">
            {wasteRateBar(row.waste_rate_pct)}
          </div>

          {/* Rate vs team avg */}
          <div className="w-20 shrink-0 text-right">
            <p className={cn('text-xs tabular-nums font-bold', rateColor(row.write_off_rate_vs_team_avg))}>
              {rateIcon(row.write_off_rate_vs_team_avg)}{' '}
              {row.write_off_rate_vs_team_avg.toFixed(2)}×
            </p>
            <p className="text-[10px] text-muted-foreground">vs avg</p>
          </div>

          {/* Percentile bar */}
          <div className="hidden lg:block w-16 shrink-0">
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  row.is_outlier ? 'bg-red-500' : 'bg-primary/60',
                )}
                style={{ width: `${Math.min((rank / teamSize) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5 text-right">#{rank} of {teamSize}</p>
          </div>

          {/* Expand toggle */}
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        </div>
      </button>

      {expanded && <MemberDetail row={row} currency={currency} />}
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ rows, currency }: { rows: TeamPerformanceRow[]; currency: string }) {
  const outliers     = rows.filter((r) => r.is_outlier).length
  const totalCost    = rows.reduce((s, r) => s + r.write_off_cost, 0)
  const totalUnits   = rows.reduce((s, r) => s + r.write_off_units, 0)
  const activeCount  = rows.filter((r) => r.active_days > 0).length

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border">
      {[
        { label: 'Team members',    value: rows.length.toString(),                icon: <Users className="h-3.5 w-3.5" /> },
        { label: 'Active this window', value: activeCount.toString(),             icon: <Activity className="h-3.5 w-3.5" /> },
        { label: 'Total write-off cost', value: formatCurrency(totalCost, currency), icon: <TrendingUp className="h-3.5 w-3.5 text-red-500" /> },
        { label: 'Outlier members',  value: outliers.toString(),
          extra: outliers > 0 ? <span className="text-red-600 dark:text-red-400 font-bold"> · {Math.round((rows.filter((r) => r.is_outlier).reduce((s, r) => s + r.write_off_cost, 0) / Math.max(totalCost, 0.01)) * 100)}% of cost</span> : null,
          icon: <ShieldAlert className={cn('h-3.5 w-3.5', outliers > 0 ? 'text-red-500' : 'text-muted-foreground')} />,
        },
      ].map(({ label, value, icon, extra }) => (
        <div key={label} className="bg-background px-4 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            {icon}
            <p className="text-[10px] uppercase tracking-widest font-bold">{label}</p>
          </div>
          <p className="text-sm font-bold tabular-nums">
            {value}{extra}
          </p>
          {label === 'Total write-off cost' && totalUnits > 0 && (
            <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{totalUnits} units total</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TeamIntelligencePage() {
  const currency                         = useCurrency()
  const [windowDays, setWindowDays]      = useState<7 | 30 | 90>(30)
  const { data: rows = [], isLoading, isError } = useTeamPerformance(windowDays)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex-1 flex items-center justify-center py-20 text-xs text-muted-foreground">
        Failed to load team performance data.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h2 className="text-sm font-semibold">Team Performance</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Write-off attribution · outlier detection · team benchmarking
            {rows.length > 0 && ` · ${rows.length} member${rows.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Window selector */}
        <div className="flex items-center gap-1 rounded-lg border p-0.5 bg-muted/30">
          {WINDOWS.map(({ days, label }) => (
            <button
              key={days}
              type="button"
              onClick={() => { setWindowDays(days as 7 | 30 | 90) }}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                windowDays === days
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      {rows.length > 0 && <SummaryStrip rows={rows} currency={currency} />}

      {/* Table header */}
      {rows.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-muted/30 shrink-0">
          <div className="w-6 shrink-0" />
          <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Member
          </div>
          <div className="hidden sm:block w-20 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Write-offs
          </div>
          <div className="hidden md:block w-24 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Waste rate
          </div>
          <div className="w-20 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            vs Team avg
          </div>
          <div className="hidden lg:block w-16" />
          <div className="w-4 shrink-0" />
        </div>
      )}

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
            <Users className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No team activity in this window</p>
            <p className="text-xs text-muted-foreground">
              Switch to a longer window or check that stock logs have user attribution.
            </p>
          </div>
        ) : (
          <div className="divide-y-0">
            {rows.map((row, i) => (
              <MemberRow
                key={row.user_id}
                row={row}
                currency={currency}
                rank={i + 1}
                teamSize={rows.length}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer — methodology note */}
      {rows.length > 0 && (
        <div className="shrink-0 border-t px-4 py-2 bg-muted/20 text-[10px] text-muted-foreground">
          Outlier threshold: ≥2.5× team avg write-off rate AND ≥3 write-off units · Team avg excludes members with zero activity ·
          Sorted: outliers first, then by write-off cost
        </div>
      )}
    </div>
  )
}
