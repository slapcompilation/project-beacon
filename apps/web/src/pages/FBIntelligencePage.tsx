// Layer: Eye (COGS intelligence + variance detection) · Mind (margin strategy)
// F&B Intelligence — answers two questions:
//   1. What does each dish actually cost to make? (COGS per serve)
//   2. Where is stock disappearing faster than POS explains? (variance = theft/waste)
// Palantir principle: cross-domain synthesis — POS + stock + cost history = situational picture.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState } from 'react'
import {
  Button,
  Callout,
  Card,
  HTMLTable,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tab,
  Tabs,
  Tag,
} from '@blueprintjs/core'
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
      <NonIdealState
        icon="menu"
        title="No POS sales in this window"
        description="COGS data appears once POS sales are ingested and menu items have ingredient mappings."
      />
    )
  }

  return (
    <Card compact className="!p-0 overflow-hidden">
      <HTMLTable compact striped interactive className="w-full">
        <thead>
          <tr>
            <th className="text-left">Menu item</th>
            <th className="text-right">Qty sold</th>
            <th className="text-right">Cost/serve</th>
            <th className="text-right">Sell price</th>
            <th className="text-right">Margin</th>
            <th className="text-right">Total COGS</th>
          </tr>
        </thead>
        <tbody>
          {displayed.map((row) => (
            <tr key={row.menu_item_id}>
              <td>
                <p className="text-sm font-medium">{row.name}</p>
                {row.category && (
                  <p className="text-[10px] text-muted-foreground">{row.category}</p>
                )}
              </td>
              <td className="text-right tabular-nums text-sm">
                {row.qty_sold > 0 ? row.qty_sold.toFixed(0) : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="text-right tabular-nums text-sm font-medium">
                {row.avg_cost_per_serve > 0
                  ? formatCurrency(row.avg_cost_per_serve, currency)
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="text-right tabular-nums text-sm text-muted-foreground">
                {row.sell_price != null
                  ? formatCurrency(row.sell_price, currency)
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
              <td className="text-right tabular-nums text-sm">
                {row.margin_pct != null ? (
                  <span className={cn('font-semibold', marginColor(row.margin_pct))}>
                    {row.margin_pct.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-muted-foreground/40 text-xs">no price</span>
                )}
              </td>
              <td className="text-right tabular-nums text-sm font-semibold">
                {row.total_ingredient_cost > 0
                  ? formatCurrency(row.total_ingredient_cost, currency)
                  : <span className="text-muted-foreground/40">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </HTMLTable>
      {rows.length > 20 && (
        <div className="border-t px-4 py-2 bg-muted/20">
          <Button variant="minimal" size="small" onClick={() => { setShowAll((v) => !v) }}>
            {showAll ? 'Show fewer' : `Show all ${String(rows.length)} items`}
          </Button>
        </div>
      )}
    </Card>
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
      <NonIdealState
        icon="shield"
        title="No significant variance detected"
        description="Variance appears when actual stock removals exceed POS-implied consumption by more than the threshold. Lower the threshold to see more."
      />
    )
  }

  return (
    <Card compact className="!p-0 overflow-hidden">
      <HTMLTable compact striped interactive className="w-full">
        <thead>
          <tr>
            <th className="text-left">Ingredient</th>
            <th className="text-right">POS-implied</th>
            <th className="text-right">Actual used</th>
            <th className="text-right">Unexplained</th>
            <th className="text-right">Variance %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const severity = (row.variance_pct ?? 0) >= 30 ? 'high' : 'medium'
            return (
              <tr
                key={row.variant_id}
                className={cn(severity === 'high' && 'bg-red-50/30 dark:bg-red-950/10')}
              >
                <td>
                  <p className="text-sm font-medium">
                    {row.variant_name !== 'Standard'
                      ? `${row.product_name} — ${row.variant_name}`
                      : row.product_name}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">{row.sku}</p>
                </td>
                <td className="text-right tabular-nums text-sm text-muted-foreground">
                  {row.pos_implied_qty.toFixed(1)}
                </td>
                <td className="text-right tabular-nums text-sm font-medium">
                  {row.actual_qty.toFixed(1)}
                </td>
                <td className="text-right tabular-nums text-sm font-semibold">
                  <span className={severity === 'high' ? 'text-red-600 dark:text-red-400' : 'text-yellow-600 dark:text-yellow-400'}>
                    +{row.variance_qty.toFixed(1)}
                  </span>
                </td>
                <td className="text-right">
                  {row.variance_pct != null ? (
                    <Tag
                      icon={severity === 'high' ? 'trending-up' : 'warning-sign'}
                      intent={severity === 'high' ? Intent.DANGER : Intent.WARNING}
                      minimal
                    >
                      +{row.variance_pct.toFixed(1)}%
                    </Tag>
                  ) : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </HTMLTable>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FBIntelligencePage() {
  const [cogsWindow,         setCogsWindow]         = useState<7 | 30 | 90>(30)
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
          <h1 className="text-xl font-semibold">Insights · F&amp;B Intelligence</h1>
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
        <Tabs
          id="fb-tabs"
          selectedTabId={activeTab}
          onChange={(v) => { setActiveTab(v as 'cogs' | 'variance') }}
        >
          <Tab id="cogs" title="COGS by Item" />
          <Tab
            id="variance"
            title={
              <span className="flex items-center gap-1.5">
                <Icon icon="trending-down" size={14} />
                Variance Feed
                {varianceRows.length > 0 && (
                  <Tag intent={Intent.DANGER} round className="ml-0.5">
                    {String(varianceRows.length)}
                  </Tag>
                )}
              </span>
            }
          />
        </Tabs>

        <div className="ml-auto flex items-center gap-2 py-2">
          {activeTab === 'cogs' && (
            <>
              <span className="text-xs text-muted-foreground">Window:</span>
              <SegmentedControl
                size="small"
                value={String(cogsWindow)}
                onValueChange={(v) => { setCogsWindow(parseInt(v, 10) as 7 | 30 | 90) }}
                options={COGS_WINDOWS.map((d) => ({ value: String(d), label: `${String(d)}d` }))}
              />
            </>
          )}
          {activeTab === 'variance' && (
            <>
              <span className="text-xs text-muted-foreground">Window:</span>
              <SegmentedControl
                size="small"
                value={String(varianceWindow)}
                onValueChange={(v) => { setVarianceWindow(parseInt(v, 10) as 7 | 30 | 90) }}
                options={VARIANCE_WINDOWS.map((d) => ({ value: String(d), label: `${String(d)}d` }))}
              />
              <span className="text-xs text-muted-foreground ml-2">Threshold:</span>
              <SegmentedControl
                size="small"
                value={String(varianceThreshold)}
                onValueChange={(v) => { setVarianceThreshold(parseInt(v, 10) as 10 | 15 | 20 | 30) }}
                options={VARIANCE_THRESHOLDS.map((t) => ({ value: String(t), label: `${String(t)}%` }))}
              />
            </>
          )}
        </div>
      </div>

      {/* Methodology note */}
      <Callout icon="info-sign" compact className="!border-x-0 !rounded-none">
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
      </Callout>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
        {activeTab === 'cogs' ? (
          cogsLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Spinner size={SpinnerSize.SMALL} />
            </div>
          ) : (
            <COGSTable rows={cogsRows} currency={currency} />
          )
        ) : (
          varianceLoading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
              <Spinner size={SpinnerSize.SMALL} />
            </div>
          ) : (
            <VarianceTable rows={varianceRows} />
          )
        )}
      </div>

    </div>
  )
}
