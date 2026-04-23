// Layer: Mind — Supplier Object Browser
// Palantir-pattern: navigation by object type, not by feature page.
// Replaces: ProcurementPage, ContractsPage, SupplierReliabilityPage,
//           ProcurementLeveragePage, PODispatchPage as separate tabs.
// All supplier intelligence (reliability, contracts, leverage, POs) is inline
// per supplier row. Clicking a row goes to the full SupplierObjectPage.
// Filter by risk tier; sort worst-first.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useSupplierReliability } from '@/features/eye/hooks'
import { cn } from '@/lib/utils'
import {
  Truck, Plus, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, FileText, ShieldAlert, Loader2,
} from 'lucide-react'
import type { Supplier, SupplierReliabilityRow } from '@beacon/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskTier = 'critical' | 'high' | 'medium' | 'low' | 'no_data'
type FilterMode = 'all' | 'critical' | 'high' | 'watch' | 'reliable'

interface SupplierDisplayRow {
  supplier:    Supplier
  reliability: SupplierReliabilityRow | null
  riskTier:    RiskTier
  sortScore:   number   // lower = worse (drives worst-first sort)
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TIER_CONFIG: Record<RiskTier, { label: string; borderCls: string; badgeCls: string }> = {
  critical: {
    label:     'CRITICAL',
    borderCls: 'border-l-red-500',
    badgeCls:  'bg-red-500/15 text-red-400 border-red-500/30',
  },
  high: {
    label:     'HIGH RISK',
    borderCls: 'border-l-orange-500',
    badgeCls:  'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  medium: {
    label:     'MONITOR',
    borderCls: 'border-l-amber-500',
    badgeCls:  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  low: {
    label:     'RELIABLE',
    borderCls: 'border-l-emerald-500',
    badgeCls:  'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  },
  no_data: {
    label:     'NO DATA',
    borderCls: 'border-l-slate-500/30',
    badgeCls:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
}

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreCell({ score, tier }: { score: number; tier: RiskTier }) {
  const cls =
    tier === 'critical' ? 'text-red-400' :
    tier === 'high'     ? 'text-orange-400' :
    tier === 'medium'   ? 'text-amber-400' :
    tier === 'low'      ? 'text-emerald-400' : 'text-muted-foreground'

  return (
    <div className="flex flex-col items-center shrink-0">
      <span className={cn('text-xl font-mono font-bold tabular-nums leading-none', cls)}>
        {score.toFixed(1)}
      </span>
      <span className="text-[9px] text-muted-foreground">/10</span>
    </div>
  )
}

// ─── On-time mini bar ─────────────────────────────────────────────────────────

function OnTimeBar({ pct }: { pct: number }) {
  const color = pct >= 85 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden shrink-0">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn(
        'text-xs font-mono tabular-nums shrink-0',
        pct >= 85 ? 'text-emerald-400' : pct >= 65 ? 'text-amber-400' : 'text-red-400',
      )}>
        {pct.toFixed(0)}%
      </span>
    </div>
  )
}

// ─── Supplier row ─────────────────────────────────────────────────────────────

function SupplierRow({ row, rank }: { row: SupplierDisplayRow; rank: number }) {
  const { supplier: s, reliability: r, riskTier } = row
  const tier = TIER_CONFIG[riskTier]
  const url  = `/supplier/${s.id}`

  return (
    <Link
      to={url}
      className={cn(
        'flex items-center gap-4 border-l-4 px-4 py-3 hover:bg-muted/20 transition-colors border-b border-border',
        tier.borderCls,
      )}
    >
      {/* Rank */}
      <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-4 text-right">
        #{rank}
      </span>

      {/* Score gauge */}
      <div className="shrink-0 w-10 text-center">
        {r ? (
          <ScoreCell score={r.reliability_score} tier={riskTier} />
        ) : (
          <Truck className="h-4 w-4 text-muted-foreground/40 mx-auto" />
        )}
      </div>

      {/* Identity + intel */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{s.name}</span>
          <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border', tier.badgeCls)}>
            {tier.label}
          </span>
          {s.lead_time_days != null && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="h-2.5 w-2.5" />
              {s.lead_time_days}d lead
            </span>
          )}
        </div>

        {r ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <OnTimeBar pct={r.on_time_pct} />
            {r.avg_delay_days > 0 && (
              <span className="text-xs text-muted-foreground">
                avg <span className={cn('font-mono font-medium', r.avg_delay_days > 3 ? 'text-red-400' : 'text-amber-400')}>
                  {r.avg_delay_days.toFixed(1)}d
                </span> late
              </span>
            )}
            {r.avg_cost_variance_pct != null && r.avg_cost_variance_pct > 0 && (
              <span className="text-xs text-red-400/80">
                +{r.avg_cost_variance_pct.toFixed(1)}% overcharge
              </span>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No delivery data — add delivery events to score this supplier</span>
        )}
      </div>

      {/* Right column: contracts + action */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {r && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {r.active_contracts > 0 && (
              <span className="flex items-center gap-0.5">
                <FileText className="h-3 w-3" />
                {r.active_contracts}
              </span>
            )}
            <span className="text-[10px] font-mono">{r.total_orders} orders</span>
          </div>
        )}
        {(riskTier === 'critical' || riskTier === 'high') && (
          <span className="flex items-center gap-0.5 text-[10px] text-red-400/80">
            <AlertTriangle className="h-2.5 w-2.5" />
            Act required
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
      </div>
    </Link>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({ rows }: { rows: SupplierDisplayRow[] }) {
  const critical  = rows.filter((r) => r.riskTier === 'critical').length
  const high      = rows.filter((r) => r.riskTier === 'high').length
  const reliable  = rows.filter((r) => r.riskTier === 'low').length
  const noData    = rows.filter((r) => r.riskTier === 'no_data').length
  const avgScore  = rows.filter((r) => r.reliability).length
    ? rows.filter((r) => r.reliability).reduce((s, r) => s + r.reliability!.reliability_score, 0) / rows.filter((r) => r.reliability).length
    : null

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/20 overflow-x-auto shrink-0">
      {critical > 0 && (
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="font-medium text-red-400">{critical} critical</span>
        </div>
      )}
      {high > 0 && (
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          <span className="text-orange-400">{high} high risk</span>
        </div>
      )}
      {reliable > 0 && (
        <div className="flex items-center gap-1.5 text-xs shrink-0">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span className="text-emerald-400">{reliable} reliable</span>
        </div>
      )}
      {avgScore !== null && (
        <div className="flex items-center gap-1 text-xs shrink-0 text-muted-foreground">
          Fleet avg
          <span className={cn(
            'font-mono font-semibold',
            avgScore < 4 ? 'text-red-400' : avgScore < 6 ? 'text-amber-400' : 'text-emerald-400',
          )}>
            {avgScore.toFixed(1)}/10
          </span>
        </div>
      )}
      {noData > 0 && (
        <div className="text-xs text-muted-foreground shrink-0">{noData} unscored</div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const FILTERS: { mode: FilterMode; label: string }[] = [
  { mode: 'all',      label: 'All Suppliers' },
  { mode: 'critical', label: 'Critical' },
  { mode: 'high',     label: 'High Risk' },
  { mode: 'watch',    label: 'Monitor' },
  { mode: 'reliable', label: 'Reliable' },
]

export default function SupplierBrowserPage() {
  const [filter, setFilter] = useState<FilterMode>('all')

  const { data: suppliers   = [], isLoading: loadingSuppliers   } = useSuppliers()
  const { data: reliability = [], isLoading: loadingReliability } = useSupplierReliability(90)

  const isLoading = loadingSuppliers || loadingReliability

  const rows: SupplierDisplayRow[] = useMemo(() => {
    const reliabilityById = new Map<string, SupplierReliabilityRow>()
    for (const r of reliability) {
      if (r.supplier_id) reliabilityById.set(r.supplier_id, r)
    }

    return suppliers.map((s): SupplierDisplayRow => {
      const r = reliabilityById.get(s.id) ?? null
      const riskTier: RiskTier = r ? r.risk_tier : 'no_data'
      // Sort score: critical=0, high=1, medium=2, no_data=3, low=4
      // Within tier: sort by reliability_score ascending (worse first)
      const tierOrder = { critical: 0, high: 1, medium: 2, no_data: 3, low: 4 }
      const sortScore = tierOrder[riskTier] * 100 + (r ? (10 - r.reliability_score) : 50)
      return { supplier: s, reliability: r, riskTier, sortScore }
    }).sort((a, b) => a.sortScore - b.sortScore)
  }, [suppliers, reliability])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'critical') return rows.filter((r) => r.riskTier === 'critical')
    if (filter === 'high')     return rows.filter((r) => r.riskTier === 'high')
    if (filter === 'watch')    return rows.filter((r) => r.riskTier === 'medium')
    if (filter === 'reliable') return rows.filter((r) => r.riskTier === 'low')
    return rows
  }, [rows, filter])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b shrink-0 bg-background overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.mode}
            type="button"
            onClick={() => { setFilter(f.mode) }}
            className={cn(
              'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              filter === f.mode
                ? 'bg-primary/10 text-primary border border-primary/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="ml-auto shrink-0">
          <Link
            to="/mind?panel=operations"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" />
            Add supplier
          </Link>
        </div>
      </div>

      {!isLoading && rows.length > 0 && <SummaryStrip rows={rows} />}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading suppliers…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === 'all'
                ? 'No suppliers configured. Add suppliers to begin tracking procurement.'
                : `No suppliers in this tier.`}
            </p>
          </div>
        ) : (
          <div className="divide-y-0">
            {filtered.map((row, i) => (
              <SupplierRow key={row.supplier.id} row={row} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
