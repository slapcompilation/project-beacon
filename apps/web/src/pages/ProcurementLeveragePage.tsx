// Layer: Mind — Procurement Leverage Engine
// Turns delivery history + cost variance into negotiation intelligence.
// Palantir principle: decision support, not data display. Every supplier row
// answers "what should I do?" and the brief tells you exactly how to do it.

import { useState, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  Copy, Check, ShieldX, ShieldOff,
  Handshake, Loader2, Zap, AlertTriangle, Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, getCurrencySymbol } from '@/lib/currency'
import { scoreToGrade, GRADE_STYLES, GRADE_ICONS } from '@/lib/grades'
import { useCurrency } from '@/hooks/useCurrency'
import { useDateFormat } from '@/features/user/hooks'
import { useSupplierLeverage, useSupplierPriceHistory } from '@/features/suppliers/hooks'
import { useCostVarianceReport } from '@/features/mind/hooks'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import type { SupplierLeverageRow, SupplierPriceHistoryRow } from '@beacon/types'

// ─── Action badge ──────────────────────────────────────────────────────────────

const ACTION_STYLE: Record<SupplierLeverageRow['recommended_action'], string> = {
  'Find Alternative': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'Renegotiate':      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  'Monitor':          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  'Preferred Supplier': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
}

// ─── Leverage score bar ────────────────────────────────────────────────────────

function LeverageBar({ score }: { score: number }) {
  const color = score >= 60 ? 'bg-red-500' : score >= 35 ? 'bg-orange-400' : 'bg-blue-400'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums font-medium">{score}</span>
    </div>
  )
}

// ─── Price drift sparkline ─────────────────────────────────────────────────────

function PriceDriftChart({ history }: { history: SupplierPriceHistoryRow[] }) {
  const rows = history.filter((h) => h.price_drift_pct !== null)
  if (rows.length < 2) {
    return <p className="text-xs text-muted-foreground italic">Not enough price data</p>
  }
  const maxAbs = Math.max(...rows.map((h) => Math.abs(h.price_drift_pct ?? 0)), 1)

  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
        Price drift per delivery ({rows.length} data points)
      </p>
      <div className="flex items-end gap-0.5 h-14">
        {rows.map((h) => {
          const pct       = h.price_drift_pct ?? 0
          const heightPct = Math.max((Math.abs(pct) / maxAbs) * 100, 6)
          return (
            <div
              key={h.delivery_id}
              title={`${h.delivery_date}: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
              className={cn(
                'flex-1 min-w-[6px] rounded-sm cursor-help transition-opacity hover:opacity-70',
                pct > 0 ? 'bg-red-400' : pct < 0 ? 'bg-green-400' : 'bg-slate-300',
              )}
              style={{ height: `${heightPct}%` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>{rows[0]?.delivery_date}</span>
        <span>red = overcharged · green = discount</span>
        <span>{rows.at(-1)?.delivery_date}</span>
      </div>
    </div>
  )
}

// ─── Negotiation brief generator ──────────────────────────────────────────────

function generateBrief(s: SupplierLeverageRow, days: number, currency: string, todayFormatted: string): string {
  const drift    = s.avg_price_drift_pct ?? 0
  const onTime   = s.on_time_rate ?? 100
  const fill     = s.avg_fill_rate ?? 100
  const late     = s.avg_days_late ?? 0
  const overAmt  = Math.max(0, (drift / 100) * s.total_spend)
  const lateN    = Math.round(s.completed_deliveries * (1 - onTime / 100))
  const underN   = Math.round(s.completed_deliveries * (1 - fill / 100))

  const lines: string[] = [
    `NEGOTIATION BRIEF — ${s.supplier_name.toUpperCase()}`,
    `Generated ${todayFormatted}  ·  Last ${days} days`,
    '',
    'OVERVIEW',
    `${s.total_deliveries} deliveries tracked, ${s.completed_deliveries} completed. Total spend: ${formatCurrency(s.total_spend, currency)}.`,
    '',
  ]

  const hasIssues = drift > 2 || onTime < 85 || fill < 90 || late > 1

  if (hasIssues) {
    lines.push('PERFORMANCE ISSUES')
    if (drift > 2)      lines.push(`• Price drift:  +${drift.toFixed(1)}% above baseline — est. overcharge ${formatCurrency(overAmt, currency)}`)
    if (onTime < 85)    lines.push(`• On-time rate: ${onTime.toFixed(0)}% — ${lateN} late ${lateN === 1 ? 'delivery' : 'deliveries'}, avg ${late.toFixed(1)} days late`)
    if (fill < 90)      lines.push(`• Fill rate:    ${fill.toFixed(0)}% — under-delivered on ${underN} ${underN === 1 ? 'occasion' : 'occasions'}`)
    lines.push('')
    lines.push('TALKING POINTS')
    let n = 1
    if (drift > 2) {
      lines.push(`${String(n)}. "Invoice prices are ${drift.toFixed(1)}% above our agreed baseline. We need a return to contracted rates or we will be reviewing alternatives."`)
      n++
    }
    if (onTime < 85) {
      lines.push(`${String(n)}. "Late deliveries force us to hold excess safety stock and create operational disruptions. We expect ≥95% on-time performance."`)
      n++
    }
    if (fill < 90) {
      lines.push(`${String(n)}. "Consistent under-delivery (${fill.toFixed(0)}% fill rate) disrupts our operations. We expect ≥95% fill rate on all orders."`)
      n++
    }
    lines.push(`${String(n)}. "Our spend of ${formatCurrency(s.total_spend, currency)} over ${days} days represents a meaningful partnership. We expect this reflected in pricing and service commitments."`)
  } else if (s.recommended_action === 'Preferred Supplier') {
    lines.push('PERFORMANCE — EXCELLENT')
    lines.push('This supplier is performing above standard across all dimensions.')
    lines.push('Consider: preferred vendor status, longer-term contracts, or exclusive arrangements.')
  } else {
    lines.push('PERFORMANCE — ADEQUATE')
    lines.push('No material issues identified. Continue monitoring.')
  }

  lines.push('')
  lines.push(`RECOMMENDATION: ${s.recommended_action.toUpperCase()}`)
  lines.push(`Leverage Score: ${s.leverage_score}/100  ·  Reliability Score: ${s.reliability_score}/100`)

  return lines.join('\n')
}

// ─── Expanded detail panel ────────────────────────────────────────────────────

function DetailPanel({
  supplier,
  days,
  currency,
}: {
  supplier: SupplierLeverageRow
  days: number
  currency: string
}) {
  const [copied, setCopied] = useState(false)
  const fmtDate = useDateFormat()
  const { data: history = [], isLoading } = useSupplierPriceHistory(supplier.supplier_id, days)

  const brief = useMemo(
    () => generateBrief(supplier, days, currency, fmtDate(new Date())),
    [supplier, days, currency, fmtDate],
  )

  const handleCopy = () => {
    void navigator.clipboard.writeText(brief).then(() => {
      setCopied(true)
      setTimeout(() => { setCopied(false) }, 2500)
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-5 bg-muted/20 border-t">
      {/* Negotiation brief */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Negotiation Brief
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="gap-1.5 h-7 text-xs"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy brief'}
          </Button>
        </div>
        <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono bg-card border rounded-lg p-4 text-foreground/80 max-h-64 overflow-y-auto">
          {brief}
        </pre>
      </div>

      {/* Price history chart */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <PriceDriftChart history={history} />
        )}

        {/* Metric breakdown */}
        <div className="grid grid-cols-2 gap-2 mt-3">
          {[
            { label: 'On-time rate', value: supplier.on_time_rate !== null ? `${supplier.on_time_rate.toFixed(0)}%` : '—', good: (supplier.on_time_rate ?? 0) >= 85 },
            { label: 'Fill rate',    value: supplier.avg_fill_rate !== null ? `${supplier.avg_fill_rate.toFixed(0)}%` : '—', good: (supplier.avg_fill_rate ?? 0) >= 90 },
            { label: 'Avg price drift', value: supplier.avg_price_drift_pct !== null ? `${supplier.avg_price_drift_pct >= 0 ? '+' : ''}${supplier.avg_price_drift_pct.toFixed(1)}%` : '—', good: (supplier.avg_price_drift_pct ?? 0) <= 2 },
            { label: 'Avg days late', value: supplier.avg_days_late !== null ? `${supplier.avg_days_late >= 0 ? '+' : ''}${supplier.avg_days_late.toFixed(1)}d` : '—', good: (supplier.avg_days_late ?? 0) <= 1 },
          ].map(({ label, value, good }) => (
            <div key={label} className="rounded-md border bg-card p-2.5">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className={cn('text-sm font-bold tabular-nums', good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Cost variance section ────────────────────────────────────────────────────
// Shows specific SKUs where the supplier is consistently overcharging vs expected.
// This is the most actionable procurement intelligence — line items to dispute.

function CostVarianceSection({ days, currency }: { days: number; currency: string }) {
  const { data: rows = [], isLoading } = useCostVarianceReport(days)
  const [showAll, setShowAll] = useState(false)

  // Only overcharged items (variance_amount > 0), sorted by absolute overcharge desc
  const overcharged = useMemo(() =>
    rows
      .filter((r) => (r.variance_amount ?? 0) > 0)
      .sort((a, b) => (b.variance_amount ?? 0) - (a.variance_amount ?? 0)),
    [rows],
  )

  const totalOvercharge = useMemo(() =>
    overcharged.reduce((s, r) => s + (r.variance_amount ?? 0), 0),
    [overcharged],
  )

  const displayed = showAll ? overcharged : overcharged.slice(0, 8)

  if (isLoading) return null
  if (overcharged.length === 0 && rows.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <h2 className="text-sm font-semibold">Cost Variance — Overcharged Line Items</h2>
          <span className="text-[11px] text-muted-foreground">last {days} days</span>
        </div>
        {totalOvercharge > 0 && (
          <span className="text-sm font-semibold text-red-600 dark:text-red-400">
            {formatCurrency(totalOvercharge, currency)} total overcharge
          </span>
        )}
      </div>

      {overcharged.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border bg-green-50 dark:bg-green-950/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <Package className="h-4 w-4 flex-shrink-0" />
          <span>No price overcharges detected in {rows.length} deliveries scanned. All invoices within expected range.</span>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product / SKU</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Expected</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="text-right">Variance</TableHead>
                <TableHead className="text-right">Overcharge</TableHead>
                <TableHead className="text-right">Qty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((r) => (
                <TableRow key={r.receive_id}>
                  <TableCell>
                    <p className="text-sm font-medium">{r.product_name}</p>
                    <p className="text-[11px] text-muted-foreground">{r.variant_name} · {r.sku}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.supplier}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {r.unit_cost_expected > 0 ? formatCurrency(r.unit_cost_expected, currency) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums font-medium">
                    {formatCurrency(r.unit_cost_actual, currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={cn(
                      'text-sm font-semibold tabular-nums',
                      (r.variance_pct ?? 0) > 10 ? 'text-red-600 dark:text-red-400'
                      : (r.variance_pct ?? 0) > 3 ? 'text-orange-600 dark:text-orange-400'
                      : 'text-yellow-600 dark:text-yellow-400',
                    )}>
                      +{(r.variance_pct ?? 0).toFixed(1)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums">
                    +{formatCurrency(r.variance_amount ?? 0, currency)}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {r.quantity_received}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {overcharged.length > 8 && (
            <div className="border-t px-4 py-2 bg-muted/20">
              <button
                onClick={() => { setShowAll((v) => !v) }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showAll
                  ? 'Show fewer'
                  : `Show all ${String(overcharged.length)} overcharged items`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProcurementLeveragePage() {
  const currency = useCurrency()
  const sym      = getCurrencySymbol(currency)

  const [days, setDays]             = useState<30 | 60 | 90>(90)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data = [], isLoading } = useSupplierLeverage(days)

  // KPI strip
  const renegotiateCount  = data.filter((s) => s.recommended_action === 'Renegotiate' || s.recommended_action === 'Find Alternative').length
  const preferredCount    = data.filter((s) => s.recommended_action === 'Preferred Supplier').length
  const totalOvercharge   = data.reduce((sum, s) => sum + Math.max(0, ((s.avg_price_drift_pct ?? 0) / 100) * s.total_spend), 0)

  const kpis = [
    { label: 'Suppliers tracked',    value: String(data.length),                    color: 'text-foreground' },
    { label: 'Action opportunities', value: String(renegotiateCount),                color: renegotiateCount > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground' },
    { label: 'Preferred suppliers',  value: String(preferredCount),                  color: preferredCount > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground' },
    { label: 'Overcharge exposure',  value: totalOvercharge > 0 ? `${sym}${totalOvercharge.toFixed(0)}` : '—', color: totalOvercharge > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground' },
  ]

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
            <Handshake className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-none">Procurement Leverage Engine</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Mind · supplier negotiation intelligence from delivery history
            </p>
          </div>
        </div>

        {/* Time range */}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums mt-0.5', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Alert banner for high-leverage suppliers */}
      {data.some((s) => s.recommended_action === 'Find Alternative') && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 px-4 py-3">
          <ShieldX className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-red-700 dark:text-red-400">Alternative required: </span>
            <span className="text-red-600 dark:text-red-300">
              {data.filter((s) => s.recommended_action === 'Find Alternative').map((s) => s.supplier_name).join(', ')} — poor reliability combined with price overcharging.
            </span>
          </div>
        </div>
      )}

      {/* Main table */}
      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
          <ShieldOff className="h-8 w-8 text-muted-foreground/40" />
          <div>
            <p className="font-semibold">No delivery data yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Log deliveries in the Suppliers page to start building negotiation intelligence.
              The leverage engine analyses price drift and reliability over time.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Leverage</TableHead>
                <TableHead className="text-right">Price drift</TableHead>
                <TableHead className="text-right">On-time</TableHead>
                <TableHead className="text-right">Fill rate</TableHead>
                <TableHead className="text-right">Total spend</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((s, i) => {
                const grade   = scoreToGrade(s.reliability_score)
                const GIcon   = GRADE_ICONS[grade]
                const drift   = s.avg_price_drift_pct
                const isOpen  = expandedId === s.supplier_id

                return (
                  <>
                    <TableRow
                      key={s.supplier_id}
                      className={cn('cursor-pointer', isOpen && 'bg-muted/30')}
                      onClick={() => { setExpandedId(isOpen ? null : s.supplier_id) }}
                    >
                      <TableCell className="text-muted-foreground text-xs tabular-nums">{i + 1}</TableCell>

                      <TableCell>
                        <div>
                          <p className="font-semibold text-sm">{s.supplier_name}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {s.total_deliveries} deliveries · {s.pending_deliveries > 0 ? `${s.pending_deliveries} pending` : 'none pending'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold', GRADE_STYLES[grade])}>
                          <GIcon className="h-3 w-3" />
                          {grade}
                        </div>
                      </TableCell>

                      <TableCell>
                        <LeverageBar score={s.leverage_score} />
                      </TableCell>

                      <TableCell className="text-right">
                        {drift !== null ? (
                          <span className={cn(
                            'inline-flex items-center gap-0.5 text-sm font-semibold tabular-nums',
                            drift > 2 ? 'text-red-600 dark:text-red-400' : drift < 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                          )}>
                            {drift > 0.5 ? <TrendingUp className="h-3 w-3" /> : drift < -0.5 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                            {drift >= 0 ? '+' : ''}{drift.toFixed(1)}%
                          </span>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>

                      <TableCell className={cn('text-right text-sm font-semibold tabular-nums', (s.on_time_rate ?? 0) < 85 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400')}>
                        {s.on_time_rate !== null ? `${s.on_time_rate.toFixed(0)}%` : '—'}
                      </TableCell>

                      <TableCell className={cn('text-right text-sm font-semibold tabular-nums', (s.avg_fill_rate ?? 0) < 90 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground')}>
                        {s.avg_fill_rate !== null ? `${s.avg_fill_rate.toFixed(0)}%` : '—'}
                      </TableCell>

                      <TableCell className="text-right text-sm tabular-nums">
                        {formatCurrency(s.total_spend, currency)}
                      </TableCell>

                      <TableCell>
                        <span className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', ACTION_STYLE[s.recommended_action])}>
                          {s.recommended_action === 'Find Alternative' && <Zap className="h-2.5 w-2.5" />}
                          {s.recommended_action}
                        </span>
                      </TableCell>

                      <TableCell>
                        {isOpen
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </TableCell>
                    </TableRow>

                    {isOpen && (
                      <TableRow key={`${s.supplier_id}-detail`} className="hover:bg-transparent">
                        <TableCell colSpan={10} className="p-0">
                          <DetailPanel supplier={s} days={days} currency={currency} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Cost variance section — specific overcharged SKUs */}
      <CostVarianceSection days={days} currency={currency} />
    </div>
  )
}
