// Layer: Mind — Financial Intelligence Center
// Transforms raw stock movement data into P&L-grade inventory finance intelligence.
// Hotel owners and GMs see COGS, waste cost, restock spend, and cost drivers —
// automatically, without a spreadsheet.
// No other hotel inventory system synthesizes this view automatically.
// Palantir principle: cross-domain synthesis — stock movements + costs = financial reality.

import { useMemo, useState } from 'react'
import {
  DollarSign, TrendingDown, TrendingUp, AlertTriangle, Download,
  ArrowDownRight, ArrowUpRight, Minus, BarChart2, Package, Filter,
} from 'lucide-react'
import { format, subDays } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useStockMovementReport } from '@/features/inventory/hooks/reports'
import { useProducts } from '@/features/inventory/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { Sparkline } from '@/components/Sparkline'
import { useDateRange, DateRangeBar } from '@/components/DateRangeBar'
import type { StockMovementRow } from '@/features/inventory/api/reports'

// ─── Movement categorisation ──────────────────────────────────────────────────

type MovementKind = 'consumed' | 'restocked' | 'waste' | 'revert' | 'other'

function classifyRow(row: StockMovementRow): MovementKind {
  if (row.is_revert) return 'revert'
  if (row.quantity_change > 0) return 'restocked'
  const cat = row.removal_category?.toLowerCase() ?? ''
  const reason = row.reason.toLowerCase()
  if (cat === 'spoilage' || cat === 'breakage' || cat === 'theft' || reason.includes('waste') || reason.includes('expired') || reason.includes('damaged')) return 'waste'
  if (cat === 'consumed' || reason.includes('consume') || reason.includes('used') || reason.includes('adjustment') || reason.includes('scan') || reason.includes('stock')) return 'consumed'
  if (row.quantity_change < 0) return 'consumed' // default negative = consumed
  return 'other'
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string
  value: string
  sub?: string
  trend?: number | null   // positive = up, negative = down
  trendLabel?: string
  highlight?: 'red' | 'green' | 'amber' | null
  sparkData?: number[]
  sparkColor?: string
}

function KpiTile({ label, value, sub, trend, trendLabel, highlight, sparkData, sparkColor }: KpiTileProps) {
  const trendUp   = trend != null && trend > 0
  const trendDown = trend != null && trend < 0
  const TrendIcon = trendUp ? ArrowUpRight : trendDown ? ArrowDownRight : Minus

  return (
    <div className="bg-card border rounded-lg px-5 py-4 flex flex-col gap-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className={cn(
            'text-2xl font-bold tabular-nums leading-none',
            highlight === 'red'   ? 'text-red-600'   :
            highlight === 'green' ? 'text-green-600' :
            highlight === 'amber' ? 'text-amber-600' : '',
          )}>
            {value}
          </p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          {trend != null && (
            <div className={cn(
              'flex items-center gap-1 mt-1.5 text-[11px] font-medium',
              trendUp ? 'text-red-500' : trendDown ? 'text-green-500' : 'text-muted-foreground',
            )}>
              <TrendIcon className="h-3 w-3" />
              <span>{trendLabel ?? `${Math.abs(trend).toFixed(1)}%`}</span>
            </div>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <Sparkline data={sparkData} color={sparkColor ?? '#3b82f6'} width={80} height={36} />
        )}
      </div>
    </div>
  )
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FinancePage() {
  const currency = useCurrency()
  const dr = useDateRange({ defaultPreset: '30d', presets: ['7d', '30d', '90d', 'custom'] })

  const [searchCost, setSearchCost] = useState('')

  const { data: movements = [], isLoading } = useStockMovementReport(dr.dateFrom, dr.dateTo)
  const { data: products = [] } = useProducts()

  // Build variant cost map
  const costMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) {
      for (const v of p.product_variants) m.set(v.id, v.cost)
    }
    return m
  }, [products])

  // Enrich movements with cost data and classification
  const enriched = useMemo(() => movements
    .filter((r) => !r.is_revert) // exclude reversals from totals
    .map((r) => ({
      ...r,
      unitCost: costMap.get(r.variant_id) ?? 0,
      cost: Math.abs(r.quantity_change) * (costMap.get(r.variant_id) ?? 0),
      kind: classifyRow(r),
    })), [movements, costMap])

  // Period totals
  const consumed   = useMemo(() => enriched.filter((r) => r.kind === 'consumed'),  [enriched])
  const restocked  = useMemo(() => enriched.filter((r) => r.kind === 'restocked'), [enriched])
  const waste      = useMemo(() => enriched.filter((r) => r.kind === 'waste'),      [enriched])

  const cogsCost     = consumed.reduce((s, r) => s + r.cost, 0)
  const wasteCost    = waste.reduce((s, r) => s + r.cost, 0)
  const restockCost  = restocked.reduce((s, r) => s + r.cost, 0)
  const totalNetCost = cogsCost + wasteCost

  // Day-by-day COGS for sparkline
  const dailyCogs = useMemo(() => {
    const days = dr.preset === '7d' ? 7 : dr.preset === '30d' ? 30 : 90
    const byDay = new Map<string, number>()
    for (let i = days - 1; i >= 0; i--) {
      byDay.set(format(subDays(new Date(), i), 'yyyy-MM-dd'), 0)
    }
    for (const r of consumed) {
      const day = r.timestamp.slice(0, 10)
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + r.cost)
    }
    return [...byDay.values()]
  }, [consumed, dr.preset])

  const dailyWaste = useMemo(() => {
    const days = dr.preset === '7d' ? 7 : dr.preset === '30d' ? 30 : 90
    const byDay = new Map<string, number>()
    for (let i = days - 1; i >= 0; i--) {
      byDay.set(format(subDays(new Date(), i), 'yyyy-MM-dd'), 0)
    }
    for (const r of waste) {
      const day = r.timestamp.slice(0, 10)
      if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + r.cost)
    }
    return [...byDay.values()]
  }, [waste, dr.preset])

  // Top 10 cost drivers (by variant, consumption + waste combined)
  const costDrivers = useMemo(() => {
    const m = new Map<string, {
      variantId: string; productName: string; variantName: string; sku: string
      consumed: number; waste: number; total: number; units: number; category: string | null
    }>()
    for (const r of enriched) {
      if (r.kind !== 'consumed' && r.kind !== 'waste') continue
      const existing = m.get(r.variant_id)
      if (existing) {
        if (r.kind === 'consumed') existing.consumed += r.cost
        else existing.waste += r.cost
        existing.total += r.cost
        existing.units += Math.abs(r.quantity_change)
      } else {
        m.set(r.variant_id, {
          variantId: r.variant_id,
          productName: r.product_name,
          variantName: r.variant_name,
          sku: r.sku,
          consumed: r.kind === 'consumed' ? r.cost : 0,
          waste: r.kind === 'waste' ? r.cost : 0,
          total: r.cost,
          units: Math.abs(r.quantity_change),
          category: r.category_name,
        })
      }
    }
    return [...m.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
  }, [enriched])

  // Filtered cost drivers
  const filteredDrivers = useMemo(() => {
    const q = searchCost.trim().toLowerCase()
    if (!q) return costDrivers
    return costDrivers.filter((d) => {
      const name = d.variantName !== 'Standard' ? `${d.productName} ${d.variantName}` : d.productName
      return name.toLowerCase().includes(q) || d.sku.toLowerCase().includes(q)
    })
  }, [costDrivers, searchCost])

  // Waste by removal category
  const wasteByCat = useMemo(() => {
    const m = new Map<string, { cost: number; count: number }>()
    for (const r of waste) {
      const cat = r.removal_category ?? 'Unspecified'
      const ex = m.get(cat) ?? { cost: 0, count: 0 }
      ex.cost += r.cost
      ex.count++
      m.set(cat, ex)
    }
    return [...m.entries()]
      .map(([cat, v]) => ({ cat, ...v }))
      .sort((a, b) => b.cost - a.cost)
  }, [waste])

  // Category cost breakdown
  const categoryBreakdown = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of enriched) {
      if (r.kind !== 'consumed' && r.kind !== 'waste') continue
      const cat = r.category_name ?? 'Uncategorised'
      m.set(cat, (m.get(cat) ?? 0) + r.cost)
    }
    return [...m.entries()]
      .map(([cat, cost]) => ({ cat, cost }))
      .sort((a, b) => b.cost - a.cost)
  }, [enriched])

  // Waste % of total cost
  const wastePct = totalNetCost > 0 ? (wasteCost / totalNetCost) * 100 : 0

  // CSV export
  const handleExport = () => {
    const rows = [
      ['Date', 'Product', 'Variant', 'SKU', 'Category', 'Type', 'Units', 'Unit Cost', 'Total Cost', 'Reason', 'Removal Category'],
      ...enriched
        .filter((r) => r.kind === 'consumed' || r.kind === 'waste' || r.kind === 'restocked')
        .map((r) => [
          r.timestamp.slice(0, 10),
          r.product_name,
          r.variant_name,
          r.sku,
          r.category_name ?? '',
          r.kind,
          Math.abs(r.quantity_change),
          r.unitCost.toFixed(2),
          r.cost.toFixed(2),
          r.reason,
          r.removal_category ?? '',
        ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory-finance-${dr.dateFrom}-to-${dr.dateTo}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const catColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-start justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-muted-foreground" />
            Financial Intelligence
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading movements…'
              : `${movements.length} stock events · ${dr.dateFrom} → ${dr.dateTo}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 text-xs h-8">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex items-center gap-3 border-b px-6 py-2.5 flex-shrink-0">
        <DateRangeBar {...dr} />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ── KPI grid ── */}
            <div className="grid grid-cols-4 gap-4">
              <KpiTile
                label="Cost of Goods Consumed"
                value={formatCurrency(cogsCost, currency)}
                sub={`${consumed.length} consumption events`}
                sparkData={dailyCogs}
                sparkColor="#3b82f6"
              />
              <KpiTile
                label="Waste Cost"
                value={formatCurrency(wasteCost, currency)}
                sub={`${wastePct.toFixed(1)}% of total spend`}
                highlight={wastePct > 15 ? 'red' : wastePct > 8 ? 'amber' : null}
                sparkData={dailyWaste}
                sparkColor="#ef4444"
              />
              <KpiTile
                label="Restock Spend"
                value={formatCurrency(restockCost, currency)}
                sub={`${restocked.length} restock events`}
                sparkColor="#10b981"
              />
              <KpiTile
                label="Total Inventory Spend"
                value={formatCurrency(totalNetCost, currency)}
                sub="COGS + waste combined"
                highlight={null}
              />
            </div>

            {/* ── Waste alert ── */}
            {wastePct > 15 && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-4 py-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-400">High waste rate: {wastePct.toFixed(1)}%</p>
                  <p className="text-xs text-red-700 dark:text-red-500 mt-0.5">
                    Industry benchmark is &lt;8%. Your waste cost is {formatCurrency(wasteCost, currency)} this period.
                    Review the waste breakdown below to identify the top contributors.
                  </p>
                </div>
              </div>
            )}

            {/* ── Two column: waste breakdown + category breakdown ── */}
            <div className="grid grid-cols-2 gap-6">

              {/* Waste by category */}
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-semibold">Waste by Category</h3>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(wasteCost, currency)} total
                  </span>
                </div>
                {wasteByCat.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No waste recorded this period</p>
                ) : (
                  <div className="space-y-4">
                    {wasteByCat.map(({ cat, cost, count }) => (
                      <div key={cat}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{cat}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{count} events</span>
                            <span className="font-semibold tabular-nums">{formatCurrency(cost, currency)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-red-400"
                            style={{ width: `${wasteCost > 0 ? (cost / wasteCost) * 100 : 0}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cost by product category */}
              <div className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart2 className="h-4 w-4 text-blue-500" />
                  <h3 className="text-sm font-semibold">Spend by Category</h3>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {formatCurrency(totalNetCost, currency)} total
                  </span>
                </div>
                {categoryBreakdown.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">No data this period</p>
                ) : (
                  <div className="space-y-4">
                    {categoryBreakdown.slice(0, 7).map(({ cat, cost }, i) => (
                      <div key={cat}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium">{cat}</span>
                          <span className="font-semibold tabular-nums">{formatCurrency(cost, currency)}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${totalNetCost > 0 ? (cost / totalNetCost) * 100 : 0}%`,
                              backgroundColor: catColors[i % catColors.length],
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Top cost drivers table ── */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-3 px-5 py-4 border-b">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Top Cost Drivers</h3>
                <span className="text-xs text-muted-foreground">· highest spend this period</span>
                <div className="ml-auto relative w-48">
                  <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filter…"
                    value={searchCost}
                    onChange={(e) => { setSearchCost(e.target.value) }}
                    className="pl-8 h-7 text-xs"
                  />
                </div>
              </div>
              {filteredDrivers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No cost data this period</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pl-5 pr-2 w-6">#</th>
                        <th className="py-2 px-2">Product</th>
                        <th className="py-2 px-2">Category</th>
                        <th className="py-2 px-2 text-right w-20">Units</th>
                        <th className="py-2 px-2 text-right w-28">COGS</th>
                        <th className="py-2 px-2 text-right w-28">Waste Cost</th>
                        <th className="py-2 pl-2 pr-5 text-right w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrivers.map((d, i) => {
                        const wasteFraction = d.total > 0 ? d.waste / d.total : 0
                        return (
                          <tr key={d.variantId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                            <td className="py-2.5 pl-5 pr-2 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="py-2.5 px-2">
                              <p className="text-sm font-medium leading-tight">
                                {d.variantName !== 'Standard' ? `${d.productName} — ${d.variantName}` : d.productName}
                              </p>
                              <p className="text-[10px] font-mono text-muted-foreground">{d.sku}</p>
                            </td>
                            <td className="py-2.5 px-2">
                              <span className="text-xs text-muted-foreground">{d.category ?? '—'}</span>
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <span className="text-sm tabular-nums">{d.units}</span>
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <span className="text-sm tabular-nums">{formatCurrency(d.consumed, currency)}</span>
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              {d.waste > 0 ? (
                                <div>
                                  <span className={cn(
                                    'text-sm tabular-nums font-medium',
                                    wasteFraction > 0.3 ? 'text-red-600' : wasteFraction > 0.15 ? 'text-amber-600' : '',
                                  )}>
                                    {formatCurrency(d.waste, currency)}
                                  </span>
                                  <p className="text-[10px] text-muted-foreground">{(wasteFraction * 100).toFixed(0)}% of total</p>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2.5 pl-2 pr-5 text-right">
                              <p className="text-sm font-bold tabular-nums">{formatCurrency(d.total, currency)}</p>
                              <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden w-20 ml-auto">
                                <div
                                  className="h-full rounded-full bg-blue-400"
                                  style={{ width: `${totalNetCost > 0 ? (d.total / (filteredDrivers[0]?.total ?? 1)) * 100 : 0}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/20">
                        <td colSpan={4} className="py-2.5 pl-5 text-xs text-muted-foreground">
                          Top {filteredDrivers.length} items · {dr.dateFrom} → {dr.dateTo}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-sm tabular-nums">
                          {formatCurrency(filteredDrivers.reduce((s, d) => s + d.consumed, 0), currency)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-bold text-sm tabular-nums text-red-600">
                          {formatCurrency(filteredDrivers.reduce((s, d) => s + d.waste, 0), currency)}
                        </td>
                        <td className="py-2.5 pl-2 pr-5 text-right font-bold text-sm tabular-nums">
                          {formatCurrency(filteredDrivers.reduce((s, d) => s + d.total, 0), currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* ── Summary insight ── */}
            <div className="rounded-lg border bg-muted/20 px-5 py-4 text-sm">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">Period Summary</span>
              </div>
              <div className="grid grid-cols-3 gap-6 text-xs text-muted-foreground">
                <div>
                  <p>Average daily COGS:</p>
                  <p className="text-foreground font-semibold tabular-nums mt-0.5">
                    {formatCurrency(cogsCost / Math.max(1, dr.preset === '7d' ? 7 : dr.preset === '30d' ? 30 : 90), currency)}/day
                  </p>
                </div>
                <div>
                  <p>Waste as % of spend:</p>
                  <p className={cn('font-semibold tabular-nums mt-0.5', wastePct > 15 ? 'text-red-600' : wastePct > 8 ? 'text-amber-600' : 'text-green-600')}>
                    {wastePct.toFixed(1)}%
                    {wastePct > 15 ? ' · above benchmark' : wastePct <= 8 ? ' · within benchmark' : ' · near benchmark'}
                  </p>
                </div>
                <div>
                  <p>Top cost driver:</p>
                  <p className="text-foreground font-semibold mt-0.5 truncate">
                    {costDrivers[0]
                      ? costDrivers[0].variantName !== 'Standard'
                        ? `${costDrivers[0].productName} (${costDrivers[0].variantName})`
                        : costDrivers[0].productName
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
