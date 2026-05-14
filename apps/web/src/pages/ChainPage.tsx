// Layer: Mind — Chain Overview (multi-hotel intelligence hub)
// Palantir principle: cross-domain synthesis. This page exists to answer
// "which property needs my attention right now, and why?" for regional
// directors and chain owners. Every metric includes the chain median as context.
// Sort order: worst health score first — the most at-risk property is always top.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import {
  Callout,
  Card,
  HTMLTable,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { scoreToGrade, GRADE_STYLES, GRADE_ICONS } from '@/lib/grades'
import { useCurrency } from '@/hooks/useCurrency'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useChainOverview, useChainHealthTrend } from '@/features/mind/hooks'
import { useSupplierLeverage } from '@/features/suppliers/hooks'
import type { ChainPropertyRow, ChainHealthTrendRow, SupplierLeverageRow } from '@beacon/types'

function ScorePill({ score }: { score: number }) {
  const grade = scoreToGrade(score)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold',
      GRADE_STYLES[grade],
    )}>
      <Icon icon={GRADE_ICONS[grade]} size={12} />
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
  const isHigh = ratio > 1
  const label  = `${ratio.toFixed(1)}× avg`

  return (
    <Tag
      icon={isHigh ? 'trending-up' : 'trending-down'}
      intent={isBad ? Intent.DANGER : Intent.SUCCESS}
      minimal
      className="ml-1.5"
    >
      {label}
    </Tag>
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
  label, value, sub, icon, accent = 'text-foreground',
}: {
  label: string; value: string; sub?: string; icon: IconName; accent?: string
}) {
  return (
    <Card compact>
      <div className="flex items-start gap-3">
        <Icon icon={icon} size={14} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('mt-0.5 text-lg font-semibold leading-none', accent)}>{value}</p>
          {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
// Pure SVG sparkline — 6 monthly values, coloured by trend direction.

function Sparkline({ values, color = 'currentColor' }: { values: number[]; color?: string }) {
  if (values.length < 2) return null
  const W = 56
  const H = 18
  const max = Math.max(...values, 1)
  const pts = values
    .map((v, i) => `${String((i / (values.length - 1)) * W)},${String(H - (v / max) * H)}`)
    .join(' ')
  return (
    <svg width={W} height={H} className="overflow-visible flex-shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Trend cell ───────────────────────────────────────────────────────────────

function TrendCell({ hotelId, trend }: { hotelId: string; trend: ChainHealthTrendRow[] }) {
  const rows = trend
    .filter(r => r.hotel_id === hotelId)
    .sort((a, b) => a.period_month.localeCompare(b.period_month))

  if (rows.length < 2) {
    return <span className="text-[10px] text-muted-foreground italic">no history</span>
  }

  const values = rows.map(r => r.waste_cost)
  const cur  = rows[rows.length - 1].waste_cost
  const prev = rows[rows.length - 2].waste_cost
  const momPct = prev > 0 ? ((cur - prev) / prev) * 100 : null

  const improving     = momPct != null && momPct < -5
  const deteriorating = momPct != null && momPct > 5

  const sparkColor = improving
    ? '#34d399'
    : deteriorating
    ? '#f87171'
    : '#94a3b8'

  return (
    <div className="flex items-center gap-2 justify-end">
      {momPct != null && (
        <span className={cn(
          'text-[10px] font-mono font-semibold',
          improving     ? 'text-emerald-400' :
          deteriorating ? 'text-red-400'     :
          'text-muted-foreground',
        )}>
          {momPct > 0 ? '+' : ''}{momPct.toFixed(0)}%
        </span>
      )}
      <Sparkline values={values} color={sparkColor} />
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
  trend: ChainHealthTrendRow[]
}

function PropertyRow({ row, rank, medians, currency, isCurrentHotel, trend }: RowProps) {
  const grade           = scoreToGrade(row.health_score)
  const wastePct        = Math.round(row.waste_rate * 100)
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
      'text-sm transition-colors',
      isCurrentHotel && 'bg-primary/5',
    )}>
      <td className="w-8 text-center text-[11px] font-mono text-muted-foreground">
        {rank}
      </td>

      <td>
        <div className="flex items-center gap-2">
          <Icon icon="office" size={14} className="flex-shrink-0 text-muted-foreground" />
          <span className="font-medium">{row.hotel_name}</span>
          {isCurrentHotel && (
            <Tag minimal intent={Intent.PRIMARY}>current</Tag>
          )}
        </div>
        <p className="ml-6 text-[11px] text-muted-foreground mt-0.5">
          {row.total_variants} variants · {row.stock_log_count} logs in period
        </p>
      </td>

      <td className="text-center">
        <ScorePill score={row.health_score} />
      </td>

      <td className="text-right">
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

      <td className="text-right">
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

      <td className="text-right">
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

      <td className="text-right">
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

      <td className="text-right">
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

      <td className="text-right">
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

      <td>
        <TrendCell hotelId={row.hotel_id} trend={trend} />
      </td>

      <td>
        {grade === 'D' && (
          <Tag intent={Intent.DANGER} minimal icon="warning-sign">Critical</Tag>
        )}
        {grade === 'C' && (
          <Tag intent={Intent.WARNING} minimal icon="warning-sign">Watch</Tag>
        )}
        {grade === 'B' && (
          <Tag intent={Intent.SUCCESS} minimal icon="dot">Good</Tag>
        )}
        {grade === 'A' && (
          <Tag intent={Intent.SUCCESS} minimal icon="endorsed">Healthy</Tag>
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
  const iconName: IconName = active ? (sortDir === 'asc' ? 'chevron-up' : 'chevron-down') : 'double-caret-vertical'
  return (
    <th
      className={cn(
        'cursor-pointer select-none text-xs font-medium text-muted-foreground hover:text-foreground transition-colors',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        align === 'left' && 'text-left',
        active && 'text-foreground',
      )}
      onClick={() => { onSort(field) }}
    >
      <span className="inline-flex items-center gap-1">
        {align === 'right' && <Icon icon={iconName} size={12} />}
        {label}
        {align !== 'right' && <Icon icon={iconName} size={12} />}
      </span>
    </th>
  )
}

// ─── Procurement leverage opportunities ───────────────────────────────────────

const ACTION_INTENT: Record<SupplierLeverageRow['recommended_action'], Intent> = {
  'Find Alternative':   Intent.DANGER,
  'Renegotiate':        Intent.WARNING,
  'Monitor':            Intent.PRIMARY,
  'Preferred Supplier': Intent.SUCCESS,
}

function ProcurementOpportunitiesPanel({ currency }: { currency: string }) {
  const { data: leverage = [], isLoading } = useSupplierLeverage(90)

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
      <Card compact className="!p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <Icon icon="flash" size={14} className="text-yellow-500" />
            <span className="text-sm font-semibold">Procurement Leverage Opportunities</span>
            <span className="text-[11px] text-muted-foreground ml-1">90-day window</span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            {formatCurrency(totalExposure, currency)} at-risk spend across {opportunities.length} supplier{opportunities.length !== 1 ? 's' : ''}
          </span>
        </div>
        <HTMLTable compact striped className="w-full">
          <thead>
            <tr>
              <th className="text-left">Supplier</th>
              <th className="text-center">Action</th>
              <th className="text-right">Leverage score</th>
              <th className="text-right">On-time rate</th>
              <th className="text-right">Price drift</th>
              <th className="text-right">90d spend</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((s) => (
              <tr key={s.supplier_id}>
                <td>
                  <span className="font-medium">{s.supplier_name}</span>
                  {s.pending_deliveries > 0 && (
                    <span className="ml-2 text-[10px] text-yellow-600 dark:text-yellow-400">
                      {s.pending_deliveries} pending
                    </span>
                  )}
                </td>
                <td className="text-center">
                  <Tag intent={ACTION_INTENT[s.recommended_action]} minimal round>
                    {s.recommended_action}
                  </Tag>
                </td>
                <td className="text-right">
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
                <td className="text-right">
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
                <td className="text-right">
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
                <td className="text-right font-medium tabular-nums">
                  {formatCurrency(s.total_spend, currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
        <div className="border-t bg-muted/20 px-4 py-2 text-[11px] text-muted-foreground">
          Leverage score = supplier dependency + price drift + reliability gaps. Higher = more negotiating room.
        </div>
      </Card>
    </div>
  )
}

// ─── Outlier synthesis panel ──────────────────────────────────────────────────

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

  const worst = rows.at(0)
  const best  = rows.at(-1)
  if (!worst || !best) return null

  const insights: string[] = []

  const wasteRatioPct = Math.round(worst.waste_rate * 100)
  if (medians.waste_rate > 0) {
    const wasteRatio = worst.waste_rate / medians.waste_rate
    if (wasteRatio >= 1.4) {
      insights.push(`${wasteRatio.toFixed(1)}× the chain median waste rate (${String(wasteRatioPct)}% vs ${String(Math.round(medians.waste_rate * 100))}% chain avg)`)
    }
  }

  const oosPct = worst.total_variants > 0
    ? (worst.out_of_stock_count / worst.total_variants) * 100
    : 0
  if (oosPct > 0 && medians.out_of_stock_pct > 0) {
    const oosRatio = oosPct / medians.out_of_stock_pct
    if (oosRatio >= 1.4) {
      insights.push(`OOS rate ${oosRatio.toFixed(1)}× chain median (${String(worst.out_of_stock_count)} variants out of stock)`)
    }
  } else if (oosPct > 5) {
    insights.push(`${String(worst.out_of_stock_count)} variants out of stock`)
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
      insights.push(`supplier score ${String(Math.round(worst.avg_supplier_score))} vs ${String(Math.round(medians.supplier_score))} chain median`)
    }
  }

  const healthGap = best.health_score - worst.health_score

  return (
    <div className="mx-4 md:mx-8 mt-4 flex-shrink-0 space-y-2">
      <Callout icon="locate" intent={Intent.WARNING} compact>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-sm font-semibold">{worst.hotel_name}</span>
              <span className="text-xs">is the chain outlier</span>
              <Tag minimal intent={Intent.WARNING}>
                score {worst.health_score} · {scoreToGrade(worst.health_score)}
              </Tag>
            </div>
            {insights.length > 0 ? (
              <p className="mt-1 text-xs">
                {insights.join(' · ')}
              </p>
            ) : (
              <p className="mt-1 text-xs">
                Health score {healthGap} points below chain best ({best.hotel_name}: {best.health_score}).
              </p>
            )}
            <p className="mt-1 text-[11px]">
              Waste cost this period: {formatCurrency(worst.waste_cost, currency)} ·
              {' '}{worst.pending_restocks} pending restocks ·
              {' '}activity {(worst.stock_log_count / 30).toFixed(1)} logs/day
            </p>
          </div>
          <div className="shrink-0 text-right hidden sm:block">
            <p className="text-[10px] opacity-70">Best performer</p>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400">{best.hotel_name}</p>
            <p className="text-[10px] opacity-70">score {best.health_score} · {scoreToGrade(best.health_score)}</p>
          </div>
        </div>
      </Callout>
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

  const { data: rows = [], isLoading }   = useChainOverview(days)
  const { data: trendData = [] }          = useChainHealthTrend(6)
  const activeHotel = useActiveHotel()
  const currency    = useCurrency()

  function handleSort(field: string) {
    const f = field as SortField
    if (f === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(f)
      const defaultDesc: SortField[] = ['out_of_stock_count', 'waste_rate', 'pending_restocks']
      setSortDir(defaultDesc.includes(f) ? 'desc' : 'asc')
    }
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      if (aVal == null) aVal = sortDir === 'asc' ? Infinity : -Infinity
      if (bVal == null) bVal = sortDir === 'asc' ? Infinity : -Infinity
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [rows, sortBy, sortDir])

  const medians = useMemo(() => {
    if (rows.length === 0) return {
      waste_rate: 0, avg_days_supply: 0, out_of_stock_pct: 0,
      pending_restock_pct: 0, supplier_score: 0,
    }
    return {
      waste_rate:          median(rows.map((r) => r.waste_rate)),
      avg_days_supply:     median(rows.map((r) => r.avg_days_supply)),
      out_of_stock_pct:    median(rows.map((r) =>
        r.total_variants > 0 ? (r.out_of_stock_count / r.total_variants) * 100 : 0
      )),
      pending_restock_pct: median(rows.map((r) =>
        r.total_variants > 0 ? (r.pending_restocks / r.total_variants) * 100 : 0
      )),
      supplier_score: median(
        rows.filter((r) => r.avg_supplier_score != null).map((r) => r.avg_supplier_score ?? 0)
      ),
    }
  }, [rows])

  const kpis = useMemo(() => {
    if (rows.length === 0) return null
    const atRisk         = rows.filter((r) => r.health_score < 60).length
    const totalWasteCost = rows.reduce((s, r) => s + r.waste_cost, 0)
    const totalPending   = rows.reduce((s, r) => s + r.pending_restocks, 0)
    const avgScore       = Math.round(rows.reduce((s, r) => s + r.health_score, 0) / rows.length)
    const worst          = rows[0]
    const best           = rows[rows.length - 1]
    return { atRisk, totalWasteCost, totalPending, avgScore, worst, best }
  }, [rows])

  const criticalRows = rows.filter((r) => scoreToGrade(r.health_score) === 'D')

  if (!isLoading && rows.length <= 1) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between border-b px-4 md:px-8 py-5">
          <div>
            <h1 className="text-xl font-semibold">Mind · Chain Overview</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Multi-property intelligence</p>
          </div>
        </div>
        <NonIdealState
          icon="office"
          title="Single property detected"
          description="Chain Overview becomes active when your account manages 2 or more hotels. Cross-property benchmarking, waste comparisons, and health rankings will appear here."
        />
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
        <SegmentedControl
          size="small"
          value={String(days)}
          onValueChange={(v) => { setDays(parseInt(v, 10) as 7 | 30 | 90) }}
          options={RANGE_OPTIONS.map((o) => ({ value: String(o.days), label: o.label }))}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} />Loading chain data…
        </div>
      ) : (
        <>
          {criticalRows.length > 0 && (
            <div className="mx-4 md:mx-8 mt-4 flex-shrink-0">
              <Callout intent={Intent.DANGER} icon="warning-sign" compact>
                <span className="font-semibold">
                  {criticalRows.length} propert{criticalRows.length > 1 ? 'ies' : 'y'} in critical state (score &lt;50):
                </span>
                {' '}
                {criticalRows.map((r) => r.hotel_name).join(', ')}
                {' '}— immediate attention required.
              </Callout>
            </div>
          )}

          {rows.length >= 2 && (
            <OutlierPanel rows={rows} medians={medians} currency={currency} />
          )}

          {kpis && (
            <div className="grid grid-cols-2 gap-3 px-4 md:px-8 py-4 border-b sm:grid-cols-4 flex-shrink-0">
              <KpiTile
                label="Chain avg health"
                value={`${String(kpis.avgScore)} · ${scoreToGrade(kpis.avgScore)}`}
                sub={`${String(rows.length)} properties · ${String(days)}d window`}
                icon="horizontal-bar-chart"
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
                icon="shield"
                accent={kpis.atRisk > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
              />
              <KpiTile
                label={`Chain waste cost (${String(days)}d)`}
                value={formatCurrency(kpis.totalWasteCost, currency)}
                sub={`${String(Math.round(medians.waste_rate * 100))}% chain median waste rate`}
                icon="trending-down"
                accent={kpis.totalWasteCost > 0 ? 'text-red-600 dark:text-red-400' : ''}
              />
              <KpiTile
                label="Chain pending restocks"
                value={String(kpis.totalPending)}
                sub={`across all ${String(rows.length)} properties`}
                icon="refresh"
                accent={kpis.totalPending > 20 ? 'text-yellow-600 dark:text-yellow-400' : ''}
              />
            </div>
          )}

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

          <div className="flex-1 overflow-auto px-4 md:px-8 py-5">
            <Card compact className="!p-0 overflow-hidden">
              <HTMLTable compact striped interactive className="w-full">
                <thead>
                  <tr>
                    <th className="w-8 text-center">#</th>
                    <th className="text-left">Property</th>
                    <SortableTh label="Health"    field="health_score"       sortBy={sortBy} sortDir={sortDir} align="center" onSort={handleSort} />
                    <SortableTh label="Stock"     field="out_of_stock_count" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Avg Supply" field="avg_days_supply"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Waste"     field="waste_rate"         sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Restocks"  field="pending_restocks"   sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Supplier"  field="avg_supplier_score" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Activity"  field="stock_log_count"    sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                    <th className="text-right">Waste trend</th>
                    <th className="text-left">Status</th>
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
                      trend={trendData}
                    />
                  ))}
                </tbody>
              </HTMLTable>
            </Card>

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Icon icon="box" size={12} />Health = stock (35%) + waste (30%) + supply (20%) + restocks (15%)</span>
              <span className="flex items-center gap-1.5">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500" />A ≥85 ·
                <span className="inline-flex h-2 w-2 rounded-full bg-lime-500 ml-1" />B ≥70 ·
                <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 ml-1" />C ≥50 ·
                <span className="inline-flex h-2 w-2 rounded-full bg-red-500 ml-1" />D &lt;50
              </span>
              <span className="flex items-center gap-1"><Icon icon="pulse" size={12} />Activity = stock log entries per day</span>
              <span className="flex items-center gap-1"><Icon icon="truck" size={12} />Supplier score only available after logging deliveries</span>
              <span className="flex items-center gap-1"><Icon icon="trending-down" size={12} className="text-emerald-400" />Waste trend = 6-month sparkline · green = improving · red = deteriorating · % = MoM change</span>
              <span className="flex items-center gap-1"><Icon icon="double-caret-vertical" size={12} />Click column headers to sort</span>
            </div>
          </div>

          <ProcurementOpportunitiesPanel currency={currency} />
        </>
      )}
    </div>
  )
}
