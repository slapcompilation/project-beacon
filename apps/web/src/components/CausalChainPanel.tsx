// Layer: Eye → Cross-layer
// Palantir principle: "operators must always be able to see WHY the world is the way it is."
//
// CausalChainPanel renders the output of explain_anomaly() + get_causal_trace()
// as a single operator-facing surface:
//   1. Summary headline + confidence indicator
//   2. Root cause callout (the single most likely cause)
//   3. Contributing factors (ranked, domain-tagged)
//   4. Causal chain timeline (step-by-step graph traversal)
//
// Self-contained: fetches its own data when `variantId` + `anomalyType` are provided.

import { format, parseISO } from 'date-fns'
import {
  AlertTriangle, Package2, Truck, Users, TrendingDown,
  Loader2, X, GitBranch, Clock, CheckCircle2,
  ChevronRight, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAnomalyExplanation, useCausalTrace } from '@/features/eye/hooks'
import type { AnomalyDomain, AnomalyContributingFactor, CausalTraceStep } from '@beacon/types'

// ─── Domain icons + colours ───────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<AnomalyDomain, {
  icon:  React.ElementType
  color: string
  bg:    string
  label: string
}> = {
  stock:  { icon: Package2,    color: 'text-red-600 dark:text-red-400',    bg: 'bg-red-50 dark:bg-red-950/30',    label: 'Stock'    },
  waste:  { icon: AlertTriangle,color:'text-orange-600 dark:text-orange-400',bg:'bg-orange-50 dark:bg-orange-950/30',label:'Waste'  },
  supply: { icon: Truck,        color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/30',  label: 'Supply'  },
  demand: { icon: TrendingDown, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30',label: 'Demand'  },
  team:   { icon: Users,        color: 'text-violet-600 dark:text-violet-400',bg:'bg-violet-50 dark:bg-violet-950/30',label:'Team'  },
}

const WEIGHT_COLOR: Record<AnomalyContributingFactor['weight'], string> = {
  high:   'border-l-red-500',
  medium: 'border-l-amber-400',
  low:    'border-l-muted-foreground/30',
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full',
      pct >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400' :
      pct >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' :
                  'bg-muted text-muted-foreground',
    )}>
      <Zap className="h-2.5 w-2.5" />
      {pct}% confidence
    </span>
  )
}

// ─── Contributing factor row ──────────────────────────────────────────────────

function FactorRow({ factor }: { factor: AnomalyContributingFactor }) {
  const cfg = DOMAIN_CONFIG[factor.domain]
  const Icon = cfg.icon
  return (
    <div className={cn(
      'flex items-start gap-2.5 pl-3 py-2 border-l-2 rounded-r-md',
      WEIGHT_COLOR[factor.weight],
      'bg-muted/20',
    )}>
      <span className={cn('mt-0.5 shrink-0 h-5 w-5 rounded flex items-center justify-center', cfg.bg)}>
        <Icon className={cn('h-3 w-3', cfg.color)} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
          {cfg.label}
        </p>
        <p className="text-xs text-foreground leading-snug">{factor.label}</p>
      </div>
    </div>
  )
}

// ─── Causal chain timeline ────────────────────────────────────────────────────

function nodeIcon(nodeType: string) {
  switch (nodeType) {
    case 'notification':    return AlertTriangle
    case 'stock_log':       return Package2
    case 'restock_request': return GitBranch
    case 'restock_receive': return Truck
    case 'variant':         return Package2
    default:                return ChevronRight
  }
}

function nodeColor(nodeType: string): string {
  switch (nodeType) {
    case 'notification':    return 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400'
    case 'stock_log':       return 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400'
    case 'restock_request': return 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400'
    case 'restock_receive': return 'bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400'
    default:                return 'bg-muted text-muted-foreground'
  }
}

function TraceStep({ step, isLast }: { step: CausalTraceStep; isLast: boolean }) {
  const Icon = nodeIcon(step.node_type)
  const happenedAt = (() => {
    try { return format(parseISO(step.happened_at), 'MMM d, HH:mm') }
    catch { return '—' }
  })()

  return (
    <div className="flex gap-3">
      {/* Connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5', nodeColor(step.node_type))}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border mt-1" />}
      </div>

      {/* Content */}
      <div className={cn('pb-4 min-w-0 flex-1', isLast && 'pb-0')}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold">{step.event_label}</span>
          {step.causal_link && (
            <span className="text-[10px] text-muted-foreground italic">{step.causal_link}</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
          {step.description}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
            <Clock className="h-2.5 w-2.5" />
            {happenedAt}
          </span>
          {step.actor !== 'System' && step.actor !== 'Reality Graph' && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
              <Users className="h-2.5 w-2.5" />
              {step.actor}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export interface CausalChainPanelProps {
  variantId:   string
  anomalyType?: string
  onClose?:    () => void
  className?:  string
}

export function CausalChainPanel({
  variantId,
  anomalyType = 'auto',
  onClose,
  className,
}: CausalChainPanelProps) {
  const { data: explanation, isLoading: loadingExpl, isError: errExpl } =
    useAnomalyExplanation(variantId, anomalyType, true)

  const { data: trace = [], isLoading: loadingTrace } =
    useCausalTrace('variant', variantId, true)

  const isLoading = loadingExpl || loadingTrace

  return (
    <div className={cn(
      'rounded-xl border bg-card shadow-sm overflow-hidden',
      className,
    )}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Root Cause Attribution</span>
          {explanation && <ConfidenceBadge score={explanation.confidence} />}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="p-5 space-y-5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Traversing reality graph…
          </div>
        ) : errExpl || !explanation ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <AlertTriangle className="h-4 w-4" />
            Could not build explanation — insufficient data
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                Summary
              </p>
              <p className="text-sm font-medium leading-relaxed">{explanation.summary}</p>
            </div>

            {/* Root cause callout */}
            <div className={cn(
              'rounded-lg border-l-4 px-4 py-3',
              explanation.anomaly_type === 'waste_spike'
                ? 'border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20'
                : 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20',
            )}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Most likely root cause
              </p>
              <p className="text-sm font-semibold">{explanation.root_cause}</p>
            </div>

            {/* Contributing factors */}
            {explanation.contributing_factors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Contributing factors
                </p>
                <div className="space-y-1.5">
                  {explanation.contributing_factors.map((f, i) => (
                    <FactorRow key={i} factor={f} />
                  ))}
                </div>
              </div>
            )}

            {/* Causal chain timeline */}
            {trace.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">
                  Event chain
                </p>
                <div className="pt-1">
                  {trace.map((step, i) => (
                    <TraceStep key={`${step.node_id}-${i}`} step={step} isLast={i === trace.length - 1} />
                  ))}
                </div>
              </div>
            )}

            {/* Footer: basis */}
            <p className="text-[10px] text-muted-foreground border-t pt-3">
              Attribution engine: 30-day consumption baseline · 7-day waste window · occupancy correlation ·
              Reality Graph traversal (get_causal_trace) · confidence based on corroborating signal count
            </p>
          </>
        )}
      </div>

      {/* Context chips when explanation is loaded */}
      {explanation && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
            <TrendingDown className="h-2.5 w-2.5" />
            {explanation.cross_domain_context.occupancy_7d.toFixed(0)}% occupancy
          </span>
          {explanation.cross_domain_context.last_supply_days !== null && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
              <Truck className="h-2.5 w-2.5" />
              Last supply {explanation.cross_domain_context.last_supply_days}d ago
              {explanation.cross_domain_context.supplier_name && ` · ${explanation.cross_domain_context.supplier_name}`}
            </span>
          )}
          {explanation.cross_domain_context.open_po_number && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400">
              <CheckCircle2 className="h-2.5 w-2.5" />
              PO {explanation.cross_domain_context.open_po_number}
            </span>
          )}
          {explanation.cross_domain_context.mean_daily_30d > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-muted/50 text-muted-foreground">
              <Package2 className="h-2.5 w-2.5" />
              {explanation.cross_domain_context.mean_daily_30d.toFixed(1)}/day avg
            </span>
          )}
        </div>
      )}
    </div>
  )
}
