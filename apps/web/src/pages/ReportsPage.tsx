// Layer: Eye + Mind — Intelligence reports
// Palantir principle: a manager should open this page and immediately know
// the state of the world — not hunt through tabs to assemble the picture.
// Every number carries trend context. Every table answers "so what?"

import React, { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, subDays, startOfMonth } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import {
  Download, FileText, TrendingDown, TrendingUp,
  AlertTriangle, Package, Activity, Receipt,
  Flame, MapPin, Zap, Truck, DollarSign, ArrowLeftRight,
  CalendarX2, Brain, Eye as EyeIcon, BarChart2, Users, CalendarDays,
} from 'lucide-react'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency, getCurrencySymbol } from '@/lib/currency'
import { useDateRange, DateRangeBar } from '@/components/DateRangeBar'
import { Trend } from '@/components/Trend'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { exportToCsv } from '@/lib/csv'
import { exportToPdf } from '@/lib/pdf'
import { useProducts, useExpiringVariants } from '@/features/inventory/hooks'
import { useStockMovementReport, useWasteReport } from '@/features/inventory/hooks/reports'
import { useTeamMembers } from '@/features/team/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useLowStockByLocation } from '@/features/locations/hooks'
import { getStockStatus } from '@beacon/types'
import type { Supplier, ProductVariant } from '@beacon/types'
import { ProcurementInsights } from '@/features/mind'
import { useCostVarianceReport } from '@/features/mind/hooks'
import { ForecastReport, AnomalyFeed } from '@/features/eye'
import { lazy, Suspense } from 'react'
import type { StockMovementRow } from '@/features/inventory/api/reports'
import type { ProductWithVariants } from '@beacon/types'

// Finance tab loaded lazily — same component as standalone FinancePage
const FinanceTab = lazy(() => import('@/pages/FinancePage'))

// ─── Cost cross-reference helper ───────────────────────────────────────────────
// Approximates cost at time of event using current variant cost.
// Accurate enough for management reporting; exact cost-at-time requires cost history join.

function buildCostMap(products: ProductWithVariants[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of products) {
    for (const v of p.product_variants) {
      map.set(v.id, v.cost)
    }
  }
  return map
}

function rowCost(row: StockMovementRow, costMap: Map<string, number>): number {
  return (costMap.get(row.variant_id) ?? 0) * Math.abs(row.quantity_change)
}

// ─── Executive Command Strip ───────────────────────────────────────────────────
// "What is the state of my operation right now?" — answered in 4 numbers.

function ExecutiveStrip({
  products,
  mtdMovements,
  priorMovements,
  currency,
}: {
  products: ProductWithVariants[]
  mtdMovements: StockMovementRow[]
  priorMovements: StockMovementRow[]
  currency: string
}) {
  const costMap = useMemo(() => buildCostMap(products), [products])

  const totalValue = useMemo(
    () => products.reduce((s, p) => s + p.product_variants.reduce((sv, v) => sv + v.current_stock * v.cost, 0), 0),
    [products],
  )
  const outOfStock = products.filter((p) => p.product_variants.every((v) => v.current_stock === 0)).length
  const lowStock   = products.filter((p) => p.product_variants.some((v) => v.low_stock_threshold > 0 && v.current_stock > 0 && v.current_stock <= v.low_stock_threshold)).length

  const wasteCost = (rows: StockMovementRow[]) =>
    rows.filter((r) => !r.is_revert && r.quantity_change < 0 && r.removal_category)
        .reduce((s, r) => s + rowCost(r, costMap), 0)

  const mtdWaste   = wasteCost(mtdMovements)
  const priorWaste = wasteCost(priorMovements)

  const mtdConsumed = mtdMovements
    .filter((r) => !r.is_revert && r.quantity_change < 0)
    .reduce((s, r) => s + rowCost(r, costMap), 0)

  const priorConsumed = priorMovements
    .filter((r) => !r.is_revert && r.quantity_change < 0)
    .reduce((s, r) => s + rowCost(r, costMap), 0)

  const kpis = [
    {
      label: 'Inventory Value',
      value: formatCurrency(totalValue, currency),
      sub: `${String(products.length)} products`,
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Consumed MTD',
      value: formatCurrency(mtdConsumed, currency),
      sub: <Trend current={mtdConsumed} prior={priorConsumed} />,
      icon: Activity,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      label: 'Waste Cost MTD',
      value: formatCurrency(mtdWaste, currency),
      sub: <Trend current={mtdWaste} prior={priorWaste} invertColor />,
      icon: TrendingDown,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Needs Attention',
      value: String(outOfStock + lowStock),
      sub: `${String(outOfStock)} out · ${String(lowStock)} low`,
      icon: AlertTriangle,
      color: outOfStock > 0 ? 'text-red-600 dark:text-red-400' : lowStock > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600',
      bg: outOfStock > 0 ? 'bg-red-50 dark:bg-red-950/30' : lowStock > 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-green-50 dark:bg-green-950/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpis.map(({ label, value, sub, icon: Icon, color, bg }) => (
        <div key={label} className="rounded-lg border bg-card p-4 flex items-start gap-3">
          <div className={cn('rounded-md p-2 shrink-0', bg)}>
            <Icon className={cn('h-4 w-4', color)} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold tabular-nums leading-tight">{value}</p>
            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Valuation report ─────────────────────────────────────────────────────────

function ValuationReport({
  products,
  currency,
}: {
  products: ProductWithVariants[]
  currency: string
}) {
  const sym = getCurrencySymbol(currency)

  const rows = useMemo(
    () =>
      products.flatMap((p) =>
        p.product_variants.map((v) => ({
          product:     p.name,
          sku:         v.sku,
          variant:     v.name,
          category:    p.categories?.name ?? '—',
          stock:       v.current_stock,
          threshold:   v.low_stock_threshold,
          unit_cost:   v.cost,
          total_value: v.current_stock * v.cost,
          // Health: 0=out, 1=low, 2=ok, 3=overstock
          health: v.current_stock === 0 ? 0
            : v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold ? 1
            : v.low_stock_threshold > 0 && v.current_stock > v.low_stock_threshold * 3 ? 3
            : 2,
        }))
      ).sort((a, b) => b.total_value - a.total_value),
    [products],
  )

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of rows) map.set(r.category, (map.get(r.category) ?? 0) + r.total_value)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  const grandTotal = rows.reduce((s, r) => s + r.total_value, 0)
  const zeroValueRows = rows.filter((r) => r.total_value === 0).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCurrency(grandTotal, currency)}</span>
          {' '}total across {String(rows.length)} variants
          {zeroValueRows > 0 && <span className="ml-2 text-yellow-600">· {String(zeroValueRows)} with no cost set</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { exportToCsv(`valuation-${format(new Date(), 'yyyy-MM-dd')}`, rows.map((r) => ({ ...r, unit_cost: r.unit_cost.toFixed(2), total_value: r.total_value.toFixed(2) }))); }}>
            <Download className="mr-2 h-3.5 w-3.5" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => { exportToPdf(`Inventory Valuation ${format(new Date(), 'yyyy-MM-dd')}`, ['Product', 'SKU', 'Variant', 'Category', 'Stock', `Unit Cost (${sym})`, `Total (${sym})`], rows.map((r) => [r.product, r.sku, r.variant, r.category, r.stock, r.unit_cost.toFixed(2), r.total_value.toFixed(2)])); }}>
            <FileText className="mr-2 h-3.5 w-3.5" />PDF
          </Button>
        </div>
      </div>

      {/* Category breakdown bar chart */}
      {byCategory.length > 1 && (
        <div className="rounded-lg border divide-y">
          {byCategory.map(([cat, value]) => (
            <div key={cat} className="flex items-center gap-4 px-4 py-2.5">
              <span className="text-sm font-medium w-36 truncate">{cat}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${String(grandTotal > 0 ? (value / grandTotal) * 100 : 0)}%` }} />
              </div>
              <span className="font-semibold text-sm w-24 text-right tabular-nums">{formatCurrency(value, currency)}</span>
              <span className="text-xs text-muted-foreground w-8 text-right">{grandTotal > 0 ? `${String(Math.round((value / grandTotal) * 100))}%` : '0%'}</span>
            </div>
          ))}
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead>Variant</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Par Level</TableHead>
            <TableHead className="text-right">Unit Cost</TableHead>
            <TableHead className="text-right">Total Value</TableHead>
            <TableHead>Health</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.sku}>
              <TableCell className="font-medium">{r.product}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{r.variant}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{r.category}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{r.stock}</TableCell>
              <TableCell className="text-right text-muted-foreground text-sm tabular-nums">{r.threshold > 0 ? r.threshold : '—'}</TableCell>
              <TableCell className="text-right text-sm text-muted-foreground tabular-nums">{sym}{r.unit_cost.toFixed(2)}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{sym}{r.total_value.toFixed(2)}</TableCell>
              <TableCell>
                {r.health === 0 && <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700">Out</Badge>}
                {r.health === 1 && <Badge variant="outline" className="text-[10px] border-yellow-200 bg-yellow-50 text-yellow-700">Low</Badge>}
                {r.health === 3 && <Badge variant="outline" className="text-[10px] border-blue-200 bg-blue-50 text-blue-700">Overstock</Badge>}
                {r.health === 2 && <span className="text-[10px] text-green-600">OK</span>}
              </TableCell>
            </TableRow>
          ))}
          {rows.length > 0 && (
            <TableRow className="bg-muted/50">
              <TableCell colSpan={7} className="font-semibold">Grand Total</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(grandTotal, currency)}</TableCell>
              <TableCell />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Consumption report ────────────────────────────────────────────────────────
// "Where is my money going and how fast?" — the report managers actually need.

function ConsumptionReport({
  products,
  currency,
}: {
  products: ProductWithVariants[]
  currency: string
}) {
  const dateRange = useDateRange({ defaultPreset: '30d' })
  const { dateFrom, dateTo } = dateRange
  const { data: rows = [], isLoading } = useStockMovementReport(dateFrom, dateTo)

  const costMap = useMemo(() => buildCostMap(products), [products])

  const periodDays = useMemo(() => {
    const d1 = new Date(dateFrom)
    const d2 = new Date(dateTo)
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
  }, [dateFrom, dateTo])

  // Only outgoing removals (not reverts)
  const removals = useMemo(
    () => rows.filter((r) => !r.is_revert && r.quantity_change < 0),
    [rows],
  )

  // By product
  const byProduct = useMemo(() => {
    const map = new Map<string, { units: number; cost: number; sku: string; category: string | null }>()
    for (const r of removals) {
      const key = `${r.product_name}||${r.variant_name}`
      const prev = map.get(key) ?? { units: 0, cost: 0, sku: r.sku, category: r.category_name }
      map.set(key, {
        units:    prev.units + Math.abs(r.quantity_change),
        cost:     prev.cost + rowCost(r, costMap),
        sku:      r.sku,
        category: r.category_name,
      })
    }
    return [...map.entries()]
      .map(([key, v]) => {
        const [product, variant] = key.split('||')
        return {
          product: product ?? '',
          variant: variant ?? '',
          ...v,
          daily_units: v.units / periodDays,
          daily_cost:  v.cost  / periodDays,
        }
      })
      .sort((a, b) => b.cost - a.cost)
  }, [removals, costMap, periodDays])

  // By category
  const byCategory = useMemo(() => {
    const map = new Map<string, { units: number; cost: number }>()
    for (const r of removals) {
      const cat = r.category_name ?? '— Uncategorised'
      const prev = map.get(cat) ?? { units: 0, cost: 0 }
      map.set(cat, { units: prev.units + Math.abs(r.quantity_change), cost: prev.cost + rowCost(r, costMap) })
    }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost)
  }, [removals, costMap])

  const totalCost  = byProduct.reduce((s, r) => s + r.cost, 0)
  const totalUnits = byProduct.reduce((s, r) => s + r.units, 0)

  if (isLoading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>

  if (removals.length === 0) return (
    <div className="py-12 text-center text-sm text-muted-foreground space-y-1">
      <p>No stock removals in this period.</p>
      <p className="text-xs">Stock removals are recorded via "Adjust Stock" or the Scan page.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar {...dateRange} />
        <div className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{formatCurrency(totalCost, currency)}</span>
          {' '}consumed · <span className="font-semibold text-foreground">{String(totalUnits)}</span> units
          {' '}· <span className="font-semibold">{formatCurrency(totalCost / periodDays, currency)}/day</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By category */}
        <div>
          <p className="text-sm font-semibold mb-2">Cost consumed by category</p>
          <div className="rounded-lg border divide-y">
            {byCategory.map(([cat, { units, cost }]) => (
              <div key={cat} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{cat}</p>
                  <p className="text-xs text-muted-foreground">{String(units)} units</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(cost, currency)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCurrency(cost / periodDays, currency)}/day</p>
                </div>
                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${String(totalCost > 0 ? (cost / totalCost) * 100 : 0)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 10 by cost */}
        <div>
          <p className="text-sm font-semibold mb-2">Top products by cost consumed</p>
          <div className="rounded-lg border divide-y">
            {byProduct.slice(0, 10).map((r, rank) => (
              <div key={r.sku} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-xs text-muted-foreground w-4 tabular-nums">{rank + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.product}{r.variant !== 'Standard' ? <span className="text-muted-foreground"> — {r.variant}</span> : ''}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{r.sku}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(r.cost, currency)}</p>
                  <p className="text-[10px] text-muted-foreground">{r.daily_units.toFixed(1)} units/day</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full table */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">All products</p>
          <Button variant="outline" size="sm" onClick={() => { exportToCsv(`consumption-${dateFrom}-to-${dateTo}`, byProduct.map((r) => ({ ...r, cost: r.cost.toFixed(2), daily_cost: r.daily_cost.toFixed(2), daily_units: r.daily_units.toFixed(2) }))); }}>
            <Download className="mr-2 h-3.5 w-3.5" />CSV
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Units consumed</TableHead>
              <TableHead className="text-right">Cost consumed</TableHead>
              <TableHead className="text-right">Daily rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byProduct.map((r) => (
              <TableRow key={r.sku}>
                <TableCell className="font-medium">
                  {r.product}
                  {r.variant !== 'Standard' && <span className="text-muted-foreground"> — {r.variant}</span>}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.category ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{r.units}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.cost, currency)}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {formatCurrency(r.daily_cost, currency)}/d
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ─── Waste report ─────────────────────────────────────────────────────────────

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function WasteReport({
  products,
  currency,
}: {
  products: ProductWithVariants[]
  currency: string
}) {
  const fmtDate = useDateFormat()
  const dateRange = useDateRange({ defaultPreset: '30d' })
  const { dateFrom, dateTo } = dateRange

  // Current period — waste events with user_id for cross-domain synthesis
  const { data: wasteEvents = [], isLoading } = useWasteReport(dateFrom, dateTo)

  // Prior period — movement report sufficient for totals only
  const periodDays = useMemo(() => {
    const d1 = new Date(dateFrom)
    const d2 = new Date(dateTo)
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
  }, [dateFrom, dateTo])
  const priorFrom = format(subDays(new Date(dateFrom), periodDays), 'yyyy-MM-dd')
  const priorTo   = format(subDays(new Date(dateFrom), 1), 'yyyy-MM-dd')
  const { data: priorRows = [] } = useStockMovementReport(priorFrom, priorTo)

  // Cross-domain synthesis data sources
  const { data: teamMembers = [] } = useTeamMembers()
  const { data: suppliers = [] }   = useSuppliers()

  const costMap = useMemo(() => buildCostMap(products), [products])

  // Use wasteEvents directly (already server-filtered to waste-only)
  const wasteRows  = wasteEvents
  const priorWaste = useMemo(() => priorRows.filter((r) => !r.is_revert && r.quantity_change < 0 && r.removal_category), [priorRows])

  const totalWasteCost  = wasteRows.reduce((s, r) => s + rowCost(r, costMap), 0)
  const priorWasteCost  = priorWaste.reduce((s, r) => s + rowCost(r, costMap), 0)
  const totalWasteUnits = wasteRows.reduce((s, r) => s + Math.abs(r.quantity_change), 0)

  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; units: number; cost: number }>()
    for (const r of wasteRows) {
      const cat  = r.removal_category ?? 'Unknown'
      const prev = map.get(cat) ?? { count: 0, units: 0, cost: 0 }
      map.set(cat, { count: prev.count + 1, units: prev.units + Math.abs(r.quantity_change), cost: prev.cost + rowCost(r, costMap) })
    }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost)
  }, [wasteRows, costMap])

  // ── Cross-domain synthesis ──────────────────────────────────────────────────

  // 1. Operator breakdown: group by user_id → email
  const memberMap = useMemo(
    () => new Map(teamMembers.map((m) => [m.id, m.email])),
    [teamMembers]
  )
  const byOperator = useMemo(() => {
    const map = new Map<string, { email: string; units: number; cost: number; events: number }>()
    for (const r of wasteRows) {
      const uid   = r.user_id ?? 'unknown'
      const email = memberMap.get(uid) ?? uid.slice(0, 8) + '…'
      const prev  = map.get(uid) ?? { email, units: 0, cost: 0, events: 0 }
      map.set(uid, {
        email,
        units:  prev.units + Math.abs(r.quantity_change),
        cost:   prev.cost + rowCost(r, costMap),
        events: prev.events + 1,
      })
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost)
  }, [wasteRows, memberMap, costMap])

  // 2. Day-of-week pattern
  const dowCosts = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]
    for (const r of wasteRows) {
      totals[new Date(r.timestamp).getDay()] += rowCost(r, costMap)
    }
    return totals
  }, [wasteRows, costMap])
  const dowMax = Math.max(...dowCosts, 0.01)

  // 3. Supplier correlation: variant → default_supplier_id → supplier name
  const suppliersMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  )
  const variantSupplierMap = useMemo(() => {
    const map = new Map<string, string>() // variantId → supplierId
    for (const p of products) {
      for (const v of p.product_variants) {
        const sid = (v as ProductVariant & { default_supplier_id?: string | null }).default_supplier_id
        if (sid) map.set(v.id, sid)
      }
    }
    return map
  }, [products])
  const bySupplier = useMemo(() => {
    const map = new Map<string, { name: string; units: number; cost: number; variants: Set<string> }>()
    for (const r of wasteRows) {
      const sid = variantSupplierMap.get(r.variant_id)
      if (!sid) continue
      const supplier = suppliersMap.get(sid) as (Supplier & { lead_time_days?: number | null }) | undefined
      if (!supplier) continue
      const prev = map.get(sid) ?? { name: supplier.name, units: 0, cost: 0, variants: new Set() }
      prev.units += Math.abs(r.quantity_change)
      prev.cost  += rowCost(r, costMap)
      prev.variants.add(r.variant_id)
      map.set(sid, prev)
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost)
  }, [wasteRows, variantSupplierMap, suppliersMap, costMap])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar {...dateRange} />
        {!isLoading && wasteRows.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span>
              <span className="font-semibold text-red-600">{formatCurrency(totalWasteCost, currency)}</span>
              <span className="text-muted-foreground"> destroyed</span>
            </span>
            <Trend current={totalWasteCost} prior={priorWasteCost} invertColor />
            <span className="text-muted-foreground text-xs">{String(totalWasteUnits)} units · {String(wasteRows.length)} events</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : wasteRows.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground space-y-1">
          <p>No categorised removals in this period.</p>
          <p className="text-xs">Categorised removals are recorded when you select a removal reason (Spoilage, Breakage, etc.) during stock adjustment.</p>
        </div>
      ) : (
        <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Category breakdown */}
          <div>
            <p className="text-sm font-semibold mb-2">Cost destroyed by category</p>
            <div className="rounded-lg border divide-y">
              {byCategory.map(([cat, { count, units, cost }]) => (
                <div key={cat} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat}</p>
                    <p className="text-xs text-muted-foreground">{String(units)} units · {String(count)} event{count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600 tabular-nums">{formatCurrency(cost, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{totalWasteCost > 0 ? `${String(Math.round((cost / totalWasteCost) * 100))}%` : ''}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-bold text-red-600 tabular-nums">{formatCurrency(totalWasteCost, currency)}</span>
              </div>
            </div>
          </div>

          {/* Detail */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Events</p>
              <Button variant="outline" size="sm" onClick={() => { exportToCsv(`waste-${dateFrom}-to-${dateTo}`, wasteRows.map((r) => ({ date: format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'), product: r.product_name, variant: r.variant_name, units: Math.abs(r.quantity_change), cost: rowCost(r, costMap).toFixed(2), category: r.removal_category }))); }}>
                <Download className="mr-2 h-3.5 w-3.5" />CSV
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Units</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {`${fmtDate(new Date(r.timestamp))}, ${format(new Date(r.timestamp), 'HH:mm')}`}
                    </TableCell>
                    <TableCell className="text-sm">{r.product_name}</TableCell>
                    <TableCell className="text-right font-semibold text-red-700 tabular-nums">
                      {r.quantity_change}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {formatCurrency(rowCost(r, costMap), currency)}
                    </TableCell>
                    <TableCell className="text-xs">{r.removal_category}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        {/* ── end 2-col grid ── */}

        {/* ── Cross-domain synthesis ──────────────────────────────────────── */}
        <div>
          <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            Cross-domain signals
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Operator breakdown */}
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Operator</span>
              </div>
              {byOperator.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">No operator data</p>
              ) : (
                <div className="divide-y">
                  {byOperator.map((op) => (
                    <div key={op.email} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{op.email.split('@')[0]}</p>
                        <p className="text-[10px] text-muted-foreground">{String(op.events)} events · {String(op.units)} units</p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-red-600 flex-shrink-0">
                        {formatCurrency(op.cost, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Day-of-week pattern */}
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Day of Week</span>
                {dowMax > 0 && (() => {
                  const peakIdx = dowCosts.indexOf(Math.max(...dowCosts))
                  return <span className="ml-auto text-[10px] text-muted-foreground">peak: {DOW_LABELS[peakIdx]}</span>
                })()}
              </div>
              <div className="px-4 py-3 space-y-2">
                {DOW_LABELS.map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-7 text-[10px] text-muted-foreground text-right flex-shrink-0">{label}</span>
                    <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-sm transition-all',
                          dowCosts[i] === 0 ? '' :
                          dowCosts[i] === dowMax ? 'bg-red-500' :
                          dowCosts[i] > dowMax * 0.6 ? 'bg-orange-400' : 'bg-orange-300/70',
                        )}
                        style={{ width: `${(dowCosts[i] / dowMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-[10px] tabular-nums text-muted-foreground text-right flex-shrink-0">
                      {dowCosts[i] > 0 ? formatCurrency(dowCosts[i], currency) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Supplier correlation */}
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Supplier</span>
              </div>
              {bySupplier.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                  {suppliers.length === 0
                    ? 'No suppliers configured'
                    : 'No waste events matched to a supplier — assign default suppliers to variants to enable this signal'}
                </p>
              ) : (
                <div className="divide-y">
                  {bySupplier.map((s) => (
                    <div key={s.name} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{String(s.variants.size)} variant{s.variants.size !== 1 ? 's' : ''} · {String(s.units)} units</p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-red-600 flex-shrink-0">
                        {formatCurrency(s.cost, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* ── end space-y-6 wrapper ── */}
        </div>
      )}
    </div>
  )
}

// ─── Stock movement report ────────────────────────────────────────────────────

function StockMovementReport() {
  const fmtDate = useDateFormat()
  const dateRange = useDateRange({ defaultPreset: '30d' })
  const { dateFrom, dateTo } = dateRange
  const { data: rows = [], isLoading } = useStockMovementReport(dateFrom, dateTo)

  const additions = rows.filter((r) => !r.is_revert && r.quantity_change > 0).length
  const removals  = rows.filter((r) => !r.is_revert && r.quantity_change < 0).length
  const reverts   = rows.filter((r) => r.is_revert).length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar {...dateRange} />
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="text-green-600 font-medium">+{additions} in</span>
          <span className="text-red-600 font-medium">{removals} out</span>
          {reverts > 0 && <span className="text-muted-foreground">{reverts} undo</span>}
          <Button variant="outline" size="sm" onClick={() => { exportToCsv(`movement-${dateFrom}-to-${dateTo}`, rows.map((r) => ({ date: format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'), product: r.product_name, variant: r.variant_name, change: r.quantity_change, balance: r.balance_after, reason: r.reason, type: r.is_revert ? 'Undo' : r.quantity_change > 0 ? 'In' : 'Out' }))); }}>
            <Download className="mr-2 h-3.5 w-3.5" />CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No movements in this date range</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{`${fmtDate(new Date(r.timestamp))}, ${format(new Date(r.timestamp), 'HH:mm')}`}</TableCell>
                <TableCell className="font-medium">{r.product_name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{r.variant_name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                <TableCell className={cn('text-right font-semibold tabular-nums', r.is_revert ? 'text-muted-foreground' : r.quantity_change > 0 ? 'text-green-700' : 'text-red-700')}>
                  {r.quantity_change > 0 ? '+' : ''}{r.quantity_change}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.balance_after}</TableCell>
                <TableCell className="max-w-xs truncate text-sm">{r.reason}</TableCell>
                <TableCell>
                  {r.is_revert
                    ? <Badge variant="outline" className="text-[10px]">Undo</Badge>
                    : r.quantity_change > 0
                      ? <Badge variant="outline" className="text-[10px] border-green-200 bg-green-50 text-green-700">In</Badge>
                      : <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700">Out</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Low stock report ─────────────────────────────────────────────────────────

function LowStockReport({ products, currency }: { products: ProductWithVariants[]; currency: string }) {
  const rows = useMemo(
    () =>
      products
        .filter((p) => { const s = getStockStatus(p.product_variants); return s === 'low_stock' || s === 'out_of_stock' })
        .flatMap((p) =>
          p.product_variants
            .filter((v) => v.current_stock === 0 || (v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold))
            .map((v) => ({
              product: p.name, sku: v.sku, variant: v.name,
              current_stock: v.current_stock, threshold: v.low_stock_threshold,
              value_at_stake: v.current_stock * v.cost,
              gap: Math.max(0, v.low_stock_threshold - v.current_stock),
              status: v.current_stock === 0 ? 'out_of_stock' : 'low_stock',
            }))
        )
        .sort((a, b) => a.current_stock - b.current_stock),
    [products],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.filter((r) => r.status === 'out_of_stock').length > 0 && <span className="text-red-600 font-semibold">{rows.filter((r) => r.status === 'out_of_stock').length} out of stock · </span>}
          {rows.filter((r) => r.status === 'low_stock').length > 0 && <span className="text-yellow-600 font-semibold">{rows.filter((r) => r.status === 'low_stock').length} low stock</span>}
          {rows.length === 0 && 'All products above par level'}
        </p>
        <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={() => { exportToCsv(`low-stock-${format(new Date(), 'yyyy-MM-dd')}`, rows); }}>
          <Download className="mr-2 h-3.5 w-3.5" />CSV
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">All products are above par level ✓</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Par Level</TableHead>
              <TableHead className="text-right">Gap</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.sku}>
                <TableCell className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground text-sm"> — {r.variant}</span>}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{r.current_stock}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{r.threshold || '—'}</TableCell>
                <TableCell className="text-right text-red-600 font-medium tabular-nums">{r.gap > 0 ? `-${String(r.gap)}` : '—'}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">{r.value_at_stake > 0 ? formatCurrency(r.value_at_stake, currency) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  {r.status === 'out_of_stock'
                    ? <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700">Out of Stock</Badge>
                    : <Badge variant="outline" className="text-[10px] border-yellow-200 bg-yellow-50 text-yellow-700">Low Stock</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Overstock report ─────────────────────────────────────────────────────────

function OverstockReport({ products, currency }: { products: ProductWithVariants[]; currency: string }) {
  const rows = useMemo(
    () =>
      products
        .flatMap((p) =>
          p.product_variants
            .filter((v) => v.low_stock_threshold > 0 && v.current_stock > v.low_stock_threshold * 2)
            .map((v) => ({
              product: p.name, sku: v.sku, variant: v.name,
              current_stock: v.current_stock, threshold: v.low_stock_threshold,
              excess: v.current_stock - v.low_stock_threshold * 2,
              excess_value: (v.current_stock - v.low_stock_threshold * 2) * v.cost,
            }))
        )
        .sort((a, b) => b.excess_value - a.excess_value),
    [products],
  )

  const totalTiedCapital = rows.reduce((s, r) => s + r.excess_value, 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length > 0
            ? <><span className="font-semibold text-foreground">{formatCurrency(totalTiedCapital, currency)}</span> in tied-up capital across {String(rows.length)} variant{rows.length !== 1 ? 's' : ''}</>
            : 'No overstock detected'}
        </p>
        <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={() => { exportToCsv(`overstock-${format(new Date(), 'yyyy-MM-dd')}`, rows); }}>
          <Download className="mr-2 h-3.5 w-3.5" />CSV
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No variants exceeding 2× par level.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Par Level</TableHead>
              <TableHead className="text-right">Excess Units</TableHead>
              <TableHead className="text-right">Tied Capital</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.sku}>
                <TableCell className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground"> — {r.variant}</span>}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{r.current_stock}</TableCell>
                <TableCell className="text-right text-muted-foreground tabular-nums">{r.threshold}</TableCell>
                <TableCell className="text-right font-semibold text-blue-700 tabular-nums">+{r.excess}</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.excess_value, currency)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={5} className="font-semibold">Total tied capital</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{formatCurrency(totalTiedCapital, currency)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Location report ──────────────────────────────────────────────────────────

function LocationReport() {
  const { data: rows = [], isLoading } = useLowStockByLocation()
  const grouped = useMemo(() => {
    const map = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = row.location_path ?? '— No location assigned'
      const arr = map.get(key) ?? []
      arr.push(row)
      map.set(key, arr)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows])

  if (isLoading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
  if (rows.length === 0) return <p className="py-12 text-center text-sm text-muted-foreground">All stocked items are above par level ✓</p>

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{rows.length} variant{rows.length !== 1 ? 's' : ''} below par across locations</p>
      {grouped.map(([path, items]) => (
        <div key={path} className="space-y-2">
          <p className="text-sm font-semibold">{path}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Variant</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Par</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((r) => (
                <TableRow key={r.variant_id}>
                  <TableCell className="font-medium">{r.product_name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.variant_name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{r.current_stock}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{r.low_stock_threshold}</TableCell>
                  <TableCell>
                    {r.current_stock === 0
                      ? <Badge variant="outline" className="text-[10px] border-red-200 bg-red-50 text-red-700">Out</Badge>
                      : <Badge variant="outline" className="text-[10px] border-yellow-200 bg-yellow-50 text-yellow-700">Low</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}

// ─── Expiry report ────────────────────────────────────────────────────────────

function ExpiryReport() {
  const { data: variants = [], isLoading } = useExpiringVariants(365)
  const activeHotel = useActiveHotel()
  const currency = activeHotel?.currency ?? 'USD'
  const fmtDate = useDateFormat()

  const rows = useMemo(
    () =>
      variants
        .filter((v) => v.expiry_date)
        .map((v) => {
          const daysLeft = Math.round((new Date(v.expiry_date ?? '').setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
          return {
            product: v.products?.name ?? '—', variant: v.name, sku: v.sku,
            lot_number: v.lot_number ?? '', current_stock: v.current_stock,
            expiry_date: v.expiry_date ?? '', days_left: daysLeft,
            value_at_risk: v.current_stock * v.cost,
          }
        }),
    [variants],
  )

  if (isLoading) return <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} variant{rows.length !== 1 ? 's' : ''} with expiry in next 12 months</p>
        <Button variant="outline" size="sm" disabled={rows.length === 0} onClick={() => { exportToCsv(`expiry-${format(new Date(), 'yyyy-MM-dd')}`, rows); }}>
          <Download className="mr-2 h-3.5 w-3.5" />CSV
        </Button>
      </div>
      {rows.length === 0
        ? <p className="py-12 text-center text-sm text-muted-foreground">No variants expiring in the next 12 months.</p>
        : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Value at risk</TableHead>
                <TableHead className="text-right">Expiry</TableHead>
                <TableHead className="text-right">Days</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.sku}-${r.expiry_date}`}>
                  <TableCell className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground text-sm"> — {r.variant}</span>}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{r.lot_number || '—'}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{r.current_stock}</TableCell>
                  <TableCell className={cn('text-right tabular-nums font-semibold text-sm', r.days_left < 0 ? 'text-red-600' : r.days_left <= 30 ? 'text-orange-600' : 'text-muted-foreground')}>
                    {r.value_at_risk > 0 ? formatCurrency(r.value_at_risk, currency) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground tabular-nums">{fmtDate(new Date(r.expiry_date))}</TableCell>
                  <TableCell className={cn('text-right text-sm font-semibold tabular-nums', r.days_left < 0 ? 'text-red-700' : r.days_left <= 7 ? 'text-red-600' : r.days_left <= 30 ? 'text-yellow-600' : 'text-muted-foreground')}>
                    {r.days_left < 0 ? 'Expired' : r.days_left === 0 ? 'Today' : `${String(r.days_left)}d`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
    </div>
  )
}

// ─── Cost Variance Report — Mind Layer invoice matching ───────────────────────
// Surfaces every delivery where the invoice price deviated from the master cost.
// Sorted by financial impact (|variance_amount| DESC) — biggest exposures first.

function CostVarianceReport({ currency }: { currency: string }) {
  const fmtDate = useDateFormat()
  const [days, setDays] = useState<30 | 60 | 90>(90)
  const { data = [], isLoading } = useCostVarianceReport(days)

  const totalOvercharge = data.reduce((s, r) => s + (r.variance_amount ?? 0), 0)
  const overchargeCount = data.filter((r) => (r.variance_amount ?? 0) > 0).length
  const discountCount   = data.filter((r) => (r.variance_amount ?? 0) < 0).length

  const sym = getCurrencySymbol(currency)

  return (
    <div className="space-y-4">
      {/* Header + controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Cost Variance — Invoice Matching</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Deliveries where the invoice price deviated from the master unit cost. Positive = overcharged.
          </p>
        </div>
        <div className="flex rounded-lg border overflow-hidden text-xs">
          {([30, 60, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => { setDays(d) }}
              className={cn(
                'px-3 py-1.5 font-medium transition-colors',
                days === d ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className={cn('rounded-lg border p-3', totalOvercharge > 0 ? 'border-red-200 bg-red-50 dark:bg-red-950/20' : 'border-green-200 bg-green-50 dark:bg-green-950/20')}>
            <p className="text-xs text-muted-foreground">Net exposure</p>
            <p className={cn('text-lg font-bold tabular-nums', totalOvercharge > 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400')}>
              {totalOvercharge >= 0 ? '+' : ''}{sym}{Math.abs(totalOvercharge).toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{data.length} lines recorded</p>
          </div>
          <div className="rounded-lg border p-3 border-red-200 bg-red-50 dark:bg-red-950/20">
            <p className="text-xs text-muted-foreground">Overcharged</p>
            <p className="text-lg font-bold tabular-nums text-red-700 dark:text-red-400">{overchargeCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">deliveries above expected</p>
          </div>
          <div className="rounded-lg border p-3 border-green-200 bg-green-50 dark:bg-green-950/20">
            <p className="text-xs text-muted-foreground">Discounts received</p>
            <p className="text-lg font-bold tabular-nums text-green-700 dark:text-green-400">{discountCount}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">deliveries below expected</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-14 text-center">
          <Receipt className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="font-medium text-sm">No cost data recorded yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Enter the invoice unit cost when receiving stock to start tracking price variances.
              When receiving in <strong>Restocks → Approved → Receive</strong>, enter the invoice unit cost.
            </p>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Expected</TableHead>
              <TableHead className="text-right">Invoice</TableHead>
              <TableHead className="text-right">Δ%</TableHead>
              <TableHead className="text-right">Impact</TableHead>
              <TableHead className="text-right">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => {
              const pct    = r.variance_pct ?? 0
              const impact = r.variance_amount ?? 0
              const isOver = impact > 0
              const pctColor = Math.abs(pct) <= 2
                ? 'text-muted-foreground'
                : isOver
                  ? Math.abs(pct) > 10 ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-yellow-600 dark:text-yellow-400'
                  : 'text-green-600 dark:text-green-400'
              return (
                <TableRow key={r.receive_id}>
                  <TableCell className="font-medium">
                    {r.product_name}
                    {r.variant_name && r.variant_name !== 'Standard' && (
                      <span className="text-muted-foreground text-sm"> — {r.variant_name}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{r.sku}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.supplier}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{r.quantity_received}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{sym}{r.unit_cost_expected.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{sym}{r.unit_cost_actual.toFixed(2)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums text-sm', pctColor)}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </TableCell>
                  <TableCell className={cn('text-right tabular-nums font-semibold text-sm', impact > 0 ? 'text-red-600 dark:text-red-400' : impact < 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                    {impact >= 0 ? '+' : ''}{sym}{Math.abs(impact).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {fmtDate(new Date(r.received_at))}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </div>
  )
}

// ─── Report nav config ────────────────────────────────────────────────────────

interface ReportItem {
  id: string
  label: string
  icon: React.ElementType
}

interface ReportGroup {
  label: string
  icon: React.ElementType
  dotColor: string
  items: ReportItem[]
}

const REPORT_GROUPS: ReportGroup[] = [
  {
    label: 'Stock',
    icon: Package,
    dotColor: 'bg-blue-500',
    items: [
      { id: 'valuation',  label: 'Valuation',   icon: BarChart2     },
      { id: 'lowstock',   label: 'Low Stock',    icon: AlertTriangle },
      { id: 'overstock',  label: 'Overstock',    icon: TrendingUp    },
    ],
  },
  {
    label: 'Activity',
    icon: Activity,
    dotColor: 'bg-purple-500',
    items: [
      { id: 'consumption', label: 'Consumption',    icon: TrendingDown    },
      { id: 'movement',    label: 'Movement Log',   icon: ArrowLeftRight  },
      { id: 'waste',       label: 'Waste & Loss',   icon: Flame           },
    ],
  },
  {
    label: 'Risk',
    icon: AlertTriangle,
    dotColor: 'bg-yellow-500',
    items: [
      { id: 'expiry',      label: 'Expiry',       icon: CalendarX2 },
      { id: 'by-location', label: 'By Location',  icon: MapPin     },
    ],
  },
  {
    label: 'Intelligence',
    icon: EyeIcon,
    dotColor: 'bg-orange-500',
    items: [
      { id: 'forecast',   label: 'Forecast',          icon: TrendingDown },
      { id: 'anomalies',  label: 'Anomalies',          icon: Zap          },
    ],
  },
  {
    label: 'Finance',
    icon: Brain,
    dotColor: 'bg-purple-600',
    items: [
      { id: 'procurement',   label: 'Procurement',    icon: Truck      },
      { id: 'cost-variance', label: 'Cost Variance',  icon: Receipt    },
      { id: 'finance',       label: 'Finance',         icon: DollarSign },
    ],
  },
]

const REPORT_META: Record<string, { title: string; desc: string }> = {
  'valuation':    { title: 'Inventory Valuation',        desc: 'Current stock value by product, sorted by total value. Export for balance sheet.' },
  'lowstock':     { title: 'Low Stock',                  desc: 'Variants below par level ranked by urgency. Critical items at the top.' },
  'overstock':    { title: 'Overstock',                  desc: 'Capital tied up above 2× par level — potential cash to release.' },
  'consumption':  { title: 'Consumption',                desc: 'Where is money going and at what rate? Sorted by cost impact for the selected period.' },
  'movement':     { title: 'Movement Log',               desc: 'Complete immutable audit trail of every stock change. Every in, out, and correction.' },
  'waste':        { title: 'Waste & Loss',               desc: 'Removals categorised as waste — spoilage, breakage, theft. Cost impact vs prior period.' },
  'expiry':       { title: 'Expiry Risk',                desc: 'Variants expiring within 12 months, sorted by value at risk.' },
  'by-location':  { title: 'Stock by Location',          desc: 'Variants below par level grouped by storage location.' },
  'forecast':     { title: 'Depletion Forecast',         desc: 'Days until stockout per variant based on 30-day rolling consumption. One-click restock.' },
  'anomalies':    { title: 'Anomaly Detection',          desc: 'Dead stock and consumption spikes flagged by the intelligence engine.' },
  'procurement':  { title: 'Procurement Intelligence',   desc: 'Supplier spend, fulfillment rates, and lead times from restock history.' },
  'cost-variance':{ title: 'Cost Variance',              desc: 'Every delivery where invoice price deviated from expected. Overcharges surface first.' },
  'finance':      { title: 'Finance Overview',           desc: 'Revenue attribution, margin analysis, and P&L contribution.' },
}

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'valuation'

  const currency = useCurrency()

  const { data: products = [], isLoading: productsLoading } = useProducts()

  // MTD and prior period for Executive Strip
  const today     = format(new Date(), 'yyyy-MM-dd')
  const mtdFrom   = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const priorFrom = format(startOfMonth(new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)), 'yyyy-MM-dd')
  const priorTo   = format(new Date(new Date().getFullYear(), new Date().getMonth(), 0), 'yyyy-MM-dd')

  const { data: mtdMovements   = [] } = useStockMovementReport(mtdFrom,   today)
  const { data: priorMovements = [] } = useStockMovementReport(priorFrom, priorTo)

  const meta = REPORT_META[activeTab] ?? { title: activeTab, desc: '' }

  const setTab = (id: string) => { setSearchParams({ tab: id }) }

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b px-8 pt-5 pb-0">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-semibold">Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Operations intelligence — consumption, waste, valuation, and forecast
            </p>
          </div>
        </div>

        {/* Executive KPI strip */}
        {!productsLoading && (
          <ExecutiveStrip
            products={products}
            mtdMovements={mtdMovements}
            priorMovements={priorMovements}
            currency={currency}
          />
        )}
      </div>

      {/* ── Split pane ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left sidebar navigation */}
        <nav className="w-44 flex-shrink-0 border-r overflow-y-auto px-3 py-4 space-y-5">
          {REPORT_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-1 flex items-center gap-1.5 px-2">
                <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', group.dotColor)} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {group.label}
                </p>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = activeTab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => { setTab(item.id) }}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate text-xs">{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Report content */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-8 py-6">
            {/* Report header */}
            <div className="mb-6 pb-4 border-b">
              <h2 className="text-base font-semibold">{meta.title}</h2>
              {meta.desc && (
                <p className="mt-0.5 text-sm text-muted-foreground">{meta.desc}</p>
              )}
            </div>

            {/* Report body */}
            {activeTab === 'valuation'    && <ValuationReport products={products} currency={currency} />}
            {activeTab === 'lowstock'     && <LowStockReport products={products} currency={currency} />}
            {activeTab === 'overstock'    && <OverstockReport products={products} currency={currency} />}
            {activeTab === 'consumption'  && <ConsumptionReport products={products} currency={currency} />}
            {activeTab === 'movement'     && <StockMovementReport />}
            {activeTab === 'waste'        && <WasteReport products={products} currency={currency} />}
            {activeTab === 'expiry'       && <ExpiryReport />}
            {activeTab === 'by-location'  && <LocationReport />}
            {activeTab === 'forecast'     && <ForecastReport />}
            {activeTab === 'anomalies'    && <AnomalyFeed />}
            {activeTab === 'procurement'  && <ProcurementInsights />}
            {activeTab === 'cost-variance'&& <CostVarianceReport currency={currency} />}
            {activeTab === 'finance'      && (
              <Suspense fallback={
                <div className="flex h-40 items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              }>
                <FinanceTab />
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
