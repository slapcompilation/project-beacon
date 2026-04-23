// Layer: Flow — Causal Chain Drilldown (Sprint 14)
// The "Machinery" concept: why does the current state exist?
// Traverses the Reality Graph from any node — variant, notification, restock request —
// and renders the full ordered causal chain as a connected timeline.
//
// Palantir Principle 5 (auditability): operators must always be able to see WHY.
// Palantir Principle 6 (cross-domain synthesis): one chain, not three widgets.
//
// Entry points:
//   - URL params  ?root_type=variant&root_id=<uuid>   (linked from Incident cards)
//   - Manual search within the page

import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowUpCircle, MinusCircle, Package, Box,
  GitBranch, Clock, User, ChevronRight, Activity, Search,
  CornerDownRight, Layers, CheckCircle2, XCircle,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useProducts } from '@/features/inventory/hooks'
import { useCausalTrace, useAnomalyExplanation } from '@/features/eye/hooks'
import type { CausalTraceStep, AnomalyExplanation, AnomalyContributingFactor } from '@beacon/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

type RootType = 'variant' | 'notification' | 'restock_request'

// ─── Node type config ─────────────────────────────────────────────────────────

const NODE_META: Record<string, { icon: React.ElementType; color: string; ring: string }> = {
  notification:    { icon: AlertTriangle,  color: 'text-amber-400',   ring: 'ring-amber-500/40'   },
  stock_log:       { icon: MinusCircle,    color: 'text-slate-400',   ring: 'ring-slate-500/40'   },
  restock_request: { icon: Package,        color: 'text-blue-400',    ring: 'ring-blue-500/40'    },
  restock_receive: { icon: ArrowUpCircle,  color: 'text-emerald-400', ring: 'ring-emerald-500/40' },
  variant:         { icon: Box,            color: 'text-primary',     ring: 'ring-primary/40'     },
}

function nodeIcon(nodeType: string) {
  return NODE_META[nodeType] ?? { icon: Activity, color: 'text-muted-foreground', ring: 'ring-muted/40' }
}

// ─── Domain weight bars ───────────────────────────────────────────────────────

const DOMAIN_COLOR: Record<string, string> = {
  stock:  'bg-blue-500',
  waste:  'bg-rose-500',
  supply: 'bg-orange-500',
  demand: 'bg-violet-500',
  team:   'bg-cyan-500',
}

const WEIGHT_WIDTH: Record<string, string> = {
  high:   'w-full',
  medium: 'w-2/3',
  low:    'w-1/3',
}

function ContributingFactorBar({ factor }: { factor: AnomalyContributingFactor }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn('w-2 h-2 rounded-full shrink-0', DOMAIN_COLOR[factor.domain] ?? 'bg-muted')} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs truncate">{factor.label}</span>
          <span className="text-xs text-muted-foreground capitalize ml-2 shrink-0">{factor.weight}</span>
        </div>
        <div className="h-1.5 bg-muted/40 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full', DOMAIN_COLOR[factor.domain] ?? 'bg-muted', WEIGHT_WIDTH[factor.weight])} />
        </div>
      </div>
    </div>
  )
}

// ─── Anomaly explanation panel ────────────────────────────────────────────────

function AnomalyExplanationPanel({ explanation }: { explanation: AnomalyExplanation }) {
  const confidencePct = Math.round(explanation.confidence * 100)
  const ctx = explanation.cross_domain_context

  return (
    <div className="rounded-lg border border-border bg-card p-4 mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              'px-2 py-0.5 text-xs font-bold rounded border',
              explanation.anomaly_type === 'waste_spike'
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            )}>
              {explanation.anomaly_type === 'waste_spike' ? 'WASTE SPIKE' : 'STOCK DEPLETION'}
            </span>
            <span className="text-xs text-muted-foreground">{explanation.variant_label}</span>
          </div>
          <p className="text-sm font-medium leading-snug">{explanation.summary}</p>
        </div>
        {/* Confidence gauge */}
        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground mb-1">Confidence</div>
          <div className="text-2xl font-mono font-bold text-foreground">{confidencePct}%</div>
          <div className="h-1.5 w-16 bg-muted/40 rounded-full overflow-hidden mt-1 ml-auto">
            <div
              className={cn('h-full rounded-full', confidencePct >= 70 ? 'bg-emerald-500' : confidencePct >= 40 ? 'bg-amber-500' : 'bg-rose-500')}
              style={{ width: `${confidencePct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Root cause */}
      <div className="mb-3 p-3 rounded bg-muted/20 border border-border">
        <div className="text-xs text-muted-foreground font-medium mb-1">Root Cause</div>
        <p className="text-sm">{explanation.root_cause}</p>
      </div>

      {/* Contributing factors */}
      {explanation.contributing_factors.length > 0 && (
        <div className="mb-3">
          <div className="text-xs text-muted-foreground font-medium mb-2">Contributing Factors</div>
          <div className="space-y-2">
            {explanation.contributing_factors.map((f, i) => (
              <ContributingFactorBar key={i} factor={f} />
            ))}
          </div>
        </div>
      )}

      {/* Cross-domain context chips */}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
        <span className="px-2 py-1 rounded text-xs bg-muted/30 text-muted-foreground">
          30d avg: <strong className="text-foreground">{ctx.mean_daily_30d.toFixed(1)}/day</strong>
        </span>
        <span className="px-2 py-1 rounded text-xs bg-muted/30 text-muted-foreground">
          7d avg: <strong className="text-foreground">{ctx.mean_daily_7d.toFixed(1)}/day</strong>
        </span>
        {ctx.occupancy_7d != null && (
          <span className="px-2 py-1 rounded text-xs bg-muted/30 text-muted-foreground">
            Occupancy: <strong className="text-foreground">{ctx.occupancy_7d.toFixed(0)}%</strong>
          </span>
        )}
        {ctx.last_supply_days != null && (
          <span className={cn('px-2 py-1 rounded text-xs', ctx.last_supply_days > 14 ? 'bg-orange-500/15 text-orange-400' : 'bg-muted/30 text-muted-foreground')}>
            Last supply: <strong>{ctx.last_supply_days}d ago</strong>
            {ctx.supplier_name && <> · {ctx.supplier_name}</>}
          </span>
        )}
        {ctx.has_open_request && (
          <span className="px-2 py-1 rounded text-xs bg-blue-500/15 text-blue-400">Open restock request</span>
        )}
        {ctx.days_until_zero != null && (
          <span className={cn('px-2 py-1 rounded text-xs font-medium', ctx.days_until_zero <= 3 ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400')}>
            ~{ctx.days_until_zero}d until zero
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Single causal step ───────────────────────────────────────────────────────

function CausalStep({
  step,
  isRoot,
  isLast,
  causalLinkBelow,
}: {
  step: CausalTraceStep
  isRoot: boolean
  isLast: boolean
  causalLinkBelow: string | null
}) {
  const meta    = nodeIcon(step.node_type)
  const Icon    = meta.icon
  const happenedAt = new Date(step.happened_at)
  const isSystem   = step.actor === 'System'

  return (
    <div className="flex gap-4">
      {/* Left: icon spine */}
      <div className="flex flex-col items-center shrink-0 w-8">
        <div className={cn(
          'w-8 h-8 rounded-full ring-2 flex items-center justify-center bg-card z-10',
          meta.ring,
          isRoot && 'ring-2',
        )}>
          <Icon className={cn('w-4 h-4', meta.color)} />
        </div>
        {!isLast && (
          <div className="flex-1 flex flex-col items-center mt-1">
            <div className="w-px flex-1 bg-border min-h-[24px]" />
            {causalLinkBelow && (
              <div className="flex items-center gap-1 py-1">
                <CornerDownRight className="w-3 h-3 text-muted-foreground/60" />
              </div>
            )}
            <div className="w-px flex-1 bg-border min-h-[8px]" />
          </div>
        )}
      </div>

      {/* Right: content */}
      <div className={cn('flex-1 pb-5', isLast && 'pb-0')}>
        <div className={cn(
          'rounded-lg border bg-card p-3 hover:bg-muted/10 transition-colors',
          isRoot && 'border-primary/30 bg-primary/5',
        )}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-xs font-semibold uppercase tracking-wide', isRoot ? 'text-primary' : 'text-foreground')}>
                {step.event_label}
              </span>
              <span className="text-xs text-muted-foreground capitalize px-1.5 py-0.5 rounded bg-muted/30">
                {step.node_type.replace('_', ' ')}
              </span>
              {isRoot && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium">Root</span>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs text-muted-foreground">{format(happenedAt, 'dd MMM HH:mm')}</div>
              <div className="text-xs text-muted-foreground/60">{formatDistanceToNow(happenedAt, { addSuffix: true })}</div>
            </div>
          </div>

          <p className="text-sm leading-relaxed mb-2">{step.description}</p>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {isSystem ? <span className="italic">System</span> : <span>{step.actor}</span>}
            </span>
            {step.causal_link && (
              <span className="flex items-center gap-1 text-violet-400/80">
                <GitBranch className="w-3 h-3" />
                {step.causal_link}
              </span>
            )}
          </div>
        </div>

        {/* Causal link label between steps */}
        {causalLinkBelow && !isLast && (
          <div className="flex items-center gap-1.5 mt-2 ml-1 text-xs text-muted-foreground/60 italic">
            <ChevronRight className="w-3 h-3" />
            {causalLinkBelow}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Causal chain timeline ────────────────────────────────────────────────────

function CausalChainTimeline({ steps }: { steps: CausalTraceStep[] }) {
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <GitBranch className="w-8 h-8 text-muted-foreground/30 mb-3" />
        <div className="text-sm text-muted-foreground">No causal chain data available</div>
        <div className="text-xs text-muted-foreground/60 mt-1">This may mean the variant has no logged history yet</div>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => (
        <CausalStep
          key={`${step.node_id}-${idx}`}
          step={step}
          isRoot={step.step === 0}
          isLast={idx === steps.length - 1}
          causalLinkBelow={steps[idx + 1]?.causal_link ?? null}
        />
      ))}
    </div>
  )
}

// ─── Variant search ───────────────────────────────────────────────────────────

function VariantSearch({
  onSelect,
}: {
  onSelect: (variantId: string, label: string) => void
}) {
  const [query, setQuery] = useState('')
  const { data: products = [] } = useProducts()

  const matches = query.trim().length < 2 ? [] : products.flatMap(p =>
    p.product_variants
      .filter(v =>
        (`${p.name} ${v.name} ${v.sku ?? ''}`.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, 4)
      .map(v => ({ variantId: v.id, label: `${p.name} · ${v.name}` }))
  ).slice(0, 8)

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search variant to trace…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="pl-9 text-sm"
        />
      </div>
      {matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
          {matches.map(m => (
            <button
              key={m.variantId}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/40 transition-colors border-b border-border/50 last:border-0"
              onClick={() => { onSelect(m.variantId, m.label); setQuery('') }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Root type tab ─────────────────────────────────────────────────────────────

const ROOT_TABS: { id: RootType; label: string; icon: React.ElementType }[] = [
  { id: 'variant',          label: 'Variant',         icon: Box       },
  { id: 'notification',     label: 'Alert',           icon: AlertTriangle },
  { id: 'restock_request',  label: 'Restock Request', icon: Package   },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CausalChainPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  // Prefer URL params (set by deep-links from IncidentCorrelationPage)
  const urlRootType = (searchParams.get('root_type') ?? 'variant') as RootType
  const urlRootId   = searchParams.get('root_id') ?? null

  const [rootType, setRootType]   = useState<RootType>(urlRootType)
  const [rootId,   setRootId]     = useState<string | null>(urlRootId)
  const [rootLabel, setRootLabel] = useState<string>(urlRootId ? 'From incident card' : '')

  // Sync URL params → local state when navigating from another page
  useEffect(() => {
    const t = (searchParams.get('root_type') ?? 'variant') as RootType
    const id = searchParams.get('root_id') ?? null
    setRootType(t)
    if (id && id !== rootId) {
      setRootId(id)
      setRootLabel('From incident card')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const { data: steps = [],       isLoading: loadingTrace } = useCausalTrace(rootType, rootId, !!rootId)
  const { data: explanation,      isLoading: loadingExp   } = useAnomalyExplanation(
    rootType === 'variant' ? rootId : null,
    'auto',
    rootType === 'variant' && !!rootId,
  )

  function selectVariant(variantId: string, label: string) {
    setRootId(variantId)
    setRootLabel(label)
    setSearchParams({ panel: 'causal', root_type: 'variant', root_id: variantId }, { replace: true })
  }

  function selectRootType(t: RootType) {
    setRootType(t)
    setRootId(null)
    setRootLabel('')
    setSearchParams({ panel: 'causal', root_type: t }, { replace: true })
  }

  const isLoading = loadingTrace || loadingExp

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <GitBranch className="w-4 h-4 text-primary" />
          <h2 className="text-base font-semibold">Causal Chain</h2>
          <span className="text-xs text-muted-foreground">— why does this state exist?</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Traverses the Reality Graph to show the full ordered event chain behind any anomaly.
        </p>
      </div>

      {/* Root type selector + search */}
      <div className="px-6 py-3 border-b border-border shrink-0 space-y-3">
        {/* Root type tabs */}
        <div className="flex gap-1">
          {ROOT_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectRootType(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border font-medium transition-colors',
                rootType === id
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Search (variant only) — for other root types, paste UUID directly */}
        {rootType === 'variant' ? (
          <VariantSearch onSelect={selectVariant} />
        ) : (
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Paste ${rootType.replace('_', ' ')} UUID…`}
              className="pl-9 text-sm font-mono"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val) { setRootId(val); setRootLabel(val) }
                }
              }}
            />
          </div>
        )}

        {/* Active root label */}
        {rootId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Layers className="w-3 h-3" />
            <span>Tracing:</span>
            <span className="text-foreground font-medium">{rootLabel || rootId}</span>
            <button
              type="button"
              onClick={() => { setRootId(null); setRootLabel(''); setSearchParams({ panel: 'causal' }, { replace: true }) }}
              className="ml-auto text-muted-foreground hover:text-foreground"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!rootId && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <GitBranch className="w-10 h-10 text-muted-foreground/20 mb-4" />
            <div className="text-sm font-medium text-foreground mb-1">Select a root to trace</div>
            <div className="text-xs text-muted-foreground max-w-sm">
              Search for a variant above, or navigate here from an incident card in{' '}
              <Link to="/eye?panel=insights" className="text-primary underline underline-offset-2">
                Eye · Insights
              </Link>
              {' '}using the "Explain" button.
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-left max-w-md w-full">
              {[
                { type: 'Notification root', steps: 'Alert → Removals → Pending requests → Last supply', color: 'text-amber-400' },
                { type: 'Variant root',      steps: 'Current state → Recent removals → Open requests → Active alerts', color: 'text-primary' },
                { type: 'Restock root',      steps: 'Request → Prior consumption → Approval chain → Fulfillment', color: 'text-blue-400' },
              ].map(({ type, steps, color }) => (
                <div key={type} className="p-3 rounded-lg border border-border bg-card">
                  <div className={cn('text-xs font-medium mb-1.5', color)}>{type}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{steps}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {rootId && isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Activity className="w-4 h-4 animate-pulse" />
            Traversing Reality Graph…
          </div>
        )}

        {rootId && !isLoading && (
          <>
            {/* Anomaly explanation (variant root only) */}
            {explanation && <AnomalyExplanationPanel explanation={explanation} />}

            {/* Status bar */}
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>{steps.length} events in causal chain</span>
              {steps.length > 0 && (
                <>
                  <span>·</span>
                  <Clock className="w-3 h-3" />
                  <span>
                    {format(new Date(steps[steps.length - 1].happened_at), 'dd MMM')}
                    {' → '}
                    {format(new Date(steps[0].happened_at), 'dd MMM HH:mm')}
                  </span>
                </>
              )}
            </div>

            <CausalChainTimeline steps={steps} />
          </>
        )}
      </div>
    </div>
  )
}
