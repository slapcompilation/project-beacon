// Layer: Eye (COGS intelligence + variance detection) · Mind (margin strategy)
// F&B Intelligence — answers two questions:
//   1. What does each dish actually cost to make? (COGS per serve)
//   2. Where is stock disappearing faster than POS explains? (variance = theft/waste)
// Palantir principle: cross-domain synthesis — POS + stock + cost history = situational picture.

import { useState } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, Loader2,
  UtensilsCrossed, ShieldAlert, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCOGSByItem, usePOSVariance } from '@/features/fb/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import type { COGSByItemRow, POSVarianceRow } from '@beacon/types'

// ─── Window controls ──────────────────────────────────────────────────────────

const COGS_WINDOWS     = [7, 30, 90] as const
const VARIANCE_WINDOWS = [7, 30, 90] as const
const VARIANCE_THRESHOLDS = [10, 15, 20, 30] as const

// ─── Margin color ─────────────────────────────────────────────────────────────

function marginColor(pct: number | null): string {
  if (pct === null) return 'text-muted-foreground'
  if (pct >= 70)    return 'text-green-600 dark:text-green-400'
  if (pct >= 50)    return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

// ─── COGS table ───────────────────────────────────────────────────────────────

function COGSTable({
  rows,
  currency,
}: {
  rows:     COGSByItemRow[]
  currency: string
}) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? rows : rows.slice(0, 20)

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <UtensilsCrossed className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No POS sales in this window</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs leading-relaxed">
          COGS data appears once POS sales are ingested and menu items have ingredient mappings.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            <th className="py-2.5 px-4 text-left">Menu item</th>
            <th className="py-2.5 px-3 text-right">Qty sold</th>
            <th className="py-2.5 px-3 text-right">Cost/serve</th>
            <th className="py-2.5 px-3 text-right">Sell price</th>
            <th className="py-2.5 px-3 text-right">Margin</th>
            <th className="py-2.5 px-4 text-right">Total COGS</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((row) => (
            <tr key={row.menu_item_id} className="border-b hover:bg-muted/20 transition-colors">
              <td className="py-2.5 px-4">
                <p className="text-sm font-medium">{row.name}</p>
                {row.category && (
                  <p className="text-[10px] text-muted-foreground">{row.category}</p>
                )}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-sm">
                {row.qty_sold > 0 ? row.qty_sold.toFixed(0) : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-sm font-medium">
                {row.avg_cost_per_serve > 0
                  ? formatCurrency(row.avg_cost_per_serve, currency)
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-sm text-muted-foreground">
                {row.sell_price != null
                  ? formatCurrency(row.sell_price, currency)
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums text-sm">
                {row.margin_pct != null ? (
                  <span className={cn('font-semibold', marginColor(row.margin_pct))}>
                    {row.margin_pct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-muted-foreground/40 text-xs">no price</span>
                )}
              </td>
              <td className="py-2.5 px-4 text-right tabular-nums text-sm font-semibold">
                {row.total_ingredient_cost > 0
                  ? formatCurrency(row.total_ingredient_cost, currency)
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 20 && (
        <div className="border-t px-4 py-2 bg-muted/20">
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => { setShowAll((v) => !v) }}
          >
            {showAll ? 'Show fewer' : `Show all ${String(rows.length)} items`}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── COGS summary strip ───────────────────────────────────────────────────────

function COGSSummary({ rows, currency }: { rows: COGSByItemRow[]; currency: string }) {
  const totalCOGS      = rows.reduce((s, r) => s + r.total_ingredient_cost, 0)
  const totalItems     = rows.filter((r) => r.qty_sold > 0).length
  const avgMargin      = (() => {
    const withMargin = rows.filter((r) => r.margin_pct != null)
    if (!withMargin.length) return null
    return withMargin.reduce((s, r) => s + (r.margin_pct ?? 0), 0) / withMargin.length
  })()
  const lowestMargin   = rows.filter((r) => r.margin_pct != null && r.margin_pct < 40)

  return (
    <div className="flex items-stretch border-b flex-shrink-0">
      {[
        {
          label: 'Total COGS',
          value: formatCurrency(totalCOGS, currency),
          sub: `ingredient cost in window`,
          color: 'text-foreground',
        },
        {
          label: 'Items with sales',
          value: String(totalItems),
          sub: `of ${String(rows.length)} mapped items`,
          color: 'text-foreground',
        },
        {
          label: 'Avg margin',
          value: avgMargin != null ? `${avgMargin.toFixed(1)}%` : '—',
          sub: avgMargin != null ? 'across items with sell price' : 'add sell prices to enable',
          color: marginColor(avgMargin),
        },
        {
          label: 'Low-margin items',
          value: String(lowestMargin.length),
          sub: lowestMargin.length > 0 ? `margin < 40%` : 'all items healthy',
          color: lowestMargin.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
        },
      ].map(({ label, value, sub, color }) => (
        <div key={label} className="flex-1 px-6 py-4 border-r last:border-r-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('text-2xl font-bold tabular-nums mt-0.5', color)}>{value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Variance table ───────────────────────────────────────────────────────────

function VarianceTable({ rows }: { rows: POSVarianceRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center">
        <ShieldAlert className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No significant variance detected</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs leading-relaxed">
          Variance appears when actual stock removals exceed POS-implied consumption
          by more than the threshold. Lower the threshold to see more.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-xs font-medium text-muted-foreground">
            <th className="py-2.5 px-4 text-left">Ingredient</th>
            <th className="py-2.5 px-3 text-right">POS-implied</th>
            <th className="py-2.5 px-3 text-right">Actual used</th>
            <th className="py-2.5 px-3 text-right">Unexplained</th>
            <th className="py-2.5 px-4 text-right">Variance %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const severity = (row.variance_pct ?? 0) >= 30 ? 'high' : 'medium'
            return (
              <tr
                key={row.variant_id}
                className={cn(
                  'border-b hover:bg-muted/20 transition-colors',
                  severity === 'high' ? 'bg-red-50/30 dark:bg-red-950/10' : '',
                )}
              >
                <td className="py-2.5 px-4">
                  <p className="text-sm font-medium">
                    {row.variant_name !== 'Standard'
                      ? `${row.product_name} — ${row.variant_name}`
                      : row.product_name}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">{row.sku}</p>
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-sm text-muted-foreground">
                  {row.pos_implied_qty.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-sm font-medium">
                  {row.actual_qty.toFixed(1)}
                </td>
                <td className="py-2.5 px-3 text-right tabular-nums text-sm font-semibold">
                  <span className={severity === 'high' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}>
                    +{row.variance_qty.toFixed(1)}
                  </span>
                </td>
                <td className="py-2.5 px-4 text-right">
                  {row.variance_pct != null ? (
                    <span className={cn(
                      'inline-flex items-center gap-0.5 text-xs font-semibold',
                      severity === 'high'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-yellow-600 dark:text-yellow-400',
                    )}>
                      {severity === 'high'
                        ? <TrendingUp className="h-3 w-3" />
                        : <AlertTriangle className="h-3 w-3" />}
                      +{row.variance_pct.toFixed(1)}%
                    </span>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FBIntelligencePage() {
  const [cogsWindow,         setCogsWindow]         = useState<30 | 7 | 90>(30)
  const [varianceWindow,     setVarianceWindow]     = useState<7 | 30 | 90>(7)
  const [varianceThreshold,  setVarianceThreshold]  = useState<10 | 15 | 20 | 30>(15)
  const [activeTab,          setActiveTab]          = useState<'cogs' | 'variance'>('cogs')

  const { data: cogsRows     = [], isLoading: cogsLoading }     = useCOGSByItem(cogsWindow)
  const { data: varianceRows = [], isLoading: varianceLoading } = usePOSVariance(varianceWindow, varianceThreshold)
  const currency = useCurrency()

  const totalCOGS = cogsRows.reduce((s, r) => s + r.total_ingredient_cost, 0)

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Eye · F&B Intelligence</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {cogsLoading
              ? 'Loading…'
              : `${String(cogsRows.filter((r) => r.qty_sold > 0).length)} items sold · ${formatCurrency(totalCOGS, currency)} COGS · ${String(varianceRows.length)} variance alerts`}
          </p>
        </div>
      </div>

      {/* COGS KPI strip */}
      {!cogsLoading && activeTab === 'cogs' && (
        <COGSSummary rows={cogsRows} currency={currency} />
      )}

      {/* Tabs + window controls */}
      <div className="flex items-center gap-4 border-b px-8 flex-shrink-0">
        <div className="flex">
          {(['cogs', 'variance'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab) }}
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors border-b-2',
                activeTab === tab
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab === 'cogs' ? 'COGS by Item' : (
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Variance Feed
                  {varianceRows.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 leading-none">
                      {varianceRows.length}
                    </span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 py-2">
          {activeTab === 'cogs' && (
            <>
              <span className="text-xs text-muted-foreground">Window:</span>
              {COGS_WINDOWS.map((d) => (
                <button
                  key={d}
                  onClick={() => { setCogsWindow(d) }}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                    cogsWindow === d ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {d}d
                </button>
              ))}
            </>
          )}
          {activeTab === 'variance' && (
            <>
              <span className="text-xs text-muted-foreground">Window:</span>
              {VARIANCE_WINDOWS.map((d) => (
                <button
                  key={d}
                  onClick={() => { setVarianceWindow(d) }}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                    varianceWindow === d ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {d}d
                </button>
              ))}
              <span className="text-xs text-muted-foreground ml-2">Threshold:</span>
              {VARIANCE_THRESHOLDS.map((t) => (
                <button
                  key={t}
                  onClick={() => { setVarianceThreshold(t) }}
                  className={cn(
                    'rounded px-2 py-0.5 text-xs font-medium transition-colors',
                    varianceThreshold === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {t}%
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Methodology note */}
      <div className="flex items-center gap-2 px-8 py-2 border-b bg-muted/10 text-[11px] text-muted-foreground flex-shrink-0">
        <Info className="h-3.5 w-3.5 flex-shrink-0" />
        {activeTab === 'cogs' ? (
          <span>
            Cost per serve uses variant_cost_history at sale time · Total COGS = Σ (cost_per_serve × qty_sold) ·
            Margin = (sell_price − cost_per_serve) ÷ sell_price · sorted by total COGS descending
          </span>
        ) : (
          <span>
            Variance = actual removals − POS-implied removals · Positive = unexplained consumption (theft / waste / miscounting) ·
            Only variants wired into active menu items · threshold = minimum variance % to surface
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
        {activeTab === 'cogs' ? (
          cogsLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <COGSTable rows={cogsRows} currency={currency} />
          )
        ) : (
          varianceLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : (
            <VarianceTable rows={varianceRows} />
          )
        )}
      </div>

    </div>
  )
}
