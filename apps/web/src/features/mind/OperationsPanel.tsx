// Layer: Mind — Operations (hospitality procurement / finance / strategy).
// Demoted from a top-level Mind panel to the "Operations" entry inside the
// AIP shell. Self-contained 4-tab workspace (Triage / Suppliers / Finance /
// Strategy) with its own sub-tabs; preserves legacy ?panel= deep links via
// PANEL_REDIRECT + the *_SUB_SEED maps.

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
  NonIdealState,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuthStore } from '@/stores/auth.store'
import { useSupplierSynthesis, usePODiscrepancies, useReviewPODiscrepancy, usePOSummary } from '@/features/mind/hooks'
import { useBriefingActions } from '@/features/briefing/hooks'
import type { SupplierSynthesisRow, PODiscrepancy, BriefingAction, POSummaryRow } from '@beacon/types'
const GLExportPage          = lazy(() => import('@/pages/GLExportPage'))
const ChainPage             = lazy(() => import('@/pages/ChainPage'))
const EventDemandPage       = lazy(() => import('@/pages/EventDemandPage'))
const FBIntelligencePage    = lazy(() => import('@/pages/FBIntelligencePage'))
const TeamIntelligencePage  = lazy(() => import('@/pages/TeamIntelligencePage'))
const CPORDashboard         = lazy(() => import('@/pages/CPORDashboard'))
const BudgetTrackerPage     = lazy(() => import('@/pages/BudgetTrackerPage'))

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
            onClick={() => { void navigate('/mind?panel=procurement') }}
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
          +{sorted.length - 5} more → <button type="button" onClick={() => { void navigate('/mind?panel=procurement') }} className="text-primary hover:underline">Procurement tab</button>
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

// ─── Finance sub-tabs (CPOR + Budget + GL + F&B Intel) ───────────────────────

function FinancialTab() {
  const [sub, setSub] = useState<'cpor' | 'budget' | 'gl' | 'fb'>('cpor')
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b shrink-0 px-4 bg-background">
        {[
          { id: 'cpor'   as const, label: 'CPOR'     },
          { id: 'budget' as const, label: 'Budget'   },
          { id: 'gl'     as const, label: 'GL Export' },
          { id: 'fb'     as const, label: 'F&B Intel' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setSub(t.id) }}
            className={cn(
              'px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
              sub === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <PanelErrorBoundary name={`Mind · Finance · ${sub}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden">
            {sub === 'cpor'   && <CPORDashboard />}
            {sub === 'budget' && <BudgetTrackerPage />}
            {sub === 'gl'     && <GLExportPage />}
            {sub === 'fb'     && <FBIntelligencePage />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}

// ─── Strategy sub-tabs (Chain + Team + Events) ───────────────────────────────

function StrategyTab({ role }: { role: string }) {
  const [sub, setSub] = useState<'chain' | 'team' | 'events'>('chain')
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b shrink-0 px-4 bg-background overflow-x-auto">
        {[
          { id: 'chain'  as const, label: 'Chain'  },
          { id: 'team'   as const, label: 'Team'   },
          { id: 'events' as const, label: 'Events' },
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
      <PanelErrorBoundary name={`Mind · Strategy · ${sub}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden">
            {sub === 'chain' && (
              role === 'owner' ? <ChainPage /> : (
                <NonIdealState
                  icon="lightbulb"
                  title="Chain benchmarking is available to owner role only"
                />
              )
            )}
            {sub === 'team'   && <TeamIntelligencePage />}
            {sub === 'events' && <EventDemandPage />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}

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

type PanelId = 'triage' | 'suppliers' | 'finance' | 'strategy'

// Backward-compat redirect map: old panel IDs → new panel
const PANEL_REDIRECT: Partial<Record<string, PanelId>> = {
  'operations':   'triage',
  'procurement':  'suppliers',   // + SUPPLIERS_SUB_SEED maps it → po-builder
  'contracts':    'suppliers',
  'leverage':     'suppliers',
  'dispatch':     'suppliers',
  'proposals':    'triage',
  'par':          'triage',
  'categories':   'triage',
  'menu':         'triage',
  'intelligence': 'finance',
  'financial':    'finance',
  'gl':           'finance',
  'chain':        'strategy',
  'team':         'strategy',
  'events':       'strategy',
}

// Deep-link sub-tab seeds: if the raw panel was one of these, open that sub-tab directly
const TRIAGE_SUB_SEED: Record<string, 'operations' | 'categories' | 'proposals'> = {
  'categories': 'categories',
  'menu':       'categories',
  'par':        'categories',
  'proposals':  'proposals',
}

const SUPPLIERS_SUB_SEED: Record<string, 'browser' | 'reliability' | 'contracts' | 'po-builder' | 'dispatch' | 'leverage' | 'quote-parser'> = {
  'leverage':    'leverage',
  'contracts':   'contracts',
  'dispatch':    'dispatch',
  'procurement': 'po-builder',
}

// ─── Suppliers tab ─────────────────────────────────────────────────────────────
// Sub-tabs ordered by the PO lifecycle:
//   Suppliers → Reliability → Contracts → PO Builder → PO Dispatch → Leverage → Quote Parser

function SuppliersTab({ initialSub }: { initialSub: 'browser' | 'reliability' | 'contracts' | 'po-builder' | 'dispatch' | 'leverage' | 'quote-parser' }) {
  const [sub, setSub] = useState<'browser' | 'reliability' | 'contracts' | 'po-builder' | 'dispatch' | 'leverage' | 'quote-parser'>(initialSub)
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b shrink-0 px-4 bg-background overflow-x-auto">
        {[
          { id: 'browser'      as const, label: 'Suppliers'    },
          { id: 'reliability'  as const, label: 'Reliability'  },
          { id: 'contracts'    as const, label: 'Contracts'    },
          { id: 'po-builder'   as const, label: 'PO Builder'   },
          { id: 'dispatch'     as const, label: 'PO Dispatch'  },
          { id: 'leverage'     as const, label: 'Leverage'     },
          { id: 'quote-parser' as const, label: 'Quote Parser' },
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
      <PanelErrorBoundary name={`Mind · Suppliers · ${sub}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden flex flex-col">
            {sub === 'browser'      && <SupplierBrowserPage />}
            {sub === 'reliability'  && <SupplierReliabilityPage />}
            {sub === 'contracts'    && <ContractsPage />}
            {sub === 'po-builder'   && <PurchaseOrderPage />}
            {sub === 'dispatch'     && <PODispatchPage />}
            {sub === 'leverage'     && <ProcurementLeveragePage />}
            {sub === 'quote-parser' && <SupplierQuoteParserPage />}
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
      <PanelErrorBoundary name={`Mind · Triage · ${sub}`}>
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

type OpsTab = 'triage' | 'suppliers' | 'finance' | 'strategy'

const OPS_TABS: { id: OpsTab; label: string }[] = [
  { id: 'triage',    label: 'Triage'    },
  { id: 'suppliers', label: 'Suppliers' },
  { id: 'finance',   label: 'Finance'   },
  { id: 'strategy',  label: 'Strategy'  },
]

export function OperationsPanel({ initialPanel }: { initialPanel?: string }) {
  const role = useAuthStore((s) => s.role ?? 'limited_access')
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
      <PanelErrorBoundary name={`Mind · Operations · ${tab}`}>
        <Suspense fallback={<PanelLoader />}>
          <div className="flex-1 overflow-hidden flex flex-col">
            {tab === 'triage'    && <TriageTab initialSub={TRIAGE_SUB_SEED[raw] ?? 'operations'} />}
            {tab === 'suppliers' && <SuppliersTab initialSub={SUPPLIERS_SUB_SEED[raw] ?? 'browser'} />}
            {tab === 'finance'   && <FinancialTab />}
            {tab === 'strategy'  && <StrategyTab role={role} />}
          </div>
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}
