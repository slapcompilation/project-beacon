// Layer: Mind — Financial Intelligence
// Palantir principle #6: cross-domain synthesis.
// procurement spend + write-offs + occupancy → CPOR (Cost Per Occupied Room)
// This is the owner/GM's crown-jewel KPI: what does running this hotel cost per room per night?

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Loader2, AlertTriangle, DollarSign, Hotel, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useCPORByPeriod, useCostByCategory } from '@/features/mind/hooks'
import type { CPORPeriodRow, CostByCategoryRow } from '@beacon/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trendIcon(changePct: number | null) {
  if (changePct === null) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  if (changePct > 0) return <TrendingUp className="h-3.5 w-3.5 text-red-500" />
  if (changePct < 0) return <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
}

function trendColor(changePct: number | null): string {
  if (changePct === null) return 'text-muted-foreground'
  if (changePct > 5) return 'text-red-600 dark:text-red-400'
  if (changePct > 0) return 'text-amber-600 dark:text-amber-400'
  if (changePct < 0) return 'text-emerald-600 dark:text-emerald-400'
  return 'text-muted-foreground'
}

function fmt(n: number | null, currency: string): string {
  if (n === null) return '—'
  return formatCurrency(n, currency)
}

function fmtPct(n: number | null): string {
  if (n === null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function CPORKPIStrip({
  rows,
  currency,
}: {
  rows: CPORPeriodRow[]
  currency: string
}) {
  // Use most recent period with data
  const latest = [...rows].reverse().find((r) => r.cpor !== null)
  const prev   = latest ? [...rows].reverse().find((r) => r.cpor !== null && r.period_start !== latest.period_start) : null

  const totalSpend    = rows.reduce((s, r) => s + r.total_cost, 0)
  const totalProcure  = rows.reduce((s, r) => s + r.procurement_spend, 0)
  const totalWriteOff = rows.reduce((s, r) => s + r.write_off_cost, 0)
  const avgOccupancy  = rows.filter((r) => r.avg_occupancy_pct !== null)
  const meanOcc       = avgOccupancy.length > 0
    ? avgOccupancy.reduce((s, r) => s + (r.avg_occupancy_pct ?? 0), 0) / avgOccupancy.length
    : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
      {/* CPOR */}
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current CPOR</p>
        {latest ? (
          <>
            <p className="text-2xl font-bold tabular-nums">{fmt(latest.cpor, currency)}</p>
            <div className="flex items-center gap-1 text-xs">
              {trendIcon(latest.cpor_change_pct)}
              <span className={trendColor(latest.cpor_change_pct)}>
                {fmtPct(latest.cpor_change_pct)} MoM
              </span>
              <span className="text-muted-foreground">· {latest.period_label}</span>
            </div>
            {prev && (
              <p className="text-[10px] text-muted-foreground tabular-nums">
                Prior: {fmt(prev.cpor, currency)} ({prev.period_label})
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No occupancy data</p>
        )}
      </div>

      {/* Total spend */}
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Cost (window)</p>
        <p className="text-2xl font-bold tabular-nums">{fmt(totalSpend, currency)}</p>
        <div className="text-[10px] text-muted-foreground space-y-0.5 tabular-nums">
          <p><span className="text-foreground">{fmt(totalProcure, currency)}</span> procurement</p>
          <p><span className="text-red-500">{fmt(totalWriteOff, currency)}</span> write-offs</p>
        </div>
      </div>

      {/* Write-off share */}
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Waste Share</p>
        {totalSpend > 0 ? (
          <>
            <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {((totalWriteOff / totalSpend) * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground tabular-nums">
              {fmt(totalWriteOff, currency)} of {fmt(totalSpend, currency)}
            </p>
            <p className="text-[10px] text-muted-foreground">Breakage + Theft + Spoilage</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No cost data</p>
        )}
      </div>

      {/* Avg occupancy */}
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Avg Occupancy</p>
        {meanOcc !== null ? (
          <>
            <p className="text-2xl font-bold tabular-nums">
              {meanOcc.toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">{rows.length}-month window average</p>
          </>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            No occupancy logs
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CPOR Period Table ────────────────────────────────────────────────────────

function CPORPeriodTable({ rows, currency }: { rows: CPORPeriodRow[]; currency: string }) {
  const sorted = [...rows].sort((a, b) => b.period_start.localeCompare(a.period_start))

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
        <Hotel className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Monthly CPOR Trend
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/10">
              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Period</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Procurement</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Write-offs</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Total Cost</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Occ. Rooms</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Avg Occ%</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">CPOR</th>
              <th className="text-right px-4 py-2 font-medium text-muted-foreground">MoM Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((row) => {
              const wasteShare = row.total_cost > 0
                ? (row.write_off_cost / row.total_cost) * 100
                : 0
              return (
                <tr key={row.period_start} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{row.period_label}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {fmt(row.procurement_spend, currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    <span className={wasteShare > 5 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground'}>
                      {fmt(row.write_off_cost, currency)}
                    </span>
                    {wasteShare > 0 && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({wasteShare.toFixed(1)}%)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                    {fmt(row.total_cost, currency)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {row.occupied_room_nights?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                    {row.avg_occupancy_pct !== null ? `${row.avg_occupancy_pct.toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold">
                    {row.cpor !== null ? fmt(row.cpor, currency) : <span className="text-muted-foreground font-normal">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {row.cpor_change_pct !== null ? (
                      <span className={cn('flex items-center justify-end gap-0.5 tabular-nums', trendColor(row.cpor_change_pct))}>
                        {trendIcon(row.cpor_change_pct)}
                        {fmtPct(row.cpor_change_pct)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t bg-muted/10">
        <p className="text-[10px] text-muted-foreground">
          CPOR = (procurement spend + write-off cost) / occupied room nights · — = no occupancy data logged
        </p>
      </div>
    </div>
  )
}

// ─── Category Breakdown ───────────────────────────────────────────────────────

function CategoryBreakdown({ rows, currency }: { rows: CostByCategoryRow[]; currency: string }) {
  const maxCost = rows[0]?.total_cost ?? 1

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
        <PieChart className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Cost by Category · {rows.length} categories
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-xs text-muted-foreground">No category spend data in window.</div>
      ) : (
        <div className="divide-y">
          {rows.map((cat) => {
            const barWidth = (cat.total_cost / maxCost) * 100
            const wasteHigh = (cat.waste_rate_pct ?? 0) > 10

            return (
              <div key={cat.category_id ?? 'uncategorised'} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold truncate">{cat.category_name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {cat.cost_pct_of_total.toFixed(1)}% of total
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                    <span className="text-muted-foreground">{fmt(cat.procurement_spend, currency)}</span>
                    {cat.write_off_cost > 0 && (
                      <span className={wasteHigh ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-muted-foreground'}>
                        +{fmt(cat.write_off_cost, currency)} waste
                        {cat.waste_rate_pct !== null && (
                          <span className="ml-1 text-[10px]">({cat.waste_rate_pct.toFixed(1)}%)</span>
                        )}
                      </span>
                    )}
                    <span className="font-bold">{fmt(cat.total_cost, currency)}</span>
                  </div>
                </div>

                {/* Bar */}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {wasteHigh && (
                  <p className="text-[10px] text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    High waste rate — investigate Breakage/Theft/Spoilage for {cat.category_name}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div className="px-4 py-2 border-t bg-muted/10">
        <p className="text-[10px] text-muted-foreground">
          Sorted by total cost · waste rate = write-offs / (procurement + write-offs)
        </p>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function NoOccupancyBanner() {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 px-4 py-4 flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Occupancy data not found</p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
          CPOR requires daily occupancy logs. To enable CPOR tracking, log occupancy data from the
          Hotel Settings page. Cost breakdowns are still accurate — only the per-room normalisation is unavailable.
        </p>
      </div>
    </div>
  )
}

// ─── Window selector ──────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '3 mo',  months: 3,  days: 90  },
  { label: '6 mo',  months: 6,  days: 180 },
  { label: '12 mo', months: 12, days: 365 },
] as const

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CPORDashboard() {
  const currency = useCurrency()
  const [windowIdx, setWindowIdx] = useState(0)
  const selected = PERIOD_OPTIONS[windowIdx]

  const { data: periodRows = [], isLoading: periodsLoading } = useCPORByPeriod(selected.months)
  const { data: catRows   = [], isLoading: catsLoading    } = useCostByCategory(selected.days)

  const isLoading = periodsLoading || catsLoading
  const hasOccupancy = periodRows.some((r) => r.occupied_room_nights !== null && r.occupied_room_nights > 0)

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Cost Per Occupied Room (CPOR)</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Hotel economics KPI — procurement + waste cost normalised by occupied room nights
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5 shrink-0">
          {PERIOD_OPTIONS.map((opt, i) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => { setWindowIdx(i) }}
              className={cn(
                'px-3 py-1 text-xs rounded transition-colors',
                windowIdx === i
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {!hasOccupancy && <NoOccupancyBanner />}

          <CPORKPIStrip rows={periodRows} currency={currency} />

          <div className="grid gap-5 xl:grid-cols-2">
            <CPORPeriodTable rows={periodRows} currency={currency} />
            <CategoryBreakdown rows={catRows} currency={currency} />
          </div>
        </>
      )}
    </div>
  )
}
