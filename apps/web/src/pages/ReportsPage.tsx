// Layer: Eye + Mind — Intelligence reports
// Palantir principle: a manager should open this page and immediately know
// the state of the world — not hunt through tabs to assemble the picture.
// Every number carries trend context. Every table answers "so what?"
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo, lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, subDays, startOfMonth } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import {
  Button,
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
import { useActiveHotel } from '@/features/hotel/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency, getCurrencySymbol } from '@/lib/currency'
import { useDateRange, DateRangeBar } from '@/components/DateRangeBar'
import { Trend } from '@/components/Trend'
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

  const kpis: { label: string; value: string; sub: React.ReactNode; icon: IconName; color: string; bg: string }[] = [
    {
      label: 'Inventory Value',
      value: formatCurrency(totalValue, currency),
      sub: `${String(products.length)} products`,
      icon: 'box',
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Consumed MTD',
      value: formatCurrency(mtdConsumed, currency),
      sub: <Trend current={mtdConsumed} prior={priorConsumed} />,
      icon: 'pulse',
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      label: 'Waste Cost MTD',
      value: formatCurrency(mtdWaste, currency),
      sub: <Trend current={mtdWaste} prior={priorWaste} invertColor />,
      icon: 'trending-down',
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-950/30',
    },
    {
      label: 'Needs Attention',
      value: String(outOfStock + lowStock),
      sub: `${String(outOfStock)} out · ${String(lowStock)} low`,
      icon: 'warning-sign',
      color: outOfStock > 0 ? 'text-red-600 dark:text-red-400' : lowStock > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600',
      bg: outOfStock > 0 ? 'bg-red-50 dark:bg-red-950/30' : lowStock > 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : 'bg-green-50 dark:bg-green-950/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {kpis.map(({ label, value, sub, icon, color, bg }) => (
        <div key={label} className="rounded-lg border bg-card p-4 flex items-start gap-3">
          <div className={cn('rounded-md p-2 shrink-0', bg)}>
            <Icon icon={icon} size={16} className={color} />
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
          <Button
            size="small"
            variant="outlined"
            icon="download"
            onClick={() => { exportToCsv(`valuation-${format(new Date(), 'yyyy-MM-dd')}`, rows.map((r) => ({ ...r, unit_cost: r.unit_cost.toFixed(2), total_value: r.total_value.toFixed(2) }))) }}
          >
            CSV
          </Button>
          <Button
            size="small"
            variant="outlined"
            icon="document"
            onClick={() => { exportToPdf(`Inventory Valuation ${format(new Date(), 'yyyy-MM-dd')}`, ['Product', 'SKU', 'Variant', 'Category', 'Stock', `Unit Cost (${sym})`, `Total (${sym})`], rows.map((r) => [r.product, r.sku, r.variant, r.category, r.stock, r.unit_cost.toFixed(2), r.total_value.toFixed(2)])) }}
          >
            PDF
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

      <HTMLTable interactive className="w-full">
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Variant</th>
            <th>Category</th>
            <th className="text-right">Stock</th>
            <th className="text-right">Par Level</th>
            <th className="text-right">Unit Cost</th>
            <th className="text-right">Total Value</th>
            <th>Health</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.sku}>
              <td className="font-medium">{r.product}</td>
              <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
              <td className="text-muted-foreground text-sm">{r.variant}</td>
              <td className="text-sm text-muted-foreground">{r.category}</td>
              <td className="text-right font-semibold tabular-nums">{r.stock}</td>
              <td className="text-right text-muted-foreground text-sm tabular-nums">{r.threshold > 0 ? r.threshold : '—'}</td>
              <td className="text-right text-sm text-muted-foreground tabular-nums">{sym}{r.unit_cost.toFixed(2)}</td>
              <td className="text-right font-semibold tabular-nums">{sym}{r.total_value.toFixed(2)}</td>
              <td>
                {r.health === 0 && <Tag minimal intent={Intent.DANGER} className="!text-[10px]">Out</Tag>}
                {r.health === 1 && <Tag minimal intent={Intent.WARNING} className="!text-[10px]">Low</Tag>}
                {r.health === 3 && <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">Overstock</Tag>}
                {r.health === 2 && <span className="text-[10px] text-green-600">OK</span>}
              </td>
            </tr>
          ))}
          {rows.length > 0 && (
            <tr className="bg-muted/50">
              <td colSpan={7} className="font-semibold">Grand Total</td>
              <td className="text-right font-bold tabular-nums">{formatCurrency(grandTotal, currency)}</td>
              <td />
            </tr>
          )}
        </tbody>
      </HTMLTable>
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

  const removals = useMemo(
    () => rows.filter((r) => !r.is_revert && r.quantity_change < 0),
    [rows],
  )

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

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
    </div>
  )

  if (removals.length === 0) return (
    <NonIdealState
      icon="pulse"
      title="No stock removals in this period."
      description='Stock removals are recorded via "Adjust Stock" or the Scan page.'
    />
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
          <Button
            size="small"
            variant="outlined"
            icon="download"
            onClick={() => { exportToCsv(`consumption-${dateFrom}-to-${dateTo}`, byProduct.map((r) => ({ ...r, cost: r.cost.toFixed(2), daily_cost: r.daily_cost.toFixed(2), daily_units: r.daily_units.toFixed(2) }))) }}
          >
            CSV
          </Button>
        </div>
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th className="text-right">Units consumed</th>
              <th className="text-right">Cost consumed</th>
              <th className="text-right">Daily rate</th>
            </tr>
          </thead>
          <tbody>
            {byProduct.map((r) => (
              <tr key={r.sku}>
                <td className="font-medium">
                  {r.product}
                  {r.variant !== 'Standard' && <span className="text-muted-foreground"> — {r.variant}</span>}
                </td>
                <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className="text-sm text-muted-foreground">{r.category ?? '—'}</td>
                <td className="text-right tabular-nums">{r.units}</td>
                <td className="text-right font-semibold tabular-nums">{formatCurrency(r.cost, currency)}</td>
                <td className="text-right text-sm text-muted-foreground tabular-nums">
                  {formatCurrency(r.daily_cost, currency)}/d
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
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

  const { data: wasteEvents = [], isLoading } = useWasteReport(dateFrom, dateTo)

  const periodDays = useMemo(() => {
    const d1 = new Date(dateFrom)
    const d2 = new Date(dateTo)
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
  }, [dateFrom, dateTo])
  const priorFrom = format(subDays(new Date(dateFrom), periodDays), 'yyyy-MM-dd')
  const priorTo   = format(subDays(new Date(dateFrom), 1), 'yyyy-MM-dd')
  const { data: priorRows = [] } = useStockMovementReport(priorFrom, priorTo)

  const { data: teamMembers = [] } = useTeamMembers()
  const { data: suppliers = [] }   = useSuppliers()

  const costMap = useMemo(() => buildCostMap(products), [products])

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

  const dowCosts = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]
    for (const r of wasteRows) {
      totals[new Date(r.timestamp).getDay()] += rowCost(r, costMap)
    }
    return totals
  }, [wasteRows, costMap])
  const dowMax = Math.max(...dowCosts, 0.01)

  const suppliersMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  )
  const variantSupplierMap = useMemo(() => {
    const map = new Map<string, string>()
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
        <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
        </div>
      ) : wasteRows.length === 0 ? (
        <NonIdealState
          icon="flame"
          title="No categorised removals in this period."
          description="Categorised removals are recorded when you select a removal reason (Spoilage, Breakage, etc.) during stock adjustment."
        />
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
              <Button
                size="small"
                variant="outlined"
                icon="download"
                onClick={() => { exportToCsv(`waste-${dateFrom}-to-${dateTo}`, wasteRows.map((r) => ({ date: format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'), product: r.product_name, variant: r.variant_name, units: Math.abs(r.quantity_change), cost: rowCost(r, costMap).toFixed(2), category: r.removal_category }))) }}
              >
                CSV
              </Button>
            </div>
            <HTMLTable interactive className="w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">Cost</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {wasteRows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs text-muted-foreground whitespace-nowrap">
                      {`${fmtDate(new Date(r.timestamp))}, ${format(new Date(r.timestamp), 'HH:mm')}`}
                    </td>
                    <td className="text-sm">{r.product_name}</td>
                    <td className="text-right font-semibold text-red-700 tabular-nums">
                      {r.quantity_change}
                    </td>
                    <td className="text-right tabular-nums text-sm font-medium">
                      {formatCurrency(rowCost(r, costMap), currency)}
                    </td>
                    <td className="text-xs">{r.removal_category}</td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </div>
        </div>
        {/* ── end 2-col grid ── */}

        {/* ── Cross-domain synthesis ──────────────────────────────────────── */}
        <div>
          <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Icon icon="flash" size={14} className="text-muted-foreground" />
            Cross-domain signals
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Operator breakdown */}
            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b">
                <Icon icon="people" size={14} className="text-muted-foreground" />
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
                <Icon icon="calendar" size={14} className="text-muted-foreground" />
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
                <Icon icon="truck" size={14} className="text-muted-foreground" />
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
          <Button
            size="small"
            variant="outlined"
            icon="download"
            onClick={() => { exportToCsv(`movement-${dateFrom}-to-${dateTo}`, rows.map((r) => ({ date: format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'), product: r.product_name, variant: r.variant_name, change: r.quantity_change, balance: r.balance_after, reason: r.reason, type: r.is_revert ? 'Undo' : r.quantity_change > 0 ? 'In' : 'Out' }))) }}
          >
            CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
        </div>
      ) : rows.length === 0 ? (
        <NonIdealState icon="swap-horizontal" title="No movements in this date range" />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Variant</th>
              <th>SKU</th>
              <th className="text-right">Change</th>
              <th className="text-right">Balance</th>
              <th>Reason</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="text-sm text-muted-foreground whitespace-nowrap">{`${fmtDate(new Date(r.timestamp))}, ${format(new Date(r.timestamp), 'HH:mm')}`}</td>
                <td className="font-medium">{r.product_name}</td>
                <td className="text-muted-foreground text-sm">{r.variant_name}</td>
                <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className={cn('text-right font-semibold tabular-nums', r.is_revert ? 'text-muted-foreground' : r.quantity_change > 0 ? 'text-green-700' : 'text-red-700')}>
                  {r.quantity_change > 0 ? '+' : ''}{r.quantity_change}
                </td>
                <td className="text-right tabular-nums">{r.balance_after}</td>
                <td className="max-w-xs truncate text-sm">{r.reason}</td>
                <td>
                  {r.is_revert
                    ? <Tag minimal className="!text-[10px]">Undo</Tag>
                    : r.quantity_change > 0
                      ? <Tag minimal intent={Intent.SUCCESS} className="!text-[10px]">In</Tag>
                      : <Tag minimal intent={Intent.DANGER} className="!text-[10px]">Out</Tag>}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
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
        <Button
          size="small"
          variant="outlined"
          icon="download"
          disabled={rows.length === 0}
          onClick={() => { exportToCsv(`low-stock-${format(new Date(), 'yyyy-MM-dd')}`, rows) }}
        >
          CSV
        </Button>
      </div>
      {rows.length === 0 ? (
        <NonIdealState icon="tick-circle" title="All products are above par level" />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Par Level</th>
              <th className="text-right">Gap</th>
              <th className="text-right">Stock Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sku}>
                <td className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground text-sm"> — {r.variant}</span>}</td>
                <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className="text-right font-semibold tabular-nums">{r.current_stock}</td>
                <td className="text-right text-muted-foreground tabular-nums">{r.threshold || '—'}</td>
                <td className="text-right text-red-600 font-medium tabular-nums">{r.gap > 0 ? `-${String(r.gap)}` : '—'}</td>
                <td className="text-right tabular-nums text-sm">{r.value_at_stake > 0 ? formatCurrency(r.value_at_stake, currency) : <span className="text-muted-foreground">—</span>}</td>
                <td>
                  {r.status === 'out_of_stock'
                    ? <Tag minimal intent={Intent.DANGER} className="!text-[10px]">Out of Stock</Tag>
                    : <Tag minimal intent={Intent.WARNING} className="!text-[10px]">Low Stock</Tag>}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
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
        <Button
          size="small"
          variant="outlined"
          icon="download"
          disabled={rows.length === 0}
          onClick={() => { exportToCsv(`overstock-${format(new Date(), 'yyyy-MM-dd')}`, rows) }}
        >
          CSV
        </Button>
      </div>
      {rows.length === 0 ? (
        <NonIdealState icon="trending-up" title="No variants exceeding 2× par level." />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Par Level</th>
              <th className="text-right">Excess Units</th>
              <th className="text-right">Tied Capital</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.sku}>
                <td className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground"> — {r.variant}</span>}</td>
                <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                <td className="text-right font-semibold tabular-nums">{r.current_stock}</td>
                <td className="text-right text-muted-foreground tabular-nums">{r.threshold}</td>
                <td className="text-right font-semibold text-blue-700 tabular-nums">+{r.excess}</td>
                <td className="text-right font-semibold tabular-nums">{formatCurrency(r.excess_value, currency)}</td>
              </tr>
            ))}
            <tr className="bg-muted/50">
              <td colSpan={5} className="font-semibold">Total tied capital</td>
              <td className="text-right font-bold tabular-nums">{formatCurrency(totalTiedCapital, currency)}</td>
            </tr>
          </tbody>
        </HTMLTable>
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

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
    </div>
  )
  if (rows.length === 0) return <NonIdealState icon="tick-circle" title="All stocked items are above par level" />

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{rows.length} variant{rows.length !== 1 ? 's' : ''} below par across locations</p>
      {grouped.map(([path, items]) => (
        <div key={path} className="space-y-2">
          <p className="text-sm font-semibold">{path}</p>
          <HTMLTable interactive className="w-full">
            <thead>
              <tr>
                <th>Product</th>
                <th>Variant</th>
                <th>SKU</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Par</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.variant_id}>
                  <td className="font-medium">{r.product_name}</td>
                  <td className="text-muted-foreground">{r.variant_name}</td>
                  <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="text-right font-semibold tabular-nums">{r.current_stock}</td>
                  <td className="text-right text-muted-foreground tabular-nums">{r.low_stock_threshold}</td>
                  <td>
                    {r.current_stock === 0
                      ? <Tag minimal intent={Intent.DANGER} className="!text-[10px]">Out</Tag>
                      : <Tag minimal intent={Intent.WARNING} className="!text-[10px]">Low</Tag>}
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
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

  if (isLoading) return (
    <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rows.length} variant{rows.length !== 1 ? 's' : ''} with expiry in next 12 months</p>
        <Button
          size="small"
          variant="outlined"
          icon="download"
          disabled={rows.length === 0}
          onClick={() => { exportToCsv(`expiry-${format(new Date(), 'yyyy-MM-dd')}`, rows) }}
        >
          CSV
        </Button>
      </div>
      {rows.length === 0
        ? <NonIdealState icon="calendar" title="No variants expiring in the next 12 months." />
        : (
          <HTMLTable interactive className="w-full">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Lot</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Value at risk</th>
                <th className="text-right">Expiry</th>
                <th className="text-right">Days</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.sku}-${r.expiry_date}`}>
                  <td className="font-medium">{r.product}{r.variant !== 'Standard' && <span className="text-muted-foreground text-sm"> — {r.variant}</span>}</td>
                  <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="text-muted-foreground text-sm">{r.lot_number || '—'}</td>
                  <td className="text-right font-semibold tabular-nums">{r.current_stock}</td>
                  <td className={cn('text-right tabular-nums font-semibold text-sm', r.days_left < 0 ? 'text-red-600' : r.days_left <= 30 ? 'text-orange-600' : 'text-muted-foreground')}>
                    {r.value_at_risk > 0 ? formatCurrency(r.value_at_risk, currency) : '—'}
                  </td>
                  <td className="text-right text-sm text-muted-foreground tabular-nums">{fmtDate(new Date(r.expiry_date))}</td>
                  <td className={cn('text-right text-sm font-semibold tabular-nums', r.days_left < 0 ? 'text-red-700' : r.days_left <= 7 ? 'text-red-600' : r.days_left <= 30 ? 'text-yellow-600' : 'text-muted-foreground')}>
                    {r.days_left < 0 ? 'Expired' : r.days_left === 0 ? 'Today' : `${String(r.days_left)}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
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
        <SegmentedControl
          options={[
            { value: '30', label: '30d' },
            { value: '60', label: '60d' },
            { value: '90', label: '90d' },
          ]}
          value={String(days)}
          onValueChange={(v) => { setDays(Number(v) as 30 | 60 | 90) }}
          size="small"
        />
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
          <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
        </div>
      ) : data.length === 0 ? (
        <NonIdealState
          icon="manual"
          title="No cost data recorded yet"
          description={
            <>
              Enter the invoice unit cost when receiving stock to start tracking price variances.
              When receiving in <strong>Restocks → Approved → Receive</strong>, enter the invoice unit cost.
            </>
          }
        />
      ) : (
        <HTMLTable interactive className="w-full">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Supplier</th>
              <th className="text-right">Received</th>
              <th className="text-right">Expected</th>
              <th className="text-right">Invoice</th>
              <th className="text-right">Δ%</th>
              <th className="text-right">Impact</th>
              <th className="text-right">Date</th>
            </tr>
          </thead>
          <tbody>
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
                <tr key={r.receive_id}>
                  <td className="font-medium">
                    {r.product_name}
                    {r.variant_name && r.variant_name !== 'Standard' && (
                      <span className="text-muted-foreground text-sm"> — {r.variant_name}</span>
                    )}
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">{r.sku}</td>
                  <td className="text-sm text-muted-foreground">{r.supplier}</td>
                  <td className="text-right tabular-nums text-sm">{r.quantity_received}</td>
                  <td className="text-right tabular-nums text-sm">{sym}{r.unit_cost_expected.toFixed(2)}</td>
                  <td className="text-right tabular-nums text-sm">{sym}{r.unit_cost_actual.toFixed(2)}</td>
                  <td className={cn('text-right tabular-nums text-sm', pctColor)}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </td>
                  <td className={cn('text-right tabular-nums font-semibold text-sm', impact > 0 ? 'text-red-600 dark:text-red-400' : impact < 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground')}>
                    {impact >= 0 ? '+' : ''}{sym}{Math.abs(impact).toFixed(2)}
                  </td>
                  <td className="text-right text-xs text-muted-foreground tabular-nums">
                    {fmtDate(new Date(r.received_at))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </HTMLTable>
      )}
    </div>
  )
}

// ─── Report nav config ────────────────────────────────────────────────────────

interface ReportItem {
  id: string
  label: string
  icon: IconName
}

interface ReportGroup {
  label: string
  icon: IconName
  dotColor: string
  items: ReportItem[]
}

const REPORT_GROUPS: ReportGroup[] = [
  {
    label: 'Stock',
    icon: 'box',
    dotColor: 'bg-blue-500',
    items: [
      { id: 'valuation',  label: 'Valuation',   icon: 'chart'         },
      { id: 'lowstock',   label: 'Low Stock',    icon: 'warning-sign' },
      { id: 'overstock',  label: 'Overstock',    icon: 'trending-up'  },
    ],
  },
  {
    label: 'Activity',
    icon: 'pulse',
    dotColor: 'bg-purple-500',
    items: [
      { id: 'consumption', label: 'Consumption',    icon: 'trending-down'  },
      { id: 'movement',    label: 'Movement Log',   icon: 'swap-horizontal' },
      { id: 'waste',       label: 'Waste & Loss',   icon: 'flame'          },
    ],
  },
  {
    label: 'Risk',
    icon: 'warning-sign',
    dotColor: 'bg-yellow-500',
    items: [
      { id: 'expiry',      label: 'Expiry',       icon: 'calendar' },
      { id: 'by-location', label: 'By Location',  icon: 'map-marker' },
    ],
  },
  {
    label: 'Intelligence',
    icon: 'eye-open',
    dotColor: 'bg-orange-500',
    items: [
      { id: 'forecast',   label: 'Forecast',          icon: 'trending-down' },
      { id: 'anomalies',  label: 'Anomalies',          icon: 'flash'        },
    ],
  },
  {
    label: 'Finance',
    icon: 'lightbulb',
    dotColor: 'bg-purple-600',
    items: [
      { id: 'procurement',   label: 'Procurement',    icon: 'truck'   },
      { id: 'cost-variance', label: 'Cost Variance',  icon: 'manual'  },
      { id: 'finance',       label: 'Finance',         icon: 'dollar' },
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
                      <Icon icon={item.icon} size={12} className="flex-shrink-0" />
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
                  <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
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
