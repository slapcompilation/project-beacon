// Layer: Mind — Negotiation Preparation
// Aggregates price drift, spend concentration, supplier expiry rates,
// price variance by supplier, and spend forecast into a single prep surface.
// For admin+ only. Answers: "Who should we renegotiate with, and why?"
// Palantir principle: cross-domain synthesis — cost + supplier + waste together.

import { useState } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, Package,
  DollarSign, Loader2, Info, ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuthStore } from '@/stores/auth.store'
import {
  useSupplierSynthesis,
  usePriceDrift,
  useSpendConcentration,
  useSupplierExpiryRates,
  usePriceVarianceBySupplier,
  useSpendForecast,
} from '@/features/mind/hooks'
import type { PriceDriftRow, SpendConcentrationRow, SupplierExpiryRateRow, PriceVarianceBySupplierRow, SpendForecastRow, SupplierSynthesisRow } from '@beacon/types'

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pct(n: number | null): string {
  if (n == null) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function SectionHeader({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {badge && (
        <span className="text-[9px] font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-400">
          {badge}
        </span>
      )}
    </div>
  )
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center py-10 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin mr-2" />
      <span className="text-xs">Loading…</span>
    </div>
  )
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
      {message}
    </div>
  )
}

// ─── Spend Forecast ────────────────────────────────────────────────────────────

function ForecastCards({ rows, currency }: { rows: SpendForecastRow[]; currency: string }) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground py-4">
        No receive data available to build a forecast.
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map((row) => (
        <div key={row.horizon} className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">{row.horizon} Forecast</p>
          <p className="text-2xl font-semibold tabular-nums mt-1">
            {formatCurrency(row.forecast_spend, currency)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {row.basis_months > 0
              ? `based on ${row.basis_months}-month avg · ${formatCurrency(row.basis_avg_monthly, currency)}/mo`
              : 'insufficient history'}
          </p>
        </div>
      ))}
    </div>
  )
}

// ─── Price Drift Table ─────────────────────────────────────────────────────────

const WINDOW_OPTIONS = [
  { label: '3 months', value: 3 },
  { label: '6 months', value: 6 },
  { label: '12 months', value: 12 },
]

function PriceDriftTable({ rows, currency }: { rows: PriceDriftRow[]; currency: string }) {
  if (rows.length === 0) {
    return <EmptyRow message="No cost changes ≥5% detected in this window." />
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left font-medium pb-2">Product / Variant</th>
          <th className="text-right font-medium pb-2">Then</th>
          <th className="text-right font-medium pb-2">Now</th>
          <th className="text-right font-medium pb-2">Change</th>
          <th className="text-right font-medium pb-2 hidden sm:table-cell">Last updated</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => {
          const isUp = row.direction === 'up'
          return (
            <tr key={row.variant_id} className="hover:bg-muted/30 transition-colors">
              <td className="py-2 pr-4">
                <span className="font-medium">{row.product_name}</span>
                {row.variant_name !== 'Standard' && (
                  <span className="text-muted-foreground"> — {row.variant_name}</span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {formatCurrency(row.cost_then, currency)}
              </td>
              <td className="py-2 text-right tabular-nums font-medium">
                {formatCurrency(row.cost_now, currency)}
              </td>
              <td className={cn('py-2 text-right tabular-nums font-semibold flex items-center justify-end gap-1', isUp ? 'text-red-600' : 'text-green-600')}>
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {pct(row.pct_change)}
              </td>
              <td className="py-2 text-right text-muted-foreground hidden sm:table-cell">
                {new Date(row.last_changed).toLocaleDateString()}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Spend Concentration ───────────────────────────────────────────────────────

function SpendConcentrationTable({ rows, currency }: { rows: SpendConcentrationRow[]; currency: string }) {
  if (rows.length === 0) {
    return <EmptyRow message="No receive data in this period." />
  }
  const maxSpend = rows[0]?.total_spend ?? 1
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left font-medium pb-2">Supplier</th>
          <th className="text-right font-medium pb-2">Total spend</th>
          <th className="text-right font-medium pb-2">% of total</th>
          <th className="text-right font-medium pb-2">Orders</th>
          <th className="pb-2 w-24 hidden md:table-cell" />
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row, i) => (
          <tr key={row.supplier_id ?? row.supplier_name} className="hover:bg-muted/30 transition-colors">
            <td className="py-2 pr-4 font-medium">
              {row.supplier_name}
              {i === 0 && (
                <span className="ml-2 text-[9px] font-semibold uppercase tracking-wide text-orange-600 bg-orange-50 dark:bg-orange-950/30 px-1 py-0.5 rounded">
                  Top supplier
                </span>
              )}
            </td>
            <td className="py-2 text-right tabular-nums">{formatCurrency(row.total_spend, currency)}</td>
            <td className="py-2 text-right tabular-nums font-semibold">
              <span className={cn(row.pct_of_total >= 50 ? 'text-orange-600' : row.pct_of_total >= 30 ? 'text-yellow-600' : '')}>
                {row.pct_of_total.toFixed(1)}%
              </span>
            </td>
            <td className="py-2 text-right tabular-nums text-muted-foreground">{row.order_count}</td>
            <td className="py-2 hidden md:table-cell">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/60"
                  style={{ width: `${(row.total_spend / maxSpend) * 100}%` }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── Price Variance by Supplier ────────────────────────────────────────────────

function PriceVarianceTable({ rows, currency }: { rows: PriceVarianceBySupplierRow[]; currency: string }) {
  if (rows.length === 0) {
    return <EmptyRow message="No receives with recorded unit cost in this period." />
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left font-medium pb-2">Supplier</th>
          <th className="text-right font-medium pb-2">Receives</th>
          <th className="text-right font-medium pb-2">Avg variance</th>
          <th className="text-right font-medium pb-2">Overcharge</th>
          <th className="text-right font-medium pb-2">Savings</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => {
          const isOver = (row.avg_variance_pct ?? 0) > 0
          return (
            <tr key={row.supplier_id} className="hover:bg-muted/30 transition-colors">
              <td className="py-2 pr-4 font-medium">{row.supplier_name}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">{row.receive_count}</td>
              <td className={cn('py-2 text-right tabular-nums font-semibold', isOver ? 'text-red-600' : 'text-green-600')}>
                {pct(row.avg_variance_pct)}
              </td>
              <td className="py-2 text-right tabular-nums text-red-600">
                {row.total_overcharge > 0 ? formatCurrency(row.total_overcharge, currency) : '—'}
              </td>
              <td className="py-2 text-right tabular-nums text-green-600">
                {row.total_savings > 0 ? formatCurrency(row.total_savings, currency) : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Supplier Expiry Rates ─────────────────────────────────────────────────────

function ExpiryRatesTable({ rows, currency }: { rows: SupplierExpiryRateRow[]; currency: string }) {
  if (rows.length === 0) {
    return <EmptyRow message="No supplier-linked batches with expiry dates in this period." />
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b text-muted-foreground">
          <th className="text-left font-medium pb-2">Supplier</th>
          <th className="text-right font-medium pb-2">Batches</th>
          <th className="text-right font-medium pb-2">Expired %</th>
          <th className="text-right font-medium pb-2">Units expired</th>
          <th className="text-right font-medium pb-2">Cost at risk</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {rows.map((row) => {
          const rate = row.expiry_rate_pct ?? 0
          return (
            <tr key={row.supplier_id} className="hover:bg-muted/30 transition-colors">
              <td className="py-2 pr-4 font-medium">{row.supplier_name}</td>
              <td className="py-2 text-right tabular-nums text-muted-foreground">
                {row.batches_received}
              </td>
              <td className={cn('py-2 text-right tabular-nums font-semibold', rate >= 20 ? 'text-red-600' : rate >= 10 ? 'text-orange-600' : 'text-muted-foreground')}>
                {row.expiry_rate_pct != null ? `${row.expiry_rate_pct.toFixed(1)}%` : '—'}
                {row.batches_with_expiry < row.batches_received && (
                  <span className="ml-1 text-[9px] text-muted-foreground/60 font-normal">
                    ({row.batches_with_expiry}/{row.batches_received} tracked)
                  </span>
                )}
              </td>
              <td className="py-2 text-right tabular-nums">{row.units_expired > 0 ? row.units_expired : '—'}</td>
              <td className={cn('py-2 text-right tabular-nums', row.cost_expired > 0 ? 'text-red-600' : 'text-muted-foreground')}>
                {row.cost_expired > 0 ? formatCurrency(row.cost_expired, currency) : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ─── Supplier Urgency Strip ────────────────────────────────────────────────────

const TIER_CFG = {
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',    bar: 'bg-red-500' },
  review:   { label: 'Review',   cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400', bar: 'bg-amber-500' },
  watch:    { label: 'Watch',    cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400', bar: 'bg-yellow-400' },
  ok:       { label: 'OK',       cls: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400', bar: 'bg-green-400' },
}

function SupplierUrgencyRow({ row, currency }: { row: SupplierSynthesisRow; currency: string }) {
  const tier = TIER_CFG[row.urgency_tier]
  return (
    <div className="flex items-start gap-4 py-3 border-b last:border-b-0">
      {/* Score + tier */}
      <div className="flex flex-col items-center gap-1 w-14 shrink-0">
        <span className="text-xl font-bold tabular-nums leading-none">{row.urgency_score}</span>
        <span className={cn('text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded', tier.cls)}>
          {tier.label}
        </span>
      </div>

      {/* Score bar + name + reasons */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">{row.supplier_name}</span>
          {row.total_overcharge > 0 && (
            <span className="text-[10px] text-red-600 font-medium tabular-nums">
              {formatCurrency(row.total_overcharge, currency)} overcharge
            </span>
          )}
        </div>
        {/* 100-pt score bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mb-2">
          <div className={cn('h-full rounded-full transition-all', tier.bar)} style={{ width: `${row.urgency_score}%` }} />
        </div>
        {/* Reason chips */}
        <div className="flex flex-wrap gap-1">
          {row.reasons.map((r) => (
            <span key={r} className="text-[10px] border rounded px-1.5 py-0.5 text-muted-foreground">
              {r}
            </span>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="hidden sm:flex flex-col items-end gap-1 text-xs text-muted-foreground shrink-0 w-36">
        {row.fill_rate != null && (
          <span className={cn('tabular-nums', row.fill_rate < 0.9 ? 'text-red-600' : '')}>
            Fill {(row.fill_rate * 100).toFixed(0)}%
          </span>
        )}
        {row.on_time_rate != null && (
          <span className={cn('tabular-nums', row.on_time_rate < 0.85 ? 'text-amber-600' : '')}>
            On-time {(row.on_time_rate * 100).toFixed(0)}%
          </span>
        )}
        {row.invoice_avg_variance_pct != null && row.invoice_avg_variance_pct > 0 && (
          <span className="tabular-nums text-red-600">
            +{row.invoice_avg_variance_pct.toFixed(1)}% invoice
          </span>
        )}
        {row.spend_pct_of_total != null && (
          <span className="tabular-nums">{row.spend_pct_of_total.toFixed(0)}% of spend</span>
        )}
      </div>
    </div>
  )
}

function SupplierUrgencyStrip({ rows, isLoading, currency }: { rows: SupplierSynthesisRow[]; isLoading: boolean; currency: string }) {
  const actionable = rows.filter((r) => r.urgency_tier !== 'ok')
  return (
    <section>
      <SectionHeader
        title="Supplier Urgency Radar"
        subtitle="Composite risk score · fill rate + on-time + invoice variance + price drift + expiry · critical first"
        badge="Mind"
      />
      <div className="rounded-lg border overflow-hidden">
        {isLoading ? (
          <LoadingRow />
        ) : actionable.length === 0 ? (
          <div className="flex items-center gap-2 px-5 py-8 text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4" />
            <span>
              All active suppliers within acceptable thresholds based on 90-day data.
              {rows.length > 0 && ` (${rows.length} supplier${rows.length > 1 ? 's' : ''} monitored)`}
            </span>
          </div>
        ) : (
          <div className="px-5">
            {actionable.map((row) => (
              <SupplierUrgencyRow key={row.supplier_id} row={row} currency={currency} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Negotiation Brief (top-line summary) ─────────────────────────────────────

function NegotiationBrief({
  driftRows,
  concentrationRows,
  varianceRows,
  currency,
}: {
  driftRows: PriceDriftRow[]
  concentrationRows: SpendConcentrationRow[]
  varianceRows: PriceVarianceBySupplierRow[]
  currency: string
}) {
  const biggestDrift   = driftRows[0]
  const topSupplier    = concentrationRows[0]
  const topOvercharger = varianceRows.find((r) => (r.avg_variance_pct ?? 0) > 0)

  if (!biggestDrift && !topSupplier && !topOvercharger) return null

  const signals: { icon: React.ElementType; color: string; text: string }[] = []

  if (biggestDrift) {
    const isUp = biggestDrift.direction === 'up'
    signals.push({
      icon: isUp ? TrendingUp : TrendingDown,
      color: isUp ? 'text-red-600' : 'text-green-600',
      text: `${biggestDrift.product_name} cost ${isUp ? 'up' : 'down'} ${Math.abs(biggestDrift.pct_change).toFixed(1)}% — largest price shift`,
    })
  }

  if (topSupplier && topSupplier.pct_of_total >= 40) {
    signals.push({
      icon: DollarSign,
      color: 'text-orange-600',
      text: `${topSupplier.supplier_name} accounts for ${topSupplier.pct_of_total.toFixed(1)}% of spend — concentration risk`,
    })
  }

  if (topOvercharger) {
    signals.push({
      icon: AlertTriangle,
      color: 'text-yellow-600',
      text: `${topOvercharger.supplier_name} invoicing avg ${pct(topOvercharger.avg_variance_pct)} above cost baseline — ${formatCurrency(topOvercharger.total_overcharge, currency)} overcharge`,
    })
  }

  if (signals.length === 0) return null

  return (
    <div className="rounded-lg border bg-muted/20 p-4 mb-6 space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
        Negotiation Brief
      </p>
      {signals.map((s, i) => {
        const Icon = s.icon
        return (
          <div key={i} className="flex items-start gap-2.5">
            <Icon className={cn('h-3.5 w-3.5 mt-0.5 flex-shrink-0', s.color)} />
            <p className="text-xs">{s.text}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function NegotiationPrepPage() {
  const role = useAuthStore((s) => s.role ?? 'limited_access')
  const currency = useCurrency()

  // Window controls
  const [driftWindow, setDriftWindow]         = useState(6)
  const [spendWindow, setSpendWindow]         = useState(6)
  const [varianceDays, setVarianceDays]       = useState(90)
  const [expiryDays, setExpiryDays]           = useState(180)

  const { data: synthesisRows = [],   isLoading: synthesisLoading }   = useSupplierSynthesis(90)
  const { data: driftRows = [],       isLoading: driftLoading }       = usePriceDrift(driftWindow, 5)
  const { data: concentrationRows = [], isLoading: concLoading }      = useSpendConcentration(spendWindow)
  const { data: expiryRows = [],      isLoading: expiryLoading }      = useSupplierExpiryRates(expiryDays)
  const { data: varianceRows = [],    isLoading: varianceLoading }    = usePriceVarianceBySupplier(varianceDays)
  const { data: forecastRows = [],    isLoading: forecastLoading }    = useSpendForecast()

  if (role !== 'admin' && role !== 'owner') {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
        <Package className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Negotiation prep is available to admin and owner roles only.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Mind · Negotiation Prep</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Price drift · spend concentration · invoice variance · expiry waste · forward forecast
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>All figures based on recorded receives</span>
        </div>
      </div>

      <div className="flex-1 px-8 py-6 space-y-8 max-w-6xl">

        {/* Supplier Urgency Radar */}
        <SupplierUrgencyStrip rows={synthesisRows} isLoading={synthesisLoading} currency={currency} />

        {/* Negotiation Brief */}
        {!driftLoading && !concLoading && !varianceLoading && (
          <NegotiationBrief
            driftRows={driftRows}
            concentrationRows={concentrationRows}
            varianceRows={varianceRows}
            currency={currency}
          />
        )}

        {/* Spend Forecast */}
        <section>
          <SectionHeader
            title="Spend Forecast"
            subtitle="Projected forward spend based on trailing 6-month average · excludes current partial month"
            badge="Mind"
          />
          {forecastLoading ? <LoadingRow /> : <ForecastCards rows={forecastRows} currency={currency} />}
        </section>

        {/* Price Drift */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader
              title="Price Drift"
              subtitle={`Cost changes ≥5% vs ${driftWindow}m ago · largest shift first`}
              badge="Mind"
            />
            <div className="flex gap-1">
              {WINDOW_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setDriftWindow(opt.value) }}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors',
                    driftWindow === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            {driftLoading ? <LoadingRow /> : (
              <div className="p-4">
                <PriceDriftTable rows={driftRows} currency={currency} />
              </div>
            )}
          </div>
        </section>

        {/* Spend Concentration */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader
              title="Spend Concentration"
              subtitle="Actual received spend per supplier · orange ≥40% concentration"
              badge="Mind"
            />
            <div className="flex gap-1">
              {[
                { label: '3m', value: 3 },
                { label: '6m', value: 6 },
                { label: '12m', value: 12 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setSpendWindow(opt.value) }}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors',
                    spendWindow === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            {concLoading ? <LoadingRow /> : (
              <div className="p-4">
                <SpendConcentrationTable rows={concentrationRows} currency={currency} />
              </div>
            )}
          </div>
        </section>

        {/* Price Variance by Supplier */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader
              title="Invoice Price Variance"
              subtitle="Actual vs cost baseline at receiving · positive % = overcharged · supplier_id linked only"
              badge="Mind"
            />
            <div className="flex gap-1">
              {[
                { label: '30d', value: 30 },
                { label: '90d', value: 90 },
                { label: '180d', value: 180 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setVarianceDays(opt.value) }}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors',
                    varianceDays === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            {varianceLoading ? <LoadingRow /> : (
              <div className="p-4">
                <PriceVarianceTable rows={varianceRows} currency={currency} />
              </div>
            )}
          </div>
        </section>

        {/* Supplier Expiry Rates */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionHeader
              title="Lot Expiry Rate by Supplier"
              subtitle="% of expiry-tracked batches that still held stock past expiry date · red ≥20%"
              badge="Mind"
            />
            <div className="flex gap-1">
              {[
                { label: '90d', value: 90 },
                { label: '180d', value: 180 },
                { label: '365d', value: 365 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { setExpiryDays(opt.value) }}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md transition-colors',
                    expiryDays === opt.value
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden">
            {expiryLoading ? <LoadingRow /> : (
              <div className="p-4">
                <ExpiryRatesTable rows={expiryRows} currency={currency} />
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
