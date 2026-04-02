// Layer: Mind → Eye → Flow synthesis
// Palantir principle: decision support, not data display.
// Operator sees exactly what to order, why, at what confidence — and approves with one click.
// Proposals are probabilistically enriched: stockout probability, PAR-aware qty, PO-history lead times.

import { useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Loader2, RefreshCw, Zap, Package, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useNavigate } from 'react-router-dom'
import {
  useSmartProposals,
  useApproveProposalWithPO,
  useApproveProposalNoSupplier,
  useDismissProposal,
} from '@/features/mind/hooks'
import type { SmartProposalRow } from '@beacon/types'

// ─── Signal config ────────────────────────────────────────────────────────────

const SIGNAL = {
  critical: {
    label: 'Critical',
    badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
    border: 'border-l-red-500',
    dot:   'bg-red-500',
  },
  warning: {
    label: 'Warning',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    border: 'border-l-amber-400',
    dot:   'bg-amber-400',
  },
  watch: {
    label: 'Watch',
    badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
    border: 'border-l-yellow-400',
    dot:   'bg-yellow-400',
  },
} as const

const LT_SOURCE_BADGE: Record<string, string> = {
  po_history:      'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
  supplier_stated: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  hotel_median:    'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  unknown:         'bg-muted text-muted-foreground',
}

const DEMAND_BADGE: Record<string, string> = {
  steady:       'text-emerald-600 dark:text-emerald-400',
  variable:     'text-amber-600 dark:text-amber-400',
  event_driven: 'text-red-600 dark:text-red-400',
  sparse:       'text-muted-foreground',
}

// ─── Confidence gauge ─────────────────────────────────────────────────────────

function ConfidenceGauge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  )
}

// ─── Stockout probability bar ─────────────────────────────────────────────────

function StockoutBar({ prob }: { prob: number | null }) {
  if (prob === null) return <span className="text-[10px] text-muted-foreground">—</span>
  const color = prob >= 80 ? 'bg-red-500' : prob >= 50 ? 'bg-amber-400' : 'bg-yellow-300'
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(prob, 100)}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(prob)}%</span>
    </div>
  )
}

// ─── Expanded detail panel ────────────────────────────────────────────────────

function ProposalDetail({
  row,
  currency,
  onApprove,
  onDismiss,
  approving,
}: {
  row: SmartProposalRow
  currency: string
  onApprove: () => void
  onDismiss: () => void
  approving: boolean
}) {
  return (
    <div className="px-4 pb-4 pt-3 pl-10 border-t border-border/30 bg-muted/10 space-y-3">
      {/* Intelligence breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2.5 text-xs">
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Consumption</p>
          <p className="tabular-nums">
            {row.mean_daily_30d.toFixed(2)} u/day
            <span className="text-muted-foreground"> avg</span>
          </p>
          <p className="text-muted-foreground tabular-nums">
            ±{row.stddev_daily.toFixed(2)} σ · {row.data_days}d data
          </p>
          <p className={cn('text-[10px] capitalize', DEMAND_BADGE[row.demand_pattern])}>
            {row.demand_pattern.replace('_', ' ')} demand
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lead Time</p>
          <p className="tabular-nums">
            {row.lead_time_days ?? '—'} days
          </p>
          <span className={cn(
            'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded inline-block',
            LT_SOURCE_BADGE[row.lead_time_source],
          )}>
            {row.lead_time_source.replace('_', ' ')}
          </span>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Stockout Risk</p>
          <StockoutBar prob={row.stockout_prob_lt} />
          <p className="text-[10px] text-muted-foreground">during reorder window</p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Confidence</p>
          <ConfidenceGauge score={row.confidence_score} />
          <p className="text-[10px] text-muted-foreground">data quality score</p>
        </div>
      </div>

      {/* Proposed qty formula */}
      <div className="rounded-md border border-border/50 bg-background px-3 py-2 text-[10px] text-muted-foreground font-mono">
        Qty = ⌈mean({row.mean_daily_30d.toFixed(2)}) × lead({row.lead_time_days ?? 7}d)
        + mean × 14d buffer
        + PAR gap({Math.max(0, row.par_level - row.current_stock)})⌉
        = <span className="text-foreground font-bold">{row.proposed_qty} units</span>
        {row.unit_cost > 0 && (
          <> · est. <span className="text-foreground font-bold">{formatCurrency(row.estimated_cost, currency)}</span></>
        )}
      </div>

      {/* Reasoning */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">{row.reasoning}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          disabled={approving}
          onClick={onApprove}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
            row.preferred_supplier_id
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-amber-600 text-white hover:bg-amber-700',
            'disabled:opacity-50',
          )}
        >
          {approving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3 w-3" />
          )}
          {row.preferred_supplier_id ? 'Approve & Create PO' : 'Create Restock Request'}
        </button>
        {!row.preferred_supplier_id && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400">
            No supplier — assign in Procurement after approve
          </p>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Dismiss 48h
        </button>
      </div>
    </div>
  )
}

// ─── Proposal row ─────────────────────────────────────────────────────────────

function ProposalRow({
  row,
  currency,
  approving,
  onApprove,
  onDismiss,
}: {
  row: SmartProposalRow
  currency: string
  approving: boolean
  onApprove: () => void
  onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const sig = SIGNAL[row.signal_type]

  return (
    <div className={cn(
      'border-b last:border-0 border-l-2 transition-colors',
      sig.border,
    )}>
      <button
        type="button"
        className="w-full text-left"
        onClick={() => { setExpanded((v) => !v) }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Signal badge */}
          <span className={cn(
            'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0',
            sig.badge,
          )}>
            {sig.label}
          </span>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {row.product_name}
              {row.variant_name !== 'Standard' && (
                <span className="text-muted-foreground"> — {row.variant_name}</span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {row.sku}
              {' · '}
              <span className="tabular-nums">{row.current_stock}</span> in stock
              {row.par_level > 0 && (
                <> / <span className="tabular-nums">{row.par_level}</span> PAR</>
              )}
              {row.days_until_zero !== null && (
                <> · <span className={cn(
                  'tabular-nums',
                  row.signal_type === 'critical' ? 'text-red-600 dark:text-red-400 font-semibold' :
                  row.signal_type === 'warning'  ? 'text-amber-600 dark:text-amber-400' : '',
                )}>~{Math.round(row.days_until_zero)}d left</span></>
              )}
            </p>
          </div>

          {/* Supplier */}
          <div className="hidden md:block text-xs text-muted-foreground shrink-0 max-w-[120px] truncate">
            {row.preferred_supplier_name ?? (
              <span className="text-amber-600 dark:text-amber-400">No supplier</span>
            )}
          </div>

          {/* Proposed order */}
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold tabular-nums">{row.proposed_qty} u</p>
            {row.estimated_cost > 0 && (
              <p className="text-[10px] text-muted-foreground tabular-nums">
                ~{formatCurrency(row.estimated_cost, currency)}
              </p>
            )}
          </div>

          {/* Confidence dot */}
          <div className="hidden lg:flex items-center gap-1 shrink-0 w-14">
            <div className={cn(
              'h-2 w-2 rounded-full shrink-0',
              row.confidence_score >= 0.8 ? 'bg-emerald-500' :
              row.confidence_score >= 0.6 ? 'bg-amber-400' : 'bg-red-400',
            )} />
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {Math.round(row.confidence_score * 100)}%
            </span>
          </div>

          {/* Quick approve button (visible on non-expanded) */}
          {!expanded && (
            <button
              type="button"
              disabled={approving}
              onClick={(e) => {
                e.stopPropagation()
                onApprove()
              }}
              className={cn(
                'flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded transition-colors shrink-0',
                row.preferred_supplier_id
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 hover:bg-amber-200',
                'disabled:opacity-50',
              )}
            >
              {approving
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <CheckCircle2 className="h-3 w-3" />
              }
              {row.preferred_supplier_id ? 'Approve' : 'Request'}
            </button>
          )}

          {/* Expand toggle */}
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </div>
        </div>
      </button>

      {expanded && (
        <ProposalDetail
          row={row}
          currency={currency}
          onApprove={onApprove}
          onDismiss={onDismiss}
          approving={approving}
        />
      )}
    </div>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({
  rows,
  currency,
  onApproveAllCritical,
  approvingAll,
}: {
  rows: SmartProposalRow[]
  currency: string
  onApproveAllCritical: () => void
  approvingAll: boolean
}) {
  const critical  = rows.filter((r) => r.signal_type === 'critical')
  const totalCost = rows.reduce((s, r) => s + r.estimated_cost, 0)
  const withPO    = rows.filter((r) => !!r.preferred_supplier_id)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-b bg-border shrink-0">
      {[
        {
          label: 'Total proposals',
          value: rows.length.toString(),
          sub:   `${rows.filter((r) => r.signal_type === 'warning').length} warning · ${rows.filter((r) => r.signal_type === 'watch').length} watch`,
          icon:  <Package className="h-3.5 w-3.5" />,
        },
        {
          label: 'Critical',
          value: critical.length.toString(),
          sub:   critical.length > 0 ? 'Stockout within lead time' : 'None — all within window',
          icon:  <AlertTriangle className={cn('h-3.5 w-3.5', critical.length > 0 ? 'text-red-500' : 'text-muted-foreground')} />,
        },
        {
          label: 'Estimated cost',
          value: formatCurrency(totalCost, currency),
          sub:   `${withPO.length} of ${rows.length} can create PO automatically`,
          icon:  <TrendingUp className="h-3.5 w-3.5" />,
        },
        {
          label: 'Avg confidence',
          value: rows.length > 0
            ? `${Math.round(rows.reduce((s, r) => s + r.confidence_score, 0) / rows.length * 100)}%`
            : '—',
          sub:   'Based on data quality + lead time source',
          icon:  <Zap className="h-3.5 w-3.5" />,
        },
      ].map(({ label, value, sub, icon }) => (
        <div key={label} className="bg-background px-4 py-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            {icon}
            <p className="text-[10px] uppercase tracking-widest font-bold">{label}</p>
          </div>
          <p className="text-sm font-bold tabular-nums">{value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
        </div>
      ))}

      {/* Approve all critical — spans full row if any critical exist */}
      {critical.length > 0 && critical.every((r) => !!r.preferred_supplier_id) && (
        <div className="bg-background col-span-full px-4 py-2 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {critical.length} critical proposal{critical.length > 1 ? 's' : ''} — all have known suppliers
          </p>
          <button
            type="button"
            disabled={approvingAll}
            onClick={onApproveAllCritical}
            className="flex items-center gap-1.5 text-xs font-medium bg-red-600 text-white px-3 py-1.5 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {approvingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            Approve All Critical ({critical.length})
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type Filter = 'all' | 'critical' | 'warning' | 'watch'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SmartProposalsPage() {
  const currency              = useCurrency()
  const navigate              = useNavigate()
  const [filter, setFilter]   = useState<Filter>('all')

  const { data: rows = [], isLoading, isError, refetch, isFetching } = useSmartProposals()
  const approveWithPO   = useApproveProposalWithPO()
  const approveNoSupp   = useApproveProposalNoSupplier()
  const dismiss         = useDismissProposal()

  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [approvingAll, setApprovingAll] = useState(false)

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.signal_type === filter)

  const counts: Record<Filter, number> = {
    all:      rows.length,
    critical: rows.filter((r) => r.signal_type === 'critical').length,
    warning:  rows.filter((r) => r.signal_type === 'warning').length,
    watch:    rows.filter((r) => r.signal_type === 'watch').length,
  }

  const handleApprove = async (row: SmartProposalRow) => {
    setApprovingId(row.variant_id)
    try {
      if (row.preferred_supplier_id) {
        await approveWithPO.mutateAsync({
          variantId:    row.variant_id,
          qty:          row.proposed_qty,
          supplierId:   row.preferred_supplier_id,
          supplierName: row.preferred_supplier_name ?? '',
          unitCost:     row.unit_cost,
          leadDays:     row.lead_time_days ?? 7,
        })
      } else {
        await approveNoSupp.mutateAsync({ variantId: row.variant_id, qty: row.proposed_qty })
      }
    } finally {
      setApprovingId(null)
    }
  }

  const handleApproveAllCritical = async () => {
    const critical = rows.filter((r) => r.signal_type === 'critical' && !!r.preferred_supplier_id)
    setApprovingAll(true)
    for (const row of critical) {
      try {
        await approveWithPO.mutateAsync({
          variantId:    row.variant_id,
          qty:          row.proposed_qty,
          supplierId:   row.preferred_supplier_id!,
          supplierName: row.preferred_supplier_name ?? '',
          unitCost:     row.unit_cost,
          leadDays:     row.lead_time_days ?? 7,
        })
      } catch {
        // Continue even if one fails — toast already shown by mutation
      }
    }
    setApprovingAll(false)
  }

  const handleDismiss = (row: SmartProposalRow) => {
    dismiss.mutate({ variantId: row.variant_id, hours: 48 })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex-1 flex flex-col items-center gap-3 py-20 text-center px-8">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Failed to load proposals.</p>
        <button type="button" onClick={() => { void refetch() }}
          className="text-xs text-primary hover:underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            Smart Proposals
            {rows.length > 0 && (
              <span className={cn(
                'text-[10px] font-bold px-1.5 py-0.5 rounded',
                counts.critical > 0
                  ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  : 'bg-muted text-muted-foreground',
              )}>
                {rows.length}
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Probabilistic restock proposals · approve to create PO + restock request
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void refetch() }}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Summary strip */}
      {rows.length > 0 && (
        <SummaryStrip
          rows={rows}
          currency={currency}
          onApproveAllCritical={() => { void handleApproveAllCritical() }}
          approvingAll={approvingAll}
        />
      )}

      {/* Filter tabs */}
      {rows.length > 0 && (
        <div className="flex border-b shrink-0 px-4 bg-background">
          {(['all', 'critical', 'warning', 'watch'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setFilter(f) }}
              className={cn(
                'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px capitalize',
                filter === f
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {f}
              {counts[f] > 0 && (
                <span className={cn(
                  'ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded',
                  f === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                  f === 'warning'  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                  'bg-muted text-muted-foreground',
                )}>
                  {counts[f]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Table header */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-1.5 border-b bg-muted/30 shrink-0">
          <div className="w-14 shrink-0" />
          <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Product
          </div>
          <div className="hidden md:block w-[120px] text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Supplier
          </div>
          <div className="text-right w-20 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Proposed
          </div>
          <div className="hidden lg:block w-14 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Conf.
          </div>
          <div className="w-20 shrink-0" />
          <div className="w-4 shrink-0" />
        </div>
      )}

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center px-8">
            <CheckCircle2 className="h-12 w-12 text-emerald-500/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">All clear — no proposals needed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Checked: variants with ≥3 days of consumption data · excludes items with open POs or requests · dismissed proposals re-surface after 48h
              </p>
            </div>
            <button
              type="button"
              onClick={() => { void navigate('/mind?panel=procurement') }}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Clock className="h-3.5 w-3.5" />
              View open purchase orders
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-xs text-muted-foreground">
            No {filter} proposals
          </div>
        ) : (
          filtered.map((row) => (
            <ProposalRow
              key={row.variant_id}
              row={row}
              currency={currency}
              approving={approvingId === row.variant_id}
              onApprove={() => { void handleApprove(row) }}
              onDismiss={() => { handleDismiss(row) }}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {rows.length > 0 && (
        <div className="shrink-0 border-t px-4 py-2 bg-muted/20 text-[10px] text-muted-foreground">
          Proposals enriched with: Normal-approx stockout probability · PO-history lead times (≥3 POs) · PAR-aware qty (lead time cover + 14d buffer + PAR gap) ·
          Excludes variants with open POs or requests · Dismissed proposals resurface after 48h
        </div>
      )}
    </div>
  )
}
