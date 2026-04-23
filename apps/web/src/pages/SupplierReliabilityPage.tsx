// Layer: Eye — Supplier Delivery Reliability Scorecard (Sprint 28)
// Palantir Principle 3: Intelligence everywhere — every supplier number carries
// its derived context: on-time rate, avg delay, cost variance vs contract.
// Palantir Principle 4: Decision support — worst suppliers surface first with
// actionable links to Mind/Contracts for renegotiation.
//
// Data: get_supplier_reliability() RPC — purchase_orders + restock_receives
//       gives actual vs expected delivery dates; supplier_contracts gives
//       cost variance. No new tables required.

import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Truck, AlertTriangle, CheckCircle2, Clock, TrendingUp,
  TrendingDown, FileText, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useSupplierReliability } from '@/features/eye/hooks'
import type { SupplierReliabilityRow } from '@beacon/types'

// ─── Risk tier config ─────────────────────────────────────────────────────────

const TIER = {
  critical: {
    label:  'CRITICAL',
    badge:  'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-300 dark:border-red-800',
    border: 'border-l-red-500',
    dot:    'bg-red-500',
  },
  high: {
    label:  'HIGH RISK',
    badge:  'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-300 dark:border-orange-800',
    border: 'border-l-orange-500',
    dot:    'bg-orange-500',
  },
  medium: {
    label:  'MEDIUM',
    badge:  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-300 dark:border-amber-800',
    border: 'border-l-amber-500',
    dot:    'bg-amber-500',
  },
  low: {
    label:  'RELIABLE',
    badge:  'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border-green-300 dark:border-green-800',
    border: 'border-l-green-500',
    dot:    'bg-green-500',
  },
} as const

// ─── Reliability score gauge ──────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const tier =
    score < 3 ? 'critical' :
    score < 5 ? 'high' :
    score < 7 ? 'medium' : 'low'

  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0">
      <div className={cn(
        'w-11 h-11 rounded-xl flex items-center justify-center font-bold text-lg tabular-nums border',
        TIER[tier].badge,
      )}>
        {score.toFixed(1)}
      </div>
      <span className="text-[9px] text-muted-foreground">/10</span>
    </div>
  )
}

// ─── On-time bar ─────────────────────────────────────────────────────────────

function OnTimeBar({ pct }: { pct: number }) {
  const color =
    pct >= 85 ? 'bg-green-500' :
    pct >= 65 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums shrink-0 w-10 text-right',
        pct >= 85 ? 'text-green-600 dark:text-green-400' :
        pct >= 65 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400',
      )}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

// ─── Cost variance badge ──────────────────────────────────────────────────────

function CostVarianceBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-xs text-muted-foreground">No contracts</span>
  if (pct <= 0) return (
    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 font-medium">
      <TrendingDown className="w-3 h-3" />
      {Math.abs(pct).toFixed(1)}% under
    </span>
  )
  return (
    <span className={cn(
      'flex items-center gap-1 text-xs font-medium',
      pct > 10 ? 'text-red-600 dark:text-red-400' :
      pct > 5  ? 'text-amber-600 dark:text-amber-400' : 'text-yellow-600 dark:text-yellow-400',
    )}>
      <TrendingUp className="w-3 h-3" />
      +{pct.toFixed(1)}% overcharge
    </span>
  )
}

// ─── Supplier card ────────────────────────────────────────────────────────────

function SupplierCard({
  row,
  currency,
  rank,
}: {
  row: SupplierReliabilityRow
  currency: string
  rank: number
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const tier = TIER[row.risk_tier]

  return (
    <div className={cn(
      'border-l-4 rounded-r-lg bg-card border border-l-[4px] border-border overflow-hidden',
      tier.border,
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
          <span className="text-[10px] text-muted-foreground font-mono">#{rank}</span>
          <ScoreGauge score={row.reliability_score} />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Name + tier badge */}
          <div className="flex items-center gap-2 flex-wrap">
            {row.supplier_id ? (
              <Link
                to={`/supplier/${row.supplier_id}`}
                className="font-semibold text-sm hover:text-primary hover:underline transition-colors"
              >
                {row.supplier_name}
              </Link>
            ) : (
              <span className="font-semibold text-sm">{row.supplier_name}</span>
            )}
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide', tier.badge)}>
              {tier.label}
            </span>
            {row.active_contracts > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <FileText className="w-2.5 h-2.5" />
                {row.active_contracts} contract{row.active_contracts !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* On-time bar */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground shrink-0 w-14">On-time</span>
            <div className="flex-1">
              <OnTimeBar pct={row.on_time_pct} />
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {row.on_time_orders}/{row.total_orders} orders
            </span>
          </div>

          {/* Key metrics inline */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {row.late_orders > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Avg <span className="font-medium text-foreground">{row.avg_delay_days.toFixed(1)}d</span> late
                {row.max_delay_days > 0 && (
                  <span className="text-[10px]">(max {row.max_delay_days.toFixed(0)}d)</span>
                )}
              </span>
            )}
            <CostVarianceBadge pct={row.avg_cost_variance_pct} />
            {row.total_value > 0 && (
              <span>{formatCurrency(row.total_value, currency)} total</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {(row.risk_tier === 'critical' || row.risk_tier === 'high') && (
            <button
              type="button"
              onClick={() => navigate('/mind?panel=contracts')}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              Renegotiate →
            </button>
          )}
          {row.last_delivery_date && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Calendar className="w-2.5 h-2.5" />
              Last: {row.last_delivery_date}
            </span>
          )}
          <button
            type="button"
            className="h-6 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded breakdown */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border bg-muted/10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: 'Reliability Score',
                value: `${row.reliability_score.toFixed(1)} / 10`,
                sub:   'composite: on-time + delay + cost',
                highlight: row.reliability_score < 5,
              },
              {
                label: 'On-Time Rate',
                value: `${row.on_time_pct.toFixed(1)}%`,
                sub:   `${row.on_time_orders} of ${row.total_orders} orders`,
                highlight: row.on_time_pct < 65,
              },
              {
                label: 'Avg Delay',
                value: row.late_orders > 0 ? `${row.avg_delay_days.toFixed(1)} days` : '—',
                sub:   row.late_orders > 0 ? `worst: ${row.max_delay_days.toFixed(0)}d late` : 'No late orders',
                highlight: row.avg_delay_days > 5,
              },
              {
                label: 'Cost Variance',
                value: row.avg_cost_variance_pct != null
                  ? `${row.avg_cost_variance_pct > 0 ? '+' : ''}${row.avg_cost_variance_pct.toFixed(1)}%`
                  : 'No contracts',
                sub:   row.active_contracts > 0
                  ? `vs ${row.active_contracts} contracted lines`
                  : 'Set contracts to track',
                highlight: (row.avg_cost_variance_pct ?? 0) > 5,
              },
            ].map(({ label, value, sub, highlight }) => (
              <div key={label} className={cn(
                'p-3 rounded-lg border bg-card text-xs',
                highlight ? 'border-red-500/30 bg-red-500/5' : 'border-border',
              )}>
                <div className="text-muted-foreground mb-1">{label}</div>
                <div className={cn('text-base font-mono font-semibold', highlight ? 'text-red-400' : 'text-foreground')}>
                  {value}
                </div>
                <div className="text-muted-foreground mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Score explanation */}
          <div className="mt-3 text-[10px] text-muted-foreground">
            Score formula: (on-time% ÷ 10) − (avg_delay ÷ 3) − cost_variance_penalty · clamped 1–10
            {row.avg_cost_variance_pct == null && ' · Cost variance not measured (no active contracts)'}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ rows, currency }: { rows: SupplierReliabilityRow[]; currency: string }) {
  const criticalCount  = rows.filter((r) => r.risk_tier === 'critical').length
  const highCount      = rows.filter((r) => r.risk_tier === 'high').length
  const reliableCount  = rows.filter((r) => r.risk_tier === 'low').length
  const avgOnTime      = rows.length ? rows.reduce((s, r) => s + r.on_time_pct, 0) / rows.length : 0
  const totalValue     = rows.reduce((s, r) => s + r.total_value, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
      {[
        {
          label: 'Critical Suppliers',
          value: criticalCount,
          sub:   'score < 3 · immediate action',
          accent: criticalCount > 0 ? 'text-red-400' : 'text-muted-foreground',
          highlight: criticalCount > 0,
          icon: AlertTriangle,
        },
        {
          label: 'High Risk',
          value: highCount,
          sub:   'score 3–5 · monitor closely',
          accent: highCount > 0 ? 'text-orange-400' : 'text-muted-foreground',
          highlight: false,
          icon: Truck,
        },
        {
          label: 'Reliable',
          value: reliableCount,
          sub:   'score ≥ 7',
          accent: 'text-green-400',
          highlight: false,
          icon: CheckCircle2,
        },
        {
          label: 'Fleet On-Time Avg',
          value: `${avgOnTime.toFixed(1)}%`,
          sub:   'across all suppliers',
          accent: avgOnTime >= 85 ? 'text-green-400' : avgOnTime >= 65 ? 'text-amber-400' : 'text-red-400',
          highlight: false,
          icon: Clock,
        },
        {
          label: 'Total PO Value',
          value: formatCurrency(totalValue, currency),
          sub:   'in analysis window',
          accent: 'text-foreground',
          highlight: false,
          icon: TrendingUp,
        },
      ].map(({ label, value, sub, accent, highlight, icon: Icon }) => (
        <div key={label} className={cn(
          'p-3 rounded-lg border bg-card',
          highlight ? 'border-red-500/30 bg-red-500/5' : 'border-border',
        )}>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
            <Icon className="w-3 h-3" />
            {label}
          </div>
          <div className={cn('text-xl font-mono font-bold', accent)}>{value}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type WindowOption = 30 | 60 | 90 | 180
type TierFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'

export default function SupplierReliabilityPage() {
  const currency                  = useCurrency()
  const [windowDays, setWindowDays] = useState<WindowOption>(90)
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')

  const { data: rows = [], isLoading, error } = useSupplierReliability(windowDays)

  const filtered = useMemo(() => {
    if (tierFilter === 'all') return rows
    return rows.filter((r) => r.risk_tier === tierFilter)
  }, [rows, tierFilter])

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-400" />
              Supplier Reliability Scorecard
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Eye Layer · delivery on-time rate · avg delay · cost variance vs contracts · ranked worst first
            </p>
          </div>
          {/* Window selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Window:</span>
            {([30, 60, 90, 180] as WindowOption[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setWindowDays(d)}
                className={cn(
                  'px-3 py-1.5 text-xs rounded border font-medium transition-colors',
                  windowDays === d
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tier filter */}
      <div className="px-6 py-3 border-b shrink-0 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Risk tier:</span>
        {(['all', 'critical', 'high', 'medium', 'low'] as TierFilter[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTierFilter(t)}
            className={cn(
              'px-3 py-1 text-xs rounded border capitalize transition-colors',
              tierFilter === t
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'all' ? 'All' : t === 'low' ? 'Reliable' : TIER[t as 'critical' | 'high' | 'medium'].label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {rows.length} suppliers
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading && (
          <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
            Scoring supplier delivery performance…
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error instanceof Error ? error.message : 'Failed to load supplier reliability data'}
          </div>
        )}

        {!isLoading && !error && rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Truck className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <div className="text-sm font-medium">No delivery history in this window</div>
            <div className="text-xs text-muted-foreground mt-1 max-w-sm">
              Supplier reliability scores are computed from closed purchase orders with
              expected delivery dates. Receive orders via the Deliveries tab to build history.
            </div>
          </div>
        )}

        {!isLoading && !error && rows.length > 0 && (
          <>
            <SummaryStrip rows={rows} currency={currency} />

            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground">
                No suppliers match the selected filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((row, i) => (
                  <SupplierCard
                    key={row.supplier_id ?? row.supplier_name}
                    row={row}
                    currency={currency}
                    rank={i + 1}
                  />
                ))}
              </div>
            )}

            <div className="mt-4 text-[10px] text-muted-foreground border-t pt-3">
              Reliability score 1–10: on-time% ÷ 10, minus avg_delay_days ÷ 3,
              minus cost overcharge penalty (−1pt if &gt;5%, −2pt if &gt;10%) ·
              based on {windowDays}-day window of closed POs with expected delivery dates set
            </div>
          </>
        )}
      </div>
    </div>
  )
}
