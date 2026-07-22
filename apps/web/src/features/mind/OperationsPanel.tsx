// Operations — the hospitality procurement workspace. Tabs: Triage (inbox) /
// Procurement (a guided supplier→PO stepper, not a flat sub-tab strip) / Finance /
// Strategy. Legacy ?panel= deep links resolve via PANEL_REDIRECT + seedProcurement.
// (Finance/Strategy relocate to Home briefing + Insights in a later phase —
// docs/OPERATIONS-RESTRUCTURE.md.)

import { lazy, Suspense, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { PanelLoader } from '@/components/WorkspaceTabs'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  Intent,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useSupplierSynthesis, usePODiscrepancies, useReviewPODiscrepancy, usePOSummary } from '@/features/mind/hooks'
import { useBriefingActions } from '@/features/briefing/hooks'
import type { SupplierSynthesisRow, PODiscrepancy, BriefingAction, POSummaryRow } from '@beacon/types'
const EventDemandPage       = lazy(() => import('@/pages/EventDemandPage'))

// ─── Shared tab strip ─────────────────────────────────────────────────────────

const MIND_TIERS = {
  critical: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  review:   'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  watch:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  ok:       'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
}

// ─── Operations tab — triage surface ──────────────────────────────────────────

const MIND_ACTION_TYPES = new Set([
  'supplier_risk', 'invoice_discrepancy', 'restock_proposal', 'gl_unmapped', 'gl_period_ending',
])

function MindBriefingStrip({ actions }: { actions: BriefingAction[] }) {
  const navigate = useNavigate()
  const mind = actions
    .filter((a) => MIND_ACTION_TYPES.has(a.action_type))
    .filter((a) => a.priority <= 2)
    .slice(0, 6)

  if (mind.length === 0) return null

  return (
    <Card className="!p-0 overflow-hidden divide-y">
      <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30">
        Needs attention · {mind.length}
      </p>
      {mind.map((a) => (
        <div key={`${a.action_type}-${a.entity_id ?? a.action_type}`}
          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              {a.entity_id
                ? (a.action_type === 'supplier_risk' || a.action_type === 'invoice_discrepancy')
                  ? <Link to={`/supplier/${a.entity_id}`} className="hover:underline">{a.entity_label}</Link>
                  : <Link to={`/variant/${a.entity_id}`} className="hover:underline">{a.entity_label}</Link>
                : a.entity_label
              }
            </p>
            <p className="text-xs text-muted-foreground truncate">{a.context}</p>
          </div>
          <Button
            variant="minimal"
            size="small"
            intent={Intent.PRIMARY}
            endIcon="chevron-right"
            onClick={() => { void navigate(a.action_url) }}
          >
            {a.action_label}
          </Button>
        </div>
      ))}
    </Card>
  )
}

function SupplierRiskTriage({ rows, currency }: { rows: SupplierSynthesisRow[]; currency: string }) {
  const actionable = rows.filter((r) => r.urgency_tier === 'critical' || r.urgency_tier === 'review')
  if (actionable.length === 0) {
    return (
      <Card className="!px-4 !py-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon icon="shield" size={14} />
        All suppliers within acceptable thresholds
      </Card>
    )
  }
  return (
    <Card className="!p-0 overflow-hidden divide-y">
      <p className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30">
        Supplier Risk · {actionable.length}
      </p>
      {actionable.map((r) => (
        <div key={r.supplier_id} className="flex items-start gap-3 px-4 py-3">
          <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 mt-0.5', MIND_TIERS[r.urgency_tier])}>
            {r.urgency_tier}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">
              <Link to={`/supplier/${r.supplier_id}`} className="hover:underline">{r.supplier_name}</Link>
            </p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {r.reasons.slice(0, 2).map((reason) => (
                <span key={reason} className="text-[10px] border rounded px-1.5 py-0.5 text-muted-foreground">
                  {reason}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground shrink-0">
            <p className="font-bold text-foreground tabular-nums">{r.urgency_score}</p>
            {r.total_overcharge > 0 && (
              <p className="text-red-600 tabular-nums">{formatCurrency(r.total_overcharge, currency)}</p>
            )}
          </div>
        </div>
      ))}
    </Card>
  )
}

function DiscrepancyTriage({ currency }: { currency: string }) {
  const { data: discrepancies = [], isLoading } = usePODiscrepancies()
  const review = useReviewPODiscrepancy()
  const [autoApproving, setAutoApproving] = useState(false)

  const pending      = discrepancies.filter((d) => d.status === 'pending')
  const autoApprovable = pending.filter((d) => d.variance_pct <= 2)

  const handleAutoApprove = async () => {
    setAutoApproving(true)
    for (const d of autoApprovable) {
      await review.mutateAsync({ discrepancyId: d.id, status: 'approved', notes: 'Auto-approved: within 2% tolerance' })
    }
    setAutoApproving(false)
  }

  if (isLoading) return (
    <Card className="!px-4 !py-6 flex items-center justify-center">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
    </Card>
  )

  if (pending.length === 0) {
    return (
      <Card className="!px-4 !py-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Icon icon="tick-circle" size={14} className="text-green-500/60" />
        No invoice discrepancies pending review
      </Card>
    )
  }

  return (
    <Card className="!p-0 overflow-hidden divide-y">
      <div className="px-4 py-2 bg-muted/30 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Invoice Discrepancies · {pending.length}
        </p>
        {autoApprovable.length > 0 && (
          <Button
            variant="minimal"
            size="small"
            intent={Intent.SUCCESS}
            icon="tick"
            loading={autoApproving}
            onClick={() => { void handleAutoApprove() }}
          >
            Approve {autoApprovable.length} ≤2%
          </Button>
        )}
      </div>
      {pending.slice(0, 5).map((d: PODiscrepancy) => {
        const overbilled = d.invoiced_value > d.received_value
        const amount = Math.abs(d.invoiced_value - d.received_value)
        return (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3">
            <Icon icon="warning-sign" size={12} className="text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {d.supplier_name ?? 'Unknown supplier'} · {d.variance_pct.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {overbilled ? '+' : '−'}{formatCurrency(amount, currency)} {overbilled ? 'overcharge' : 'under'}
              </p>
            </div>
          </div>
        )
      })}
      {pending.length > 5 && (
        <p className="px-4 py-2 text-xs text-muted-foreground">+{pending.length - 5} more → Procurement tab</p>
      )}
    </Card>
  )
}

// ─── Open PO pipeline ─────────────────────────────────────────────────────────

function deliveryLabel(dateStr: string | null): { text: string; cls: string } {
  if (!dateStr) return { text: 'No ETA', cls: 'text-muted-foreground' }
  const d = new Date(dateStr)
  if (isPast(d) && !isToday(d)) return { text: `Overdue · ${format(d, 'MMM d')}`, cls: 'text-red-600 dark:text-red-400 font-semibold' }
  if (isToday(d))               return { text: 'Arriving today',    cls: 'text-emerald-600 dark:text-emerald-400 font-semibold' }
  if (isTomorrow(d))            return { text: 'Arriving tomorrow', cls: 'text-amber-600 dark:text-amber-400 font-semibold' }
  return { text: `Arriving ${format(d, 'MMM d')}`, cls: 'text-muted-foreground' }
}

const PO_STATUS_BADGE: Record<POSummaryRow['status'], { label: string; cls: string }> = {
  draft:               { label: 'Draft',      cls: 'bg-muted text-muted-foreground' },
  sent:                { label: 'Sent',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  confirmed:           { label: 'Confirmed',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400' },
  partially_received:  { label: 'Partial',     cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  closed:              { label: 'Closed',      cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  cancelled:           { label: 'Cancelled',   cls: 'bg-muted text-muted-foreground line-through' },
}

function OpenPOPipeline({ currency }: { currency: string }) {
  const navigate = useNavigate()
  const { data: pos = [], isLoading } = usePOSummary()

  const open = pos.filter((p) => ['draft', 'sent', 'partially_received'].includes(p.status))
  // Sort: overdue first, then by ETA ascending, then no-ETA last
  const sorted = [...open].sort((a, b) => {
    const da = a.expected_delivery_date ? new Date(a.expected_delivery_date).getTime() : Infinity
    const db = b.expected_delivery_date ? new Date(b.expected_delivery_date).getTime() : Infinity
    return da - db
  })

  const overdueCount  = open.filter((p) => p.expected_delivery_date && isPast(new Date(p.expected_delivery_date)) && !isToday(new Date(p.expected_delivery_date))).length
  const totalOpen     = open.reduce((s, p) => s + p.total_amount, 0)

  if (isLoading) return (
    <Card className="!px-4 !py-6 flex items-center justify-center">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
    </Card>
  )

  if (sorted.length === 0) return (
    <Card className="!px-4 !py-6 flex items-center gap-2 text-xs text-muted-foreground">
      <Icon icon="box" size={14} />
      No open purchase orders
    </Card>
  )

  return (
    <Card className="!p-0 overflow-hidden divide-y">
      {/* Header */}
      <div className="px-4 py-2 bg-muted/30 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Open POs · {sorted.length}
          {overdueCount > 0 && (
            <span className="ml-1.5 text-red-600 dark:text-red-400">· {overdueCount} overdue</span>
          )}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums inline-flex items-center gap-1">
            <Icon icon="trending-down" size={12} />
            {formatCurrency(totalOpen, currency)} open value
          </span>
          <Button
            variant="minimal"
            size="small"
            intent={Intent.PRIMARY}
            endIcon="chevron-right"
            onClick={() => { void navigate('/operations?panel=procurement') }}
          >
            All POs
          </Button>
        </div>
      </div>

      {/* Rows */}
      {sorted.slice(0, 5).map((po) => {
        const badge   = PO_STATUS_BADGE[po.status]
        const eta     = deliveryLabel(po.expected_delivery_date)
        const filledPct = po.line_count > 0 ? Math.round((po.received_lines / po.line_count) * 100) : 0
        return (
          <div key={po.id} className="flex items-center gap-3 px-4 py-3">
            <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0', badge.cls)}>
              {badge.label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                <Link to={`/po/${po.id}`} className="hover:underline">{po.po_number}</Link>
                {po.supplier_id
                  ? <Link to={`/supplier/${po.supplier_id}`} className="text-muted-foreground hover:underline ml-1">· {po.supplier_name}</Link>
                  : <span className="text-muted-foreground ml-1">· {po.supplier_name}</span>
                }
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn('text-[10px] inline-flex items-center gap-0.5', eta.cls)}>
                  <Icon icon="time" size={10} />
                  {eta.text}
                </span>
                {po.status === 'partially_received' && (
                  <span className="text-[10px] text-muted-foreground">
                    {po.received_lines}/{po.line_count} lines · {filledPct}%
                  </span>
                )}
              </div>
            </div>
            <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0">
              {formatCurrency(po.total_amount, currency)}
            </span>
          </div>
        )
      })}
      {sorted.length > 5 && (
        <p className="px-4 py-2 text-xs text-muted-foreground">
          +{sorted.length - 5} more → <button type="button" onClick={() => { void navigate('/operations?panel=procurement') }} className="text-primary hover:underline">Procurement tab</button>
        </p>
      )}
    </Card>
  )
}

function OperationsTab() {
  const currency = useCurrency()
  const { data: synthesis = [], isLoading: synthLoading } = useSupplierSynthesis(90)
  const { data: actions   = [] }                          = useBriefingActions()

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 max-w-4xl">
      <MindBriefingStrip actions={actions} />
      {synthLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
        </div>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <SupplierRiskTriage rows={synthesis} currency={currency} />
            <DiscrepancyTriage currency={currency} />
          </div>
          <OpenPOPipeline currency={currency} />
        </>
      )}
    </div>
  )
}

// Finance (CPOR/Budget/GL/F&B) + Strategy (Chain/Team) relocated to Insights
// lenses in P3; Events folded into Build PO in P1. Operations is now just the
// procurement flow — see relocateOperationsPanel() + docs/OPERATIONS-RESTRUCTURE.md.

// ─── Main workspace ───────────────────────────────────────────────────────────
const SupplierBrowserPage      = lazy(() => import('@/pages/SupplierBrowserPage'))
const SupplierReliabilityPage  = lazy(() => import('@/pages/SupplierReliabilityPage'))
const ContractsPage            = lazy(() => import('@/pages/ContractsPage'))
const PurchaseOrderPage        = lazy(() => import('@/pages/PurchaseOrderPage'))
const PODispatchPage           = lazy(() => import('@/pages/PODispatchPage'))
const CategoryIntelligencePage = lazy(() => import('@/pages/CategoryIntelligencePage'))
const SupplierQuoteParserPage  = lazy(() => import('@/pages/SupplierQuoteParserPage'))
const ProcurementLeveragePage  = lazy(() => import('@/pages/ProcurementLeveragePage'))
const SmartProposalsPage       = lazy(() => import('@/pages/SmartProposalsPage'))

type PanelId = 'triage' | 'procurement'

// Backward-compat redirect map: old panel IDs → new panel. Procurement sub-seeds
// (contracts/leverage/dispatch/events…) are resolved by seedProcurement(); the
// Finance/Strategy panels relocated to Insights — see RELOCATED in OperationsWorkspace.
const PANEL_REDIRECT: Partial<Record<string, PanelId>> = {
  'operations':   'triage',
  'suppliers':    'procurement',
  'procurement':  'procurement',
  'contracts':    'procurement',
  'leverage':     'procurement',
  'dispatch':     'procurement',
  'events':       'procurement',   // event-driven PO is a Build PO mode now
  'proposals':    'triage',
  'par':          'triage',
  'categories':   'triage',
  'menu':         'triage',
}

// Deep-link sub-tab seeds: if the raw panel was one of these, open that sub-tab directly
const TRIAGE_SUB_SEED: Record<string, 'operations' | 'categories' | 'proposals'> = {
  'categories': 'categories',
  'menu':       'categories',
  'par':        'categories',
  'proposals':  'proposals',
}

// ─── Procurement flow (guided spine) ───────────────────────────────────────────
// The supplier→PO lifecycle as an ordered, free-scrub stepper instead of a flat
// tab strip: Find supplier → Vet → Review contract → Build PO → Dispatch. Every
// step is jump-in-able (never locked). Build PO folds in event- and quote-driven
// modes; Review contract folds in negotiation leverage.

type ProcStep = 'find' | 'vet' | 'contract' | 'build' | 'dispatch'
type BuildMode = 'new' | 'event' | 'quote'
type ContractMode = 'terms' | 'leverage'

const PROCUREMENT_STEPS: { id: ProcStep; label: string; hint: string }[] = [
  { id: 'find',     label: 'Find supplier',   hint: 'Who can supply this?' },
  { id: 'vet',      label: 'Vet reliability', hint: 'On-time rate, delays, cost variance' },
  { id: 'contract', label: 'Review contract', hint: 'Terms + negotiation leverage' },
  { id: 'build',    label: 'Build PO',        hint: 'Assemble the order' },
  { id: 'dispatch', label: 'Dispatch',        hint: 'Send + track open POs' },
]

function ProcurementStepper({ active, onPick }: { active: ProcStep; onPick: (s: ProcStep) => void }) {
  return (
    <div className="flex items-center border-b shrink-0 px-4 py-2 bg-background overflow-x-auto">
      {PROCUREMENT_STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center shrink-0">
          <button
            type="button"
            title={s.hint}
            onClick={() => { onPick(s.id) }}
            className={cn('flex items-center gap-2 rounded px-2.5 py-1 transition-colors',
              s.id === active ? 'bg-primary/10' : 'hover:bg-muted/50')}
          >
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold tabular-nums',
              s.id === active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground')}>
              {i + 1}
            </span>
            <span className={cn('text-xs font-medium', s.id === active ? 'text-foreground' : 'text-muted-foreground')}>
              {s.label}
            </span>
          </button>
          {i < PROCUREMENT_STEPS.length - 1 && (
            <Icon icon="chevron-right" size={12} className="mx-0.5 text-muted-foreground/40 shrink-0" />
          )}
        </div>
      ))}
    </div>
  )
}

function ModeToggle<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { id: T; label: string }[]
}) {
  return (
    <div className="flex items-center gap-1 border-b shrink-0 px-4 py-1.5 bg-muted/20">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => { onChange(o.id) }}
          className={cn('rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
            o.id === value ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

interface ProcSeed { step: ProcStep; build: BuildMode; contract: ContractMode }

function seedProcurement(raw: string): ProcSeed {
  const base: ProcSeed = { step: 'find', build: 'new', contract: 'terms' }
  switch (raw) {
    case 'reliability':  return { ...base, step: 'vet' }
    case 'contracts':    return { ...base, step: 'contract', contract: 'terms' }
    case 'leverage':     return { ...base, step: 'contract', contract: 'leverage' }
    case 'procurement':  return { ...base, step: 'build', build: 'new' }
    case 'events':       return { ...base, step: 'build', build: 'event' }
    case 'quote-parser': return { ...base, step: 'build', build: 'quote' }
    case 'dispatch':     return { ...base, step: 'dispatch' }
    default:             return base
  }
}

function ProcurementFlow({ seed }: { seed: ProcSeed }) {
  const [step, setStep] = useState<ProcStep>(seed.step)
  const [build, setBuild] = useState<BuildMode>(seed.build)
  const [contract, setContract] = useState<ContractMode>(seed.contract)
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ProcurementStepper active={step} onPick={setStep} />
      {step === 'contract' && (
        <ModeToggle value={contract} onChange={setContract}
          options={[{ id: 'terms', label: 'Terms' }, { id: 'leverage', label: 'Negotiation leverage' }]} />
      )}
      {step === 'build' && (
        <ModeToggle value={build} onChange={setBuild}
          options={[{ id: 'new', label: 'New PO' }, { id: 'event', label: 'From event' }, { id: 'quote', label: 'From quote' }]} />
      )}
      <PanelErrorBoundary name={`Operations · Procurement · ${step}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden flex flex-col">
            {step === 'find'     && <SupplierBrowserPage />}
            {step === 'vet'      && <SupplierReliabilityPage />}
            {step === 'contract' && (contract === 'terms' ? <ContractsPage /> : <ProcurementLeveragePage />)}
            {step === 'build'    && build === 'new'   && <PurchaseOrderPage />}
            {step === 'build'    && build === 'event' && <EventDemandPage />}
            {step === 'build'    && build === 'quote' && <SupplierQuoteParserPage />}
            {step === 'dispatch' && <PODispatchPage />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}

// ─── Triage tab — operations + category intelligence ──────────────────────────

function TriageTab({ initialSub }: { initialSub: 'operations' | 'categories' | 'proposals' }) {
  const [sub, setSub] = useState<'operations' | 'categories' | 'proposals'>(initialSub)
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b shrink-0 px-4 bg-background overflow-x-auto">
        {[
          { id: 'operations' as const, label: 'Operations'      },
          { id: 'categories' as const, label: 'Categories'      },
          { id: 'proposals'  as const, label: 'Smart Proposals' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setSub(t.id) }}
            className={cn(
              'shrink-0 px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
              sub === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <PanelErrorBoundary name={`Operations · Triage · ${sub}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden flex flex-col">
            {sub === 'operations' && <OperationsTab />}
            {sub === 'categories' && <CategoryIntelligencePage />}
            {sub === 'proposals'  && <SmartProposalsPage />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}

// ─── Operations panel — the demoted hospitality workspace ──────────────────
// Rendered by AIPShell for the `operations` rail tab. Owns its own 4-tab
// selector + internal state; `initialPanel` carries a legacy ?panel= value
// so old deep links land on the right tab.

type OpsTab = 'triage' | 'procurement'

const OPS_TABS: { id: OpsTab; label: string }[] = [
  { id: 'triage',      label: 'Triage'      },
  { id: 'procurement', label: 'Procurement' },
]

export function OperationsPanel({ initialPanel }: { initialPanel?: string }) {
  const raw = initialPanel ?? ''
  const seeded: OpsTab =
    (OPS_TABS.some((t) => t.id === raw) ? raw as OpsTab : null)
    ?? PANEL_REDIRECT[raw]
    ?? 'triage'
  const [tab, setTab] = useState<OpsTab>(seeded)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b shrink-0 bg-background">
        {OPS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setTab(t.id) }}
            className={cn(
              'px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <PanelErrorBoundary name={`Operations · Operations · ${tab}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden flex flex-col">
            {tab === 'triage'      && <TriageTab initialSub={TRIAGE_SUB_SEED[raw] ?? 'operations'} />}
            {tab === 'procurement' && <ProcurementFlow seed={seedProcurement(raw)} />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}
