// Layer: Flow — Causal Chain Drilldown (Sprint 14)
// The "Machinery" concept: why does the current state exist?
// Traverses the Reality Graph from any node — variant, notification, restock request —
// and renders the full ordered causal chain as a connected timeline.
//
// Palantir Principle 5 (auditability): operators must always be able to see WHY.
// Palantir Principle 6 (cross-domain synthesis): one chain, not three widgets.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { formatDistanceToNow, format } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useProducts } from '@/features/inventory/hooks'
import { useCausalTrace, useAnomalyExplanation } from '@/features/eye/hooks'
import type { CausalTraceStep, AnomalyExplanation, AnomalyContributingFactor } from '@beacon/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

type RootType = 'variant' | 'notification' | 'restock_request'

// ─── Node type config ─────────────────────────────────────────────────────────

const NODE_META: Record<string, { icon: IconName; color: string; ring: string }> = {
  notification:    { icon: 'warning-sign', color: 'text-amber-400',   ring: 'ring-amber-500/40'   },
  stock_log:       { icon: 'minus',        color: 'text-slate-400',   ring: 'ring-slate-500/40'   },
  restock_request: { icon: 'box',          color: 'text-blue-400',    ring: 'ring-blue-500/40'    },
  restock_receive: { icon: 'arrow-up',     color: 'text-emerald-400', ring: 'ring-emerald-500/40' },
  variant:         { icon: 'cube',         color: 'text-primary',     ring: 'ring-primary/40'     },
}

function nodeIcon(nodeType: string): { icon: IconName; color: string; ring: string } {
  return NODE_META[nodeType] ?? { icon: 'pulse', color: 'text-muted-foreground', ring: 'ring-muted/40' }
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
    <Card compact className="mb-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Tag intent={explanation.anomaly_type === 'waste_spike' ? Intent.DANGER : Intent.WARNING} minimal>
              {explanation.anomaly_type === 'waste_spike' ? 'WASTE SPIKE' : 'STOCK DEPLETION'}
            </Tag>
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
              style={{ width: `${String(confidencePct)}%` }}
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
        <Tag minimal>
          30d avg: <strong className="ml-1">{ctx.mean_daily_30d.toFixed(1)}/day</strong>
        </Tag>
        <Tag minimal>
          7d avg: <strong className="ml-1">{ctx.mean_daily_7d.toFixed(1)}/day</strong>
        </Tag>
        <Tag minimal>
          Occupancy: <strong className="ml-1">{ctx.occupancy_7d.toFixed(0)}%</strong>
        </Tag>
        {ctx.last_supply_days != null && (
          <Tag intent={ctx.last_supply_days > 14 ? Intent.WARNING : Intent.NONE} minimal>
            Last supply: <strong className="ml-1">{ctx.last_supply_days}d ago</strong>
            {ctx.supplier_name && <> · {ctx.supplier_name}</>}
          </Tag>
        )}
        {ctx.has_open_request && (
          <Tag intent={Intent.PRIMARY} minimal>Open restock request</Tag>
        )}
        {ctx.days_until_zero != null && (
          <Tag intent={ctx.days_until_zero <= 3 ? Intent.DANGER : Intent.WARNING} minimal>
            ~{ctx.days_until_zero}d until zero
          </Tag>
        )}
      </div>
    </Card>
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
          <Icon icon={meta.icon} size={14} className={meta.color} />
        </div>
        {!isLast && (
          <div className="flex-1 flex flex-col items-center mt-1">
            <div className="w-px flex-1 bg-border min-h-[24px]" />
            {causalLinkBelow && (
              <div className="flex items-center gap-1 py-1">
                <Icon icon="key-enter" size={12} className="text-muted-foreground/60" />
              </div>
            )}
            <div className="w-px flex-1 bg-border min-h-[8px]" />
          </div>
        )}
      </div>

      {/* Right: content */}
      <div className={cn('flex-1 pb-5', isLast && 'pb-0')}>
        <Card compact className={cn('hover:bg-muted/10 transition-colors', isRoot && '!border-primary/30 !bg-primary/5')}>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-xs font-semibold uppercase tracking-wide', isRoot ? 'text-primary' : 'text-foreground')}>
                {step.event_label}
              </span>
              <Tag minimal>{step.node_type.replace('_', ' ')}</Tag>
              {isRoot && (
                <Tag intent={Intent.PRIMARY} minimal>Root</Tag>
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
              <Icon icon="user" size={12} />
              {isSystem ? <span className="italic">System</span> : <span>{step.actor}</span>}
            </span>
            {step.causal_link && (
              <span className="flex items-center gap-1 text-violet-400/80">
                <Icon icon="git-branch" size={12} />
                {step.causal_link}
              </span>
            )}
          </div>
        </Card>

        {/* Causal link label between steps */}
        {causalLinkBelow && !isLast && (
          <div className="flex items-center gap-1.5 mt-2 ml-1 text-xs text-muted-foreground/60 italic">
            <Icon icon="chevron-right" size={12} />
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
      <NonIdealState
        icon="git-branch"
        title="No causal chain data available"
        description="This may mean the variant has no logged history yet"
      />
    )
  }

  return (
    <div className="space-y-0">
      {steps.map((step, idx) => (
        <CausalStep
          key={`${step.node_id}-${String(idx)}`}
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
        (`${p.name} ${v.name} ${v.sku}`.toLowerCase().includes(query.toLowerCase()))
      )
      .slice(0, 4)
      .map(v => ({ variantId: v.id, label: `${p.name} · ${v.name}` }))
  ).slice(0, 8)

  return (
    <div className="relative">
      <InputGroup
        leftIcon="search"
        placeholder="Search variant to trace…"
        value={query}
        onChange={e => { setQuery(e.target.value); }}
      />
      {matches.length > 0 && (
        <Card compact className="absolute top-full left-0 right-0 z-20 mt-1 !p-0 overflow-hidden">
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
        </Card>
      )}
    </div>
  )
}

// ─── Root type tab ─────────────────────────────────────────────────────────────

const ROOT_TABS: { id: RootType; label: string; icon: IconName }[] = [
  { id: 'variant',          label: 'Variant',         icon: 'cube' },
  { id: 'notification',     label: 'Alert',           icon: 'warning-sign' },
  { id: 'restock_request',  label: 'Restock Request', icon: 'box' },
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CausalChainPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const urlRootType = (searchParams.get('root_type') ?? 'variant') as RootType
  const urlRootId   = searchParams.get('root_id') ?? null

  const [rootType, setRootType]   = useState<RootType>(urlRootType)
  const [rootId,   setRootId]     = useState<string | null>(urlRootId)
  const [rootLabel, setRootLabel] = useState<string>(urlRootId ? 'From incident card' : '')

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
          <Icon icon="git-branch" size={14} intent={Intent.PRIMARY} />
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
          {ROOT_TABS.map(({ id, label, icon }) => (
            <Button
              key={id}
              icon={icon}
              size="small"
              active={rootType === id}
              intent={rootType === id ? Intent.PRIMARY : Intent.NONE}
              variant={rootType === id ? 'solid' : 'outlined'}
              onClick={() => { selectRootType(id) }}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Search (variant only) — for other root types, paste UUID directly */}
        {rootType === 'variant' ? (
          <VariantSearch onSelect={selectVariant} />
        ) : (
          <InputGroup
            leftIcon="search"
            placeholder={`Paste ${rootType.replace('_', ' ')} UUID…`}
            className="font-mono"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) { setRootId(val); setRootLabel(val) }
              }
            }}
          />
        )}

        {/* Active root label */}
        {rootId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Icon icon="layers" size={12} />
            <span>Tracing:</span>
            <span className="text-foreground font-medium">{rootLabel || rootId}</span>
            <Button
              icon="cross-circle"
              variant="minimal"
              size="small"
              aria-label="Clear root"
              onClick={() => { setRootId(null); setRootLabel(''); setSearchParams({ panel: 'causal' }, { replace: true }) }}
              className="ml-auto"
            />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!rootId && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Icon icon="git-branch" size={40} className="text-muted-foreground/20 mb-4" />
            <div className="text-sm font-medium text-foreground mb-1">Select a root to trace</div>
            <div className="text-xs text-muted-foreground max-w-sm">
              Search for a variant above, or navigate here from an incident card in{' '}
              <Link to="/eye?panel=incidents" className="text-primary underline underline-offset-2">
                Eye · Insights
              </Link>
              {' '}using the &quot;Explain&quot; button.
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-left max-w-md w-full">
              {[
                { type: 'Notification root', steps: 'Alert → Removals → Pending requests → Last supply', color: 'text-amber-400' },
                { type: 'Variant root',      steps: 'Current state → Recent removals → Open requests → Active alerts', color: 'text-primary' },
                { type: 'Restock root',      steps: 'Request → Prior consumption → Approval chain → Fulfillment', color: 'text-blue-400' },
              ].map(({ type, steps, color }) => (
                <Card key={type} compact>
                  <div className={cn('text-xs font-medium mb-1.5', color)}>{type}</div>
                  <div className="text-xs text-muted-foreground leading-relaxed">{steps}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {rootId && isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
            <Icon icon="pulse" size={14} className="animate-pulse" />
            Traversing Reality Graph…
          </div>
        )}

        {rootId && !isLoading && (
          <>
            {/* Anomaly explanation (variant root only) */}
            {explanation && <AnomalyExplanationPanel explanation={explanation} />}

            {/* Status bar */}
            <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
              <Icon icon="tick-circle" size={14} className="text-emerald-400" />
              <span>{steps.length} events in causal chain</span>
              {steps.length > 0 && (
                <>
                  <span>·</span>
                  <Icon icon="time" size={12} />
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
