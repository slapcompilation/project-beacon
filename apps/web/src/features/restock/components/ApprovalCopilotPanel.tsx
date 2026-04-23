// Layer: Flow — Approval Copilot Panel (Sprint 15)
// Palantir AIP Principle: decision support, not data display.
// When a manager is about to approve or reject, they need to know WHY
// the request was made and WHAT the right decision is — not just the quantity.
//
// Computes a APPROVE / MODIFY / HOLD recommendation from:
//   - VariantIntelligence (days_until_zero, waste, open PO, velocity)
//   - OptimalPARRow (lead_time_days, recommended_par, rationale, confidence)
//
// No new SQL — all data is from existing RPCs cached by TanStack Query.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2, AlertTriangle, Clock, Flame, TrendingUp, TrendingDown,
  GitBranch, Truck, Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useVariantIntelligence, useOptimalPAR } from '@/features/eye/hooks'

// ─── Decision engine ─────────────────────────────────────────────────────────

type Decision = 'approve' | 'modify' | 'hold' | 'flag'

interface Recommendation {
  decision:    Decision
  label:       string
  basis:       string
  recommended_order: number | null  // units to order (may differ from requested)
  confidence:  number               // 0–1
}

const DECISION_STYLES: Record<Decision, { badge: string; icon: React.ElementType }> = {
  approve: { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
  modify:  { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',    icon: AlertTriangle },
  hold:    { badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       icon: Clock         },
  flag:    { badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',       icon: Flame         },
}

function computeRecommendation(
  requestedQty:   number,
  daysUntilZero:  number | null,
  daysUntilZero7d: number | null,
  leadTimeDays:   number | null,
  recommendedPar: number | null,
  currentStock:   number,
  adjMeanDaily:   number,
  wasteSpikeP:    number | null,
  hasOpenPO:      boolean,
  confidence:     number,
): Recommendation {
  const lt = leadTimeDays ?? 7  // fallback: assume 7-day lead time

  // Guard: incoming stock already covers the gap
  if (hasOpenPO) {
    return {
      decision: 'hold',
      label: 'HOLD · PO in flight',
      basis: 'A purchase order is already in progress for this variant. Approve only if that PO is insufficient.',
      recommended_order: null,
      confidence,
    }
  }

  // Urgency: will stock out before replenishment arrives?
  const dtz = daysUntilZero ?? Infinity
  const dtz7 = daysUntilZero7d ?? Infinity
  const urgent = dtz <= lt || dtz7 <= lt

  // Waste spike: >100% above weekly average
  const wasteHigh = (wasteSpikeP ?? 0) > 100

  // Recommended order quantity: cover to PAR + lead-time consumption + safety
  const recPar = recommendedPar ?? (currentStock + requestedQty)
  const parGap = Math.max(0, recPar - currentStock)
  const ltCover = Math.ceil(adjMeanDaily * lt)
  const recommendedOrder = Math.max(parGap + ltCover, 1)

  const qtyRatio = recommendedOrder > 0 ? requestedQty / recommendedOrder : 1

  if (urgent && wasteHigh) {
    return {
      decision: 'flag',
      label: 'FLAG · Waste + Urgent',
      basis: `Stock runs out in ~${dtz === Infinity ? '?' : Math.round(dtz)}d (lead time ${lt}d). But waste is ${Math.round(wasteSpikeP ?? 0)}% above baseline — verify demand is genuine before approving.`,
      recommended_order: recommendedOrder,
      confidence: confidence * 0.7,
    }
  }

  if (urgent) {
    return {
      decision: 'approve',
      label: 'APPROVE · Urgent',
      basis: `Stock runs out in ~${dtz === Infinity ? '?' : Math.round(dtz)}d at current burn rate. Lead time is ${lt}d — order must be placed now to avoid stockout.`,
      recommended_order: recommendedOrder,
      confidence,
    }
  }

  if (wasteHigh) {
    return {
      decision: 'flag',
      label: 'FLAG · Waste Spike',
      basis: `Waste is ${Math.round(wasteSpikeP ?? 0)}% above weekly baseline. Investigate before committing stock. Approve only after confirming the write-offs are not systemic.`,
      recommended_order: recommendedOrder,
      confidence: confidence * 0.6,
    }
  }

  // Not urgent — does quantity make sense?
  if (qtyRatio > 1.6) {
    return {
      decision: 'modify',
      label: 'MODIFY · Overorder',
      basis: `Requested ${requestedQty}u is ${Math.round((qtyRatio - 1) * 100)}% above the ${recommendedOrder}u recommended (PAR gap + ${lt}d lead-time cover). Consider reducing.`,
      recommended_order: recommendedOrder,
      confidence,
    }
  }

  if (qtyRatio < 0.5) {
    return {
      decision: 'modify',
      label: 'MODIFY · Under-order',
      basis: `Requested ${requestedQty}u covers only ${Math.round(qtyRatio * 100)}% of the ${recommendedOrder}u recommended (PAR gap + ${lt}d lead-time cover). Consider increasing.`,
      recommended_order: recommendedOrder,
      confidence,
    }
  }

  // Sufficient runway — not urgent
  if (dtz > lt + 14) {
    return {
      decision: 'hold',
      label: 'HOLD · Not urgent',
      basis: `~${Math.round(dtz)}d of supply remain at current burn rate. Lead time is ${lt}d. Can defer order for ~${Math.round(dtz - lt - 7)}d without risk.`,
      recommended_order: recommendedOrder,
      confidence,
    }
  }

  return {
    decision: 'approve',
    label: 'APPROVE',
    basis: `Quantity and timing look appropriate. Requested ${requestedQty}u vs ${recommendedOrder}u recommended. Stock runway (~${dtz === Infinity ? '?' : Math.round(dtz)}d) is within acceptable range of the ${lt}d lead time.`,
    recommended_order: recommendedOrder,
    confidence,
  }
}

// ─── Metric block ─────────────────────────────────────────────────────────────

function MetricBlock({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: 'warn' | 'critical' | 'good'
}) {
  return (
    <div className={cn(
      'p-2 rounded border text-center',
      highlight === 'critical' ? 'border-red-500/30 bg-red-500/5' :
      highlight === 'warn'     ? 'border-amber-500/30 bg-amber-500/5' :
      highlight === 'good'     ? 'border-emerald-500/30 bg-emerald-500/5' :
      'border-border bg-card'
    )}>
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={cn(
        'text-sm font-mono font-semibold',
        highlight === 'critical' ? 'text-red-400' :
        highlight === 'warn'     ? 'text-amber-400' :
        highlight === 'good'     ? 'text-emerald-400' :
        'text-foreground'
      )}>
        {value}
      </div>
      {sub && <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ApprovalCopilotPanelProps {
  variantId:    string
  requestedQty: number
  estimatedCost: number | null
}

export function ApprovalCopilotPanel({ variantId, requestedQty, estimatedCost }: ApprovalCopilotPanelProps) {
  const currency = useCurrency()
  const { data: vi, isLoading: loadVI } = useVariantIntelligence(variantId)
  const { data: parRows = [], isLoading: loadPAR } = useOptimalPAR()

  const parRow = useMemo(
    () => parRows.find(r => r.variant_id === variantId) ?? null,
    [parRows, variantId],
  )

  const rec = useMemo<Recommendation | null>(() => {
    if (!vi) return null
    return computeRecommendation(
      requestedQty,
      vi.days_until_zero,
      vi.days_until_zero_7d,
      parRow?.lead_time_days ?? null,
      parRow?.recommended_par ?? null,
      vi.current_stock,
      parRow?.adj_mean_daily ?? vi.avg_daily_use,
      vi.waste_spike_pct,
      !!vi.open_po_id,
      parRow?.confidence_score ?? 0.5,
    )
  }, [vi, parRow, requestedQty])

  if (loadVI || loadPAR) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading intelligence…
      </div>
    )
  }

  if (!vi || !rec) {
    return (
      <div className="py-2 text-xs text-muted-foreground italic">
        No intelligence data available for this variant.
      </div>
    )
  }

  const { icon: DecIcon, badge: badgeClass } = DECISION_STYLES[rec.decision]
  const dtz    = vi.days_until_zero
  const lt     = parRow?.lead_time_days ?? 7
  const confPct = Math.round(rec.confidence * 100)

  return (
    <div className="mt-2 pt-2 border-t border-dashed border-border space-y-2.5">
      {/* Recommendation header */}
      <div className="flex items-start gap-2">
        <div className={cn('flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-bold shrink-0', badgeClass)}>
          <DecIcon className="w-3 h-3" />
          {rec.label}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground font-mono">
            Confidence: {confPct}% · based on {parRow?.lead_time_source ?? 'estimated'} lead time
          </div>
        </div>
      </div>

      {/* Basis text */}
      <p className="text-xs leading-relaxed text-muted-foreground">{rec.basis}</p>

      {/* Metric blocks */}
      <div className="grid grid-cols-4 gap-1.5">
        <MetricBlock
          label="On Hand"
          value={`${vi.current_stock}`}
          sub={`PAR ${vi.low_stock_threshold}`}
          highlight={vi.current_stock <= vi.low_stock_threshold ? 'warn' : undefined}
        />
        <MetricBlock
          label="Days Left"
          value={dtz != null ? `${Math.round(dtz)}d` : '—'}
          sub={dtz != null && lt > 0 ? `LT ${lt}d` : 'no data'}
          highlight={dtz != null && dtz <= lt ? 'critical' : dtz != null && dtz <= lt + 7 ? 'warn' : undefined}
        />
        <MetricBlock
          label="Rec. Order"
          value={rec.recommended_order != null ? `${rec.recommended_order}u` : '—'}
          sub={requestedQty !== rec.recommended_order ? `Req: ${requestedQty}u` : 'matches request'}
          highlight={
            rec.recommended_order != null && requestedQty / rec.recommended_order > 1.5 ? 'warn' :
            rec.recommended_order != null && requestedQty / rec.recommended_order < 0.6 ? 'warn' :
            'good'
          }
        />
        <MetricBlock
          label="Waste 7d"
          value={`${vi.waste_7d.toFixed(1)}u`}
          sub={vi.waste_spike_pct != null ? `${vi.waste_spike_pct > 0 ? '+' : ''}${Math.round(vi.waste_spike_pct)}% vs avg` : 'no baseline'}
          highlight={(vi.waste_spike_pct ?? 0) > 100 ? 'critical' : (vi.waste_spike_pct ?? 0) > 50 ? 'warn' : undefined}
        />
      </div>

      {/* Supplementary context chips */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {/* Velocity */}
        {vi.velocity_change_pct != null && Math.abs(vi.velocity_change_pct) >= 10 && (
          <span className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/30',
            vi.velocity_change_pct > 0 ? 'text-amber-400' : 'text-emerald-400',
          )}>
            {vi.velocity_change_pct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(Math.round(vi.velocity_change_pct))}% velocity {vi.velocity_change_pct > 0 ? 'up' : 'down'} vs 30d
          </span>
        )}

        {/* Open PO */}
        {vi.open_po_id && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
            <Truck className="w-3 h-3" />
            PO {vi.open_po_number ?? 'in flight'}
            {vi.expected_delivery && <> · due {format(new Date(vi.expected_delivery), 'MMM d')}</>}
          </span>
        )}

        {/* Occupancy context */}
        {vi.avg_occupancy_7d > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
            Occupancy 7d: {vi.avg_occupancy_7d.toFixed(0)}%
          </span>
        )}

        {/* Cost estimate */}
        {estimatedCost != null && estimatedCost > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">
            {formatCurrency(estimatedCost, currency)} est.
          </span>
        )}

        {/* PAR rationale (from optimal PAR engine) */}
        {parRow?.rationale && (
          <span className="px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground/70 italic">
            PAR: {parRow.rationale}
          </span>
        )}
      </div>

      {/* Causal trace link */}
      <div className="flex items-center justify-end">
        <Link
          to={`/flow?panel=causal&root_type=variant&root_id=${variantId}`}
          className="flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors"
        >
          <GitBranch className="w-3 h-3" />
          Full causal trace →
        </Link>
      </div>
    </div>
  )
}
