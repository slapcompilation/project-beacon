// Layer: Mind — Chain Overview (multi-hotel intelligence hub)
// Palantir principle: cross-domain synthesis. This page exists to answer
// "which property needs my attention right now, and why?" for regional
// directors and chain owners. Every metric includes the chain median as context.
// Sort order: worst health score first — the most at-risk property is always top.

import { useMemo, useState } from 'react'
import {
  AlertTriangle, Building2, BarChart3, Loader2,
  TrendingDown, TrendingUp, ShieldCheck, ShieldAlert,
  CircleDot, Package, RefreshCw, Truck, Activity,
  ChevronsUpDown, ChevronUp, ChevronDown, Zap, Target,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { scoreToGrade, GRADE_STYLES, GRADE_ICONS } from '@/lib/grades'
import { useCurrency } from '@/hooks/useCurrency'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useChainOverview } from '@/features/mind/hooks'
import { useSupplierLeverage } from '@/features/suppliers/hooks'
import type { ChainPropertyRow, SupplierLeverageRow } from '@beacon/types'

function ScorePill({ score }: { score: number }) {
  const grade = scoreToGrade(score)
  const Icon = GRADE_ICONS[grade]
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold',
      GRADE_STYLES[grade],
    )}>
      <Icon className="h-3 w-3" />
      {score} · {grade}
    </span>
  )
}

// ─── Median deviation badge ───────────────────────────────────────────────────
// Shows "X.Xx avg" when a metric is significantly above/below chain median.
// Only renders when ratio > 1.4 (40% worse than chain avg).

function DeviationBadge({
  value,
  median,
  higherIsBad = true,
}: {
  value: number
  median: number
  higherIsBad?: boolean
}) {
  if (median === 0) return null
  const ratio = value / median
  const threshold = 1.4
  if (ratio < threshold && ratio > 1 / threshold) return null

  const isBad  = higherIsBad ? ratio > 1 : ratio < 1
  const isHigh = ratio > 1   // determines icon direction, independent of good/bad
  const label  = `${ratio.toFixed(1)}× avg`

  return (
    <span className={cn(
      'ml-1.5 inline-flex items-center gap-0.5 rounded px-1 py-0 text-[10px] font-bold',
      isBad
        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
        : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
    )}>
      {isHigh
        ? <TrendingUp className="h-2.5 w-2.5" />
        : <TrendingDown className="h-2.5 w-2.5" />}
      {label}
    </span>
  )
}

// ─── Chain median helpers ──────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

function KpiTile({
  label, value, sub, icon: Icon, accent = 'text-foreground',
}: {
  label: string; value: string; sub?: string; icon: React.ElementType; accent?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-0.5 text-lg font-semibold leading-none', accent)}>{value}</p>
        {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Property Row ─────────────────────────────────────────────────────────────

interface RowProps {
  row: ChainPropertyRow
  rank: number
  medians: {
    waste_rate: number
    avg_days_supply: number
    out_of_stock_pct: number
    pending_restock_pct: number
    supplier_score: number
  }
  currency: string
  isCurrentHotel: boolean
}

function PropertyRow({ row, rank, medians, currency, isCurrentHotel }: RowProps) {
  const grade           = scoreToGrade(row.health_score)
  const wastePct        = Math.round((row.waste_rate ?? 0) * 100)
  const oosPct          = row.total_variants > 0
    ? (row.out_of_stock_count / row.total_variants) * 100
    : 0
  const pendingPct      = row.total_variants > 0
    ? (row.pending_restocks / row.total_variants) * 100
    : 0
  const logsPerDay      = row.stock_log_count > 0
    ? (row.stock_log_count / 30).toFixed(1)
    : '0'

  return (
    <tr className={cn(
      'border-b text-sm transition-colors hover:bg-muted/30',
      isCurrentHotel && 'bg-primary/5',
    )}>
      {/* Rank */}
      <td className="w-8 py-3 pl-4 text-center text-[11px] font-mono text-muted-foreground">
        {rank}
      </td>

      {/* Property name */}
      <td className="py-3 pl-2 pr-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="font-medium">{row.hotel_name}</span>
          {isCurrentHotel && (
            <span className="rounded bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
              current
            </span>
          )}
        </div>
        <p className="ml-6 text-[11px] text-muted-foreground mt-0.5">
          {row.total_variants} variants · {row.stock_log_count} logs in period
        </p>
      </td>

      {/* Health score */}
      <td className="py-3 px-4 text-center">
        <ScorePill score={row.health_score} />
      </td>

      {/* Stock health: OOS + Low */}
      <td className="py-3 px-4 text-right">
        <div>
          <span className={cn(
            'text-sm font-semibold tabular-nums',
            row.out_of_stock_count > 0 ? 'text-red-600 dark:text-red-400'
            : row.low_stock_count > 0  ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-green-600 dark:text-green-400',
          )}>
            {row.out_of_stock_count} OOS
          </span>
          {row.out_of_stock_count > 0 && (
            <DeviationBadge value={oosPct} median={medians.out_of_stock_pct} higherIsBad />
          )}
          <p className="text-[10px] text-muted-foreground">{row.low_stock_count} low</p>
        </div>
      </td>

      {/* Avg days supply */}
      <td className="py-3 px-4 text-right">
        <div>
          <span className={cn(
            'text-sm font-semibold tabular-nums',
            row.avg_days_supply >= 14 ? 'text-green-600 dark:text-green-400'
            : row.avg_days_supply >= 7  ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-red-600 dark:text-red-400',
          )}>
            {row.avg_days_supply > 0 ? `${row.avg_days_supply.toFixed(0)}d` : '—'}
          </span>
          {row.avg_days_supply > 0 && medians.avg_days_supply > 0 && (
            <DeviationBadge
              value={row.avg_days_supply}
              median={medians.avg_days_supply}
              higherIsBad={false}
            />
          )}
        </div>
      </td>

      {/* Waste */}
      <td className="py-3 px-4 text-right">
        <div>
          <span className={cn(
            'text-sm font-semibold tabular-nums',
            wastePct > 20 ? 'text-red-600 dark:text-red-400'
            : wastePct > 10 ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-green-600 dark:text-green-400',
          )}>
            {wastePct}%
          </span>
          <DeviationBadge value={row.waste_rate} median={medians.waste_rate} higherIsBad />
          <p className="text-[10px] text-muted-foreground">
            {formatCurrency(row.waste_cost, currency)} cost
          </p>
        </div>
      </td>

      {/* Restocks pending */}
      <td className="py-3 px-4 text-right">
        <div>
          <span className={cn(
            'text-sm font-semibold tabular-nums',
            row.pending_restocks > 10 ? 'text-red-600 dark:text-red-400'
            : row.pending_restocks > 5 ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-foreground',
          )}>
            {row.pending_restocks}
          </span>
          {row.pending_restocks > 0 && (
            <DeviationBadge value={pendingPct} median={medians.pending_restock_pct} higherIsBad />
          )}
          <p className="text-[10px] text-muted-foreground">{row.total_restocks} total</p>
        </div>
      </td>

      {/* Supplier score */}
      <td className="py-3 px-4 text-right">
        {row.avg_supplier_score != null ? (
          <div>
            <span className={cn(
              'text-sm font-semibold tabular-nums',
              row.avg_supplier_score >= 85 ? 'text-green-600 dark:text-green-400'
              : row.avg_supplier_score >= 70 ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400',
            )}>
              {Math.round(row.avg_supplier_score)}
            </span>
            {medians.supplier_score > 0 && (
              <DeviationBadge
                value={row.avg_supplier_score}
                median={medians.supplier_score}
                higherIsBad={false}
              />
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No data</span>
        )}
      </td>

      {/* Activity */}
      <td className="py-3 px-4 text-right">
        <div>
          <span className={cn(
            'text-sm font-semibold tabular-nums',
            Number(logsPerDay) >= 5 ? 'text-green-600 dark:text-green-400'
            : Number(logsPerDay) >= 2 ? 'text-yellow-600 dark:text-yellow-400'
            : 'text-red-600 dark:text-red-400',
          )}>
            {logsPerDay}/d
          </span>
          <p className="text-[10px] text-muted-foreground">log cadence</p>
        </div>
      </td>

      {/* Grade context */}
      <td className="py-3 px-4 pr-6">
        {grade === 'D' && (
          <span className="flex items-center gap-1 text-[11px] font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />Critical
          </span>
        )}
        {grade === 'C' && (
          <span className="flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-3 w-3" />Watch
          </span>
        )}
        {grade === 'B' && (
          <span className="flex items-center gap-1 text-[11px] text-lime-600 dark:text-lime-400">
            <CircleDot className="h-3 w-3" />Good
          </span>
        )}
        {grade === 'A' && (
          <span className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
            <ShieldCheck className="h-3 w-3" />Healthy
          </span>
        )}
      </td>
    </tr>
  )
}

// ─── Sortable column header ────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

function SortableTh({
  label, field, sortBy, sortDir, align = 'right', onSort,
}: {
  label: string
  field: string
  sortBy: string
  sortDir: SortDir
  align?: 'left' | 'right' | 'center'
  onSort: (field: string) => void
}) {
  const active = sortBy === field
  const Icon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <th
      className={cn(
        'cursor-pointer select-none py-2.5 px-4 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        active && 'text-foreground',
      )}
      onClick={() => { onSort(field) }}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && <Icon className="h-3 w-3" />}
        {label}
        {align !== 'right' && <Icon className="h-3 w-3" />}
      </span>
    </th>
  )
}

// ─── Procurement leverage opportunities ───────────────────────────────────────

const ACTION_STYLES: Record<SupplierLeverageRow['recommended_action'], string> = {
  'Find Alternative':   'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  'Renegotiate':        'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  'Monitor':            'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  'Preferred Supplier': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
}

function ProcurementOpportunitiesPanel({ currency }: { currency: string }) {
  const { data: leverage = [], isLoading } = useSupplierLeverage(90)

  // Focus on suppliers with actual leverage (not preferred)
  const opportunities = useMemo(() => (
    leverage
      .filter((s) => s.recommended_action !== 'Preferred Supplier')
      .sort((a, b) => b.leverage_score - a.leverage_score)
      .slice(0, 6)
  ), [leverage])

  const totalExposure = useMemo(() =>
    leverage.filter((s) => s.recommended_action !== 'Preferred Supplier')
      .reduce((sum, s) => sum + s.total_spend, 0),
    [leverage],
  )

  if (isLoading || opportunities.length === 0) return null

  return (
    <div className="px-4 md:px-8 pb-6">
      <div className="rounded-lg border overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold">Procurement Leverage Opportunities</span>
            <span className="text-[11px] text-muted-foreground ml-1">90-day window</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {formatCurrency(totalExposure, currency)} at-risk spend across {opportunities.length} supplier{opportunities.length !== 1 ? 's' : ''}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/20 text-xs font-medium text-muted-foreground">
              <th className="py-2 px-4 text-left">Supplier</th>
              <th className="py-2 px-4 text-center">Action</th>
              <th className="py-2 px-4 text-right">Leverage score</th>
              <th className="py-2 px-4 text-right">On-time rate</th>
              <th className="py-2 px-4 text-right">Price drift</th>
              <th className="py-2 px-4 text-right">90d spend</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((s) => (
              <tr key={s.supplier_id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-4">
                  <span className="font-medium">{s.supplier_name}</span>
                  {s.pending_deliveries > 0 && (
                    <span className="ml-2 text-[10px] text-yellow-600 dark:text-yellow-400">
                      {s.pending_deliveries} pending
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <span className={cn(
                    'rounded-full px-2 py-0.5 text-[11px] font-medium',
                    ACTION_STYLES[s.recommended_action],
                  )}>
                    {s.recommended_action}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  <span className={cn(
                    'text-sm font-semibold tabular-nums',
                    s.leverage_score >= 70 ? 'text-red-600 dark:text-red-400'
                    : s.leverage_score >= 40 ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-foreground',
                  )}>
                    {Math.round(s.leverage_score)}
                  </span>
                  <span className="ml-1 text-[10px] text-muted-foreground">/100</span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  {s.on_time_rate != null ? (
                    <span className={cn(
                      'text-sm tabular-nums',
                      s.on_time_rate >= 0.9 ? 'text-green-600 dark:text-green-400'
                      : s.on_time_rate >= 0.75 ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400',
                    )}>
                      {Math.round(s.on_time_rate * 100)}%
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right">
                  {s.avg_price_drift_pct != null ? (
                    <span className={cn(
                      'text-sm tabular-nums',
                      s.avg_price_drift_pct > 5 ? 'text-red-600 dark:text-red-400'
                      : s.avg_price_drift_pct > 0 ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-green-600 dark:text-green-400',
                    )}>
                      {s.avg_price_drift_pct > 0 ? '+' : ''}{s.avg_price_drift_pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 px-4 text-right font-medium tabular-nums">
                  {formatCurrency(s.total_spend, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          Leverage score = supplier dependency + price drift + reliability gaps. Higher = more negotiating room.
        </div>
      </div>
    </div>
  )
}

// ─── Outlier synthesis panel ──────────────────────────────────────────────────
// Computes the chain outlier and explains WHY in plain language.
// Uses existing ChainPropertyRow data — no new SQL required.

function OutlierPanel({
  rows,
  medians,
  currency,
}: {
  rows: ChainPropertyRow[]
  medians: { waste_rate: number; avg_days_supply: number; out_of_stock_pct: number; pending_restock_pct: number; supplier_score: number }
  currency: string
}) {
  if (rows.length < 2) return null

  const worst = rows[0]  // rows are sorted worst-first (health_score ASC)
  const best  = rows[rows.length - 1]
  if (!worst || !best) return null

  // Build explanation: find which specific dimensions are most off vs median
  const insights: string[] = []

  const wasteRatioPct = Math.round((worst.waste_rate ?? 0) * 100)
  if (medians.waste_rate > 0) {
    const wasteRatio = (worst.waste_rate ?? 0) / medians.waste_rate
    if (wasteRatio >= 1.4) {
      insights.push(`${wasteRatio.toFixed(1)}× the chain median waste rate (${wasteRatioPct}% vs ${Math.round(medians.waste_rate * 100)}% chain avg)`)
    }
  }

  const oosPct = worst.total_variants > 0
    ? (worst.out_of_stock_count / worst.total_variants) * 100
    : 0
  if (oosPct > 0 && medians.out_of_stock_pct > 0) {
    const oosRatio = oosPct / medians.out_of_stock_pct
    if (oosRatio >= 1.4) {
      insights.push(`OOS rate ${oosRatio.toFixed(1)}× chain median (${worst.out_of_stock_count} variants out of stock)`)
    }
  } else if (oosPct > 5) {
    insights.push(`${worst.out_of_stock_count} variants out of stock`)
  }

  if (worst.avg_days_supply > 0 && medians.avg_days_supply > 0) {
    const supplyRatio = worst.avg_days_supply / medians.avg_days_supply
    if (supplyRatio < 0.6) {
      insights.push(`avg supply ${worst.avg_days_supply.toFixed(0)}d vs ${medians.avg_days_supply.toFixed(0)}d chain median`)
    }
  }

  if (worst.avg_supplier_score != null && medians.supplier_score > 0) {
    const scoreGap = medians.supplier_score - worst.avg_supplier_score
    if (scoreGap >= 10) {
      insights.push(`supplier score ${Math.round(worst.avg_supplier_score)} vs ${Math.round(medians.supplier_score)} chain median`)
    }
  }

  const healthGap = best.health_score - worst.health_score

  return (
    <div className="mx-4 md:mx-8 mt-4 flex-shrink-0 space-y-2">
      {/* Worst-performer card */}
      <div className="flex items-start gap-3 rounded-lg border border-orange-300/60 bg-orange-50/50 dark:border-orange-800/50 dark:bg-orange-950/20 px-4 py-3">
        <Target className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-semibold">{worst.hotel_name}</span>
            <span className="text-xs text-muted-foreground">is the chain outlier</span>
            <span className="rounded bg-orange-200 dark:bg-orange-900/60 px-1.5 py-0 text-[10px] font-bold text-orange-800 dark:text-orange-300">
              score {worst.health_score} · {scoreToGrade(worst.health_score)}
            </span>
          </div>
          {insights.length > 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {insights.join(' · ')}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Health score {healthGap} points below chain best ({best.hotel_name}: {best.health_score}).
            </p>
          )}
          <p className="mt-1 text-[11px] text-orange-700 dark:text-orange-400">
            Waste cost this period: {formatCurrency(worst.waste_cost, currency)} ·
            {' '}{worst.pending_restocks} pending restocks ·
            {' '}activity {(worst.stock_log_count / 30).toFixed(1)} logs/day
          </p>
        </div>

        {/* Best performer */}
        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-[10px] text-muted-foreground">Best performer</p>
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">{best.hotel_name}</p>
          <p className="text-[10px] text-muted-foreground">score {best.health_score} · {scoreToGrade(best.health_score)}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const RANGE_OPTIONS = [
  { label: '7d',  days: 7  },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

type SortField =
  | 'health_score' | 'out_of_stock_count' | 'avg_days_supply'
  | 'waste_rate' | 'pending_restocks' | 'avg_supplier_score' | 'stock_log_count'

export default function ChainPage() {
  const [days, setDays]       = useState<7 | 30 | 90>(30)
  const [sortBy, setSortBy]   = useState<SortField>('health_score')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const { data: rows = [], isLoading } = useChainOverview(days)
  const activeHotel = useActiveHotel()
  const currency    = useCurrency()

  function handleSort(field: string) {
    const f = field as SortField
    if (f === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(f)
      // Default direction: asc for health/supplier (higher is better → show worst first),
      // desc for problems (OOS, waste, pending restocks → show most severe first)
      const defaultDesc: SortField[] = ['out_of_stock_count', 'waste_rate', 'pending_restocks']
      setSortDir(defaultDesc.includes(f) ? 'desc' : 'asc')
    }
  }

  // Sorted rows for the table
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal = a[sortBy] as number | null
      let bVal = b[sortBy] as number | null
      if (aVal == null) aVal = sortDir === 'asc' ? Infinity : -Infinity
      if (bVal == null) bVal = sortDir === 'asc' ? Infinity : -Infinity
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [rows, sortBy, sortDir])

  // Chain-level medians for deviation callouts
  const medians = useMemo(() => {
    if (rows.length === 0) return {
      waste_rate: 0, avg_days_supply: 0, out_of_stock_pct: 0,
      pending_restock_pct: 0, supplier_score: 0,
    }
    return {
      waste_rate:          median(rows.map((r) => r.waste_rate ?? 0)),
      avg_days_supply:     median(rows.map((r) => r.avg_days_supply)),
      out_of_stock_pct:    median(rows.map((r) =>
        r.total_variants > 0 ? (r.out_of_stock_count / r.total_variants) * 100 : 0
      )),
      pending_restock_pct: median(rows.map((r) =>
        r.total_variants > 0 ? (r.pending_restocks / r.total_variants) * 100 : 0
      )),
      supplier_score: median(
        rows.filter((r) => r.avg_supplier_score != null).map((r) => r.avg_supplier_score!)
      ),
    }
  }, [rows])

  // Chain-level aggregate KPIs
  const kpis = useMemo(() => {
    if (rows.length === 0) return null
    const atRisk         = rows.filter((r) => r.health_score < 60).length
    const totalWasteCost = rows.reduce((s, r) => s + r.waste_cost, 0)
    const totalPending   = rows.reduce((s, r) => s + r.pending_restocks, 0)
    const avgScore       = Math.round(rows.reduce((s, r) => s + r.health_score, 0) / rows.length)
    const worst          = rows[0]   // already sorted worst-first
    const best           = rows[rows.length - 1]
    return { atRisk, totalWasteCost, totalPending, avgScore, worst, best }
  }, [rows])

  const criticalRows = rows.filter((r) => scoreToGrade(r.health_score) === 'D')

  // Single-hotel: show upgrade message instead of empty table
  if (!isLoading && rows.length <= 1) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b px-4 md:px-8 py-5">
          <div>
            <h1 className="text-xl font-semibold">Mind · Chain Overview</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Multi-property intelligence</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm font-medium">Single property detected</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Chain Overview becomes active when your account manages 2 or more hotels.
            Cross-property benchmarking, waste comparisons, and health rankings will appear here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 md:px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Mind · Chain Overview</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : `${String(rows.length)} properties · sorted by health score · worst first · last ${String(days)} days`}
          </p>
        </div>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => { setDays(opt.days) }}
              className={cn(
                'rounded px-3 py-1.5 text-xs font-medium transition-colors',
                days === opt.days
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading chain data…
        </div>
      ) : (
        <>
          {/* Critical alert banner */}
          {criticalRows.length > 0 && (
            <div className="mx-4 md:mx-8 mt-4 flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 flex-shrink-0">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <span className="font-semibold">
                  {criticalRows.length} propert{criticalRows.length > 1 ? 'ies' : 'y'} in critical state (score &lt;50):
                </span>
                {' '}
                {criticalRows.map((r) => r.hotel_name).join(', ')}
                {' '}— immediate attention required.
              </div>
            </div>
          )}

          {/* Outlier synthesis */}
          {rows.length >= 2 && (
            <OutlierPanel rows={rows} medians={medians} currency={currency} />
          )}

          {/* KPI strip */}
          {kpis && (
            <div className="grid grid-cols-2 gap-3 px-4 md:px-8 py-4 border-b sm:grid-cols-4 flex-shrink-0">
              <KpiTile
                label="Chain avg health"
                value={`${String(kpis.avgScore)} · ${scoreToGrade(kpis.avgScore)}`}
                sub={`${String(rows.length)} properties · ${days}d window`}
                icon={BarChart3}
                accent={
                  kpis.avgScore >= 85 ? 'text-green-600 dark:text-green-400'
                  : kpis.avgScore >= 70 ? 'text-lime-600 dark:text-lime-400'
                  : kpis.avgScore >= 50 ? 'text-orange-600 dark:text-orange-400'
                  : 'text-red-600 dark:text-red-400'
                }
              />
              <KpiTile
                label="Properties at risk"
                value={String(kpis.atRisk)}
                sub={kpis.atRisk > 0 ? 'score below 60 — review needed' : 'All properties healthy'}
                icon={ShieldAlert}
                accent={kpis.atRisk > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
              />
              <KpiTile
                label={`Chain waste cost (${String(days)}d)`}
                value={formatCurrency(kpis.totalWasteCost, currency)}
                sub={`${String(Math.round(medians.waste_rate * 100))}% chain median waste rate`}
                icon={TrendingDown}
                accent={kpis.totalWasteCost > 0 ? 'text-red-600 dark:text-red-400' : ''}
              />
              <KpiTile
                label="Chain pending restocks"
                value={String(kpis.totalPending)}
                sub={`across all ${String(rows.length)} properties`}
                icon={RefreshCw}
                accent={kpis.totalPending > 20 ? 'text-yellow-600 dark:text-yellow-400' : ''}
              />
            </div>
          )}

          {/* Chain median context bar */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 md:px-8 py-2 border-b bg-muted/20 flex-shrink-0 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Chain medians:</span>
            <span>Waste rate {Math.round(medians.waste_rate * 100)}%</span>
            <span>Avg supply {medians.avg_days_supply.toFixed(0)}d</span>
            <span>OOS {medians.out_of_stock_pct.toFixed(1)}%</span>
            {medians.supplier_score > 0 && (
              <span>Supplier score {Math.round(medians.supplier_score)}</span>
            )}
            <span className="ml-auto italic">Red badges = ≥1.4× chain median</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto px-4 md:px-8 py-5">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-8 py-2.5 pl-4 text-center text-xs font-medium text-muted-foreground">#</th>
                    <th className="py-2.5 pl-2 pr-4 text-left text-xs font-medium text-muted-foreground">Property</th>
                    <SortableTh label="Health"    field="health_score"       sortBy={sortBy} sortDir={sortDir} align="center" onSort={handleSort} />
                    <SortableTh label="Stock"     field="out_of_stock_count" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Avg Supply" field="avg_days_supply"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Waste"     field="waste_rate"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Restocks"  field="pending_restocks"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Supplier"  field="avg_supplier_score" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Activity"  field="stock_log_count"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <th className="py-2.5 px-4 pr-6 text-left text-xs font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, idx) => (
                    <PropertyRow
                      key={row.hotel_id}
                      row={row}
                      rank={idx + 1}
                      medians={medians}
                      currency={currency}
                      isCurrentHotel={row.hotel_id === activeHotel?.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Package className="h-3 w-3" />Health = stock (35%) + waste (30%) + supply (20%) + restocks (15%)</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />A ≥85 ·
                <span className="inline-flex h-2 w-2 rounded-full bg-lime-500 ml-1" />B ≥70 ·
                <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 ml-1" />C ≥50 ·
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500 ml-1" />D &lt;50
              </span>
              <span className="flex items-center gap-1"><Activity className="h-3 w-3" />Activity = stock log entries per day</span>
              <span className="flex items-center gap-1"><Truck className="h-3 w-3" />Supplier score only available after logging deliveries</span>
              <span className="flex items-center gap-1"><ChevronsUpDown className="h-3 w-3" />Click column headers to sort</span>
            </div>
          </div>

          {/* Procurement leverage opportunities */}
          <ProcurementOpportunitiesPanel currency={currency} />
        </>
      )}
    </div>
  )
}
