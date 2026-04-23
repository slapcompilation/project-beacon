// Layer: Mind — Consolidated supplier + procurement + finance workspace
// Replaces: ProcurementPage, NegotiationPrepPage, InvoicingPage, GLExportPage,
//           SavedOrdersPage, POMatchPage (all now tabs in one surface)
//
// Palantir principle #6: cross-domain synthesis. The operator sees one object
// (supplier intelligence) from all angles — not 5 separate pages.
//
// Tabs:
//   Operations  — triage: supplier risk + discrepancies + mind briefing actions
//   Procurement — supplier list + POs + 3-way match (existing ProcurementPage)
//   Intelligence — cost analysis (NegotiationPrep) + leverage (Invoicing) sub-tabs
//   GL Export    — existing GLExportPage

import { useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { format, isPast, isToday, isTomorrow } from 'date-fns'
import {
  ShieldAlert, AlertTriangle, Check, Loader2, ChevronRight,
  CheckCircle2, Brain, Package, Clock, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useAuthStore } from '@/stores/auth.store'
import { useSupplierSynthesis, usePODiscrepancies, useReviewPODiscrepancy, usePOSummary } from '@/features/mind/hooks'
import { useBriefingActions } from '@/features/briefing/hooks'
import type { SupplierSynthesisRow, PODiscrepancy, BriefingAction, POSummaryRow } from '@beacon/types'
import GLExportPage from './GLExportPage'
import ChainPage from './ChainPage'
import EventDemandPage from './EventDemandPage'
import FBIntelligencePage from './FBIntelligencePage'
import TeamIntelligencePage from './TeamIntelligencePage'
import CPORDashboard from './CPORDashboard'
import BudgetTrackerPage from './BudgetTrackerPage'

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
    <div className="rounded-lg border divide-y">
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
          <button
            type="button"
            onClick={() => { void navigate(a.action_url) }}
            className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            {a.action_label} <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

function SupplierRiskTriage({ rows, currency }: { rows: SupplierSynthesisRow[]; currency: string }) {
  const actionable = rows.filter((r) => r.urgency_tier === 'critical' || r.urgency_tier === 'review')
  if (actionable.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-6 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldAlert className="h-4 w-4" />
        All suppliers within acceptable thresholds
      </div>
    )
  }
  return (
    <div className="rounded-lg border divide-y">
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
    </div>
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
    <div className="rounded-lg border px-4 py-6 flex items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  )

  if (pending.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-6 flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-green-500/60" />
        No invoice discrepancies pending review
      </div>
    )
  }

  return (
    <div className="rounded-lg border divide-y">
      <div className="px-4 py-2 bg-muted/30 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Invoice Discrepancies · {pending.length}
        </p>
        {autoApprovable.length > 0 && (
          <button
            type="button"
            disabled={autoApproving}
            onClick={() => { void handleAutoApprove() }}
            className="flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400 hover:underline disabled:opacity-50"
          >
            {autoApproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve {autoApprovable.length} ≤2%
          </button>
        )}
      </div>
      {pending.slice(0, 5).map((d: PODiscrepancy) => {
        const overbilled = d.invoiced_value > d.received_value
        const amount = Math.abs(d.invoiced_value - d.received_value)
        return (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
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
    </div>
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
    <div className="rounded-lg border px-4 py-6 flex items-center justify-center">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  )

  if (sorted.length === 0) return (
    <div className="rounded-lg border px-4 py-6 flex items-center gap-2 text-xs text-muted-foreground">
      <Package className="h-4 w-4" />
      No open purchase orders
    </div>
  )

  return (
    <div className="rounded-lg border divide-y">
      {/* Header */}
      <div className="px-4 py-2 bg-muted/30 flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Open POs · {sorted.length}
          {overdueCount > 0 && (
            <span className="ml-1.5 text-red-600 dark:text-red-400">· {overdueCount} overdue</span>
          )}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            <TrendingDown className="inline h-3 w-3 mr-0.5 -mt-px" />
            {formatCurrency(totalOpen, currency)} open value
          </span>
          <button
            type="button"
            onClick={() => { void navigate('/mind?panel=procurement') }}
            className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
          >
            All POs <ChevronRight className="h-3 w-3" />
          </button>
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
                <span className={cn('text-[10px]', eta.cls)}>
                  <Clock className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />
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
    </div>
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
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
        <div className="flex-1 overflow-hidden">
          {sub === 'cpor'   && <CPORDashboard />}
          {sub === 'budget' && <BudgetTrackerPage />}
          {sub === 'gl'     && <GLExportPage />}
          {sub === 'fb'     && <FBIntelligencePage />}
        </div>
      </PanelErrorBoundary>
    </div>
  )
}

// ─── Strategy sub-tabs (Chain + Team + Events) ───────────────────────────────

function StrategyTab({ role }: { role: string }) {
  const [sub, setSub] = useState<'chain' | 'team' | 'events'>('chain')
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b shrink-0 px-4 bg-background">
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
      <PanelErrorBoundary name={`Mind · Strategy · ${sub}`}>
        <div className="flex-1 overflow-hidden">
          {sub === 'chain' && (
            role === 'owner' ? <ChainPage /> : (
              <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
                <Brain className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Chain benchmarking is available to owner role only.</p>
              </div>
            )
          )}
          {sub === 'team'   && <TeamIntelligencePage />}
          {sub === 'events' && <EventDemandPage />}
        </div>
      </PanelErrorBoundary>
    </div>
  )
}

// ─── Main workspace ───────────────────────────────────────────────────────────
// Four panels — each maps to one ontological domain.
// Old panel IDs (contracts, procurement, leverage, etc.) redirect to their parent domain
// so existing deep-links from object pages and briefing actions continue to work.

import SupplierBrowserPage from './SupplierBrowserPage'

type PanelId = 'triage' | 'suppliers' | 'finance' | 'strategy'

// Backward-compat redirect map: old panel IDs → new panel
const PANEL_REDIRECT: Record<string, PanelId> = {
  'operations':   'triage',
  'procurement':  'suppliers',
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

const PANELS: { id: PanelId; label: string }[] = [
  { id: 'triage',    label: 'Mind · Triage'    },
  { id: 'suppliers', label: 'Mind · Suppliers' },
  { id: 'finance',   label: 'Mind · Finance'   },
  { id: 'strategy',  label: 'Mind · Strategy'  },
]

export default function MindWorkspace() {
  const role = useAuthStore((s) => s.role ?? 'limited_access')
  const [params, setParams] = useSearchParams()
  const raw = params.get('panel') ?? 'triage'

  // Resolve old panel IDs to new ones for backward compat
  const resolved: PanelId =
    (PANELS.some((p) => p.id === raw) ? raw as PanelId : null)
    ?? PANEL_REDIRECT[raw]
    ?? 'triage'

  if (role !== 'admin' && role !== 'owner') {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
        <Brain className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Mind layer is available to admin and owner roles only.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top-level panel selector */}
      <div className="flex border-b shrink-0 bg-background">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setParams({ panel: p.id }, { replace: true }) }}
            className={cn(
              'px-5 py-3 text-sm font-medium border-b-2 transition-colors -mb-px',
              resolved === p.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <PanelErrorBoundary name={`Mind · ${resolved}`}>
        <div className="flex-1 overflow-hidden flex flex-col">
          {resolved === 'triage'    && <OperationsTab />}
          {resolved === 'suppliers' && <SupplierBrowserPage />}
          {resolved === 'finance'   && <FinancialTab />}
          {resolved === 'strategy'  && <StrategyTab role={role} />}
        </div>
      </PanelErrorBoundary>
    </div>
  )
}
