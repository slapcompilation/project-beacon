// Layer: Mind × Eye — Category Intelligence Dashboard (Sprint 16)
// The missing mid-level view: between per-variant detail (ProductPerformancePage)
// and hotel-wide summaries (BriefingPage).
//
// Aggregates ProductPerformance + BudgetVsActual data client-side by category_name.
// No new migrations required — pure synthesis of existing RPCs.
//
// Palantir Principles:
//   #3  Intelligence everywhere — each category row carries waste %, budget %, health score
//   #4  Decision support     — worst categories float to top; action chips inline
//   #6  Cross-domain synthesis — performance + financial + waste in one view

import { useState, useMemo } from 'react'
import { format, startOfMonth } from 'date-fns'
import {
  ChevronDown, ChevronRight, AlertTriangle,
  Package, DollarSign, Activity, Layers, BarChart3,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useProductPerformance } from '@/features/eye/hooks'
import { useBudgetVsActual } from '@/features/mind/hooks'
import type { ProductPerformanceRow, BudgetVsActualRow } from '@beacon/types'

// ─── Aggregated category row ──────────────────────────────────────────────────

interface CategoryAgg {
  name:                string
  variant_count:       number
  // Performance
  avg_score:           number      // 0–100; higher = more attention needed
  critical_count:      number
  waste_heavy_count:   number
  efficient_count:     number
  // Waste
  total_waste_cost:    number
  total_waste_units:   number
  waste_rate_pct:      number | null
  // Availability
  stockout_variants:   number
  avg_par_compliance:  number
  total_stockout_days: number
  // Consumption
  total_consumption_value: number
  // Budget (joined from BudgetVsActual)
  budget_status:       BudgetVsActualRow['status'] | null
  allocated:           number | null
  actual_spend:        number | null
  spend_pct:           number | null
  // Variants list for drill-down
  variants:            ProductPerformanceRow[]
}

function buildCategoryAggs(
  rows: ProductPerformanceRow[],
  budgetRows: BudgetVsActualRow[],
): CategoryAgg[] {
  // Group by category_name (null → "Uncategorised")
  const map = new Map<string, ProductPerformanceRow[]>()
  for (const r of rows) {
    const key = r.category_name ?? 'Uncategorised'
    map.set(key, [...(map.get(key) ?? []), r])
  }

  return [...map.entries()].map(([name, variants]) => {
    const totalConsumption    = variants.reduce((s, r) => s + r.consumption_value, 0)
    const totalWasteCost      = variants.reduce((s, r) => s + r.waste_cost, 0)
    const totalWasteUnits     = variants.reduce((s, r) => s + r.waste_units, 0)
    const totalStockoutDays   = variants.reduce((s, r) => s + r.stockout_days, 0)
    const avgScore            = variants.reduce((s, r) => s + r.performance_score, 0) / variants.length
    const avgPar              = variants.reduce((s, r) => s + r.par_compliance_pct, 0) / variants.length

    const budget = budgetRows.find(b => b.category_name === name) ?? null

    return {
      name,
      variant_count:           variants.length,
      avg_score:               Math.round(avgScore),
      critical_count:          variants.filter(r => r.performance_tier === 'critical').length,
      waste_heavy_count:       variants.filter(r => r.performance_tier === 'waste_heavy').length,
      efficient_count:         variants.filter(r => r.performance_tier === 'efficient').length,
      total_waste_cost:        totalWasteCost,
      total_waste_units:       totalWasteUnits,
      waste_rate_pct:          totalConsumption > 0 ? (totalWasteCost / totalConsumption) * 100 : null,
      stockout_variants:       variants.filter(r => r.stockout_days > 0).length,
      avg_par_compliance:      Math.round(avgPar),
      total_stockout_days:     totalStockoutDays,
      total_consumption_value: totalConsumption,
      budget_status:           budget?.status ?? null,
      allocated:               budget?.allocated_amount ?? null,
      actual_spend:            budget?.actual_spend ?? null,
      spend_pct:               budget?.spend_pct ?? null,
      variants:                [...variants].sort((a, b) => b.performance_score - a.performance_score),
    } satisfies CategoryAgg
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TIER_DOT: Record<ProductPerformanceRow['performance_tier'], string> = {
  critical:      'bg-red-500',
  waste_heavy:   'bg-orange-500',
  stockout_prone:'bg-amber-500',
  at_risk:       'bg-yellow-500',
  idle:          'bg-slate-400',
  efficient:     'bg-emerald-500',
}

const BUDGET_BADGE: Record<BudgetVsActualRow['status'], { cls: string; label: string }> = {
  over:       { cls: 'bg-red-500/15 text-red-400 border-red-500/30',     label: 'Over'     },
  warning:    { cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30', label: 'Warning'  },
  on_track:   { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: 'On track' },
  unbudgeted: { cls: 'bg-muted/30 text-muted-foreground border-transparent', label: 'No budget' },
}

function healthColor(score: number): string {
  if (score >= 60) return 'text-red-400'
  if (score >= 35) return 'text-amber-400'
  return 'text-emerald-400'
}

function healthBarColor(score: number): string {
  if (score >= 60) return 'bg-red-500'
  if (score >= 35) return 'bg-amber-500'
  return 'bg-emerald-500'
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ aggs, currency }: { aggs: CategoryAgg[]; currency: string }) {
  const overBudget = aggs.filter(a => a.budget_status === 'over').length
  const highWaste  = aggs.filter(a => (a.waste_rate_pct ?? 0) > 15)
  const worstWaste = highWaste.sort((a, b) => (b.waste_rate_pct ?? 0) - (a.waste_rate_pct ?? 0))[0]
  const totalWasteCost = aggs.reduce((s, a) => s + a.total_waste_cost, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {[
        {
          label: 'Categories Tracked',
          value: aggs.length.toString(),
          sub: `${aggs.filter(a => a.efficient_count === a.variant_count).length} all-efficient`,
          highlight: false,
        },
        {
          label: 'Over Budget',
          value: overBudget.toString(),
          sub: `${aggs.filter(a => a.budget_status === 'on_track').length} on track`,
          highlight: overBudget > 0,
        },
        {
          label: 'Total Waste Cost',
          value: formatCurrency(totalWasteCost, currency),
          sub: `${aggs.filter(a => (a.waste_rate_pct ?? 0) > 15).length} high-waste categories`,
          highlight: totalWasteCost > 0,
        },
        {
          label: 'Worst Waste Rate',
          value: worstWaste ? `${worstWaste.waste_rate_pct?.toFixed(1) ?? '—'}%` : '—',
          sub: worstWaste?.name ?? 'None flagged',
          highlight: !!worstWaste,
        },
      ].map(({ label, value, sub, highlight }) => (
        <div key={label} className={cn('p-3 rounded-lg border bg-card', highlight ? 'border-red-500/30 bg-red-500/5' : 'border-border')}>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={cn('text-xl font-mono font-bold', highlight ? 'text-red-400' : 'text-foreground')}>{value}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Variant sub-row ──────────────────────────────────────────────────────────

function VariantSubRow({ v }: { v: ProductPerformanceRow }) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/10 text-xs border-b border-border/40 last:border-0">
      <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', TIER_DOT[v.performance_tier])} />
      <div className="flex-1 min-w-0 truncate">
        <span className="font-medium">{v.product_name}</span>
        {v.variant_name !== 'Standard' && <span className="text-muted-foreground"> · {v.variant_name}</span>}
      </div>
      <div className="shrink-0 tabular-nums text-muted-foreground">
        Score: <span className={cn('font-semibold', healthColor(v.performance_score))}>{v.performance_score}</span>
      </div>
      <div className="shrink-0 tabular-nums text-muted-foreground hidden sm:block">
        Waste: <span className={v.waste_rate_pct != null && v.waste_rate_pct > 15 ? 'text-rose-400 font-medium' : ''}>
          {v.waste_rate_pct != null ? `${v.waste_rate_pct.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="shrink-0 tabular-nums text-muted-foreground hidden sm:block">
        PAR: <span>{v.par_compliance_pct.toFixed(0)}%</span>
      </div>
      {v.stockout_days > 0 && (
        <span className="shrink-0 text-red-400 font-medium">{v.stockout_days}d out</span>
      )}
    </div>
  )
}

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({ agg, currency }: { agg: CategoryAgg; currency: string }) {
  const [expanded, setExpanded] = useState(false)
  const budget = agg.budget_status ? BUDGET_BADGE[agg.budget_status] : null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-muted-foreground shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </span>

        {/* Name + count */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-sm">{agg.name}</span>
            <span className="text-xs text-muted-foreground">{agg.variant_count} variant{agg.variant_count !== 1 ? 's' : ''}</span>
            {budget && (
              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium border', budget.cls)}>
                {budget.label}
              </span>
            )}
          </div>
          {/* Tier dots */}
          <div className="flex items-center gap-1.5">
            {agg.critical_count > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-red-400">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />{agg.critical_count} critical
              </span>
            )}
            {agg.waste_heavy_count > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-orange-400">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{agg.waste_heavy_count} waste-heavy
              </span>
            )}
            {agg.efficient_count > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{agg.efficient_count} efficient
              </span>
            )}
          </div>
        </div>

        {/* Health score */}
        <div className="shrink-0 text-right w-16">
          <div className="text-xs text-muted-foreground mb-0.5">Health</div>
          <div className={cn('text-lg font-mono font-bold', healthColor(agg.avg_score))}>{agg.avg_score}</div>
          <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden mt-1">
            <div
              className={cn('h-full rounded-full', healthBarColor(agg.avg_score))}
              style={{ width: `${agg.avg_score}%` }}
            />
          </div>
        </div>

        {/* Waste */}
        <div className="shrink-0 text-right w-24 hidden sm:block">
          <div className="text-xs text-muted-foreground">Waste</div>
          <div className={cn('text-sm font-mono font-semibold', agg.waste_rate_pct != null && agg.waste_rate_pct > 15 ? 'text-rose-400' : 'text-foreground')}>
            {agg.waste_rate_pct != null ? `${agg.waste_rate_pct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[10px] text-muted-foreground">{formatCurrency(agg.total_waste_cost, currency)}</div>
        </div>

        {/* Budget spend % */}
        <div className="shrink-0 text-right w-24 hidden md:block">
          <div className="text-xs text-muted-foreground">Budget</div>
          {agg.spend_pct != null ? (
            <>
              <div className={cn('text-sm font-mono font-semibold', agg.budget_status === 'over' ? 'text-red-400' : agg.budget_status === 'warning' ? 'text-amber-400' : 'text-foreground')}>
                {agg.spend_pct.toFixed(0)}%
              </div>
              <div className="h-1 w-full bg-muted/40 rounded-full overflow-hidden mt-1">
                <div
                  className={cn('h-full rounded-full', agg.budget_status === 'over' ? 'bg-red-500' : agg.budget_status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500')}
                  style={{ width: `${Math.min(agg.spend_pct, 100)}%` }}
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">—</div>
          )}
        </div>

        {/* PAR compliance */}
        <div className="shrink-0 text-right w-20 hidden lg:block">
          <div className="text-xs text-muted-foreground">PAR</div>
          <div className={cn('text-sm font-mono font-semibold', agg.avg_par_compliance < 70 ? 'text-amber-400' : 'text-foreground')}>
            {agg.avg_par_compliance}%
          </div>
          {agg.stockout_variants > 0 && (
            <div className="text-[10px] text-red-400">{agg.stockout_variants} in stockout</div>
          )}
        </div>
      </button>

      {/* Drill-down */}
      {expanded && (
        <div className="border-t border-border bg-muted/5">
          {/* Category metrics detail */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-border/50">
            <div className="p-2 rounded bg-card border border-border text-center">
              <div className="text-[10px] text-muted-foreground">Consumption Value</div>
              <div className="text-sm font-mono font-semibold">{formatCurrency(agg.total_consumption_value, currency)}</div>
            </div>
            <div className="p-2 rounded bg-card border border-border text-center">
              <div className="text-[10px] text-muted-foreground">Waste Units</div>
              <div className={cn('text-sm font-mono font-semibold', agg.total_waste_units > 0 ? 'text-rose-400' : 'text-foreground')}>
                {agg.total_waste_units.toFixed(1)}
              </div>
            </div>
            <div className="p-2 rounded bg-card border border-border text-center">
              <div className="text-[10px] text-muted-foreground">Stockout Days (total)</div>
              <div className={cn('text-sm font-mono font-semibold', agg.total_stockout_days > 0 ? 'text-amber-400' : 'text-foreground')}>
                {agg.total_stockout_days}d
              </div>
            </div>
            <div className="p-2 rounded bg-card border border-border text-center">
              <div className="text-[10px] text-muted-foreground">Budget Allocated</div>
              <div className="text-sm font-mono font-semibold">
                {agg.allocated != null ? formatCurrency(agg.allocated, currency) : '—'}
              </div>
            </div>
          </div>

          {/* Variant list */}
          <div>
            {agg.variants.map(v => (
              <VariantSubRow key={v.variant_id} v={v} />
            ))}
          </div>

          {/* Actions footer */}
          <div className="flex items-center gap-3 px-3 py-2 border-t border-border/50 bg-muted/10">
            <Link
              to="/eye?panel=performance"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <BarChart3 className="w-3 h-3" />
              Full performance view →
            </Link>
            <Link
              to="/eye?panel=insights"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <Activity className="w-3 h-3" />
              Active incidents →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SortKey = 'health' | 'waste' | 'budget' | 'stockout'

export default function CategoryIntelligencePage() {
  const currency = useCurrency()
  const [windowDays, setWindowDays] = useState(30)
  const [sortKey, setSortKey] = useState<SortKey>('health')

  // Budget: use current month
  const today = new Date()
  const budgetYear  = today.getFullYear()
  const budgetMonth = today.getMonth() + 1

  const { data: perfRows  = [], isLoading: loadPerf  } = useProductPerformance(windowDays)
  const { data: budgetRows = [], isLoading: loadBudget } = useBudgetVsActual(budgetYear, budgetMonth)

  const aggs = useMemo(() => {
    const raw = buildCategoryAggs(perfRows, budgetRows)
    return [...raw].sort((a, b) => {
      if (sortKey === 'health')   return b.avg_score - a.avg_score
      if (sortKey === 'waste')    return (b.waste_rate_pct ?? 0) - (a.waste_rate_pct ?? 0)
      if (sortKey === 'budget')   return (b.spend_pct ?? 0) - (a.spend_pct ?? 0)
      if (sortKey === 'stockout') return b.total_stockout_days - a.total_stockout_days
      return 0
    })
  }, [perfRows, budgetRows, sortKey])

  const isLoading = loadPerf || loadBudget

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-border shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Category Intelligence
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Performance · waste · budget synthesised per category — {format(startOfMonth(today), 'MMMM yyyy')} budget
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Window:</span>
            {([7, 14, 30, 60] as const).map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className={cn('px-3 py-1.5 text-xs rounded border font-medium transition-colors',
                  windowDays === d ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sort controls */}
      <div className="px-6 py-3 border-b border-border shrink-0 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Sort by:</span>
        {([
          { key: 'health' as SortKey,   label: 'Health Score', icon: Activity    },
          { key: 'waste' as SortKey,    label: 'Waste Rate',   icon: AlertTriangle },
          { key: 'budget' as SortKey,   label: 'Budget Spend', icon: DollarSign  },
          { key: 'stockout' as SortKey, label: 'Stockout Days',icon: Package     },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 text-xs rounded border transition-colors',
              sortKey === key ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{aggs.length} categories</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Activity className="w-4 h-4 animate-pulse" />
            Aggregating category intelligence…
          </div>
        ) : aggs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Layers className="w-10 h-10 text-muted-foreground/20 mb-3" />
            <div className="text-sm text-muted-foreground">No category data in this window</div>
            <div className="text-xs text-muted-foreground/60 mt-1">Log some stock activity to see category aggregates</div>
          </div>
        ) : (
          <>
            <SummaryStrip aggs={aggs} currency={currency} />
            <div className="space-y-2">
              {aggs.map(agg => (
                <CategoryRow key={agg.name} agg={agg} currency={currency} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
