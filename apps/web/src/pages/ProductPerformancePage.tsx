// Layer: Eye — Cross-domain synthesis
// Palantir principle: intelligence everywhere — every number carries context.
// This page synthesises waste rate + stockout exposure + PAR compliance into a
// single performance scorecard per variant, ranked by operational burden.
// Answers: "which products are causing the most pain right now?"

import { useState } from 'react'
import {
  Loader2, Package, BarChart3, Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useProductPerformance } from '@/features/eye/hooks'
import type { ProductPerformanceRow } from '@beacon/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_META = {
  critical:       { label: 'Critical',        badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',         bar: 'bg-red-500',     dot: 'bg-red-500'     },
  waste_heavy:    { label: 'Waste Heavy',      badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400', bar: 'bg-orange-500',  dot: 'bg-orange-500'  },
  stockout_prone: { label: 'Stockout Prone',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', bar: 'bg-amber-500',   dot: 'bg-amber-500'   },
  at_risk:        { label: 'At Risk',          badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400', bar: 'bg-yellow-500', dot: 'bg-yellow-500' },
  idle:           { label: 'Idle',             badge: 'bg-muted text-muted-foreground',                                        bar: 'bg-muted',       dot: 'bg-muted-foreground' },
  efficient:      { label: 'Efficient',        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400', bar: 'bg-emerald-500', dot: 'bg-emerald-500' },
} as const

type Tier = keyof typeof TIER_META

const TIER_ORDER: Tier[] = ['critical', 'waste_heavy', 'stockout_prone', 'at_risk', 'idle', 'efficient']

const WINDOW_OPTIONS = [
  { label: '7d',  days: 7  },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
] as const

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ rows, currency }: { rows: ProductPerformanceRow[]; currency: string }) {
  const critical   = rows.filter((r) => r.performance_tier === 'critical').length
  const wasteCost  = rows.reduce((s, r) => s + r.waste_cost, 0)
  const efficient  = rows.filter((r) => r.performance_tier === 'efficient').length
  const stockouts  = rows.filter((r) => r.stockout_days > 0).length

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Products Tracked</p>
        <p className="text-2xl font-bold tabular-nums">{rows.length}</p>
        <p className="text-[10px] text-muted-foreground">{efficient} efficient · {critical} critical</p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Waste Cost</p>
        <p className={cn('text-2xl font-bold tabular-nums', wasteCost > 0 ? 'text-red-600 dark:text-red-400' : '')}>
          {formatCurrency(wasteCost, currency)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {rows.reduce((s, r) => s + r.waste_units, 0)} units written off
        </p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stockout Events</p>
        <p className={cn('text-2xl font-bold tabular-nums', stockouts > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
          {stockouts}
        </p>
        <p className="text-[10px] text-muted-foreground">product{stockouts !== 1 ? 's' : ''} hit zero stock</p>
      </div>
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Avg PAR Compliance</p>
        {rows.length > 0 ? (
          <>
            <p className="text-2xl font-bold tabular-nums">
              {(rows.reduce((s, r) => s + r.par_compliance_pct, 0) / rows.length).toFixed(1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">across all active variants</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">—</p>
        )}
      </div>
    </div>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ score, tier }: { score: number; tier: Tier }) {
  const meta = TIER_META[tier]
  return (
    <div className="flex items-center gap-2 min-w-28">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full', meta.bar)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">{score.toFixed(0)}</span>
    </div>
  )
}

// ─── Product row ──────────────────────────────────────────────────────────────

function ProductRow({ row, currency }: { row: ProductPerformanceRow; currency: string }) {
  const [open, setOpen] = useState(false)
  const meta = TIER_META[row.performance_tier]
  const label = row.variant_name !== 'Standard' ? `${row.product_name} — ${row.variant_name}` : row.product_name

  // Recommended action text
  const recommendation = (() => {
    if (row.performance_tier === 'critical')
      return `High waste (${row.waste_rate_pct?.toFixed(1)}%) AND stockout exposure (${row.stockout_days}d) — review sourcing, storage, and team logging immediately.`
    if (row.performance_tier === 'waste_heavy')
      return `${row.waste_rate_pct?.toFixed(1)}% waste rate — investigate breakage/spoilage root cause. Check FEFO rotation and storage conditions.`
    if (row.performance_tier === 'stockout_prone')
      return `Stockout on ${row.stockout_days} day${row.stockout_days !== 1 ? 's' : ''} — increase PAR level or shorten reorder cycle.`
    if (row.performance_tier === 'at_risk')
      return `Below PAR for ${row.below_par_days} of ${row.par_compliance_pct < 90 ? 'many' : 'some'} days — consider raising PAR level or improving delivery frequency.`
    if (row.performance_tier === 'idle')
      return 'No consumption or waste logged in window — verify stock is still required or flag for removal from active inventory.'
    return 'Operating within thresholds. No action required.'
  })()

  return (
    <>
      <tr
        className={cn(
          'hover:bg-muted/20 transition-colors cursor-pointer',
          (row.performance_tier === 'critical' || row.performance_tier === 'waste_heavy') && 'bg-red-50/30 dark:bg-red-950/5',
        )}
        onClick={() => { setOpen((v) => !v) }}
      >
        {/* Tier badge */}
        <td className="px-4 py-2.5 w-28">
          <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', meta.badge)}>
            {meta.label}
          </span>
        </td>
        {/* Product */}
        <td className="px-4 py-2.5">
          <p className="text-xs font-medium">{label}</p>
          {row.category_name && (
            <p className="text-[10px] text-muted-foreground">{row.category_name}</p>
          )}
        </td>
        {/* Waste rate */}
        <td className="px-4 py-2.5 text-right">
          {row.waste_rate_pct !== null ? (
            <span className={cn('text-xs tabular-nums font-medium', row.waste_rate_pct > 15 ? 'text-red-600 dark:text-red-400' : row.waste_rate_pct > 8 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
              {row.waste_rate_pct.toFixed(1)}%
            </span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        {/* Waste cost */}
        <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
          {row.waste_cost > 0 ? formatCurrency(row.waste_cost, currency) : '—'}
        </td>
        {/* Stockout days */}
        <td className="px-4 py-2.5 text-right">
          {row.stockout_days > 0 ? (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold tabular-nums">{row.stockout_days}d</span>
          ) : <span className="text-xs text-muted-foreground">—</span>}
        </td>
        {/* PAR compliance */}
        <td className="px-4 py-2.5 text-right">
          <span className={cn('text-xs tabular-nums', row.par_compliance_pct < 80 ? 'text-red-600 dark:text-red-400 font-semibold' : row.par_compliance_pct < 95 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
            {row.par_compliance_pct.toFixed(0)}%
          </span>
        </td>
        {/* Score bar */}
        <td className="px-4 py-2.5">
          <ScoreBar score={row.performance_score} tier={row.performance_tier} />
        </td>
      </tr>

      {/* Expanded detail */}
      {open && (
        <tr className="bg-muted/10">
          <td colSpan={7} className="px-8 py-4">
            <div className="grid grid-cols-3 gap-6 text-xs">
              {/* Consumption */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Consumption</p>
                <div className="space-y-0.5 text-muted-foreground">
                  <p>Units consumed: <span className="text-foreground font-medium tabular-nums">{row.consumption_units.toLocaleString()}</span></p>
                  <p>Consumption value: <span className="text-foreground font-medium tabular-nums">{formatCurrency(row.consumption_value, currency)}</span></p>
                  <p>Current stock: <span className="text-foreground font-medium tabular-nums">{row.current_stock}</span> {row.current_stock <= row.par_level && <span className="text-amber-600 dark:text-amber-400">(at/below PAR {row.par_level})</span>}</p>
                </div>
              </div>

              {/* Waste breakdown */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Waste</p>
                <div className="space-y-0.5 text-muted-foreground">
                  <p>Units written off: <span className={cn('font-medium tabular-nums', row.waste_units > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{row.waste_units}</span></p>
                  <p>Waste cost: <span className={cn('font-medium tabular-nums', row.waste_cost > 0 ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>{formatCurrency(row.waste_cost, currency)}</span></p>
                  {row.waste_rate_pct !== null && (
                    <p>Waste rate: <span className={cn('font-semibold tabular-nums', row.waste_rate_pct > 15 ? 'text-red-600 dark:text-red-400' : row.waste_rate_pct > 8 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                      {row.waste_rate_pct.toFixed(1)}% of total throughput
                    </span></p>
                  )}
                </div>
              </div>

              {/* Availability + recommendation */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Availability</p>
                <div className="space-y-0.5 text-muted-foreground">
                  <p>Stockout days: <span className={cn('font-medium tabular-nums', row.stockout_days > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{row.stockout_days}</span></p>
                  <p>Below-PAR days: <span className={cn('font-medium tabular-nums', row.below_par_days > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>{row.below_par_days}</span></p>
                  <p>PAR compliance: <span className={cn('font-semibold tabular-nums', row.par_compliance_pct < 80 ? 'text-red-600 dark:text-red-400' : row.par_compliance_pct < 95 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>{row.par_compliance_pct.toFixed(1)}%</span></p>
                </div>
                <div className={cn('mt-2 p-2 rounded text-[10px]', row.performance_tier === 'efficient' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-400')}>
                  {recommendation}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductPerformancePage() {
  const currency = useCurrency()
  const [windowDays, setWindowDays] = useState(30)
  const [search, setSearch]         = useState('')
  const [tierFilter, setTierFilter] = useState<Tier | 'all'>('all')

  const { data: rows = [], isLoading } = useProductPerformance(windowDays)

  const tierCounts = TIER_ORDER.reduce<Record<string, number>>((acc, t) => {
    acc[t] = rows.filter((r) => r.performance_tier === t).length
    return acc
  }, {})

  const filtered = rows.filter((r) => {
    if (tierFilter !== 'all' && r.performance_tier !== tierFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.product_name.toLowerCase().includes(q) ||
             r.variant_name.toLowerCase().includes(q) ||
             r.sku.toLowerCase().includes(q) ||
             (r.category_name ?? '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap shrink-0">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Product Performance Scorecard</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Waste rate · stockout exposure · PAR compliance · composite score — ranked by operational burden
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5 shrink-0">
          {WINDOW_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => { setWindowDays(opt.days) }}
              className={cn(
                'px-3 py-1 text-xs rounded transition-colors',
                windowDays === opt.days
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
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Package className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No product activity in the last {windowDays} days.</p>
        </div>
      ) : (
        <>
          <SummaryStrip rows={rows} currency={currency} />

          {/* Tier filter + search */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1 rounded-md border p-0.5 bg-background">
              <button
                type="button"
                onClick={() => { setTierFilter('all') }}
                className={cn('px-2.5 py-1 text-[10px] rounded', tierFilter === 'all' ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}
              >
                All ({rows.length})
              </button>
              {TIER_ORDER.filter((t) => (tierCounts[t] ?? 0) > 0).map((t) => {
                const meta = TIER_META[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTierFilter(t) }}
                    className={cn(
                      'flex items-center gap-1 px-2.5 py-1 text-[10px] rounded transition-colors',
                      tierFilter === t ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                    {meta.label} ({tierCounts[t]})
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-40 border rounded px-2.5 py-1">
              <Search className="h-3 w-3 text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value) }}
                placeholder="Search by product, SKU, or category…"
                className="text-xs bg-transparent border-0 outline-none flex-1 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/10">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground w-28">Tier</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Product</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Waste %</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Waste Cost</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">Stockouts</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground">PAR Comply</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-xs text-muted-foreground">
                        No products match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <ProductRow key={row.variant_id} row={row} currency={currency} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t bg-muted/10">
              <p className="text-[10px] text-muted-foreground">
                Click a row to expand the full breakdown and recommended action ·
                Score = 0–100 composite (waste 40% + stockouts 35% + below-PAR 15% + idle 10%) · based on {windowDays}-day window
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
