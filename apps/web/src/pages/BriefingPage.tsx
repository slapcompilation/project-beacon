// Layer: Cross-layer — Briefing (Sprint 12 + 13 + A)
// The command center. Ranked decision feed from get_briefing_actions() surfaces
// what to do today across all layers. PressureSection shows the forward-looking
// depletion list (days_until_zero sorted ASC). Shift-activity audit lives below.
// Sprint A additions:
//   SituationBanner — cross-domain escalation banner (fused situation score)
//   ProposalsPanel  — batch autonomous proposal approval with "Approve All"
// Palantir principle: the system has already done the analysis before you open it.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { subHours, format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  PackageMinus, Package, Package2, Scale, AlertTriangle, CalendarX,
  FileQuestion, FileDown, CheckCircle2, RefreshCw, Loader2,
  ChevronDown, ChevronRight, Clipboard, ClipboardCheck,
  Users, ArrowUp, RotateCcw, Flame, PackageCheck,
  Zap, ShieldAlert, Truck, TrendingUp, Trash2, Activity,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import {
  useBriefingActions, useApproveRestockProposal, useSituationScore,
  useCaptureSnapshot, snapshotCapturedToday, useIntelligenceHistory,
} from '@/features/briefing/hooks'
import { useStockPressure } from '@/features/eye/hooks'
import { useShiftActivity } from '@/features/inventory/hooks/reports'
import { useProducts } from '@/features/inventory/hooks'
import { useTeamMembers } from '@/features/team/hooks'
import { useConsumptionForecast } from '@/features/eye/hooks'
import { useRestockRequests, useCreateRestockRequest } from '@/features/restock/hooks'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { useCurrency } from '@/hooks/useCurrency'
import type { BriefingAction, BriefingActionType, SituationIncident } from '@beacon/types'
import type { AuditLogRow } from '@/features/inventory/api/reports'

// ─── Situation Banner — cross-domain escalation ───────────────────────────────

const DOMAIN_ICON: Record<SituationIncident['domain'], React.ElementType> = {
  stock:     Package2,
  waste:     Trash2,
  suppliers: Truck,
  demand:    TrendingUp,
}

const SITUATION_CFG = {
  critical: {
    border:    'border-red-300 dark:border-red-800',
    bg:        'bg-red-50/60 dark:bg-red-950/20',
    headerBg:  'bg-red-100/80 dark:bg-red-950/40',
    iconCls:   'text-red-600 dark:text-red-400',
    levelCls:  'text-red-700 dark:text-red-400 font-bold',
    badge:     'bg-red-600 text-white',
  },
  elevated: {
    border:    'border-amber-300 dark:border-amber-800',
    bg:        'bg-amber-50/40 dark:bg-amber-950/10',
    headerBg:  'bg-amber-100/60 dark:bg-amber-950/30',
    iconCls:   'text-amber-600 dark:text-amber-400',
    levelCls:  'text-amber-700 dark:text-amber-400 font-bold',
    badge:     'bg-amber-500 text-white',
  },
} as const

function SituationBanner() {
  const { data } = useSituationScore()
  const [open, setOpen] = useState(true)

  if (!data || data.level === 'nominal') return null

  const cfg = SITUATION_CFG[data.level]

  return (
    <div className={cn('rounded-lg border overflow-hidden', cfg.border, cfg.bg)}>
      {/* Header row */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className={cn('w-full flex items-center gap-3 px-4 py-3 transition-colors text-left', cfg.headerBg)}
      >
        <ShieldAlert className={cn('h-4 w-4 shrink-0', cfg.iconCls)} />
        <span className={cn('text-xs uppercase tracking-widest flex-1', cfg.levelCls)}>
          Situation: {data.level}
        </span>
        {/* Score bar */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full', data.level === 'critical' ? 'bg-red-500' : 'bg-amber-500')}
              style={{ width: `${data.score}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-muted-foreground">{data.score}/100</span>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {data.incidents.length} signal{data.incidents.length !== 1 ? 's' : ''}
        </span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {/* Incident list */}
      {open && data.incidents.length > 0 && (
        <div className="divide-y divide-black/5 dark:divide-white/5">
          {data.incidents.map((inc, i) => {
            const Icon = DOMAIN_ICON[inc.domain]
            const isCrit = inc.severity === 'critical'
            return (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <div className={cn(
                  'h-6 w-6 rounded flex items-center justify-center shrink-0 mt-0.5',
                  isCrit ? 'bg-red-100 dark:bg-red-950/40' : 'bg-amber-100 dark:bg-amber-950/40',
                )}>
                  <Icon className={cn('h-3.5 w-3.5', isCrit ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold leading-snug', isCrit ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400')}>
                    {inc.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{inc.context}</p>
                </div>
              </div>
            )
          })}
          <p className="px-4 py-2 text-[10px] text-muted-foreground/60">
            Cross-domain synthesis · based on live stock, waste, PO, and occupancy data
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Proposals Panel — autonomous batch approval ───────────────────────────────

function ProposalsPanel({ currency }: { currency: string }) {
  const navigate           = useNavigate()
  const { data: actions = [] } = useBriefingActions()
  const approveProposal    = useApproveRestockProposal()

  const proposals = useMemo(
    () => actions.filter((a) => a.action_type === 'restock_proposal'),
    [actions],
  )

  const [approving,     setApproving]     = useState(false)
  const [approvedCount, setApprovedCount] = useState(0)
  const [allDone,       setAllDone]       = useState(false)
  // Per-proposal done state
  const [donedIds, setDoneIds] = useState<Set<string>>(new Set())

  const estimatedTotal = useMemo(() =>
    proposals.reduce((sum, p) => {
      const qty  = p.metadata.suggested_qty as number
      const cost = (p.metadata.unit_cost as number | null) ?? 0
      return sum + qty * cost
    }, 0),
    [proposals],
  )

  const handleApproveAll = async () => {
    setApproving(true)
    setApprovedCount(0)
    let approved = 0
    for (const p of proposals) {
      if (!p.entity_id || donedIds.has(p.entity_id)) continue
      const m = p.metadata
      try {
        await approveProposal.mutateAsync({
          variantId:    p.entity_id,
          qty:          m.suggested_qty           as number,
          supplierId:   m.preferred_supplier_id   as string,
          supplierName: m.preferred_supplier_name as string,
          unitCost:     (m.unit_cost as number | null) ?? 0,
          leadDays:     Math.round((m.avg_lead_days as number | null) ?? 7),
        })
        approved++
        setApprovedCount((n) => n + 1)
        setDoneIds((prev) => new Set([...prev, p.entity_id!]))
      } catch {
        // Skip failed; continue with the rest
      }
    }
    setAllDone(true)
    setApproving(false)
    if (approved > 0) toast.success(`${approved} draft PO${approved > 1 ? 's' : ''} created — review in Procurement`)
  }

  if (proposals.length === 0) return null

  const pendingCount = proposals.filter((p) => p.entity_id && !donedIds.has(p.entity_id)).length

  return (
    <div className="rounded-lg border border-green-200 dark:border-green-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-green-50/60 dark:bg-green-950/20 border-b border-green-100 dark:border-green-900/30">
        <Activity className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-green-700 dark:text-green-400 uppercase tracking-widest">
            {proposals.length} Autonomous Proposal{proposals.length > 1 ? 's' : ''} Ready
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            System-generated from consumption trends · one-tap approval creates draft POs
            {estimatedTotal > 0 && ` · est. ${formatCurrency(estimatedTotal, currency)} total`}
          </p>
        </div>

        {allDone ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            onClick={() => { void navigate('/mind?panel=procurement') }}
          >
            View Procurement →
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs shrink-0 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            disabled={approving || pendingCount === 0}
            onClick={() => { void handleApproveAll() }}
          >
            {approving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                {approvedCount}/{pendingCount}…
              </>
            ) : (
              <>
                <PackageCheck className="h-3 w-3" />
                Approve All {pendingCount > 1 ? `${pendingCount} ` : ''}& Create POs
              </>
            )}
          </Button>
        )}
      </div>

      {/* Proposal rows */}
      <div className="divide-y">
        {proposals.map((p) => {
          const m         = p.metadata
          const qty       = m.suggested_qty           as number
          const supplier  = m.preferred_supplier_name as string
          const cost      = (m.unit_cost as number | null) ?? 0
          const days      = Math.round(m.days_until_zero as number)
          const leadDays  = Math.round((m.avg_lead_days as number | null) ?? 7)
          const isDone    = p.entity_id != null && donedIds.has(p.entity_id)

          return (
            <div key={`${p.entity_id}`} className={cn('flex items-center gap-3 px-4 py-3', isDone && 'opacity-50')}>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold leading-snug truncate">
                  {p.entity_id
                    ? <Link to={`/variant/${p.entity_id}`} className="hover:underline" onClick={(e) => { e.stopPropagation() }}>{p.entity_label}</Link>
                    : p.entity_label
                  }
                  {isDone && (
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-wide text-green-600 dark:text-green-400">PO Created</span>
                  )}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                  {qty} units from {supplier}
                  {cost > 0 && ` · est. ${formatCurrency(qty * cost, currency)}`}
                  {` · ${days}d runway · ${leadDays}d lead time`}
                </p>
              </div>
              {!isDone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-[10px] px-2 shrink-0 border-green-200 dark:border-green-900/50 text-green-700 dark:text-green-400 hover:bg-green-50"
                  disabled={approving}
                  onClick={() => {
                    void approveProposal.mutateAsync({
                      variantId:    p.entity_id!,
                      qty,
                      supplierId:   m.preferred_supplier_id   as string,
                      supplierName: supplier,
                      unitCost:     cost,
                      leadDays,
                    }).then(() => {
                      setDoneIds((prev) => new Set([...prev, p.entity_id!]))
                      toast.success('Draft PO created')
                    }).catch(() => { toast.error('Failed to create PO') })
                  }}
                >
                  Approve
                </Button>
              )}
            </div>
          )
        })}
      </div>
      <div className="px-4 py-2 border-t bg-muted/10">
        <p className="text-[10px] text-muted-foreground/60">
          Based on 30-day avg consumption · lead times from supplier records · excludes items with open POs
        </p>
      </div>
    </div>
  )
}

// ─── Situation Timeline — 30-day sparkline ────────────────────────────────────

const LEVEL_COLOR = {
  critical: '#ef4444',
  elevated: '#f59e0b',
  nominal:  '#22c55e',
} as const

function SituationTimeline() {
  const { data: rows = [], isLoading } = useIntelligenceHistory(30)

  if (isLoading || rows.length < 2) return null

  const W = 320
  const H = 48
  const PAD = 6

  const scores  = rows.map((r) => r.situation_score)
  const maxScore = Math.max(...scores, 1)
  const pts = rows.map((r, i) => {
    const x = PAD + (i / (rows.length - 1)) * (W - PAD * 2)
    const y = H - PAD - ((r.situation_score / maxScore) * (H - PAD * 2))
    return { x, y, row: r }
  })

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

  // Latest snapshot freshness label
  const latest = rows[rows.length - 1]
  const latestDate = new Date(latest.captured_at)
  const today = new Date()
  const isToday = latestDate.toDateString() === today.toDateString()
  const freshnessLabel = isToday
    ? `Analyzed today at ${format(latestDate, 'HH:mm')}`
    : `Last analyzed ${formatDistanceToNow(latestDate, { addSuffix: true })}`

  return (
    <div className="rounded-lg border bg-muted/5 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          30-day situation history
        </p>
        <p className="text-[10px] text-muted-foreground">{freshnessLabel}</p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10 overflow-visible">
        {/* Area fill */}
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${path} L${pts[pts.length - 1].x.toFixed(1)},${H} L${pts[0].x.toFixed(1)},${H} Z`}
          fill="url(#sparkGrad)"
        />
        {/* Line */}
        <path d={path} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Dots — colored by level */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2.5"
            fill={LEVEL_COLOR[p.row.situation_level as keyof typeof LEVEL_COLOR]}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-1">
        {(['critical', 'elevated', 'nominal'] as const).map((lvl) => (
          <span key={lvl} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: LEVEL_COLOR[lvl] }} />
            {lvl}
          </span>
        ))}
        <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
          {rows.length} snapshot{rows.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  )
}

// ─── Get Started banner — onboarding prompt for empty hotels ──────────────────

function GetStartedBanner() {
  const navigate = useNavigate()
  const { data: products = [], isLoading } = useProducts()

  if (isLoading || products.length > 0) return null

  return (
    <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 px-5 py-4 flex items-start gap-4">
      <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center shrink-0">
        <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">
          Welcome — let's set up your hotel
        </p>
        <p className="text-xs text-indigo-700/70 dark:text-indigo-400/70 mt-0.5 leading-relaxed">
          No products yet. Run the setup wizard to import your inventory, add your first supplier, and set par levels.
          Takes about 5 minutes.
        </p>
      </div>
      <Button
        size="sm"
        className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
        onClick={() => { void navigate('/setup') }}
      >
        Get started →
      </Button>
    </div>
  )
}

// ─── Action type config ────────────────────────────────────────────────────────

const ACTION_CFG: Record<BriefingActionType, {
  icon: React.ElementType
  iconCls: string
  groupHint?: string   // extra context label shown on the card
}> = {
  restock_proposal:           { icon: PackageCheck,  iconCls: 'text-green-600',  groupHint: 'Auto-Propose' },
  supplier_risk:              { icon: AlertTriangle, iconCls: 'text-red-500',    groupHint: 'Supplier' },
  low_stock_no_po:            { icon: PackageMinus,  iconCls: 'text-red-500',    groupHint: 'Stock' },
  invoice_discrepancy:        { icon: Scale,         iconCls: 'text-orange-500', groupHint: 'Finance' },
  waste_spike_low_occupancy:  { icon: AlertTriangle, iconCls: 'text-red-500',    groupHint: 'Waste' },
  expiry_soon:                { icon: CalendarX,     iconCls: 'text-red-500',    groupHint: 'Expiry' },
  low_stock_po_in_flight:     { icon: Package,       iconCls: 'text-amber-500',  groupHint: 'Stock' },
  waste_spike_high_occupancy: { icon: AlertTriangle, iconCls: 'text-amber-400',  groupHint: 'Waste' },
  gl_unmapped:                { icon: FileQuestion,  iconCls: 'text-orange-500', groupHint: 'GL' },
  gl_period_ending:           { icon: FileDown,      iconCls: 'text-blue-500',   groupHint: 'GL' },
}

// Priority bands
const BAND = (p: number) => p <= 1 ? 'act' : p <= 3 ? 'monitor' : 'info'
const BAND_CFG = {
  act:     { label: 'Act now',      labelCls: 'text-red-700 dark:text-red-400',   dividerCls: 'border-red-200   dark:border-red-900/40' },
  monitor: { label: 'Monitor',      labelCls: 'text-amber-700 dark:text-amber-400', dividerCls: 'border-amber-200 dark:border-amber-900/40' },
  info:    { label: 'Informational',labelCls: 'text-muted-foreground',             dividerCls: 'border-border' },
}

// ─── Action card ──────────────────────────────────────────────────────────────

function ActionCard({ action, currency }: { action: BriefingAction; currency: string }) {
  const navigate        = useNavigate()
  const createRestock   = useCreateRestockRequest()
  const approveProposal = useApproveRestockProposal()
  const cfg  = ACTION_CFG[action.action_type]
  const Icon = cfg.icon
  const band = BAND(action.priority)

  const [restockExpanded, setRestockExpanded] = useState(false)
  const [restockDone, setRestockDone]         = useState(false)
  const [proposalDone, setProposalDone]       = useState(false)
  const [restockQty, setRestockQty]           = useState<number>(() => {
    if (action.action_type === 'low_stock_no_po') {
      const thr   = action.metadata.threshold   as number | undefined
      const stock = action.metadata.current_stock as number
      return thr != null ? Math.max(1, thr - stock) : 1
    }
    return 1
  })

  const handleApproveProposal = async () => {
    if (!action.entity_id) return
    const m = action.metadata
    try {
      await approveProposal.mutateAsync({
        variantId:    action.entity_id,
        qty:          m.suggested_qty    as number,
        supplierId:   m.preferred_supplier_id   as string,
        supplierName: m.preferred_supplier_name as string,
        unitCost:     (m.unit_cost  as number | null) ?? 0,
        leadDays:     Math.round((m.avg_lead_days as number | null) ?? 7),
      })
      setProposalDone(true)
      toast.success('Draft PO created — review in Procurement')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create PO')
    }
  }

  // Extra inline context derived from metadata
  const metaLine = useMemo(() => {
    const m = action.metadata
    if (action.action_type === 'restock_proposal') {
      const qty  = m.suggested_qty           as number
      const supp = m.preferred_supplier_name as string
      const cost = m.unit_cost               as number | null
      const days = m.days_until_zero         as number
      return `${qty} units from ${supp}`
        + (cost != null && cost > 0 ? ` · est. ${formatCurrency(qty * cost, currency)}` : '')
        + ` · ${Math.round(days)}d runway`
    }
    if (action.action_type === 'supplier_risk') {
      const tier    = m.urgency_tier      as string
      const score   = m.urgency_score     as number
      const reasons = m.reasons           as string[] | undefined
      const top     = reasons?.[0] ?? tier
      return `Score ${score} · ${top}`
    }
    if (action.action_type === 'invoice_discrepancy') {
      const pct = m.variance_pct as number
      const inv = m.invoiced_value as number
      const rec = m.received_value as number
      return `${formatCurrency(inv, currency)} invoiced · ${formatCurrency(rec, currency)} received · ${pct.toFixed(1)}% gap`
    }
    if (action.action_type === 'low_stock_no_po' || action.action_type === 'low_stock_po_in_flight') {
      const stock = m.current_stock as number
      const thr   = m.threshold as number | undefined
      return thr != null ? `${stock} / ${thr} par` : `${stock} units`
    }
    if (action.action_type === 'waste_spike_low_occupancy' || action.action_type === 'waste_spike_high_occupancy') {
      const pct = m.pct_above as number
      const occ = m.occupancy as number
      return `${pct}% above weekly avg · ${occ}% occupancy`
    }
    if (action.action_type === 'expiry_soon') {
      const val = m.value_at_risk as number
      return val > 0 ? `${formatCurrency(val, currency)} at risk` : null
    }
    if (action.action_type === 'gl_unmapped') {
      return `${String(m.unmapped_count)} items unmapped`
    }
    if (action.action_type === 'gl_period_ending') {
      return `${String(m.total)} transactions ready`
    }
    return null
  }, [action, currency])

  // Object page link — variants for stock/waste/expiry, suppliers for risk/invoice
  const objectUrl = action.entity_id
    ? (action.action_type === 'supplier_risk' || action.action_type === 'invoice_discrepancy')
      ? `/supplier/${action.entity_id}`
      : (action.action_type === 'gl_unmapped' || action.action_type === 'gl_period_ending')
      ? null
      : `/variant/${action.entity_id}`
    : null

  const handleNavigate = () => {
    // Waste spikes should open the Flow Timeline at that variant, not the approval queue.
    const isWasteSpike =
      action.action_type === 'waste_spike_low_occupancy' ||
      action.action_type === 'waste_spike_high_occupancy'
    const url = isWasteSpike && action.entity_id ? '/timeline' : action.action_url
    void navigate(url, {
      state: {
        fromBriefing:    true,
        actionType:      action.action_type,
        entityLabel:     action.entity_label,
        entityId:        action.entity_id,
        focusVariantId:  isWasteSpike ? action.entity_id : undefined,
        focusLabel:      isWasteSpike ? action.entity_label : undefined,
      },
    })
  }

  const handleInlineRestock = async () => {
    if (!action.entity_id) return
    try {
      await createRestock.mutateAsync({
        variantId:     action.entity_id,
        quantityNeeded: restockQty,
        notes: `Requested from Briefing feed · ${new Date().toLocaleDateString()}`,
      })
      setRestockDone(true)
      setRestockExpanded(false)
      toast.success('Restock request created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create request')
    }
  }

  return (
    <div className={cn(
      'px-5 py-3.5 border-b last:border-b-0 hover:bg-muted/30 transition-colors',
      band === 'act' && 'bg-red-50/30 dark:bg-red-950/10',
    )}>
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
          band === 'act'     ? 'bg-red-100 dark:bg-red-950/40' :
          band === 'monitor' ? 'bg-amber-100 dark:bg-amber-950/40' :
          'bg-muted',
        )}>
          <Icon className={cn('h-4 w-4', cfg.iconCls)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {objectUrl
              ? (
                <Link
                  to={objectUrl}
                  className="text-sm font-semibold leading-snug hover:underline"
                  onClick={(e) => { e.stopPropagation() }}
                >
                  {action.entity_label}
                </Link>
              )
              : <span className="text-sm font-semibold leading-snug">{action.entity_label}</span>
            }
            {cfg.groupHint && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 font-normal text-muted-foreground">
                {cfg.groupHint}
              </Badge>
            )}
            {restockDone && (
              <Badge className="text-[10px] h-4 px-1 py-0 bg-green-100 text-green-700 border-green-200">
                Requested
              </Badge>
            )}
            {proposalDone && (
              <Badge className="text-[10px] h-4 px-1 py-0 bg-green-100 text-green-700 border-green-200">
                PO Created
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{action.context}</p>
          {metaLine && (
            <p className={cn(
              'text-xs font-medium mt-1 tabular-nums',
              band === 'act'     ? 'text-red-700 dark:text-red-400' :
              band === 'monitor' ? 'text-amber-700 dark:text-amber-400' :
              'text-muted-foreground',
            )}>
              {metaLine}
            </p>
          )}
        </div>

        {/* CTAs */}
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          {/* Inline restock expand (only for low_stock_no_po, not yet done) */}
          {action.action_type === 'low_stock_no_po' && !restockDone && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400"
              onClick={() => { setRestockExpanded((v) => !v) }}
            >
              Quick restock
              <ChevronDown className={cn('h-3 w-3 ml-0.5 transition-transform', restockExpanded && 'rotate-180')} />
            </Button>
          )}
          {/* Autonomous proposal: one-tap Approve & Create PO */}
          {action.action_type === 'restock_proposal' && !proposalDone && (
            <Button
              size="sm"
              className="text-xs h-7 px-2.5 gap-1 bg-green-600 hover:bg-green-700 text-white"
              disabled={approveProposal.isPending}
              onClick={() => { void handleApproveProposal() }}
            >
              {approveProposal.isPending
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><PackageCheck className="h-3 w-3" />Approve & Create PO</>
              }
            </Button>
          )}
          {/* After approval: navigate to the new draft PO */}
          {action.action_type === 'restock_proposal' && proposalDone && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 px-2.5"
              onClick={() => { void navigate('/procurement?tab=saved') }}
            >
              View PO
            </Button>
          )}
          {/* Standard navigate button — suppressed for restock_proposal (replaced above) */}
          {action.action_type !== 'restock_proposal' && (
            <Button
              size="sm"
              variant={band === 'act' ? 'default' : 'outline'}
              className={cn(
                'text-xs h-7 px-2.5',
                band === 'act'     ? 'bg-red-600 hover:bg-red-700 text-white' :
                band === 'monitor' ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : '',
              )}
              onClick={handleNavigate}
            >
              {action.action_label}
            </Button>
          )}
        </div>
      </div>

      {/* Inline restock form */}
      {restockExpanded && action.action_type === 'low_stock_no_po' && (
        <div className="mt-3 ml-11 flex items-center gap-2 p-3 rounded-lg bg-muted/40 border border-red-100 dark:border-red-900/30">
          <label className="text-xs text-muted-foreground shrink-0">Qty to request:</label>
          <input
            type="number"
            min={1}
            value={restockQty}
            onChange={(e) => { setRestockQty(Math.max(1, Number(e.target.value))) }}
            className="w-20 h-7 rounded border border-input bg-background px-2 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-[10px] text-muted-foreground flex-1">
            Pre-filled: par − current stock
            {action.metadata.days_left != null && ` · ~${String(action.metadata.days_left)}d at current rate`}
          </p>
          <Button
            size="sm"
            className="h-7 text-xs bg-red-600 hover:bg-red-700 text-white"
            disabled={createRestock.isPending}
            onClick={() => { void handleInlineRestock() }}
          >
            {createRestock.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => { setRestockExpanded(false) }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Priority group ────────────────────────────────────────────────────────────

function PriorityGroup({
  band, actions, currency,
}: {
  band: 'act' | 'monitor' | 'info'
  actions: BriefingAction[]
  currency: string
}) {
  const cfg = BAND_CFG[band]
  const [open, setOpen] = useState(band !== 'info')

  if (actions.length === 0) return null

  return (
    <div className={cn('rounded-lg border overflow-hidden', cfg.dividerCls)}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <span className={cn('text-xs font-semibold uppercase tracking-wider', cfg.labelCls)}>
          {cfg.label}
        </span>
        <span className={cn('text-xs font-bold tabular-nums ml-auto', cfg.labelCls)}>
          {actions.length}
        </span>
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div>
          {actions.map((a, i) => (
            <ActionCard key={`${a.action_type}-${a.entity_id ?? i}`} action={a} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Decision feed ─────────────────────────────────────────────────────────────

function DecisionFeed({ currency }: { currency: string }) {
  const { data: actions = [], isLoading, dataUpdatedAt, refetch, isRefetching } = useBriefingActions()

  // Sort by correlation_score DESC within each priority band
  // restock_proposal actions are handled by ProposalsPanel above the feed — exclude here
  const sortBand = (items: BriefingAction[]) =>
    [...items].sort((a, b) => b.correlation_score - a.correlation_score)

  const nonProposals = actions.filter((a) => a.action_type !== 'restock_proposal')
  const actNow   = sortBand(nonProposals.filter((a) => BAND(a.priority) === 'act'))
  const monitor  = sortBand(nonProposals.filter((a) => BAND(a.priority) === 'monitor'))
  const info     = sortBand(nonProposals.filter((a) => BAND(a.priority) === 'info'))

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt) : null

  return (
    <div className="space-y-3">
      {/* Feed header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">
            {isLoading ? 'Loading…' : nonProposals.length === 0 ? 'All clear' : `${nonProposals.length} item${nonProposals.length > 1 ? 's' : ''} need attention`}
          </h2>
          {lastUpdated && !isLoading && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => { void refetch() }}
          disabled={isRefetching}
          title="Refresh"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Checking all layers…</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && nonProposals.length === 0 && (
        <div className="rounded-lg border bg-muted/10 px-6 py-10 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-500/60" />
          <p className="text-sm font-medium">No action required right now</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            Stock levels are above par, no invoice discrepancies pending, no expiry warnings,
            and write-off patterns are within baseline.
          </p>
          {lastUpdated && (
            <p className="text-[10px] text-muted-foreground/60">
              Based on live data · {format(lastUpdated, 'HH:mm')}
            </p>
          )}
        </div>
      )}

      {/* Priority groups */}
      {!isLoading && nonProposals.length > 0 && (
        <>
          <PriorityGroup band="act"     actions={actNow}  currency={currency} />
          <PriorityGroup band="monitor" actions={monitor} currency={currency} />
          <PriorityGroup band="info"    actions={info}    currency={currency} />
        </>
      )}
    </div>
  )
}

// ─── Stock pressure (forward-looking depletion risk) ──────────────────────────
// Eye Layer intelligence surfaced at the command center level.
// Shows all variants running out within 14 days, sorted by days_until_zero ASC.
// Predictive: turns the Briefing from "problems that happened" to "problems
// about to happen" — the operator sees the gap before it becomes a crisis.

const TIER_CFG = {
  critical: { label: 'Critical',  cls: 'text-red-600 dark:text-red-400',    barCls: 'bg-red-500',    borderCls: 'border-red-100 dark:border-red-900/30'   },
  warning:  { label: 'Warning',   cls: 'text-amber-600 dark:text-amber-400', barCls: 'bg-amber-500',  borderCls: 'border-amber-100 dark:border-amber-900/30' },
  watch:    { label: 'Watch',     cls: 'text-yellow-600 dark:text-yellow-500',barCls: 'bg-yellow-400', borderCls: 'border-border'                             },
}

function PressureRow({ item }: { item: import('@beacon/types').StockPressureItem }) {
  const navigate = useNavigate()
  const tc = TIER_CFG[item.urgency_tier]
  const pct = Math.min(100, Math.max(2, (item.days_until_zero / 14) * 100))

  return (
    <div
      className={cn('flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer border-b last:border-b-0', tc.borderCls)}
      onClick={() => { void navigate(`/variant/${item.variant_id}`) }}
    >
      {/* Runway bar */}
      <div className="shrink-0 w-10">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full', tc.barCls)} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Label + basis */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-snug">{item.label}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {item.current_stock} units · {item.avg_daily_use}/day (30d avg)
        </p>
      </div>

      {/* Days countdown */}
      <div className="shrink-0 text-right">
        <p className={cn('text-sm font-bold tabular-nums leading-none', tc.cls)}>
          ~{item.days_until_zero}d
        </p>
        <p className="text-[10px] text-muted-foreground">left</p>
      </div>

      {/* PO badge or warning */}
      {item.open_po_number ? (
        <div className="shrink-0 flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/40 rounded px-1.5 py-0.5">
          <PackageCheck className="h-2.5 w-2.5" />
          {item.open_po_id
            ? <Link to={`/po/${item.open_po_id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>{item.open_po_number}</Link>
            : item.open_po_number
          }
          {item.expected_delivery && (
            <span className="text-muted-foreground ml-0.5">
              · {format(parseISO(item.expected_delivery), 'MMM d')}
            </span>
          )}
        </div>
      ) : (
        <div className="shrink-0 flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded px-1.5 py-0.5">
          <AlertTriangle className="h-2.5 w-2.5" />
          No PO
        </div>
      )}
    </div>
  )
}

function PressureSection() {
  const { data: items = [], isLoading } = useStockPressure()
  const [open, setOpen] = useState(true)

  const critical = items.filter((i) => i.urgency_tier === 'critical')
  const warning  = items.filter((i) => i.urgency_tier === 'warning')
  const watch    = items.filter((i) => i.urgency_tier === 'watch')

  if (!isLoading && items.length === 0) return null

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <Zap className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400 flex-1">
          Stock Pressure
        </span>
        {isLoading
          ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          : (
            <span className="text-xs font-bold tabular-nums text-muted-foreground">
              {critical.length > 0 && <span className="text-red-500">{critical.length} critical · </span>}
              {warning.length > 0 && <span className="text-amber-500">{warning.length} warning · </span>}
              {watch.length} watch
            </span>
          )}
        {open
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div>
          {/* Critical + warning always shown */}
          {[...critical, ...warning, ...watch].map((item) => (
            <PressureRow key={item.variant_id} item={item} />
          ))}
          <div className="px-4 py-2 bg-muted/10 border-t">
            <p className="text-[10px] text-muted-foreground">
              Based on 30-day avg consumption · items running out within 14 days · sorted by urgency
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shift activity (preserved from original, demoted below the fold) ──────────

function Section({
  icon: Icon, title, count, accent, children, defaultOpen = true,
}: {
  icon: React.ElementType; title: string; count?: number; accent?: string
  children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className="flex w-full items-center gap-3 px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        <Icon className={cn('h-4 w-4 flex-shrink-0', accent ?? 'text-muted-foreground')} />
        <span className="flex-1 text-sm font-semibold">{title}</span>
        {count != null && count > 0 && (
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>
        )}
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="divide-y">{children}</div>}
    </div>
  )
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex items-center gap-3 px-4 py-2.5 text-sm', className)}>{children}</div>
}

function SummaryStrip({ logs, currency, costMap }: { logs: AuditLogRow[]; currency: string; costMap: Map<string, number> }) {
  const nonReverts  = logs.filter((l) => !l.is_revert)
  const additions   = nonReverts.filter((l) => l.quantity_change > 0)
  const removals    = nonReverts.filter((l) => l.quantity_change < 0)
  const writeOffs   = nonReverts.filter((l) => l.quantity_change < 0 && l.removal_category)
  const corrections = logs.filter((l) => l.is_revert)

  const totalConsumedCost = removals.reduce((s, l) => s + (costMap.get(l.variant_id) ?? 0) * Math.abs(l.quantity_change), 0)
  const totalWasteCost    = writeOffs.reduce((s, l) => s + (costMap.get(l.variant_id) ?? 0) * Math.abs(l.quantity_change), 0)

  const stats = [
    { label: 'Events',     value: String(nonReverts.length),                                                        color: '' },
    { label: 'Added',      value: `+${String(additions.reduce((s, l) => s + l.quantity_change, 0))}`,               color: 'text-green-600 dark:text-green-400' },
    { label: 'Consumed',   value: String(removals.reduce((s, l) => s + Math.abs(l.quantity_change), 0)),            color: 'text-red-600 dark:text-red-400' },
    { label: 'Cost moved', value: formatCurrency(totalConsumedCost, currency),                                      color: '' },
    { label: 'Waste cost', value: formatCurrency(totalWasteCost, currency),                                         color: totalWasteCost > 0 ? 'text-orange-600 dark:text-orange-400' : '' },
    { label: 'Corrections',value: String(corrections.length),                                                        color: corrections.length > 0 ? 'text-amber-600 dark:text-amber-400' : '' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="rounded-lg border bg-card px-3 py-2.5 text-center">
          <p className={cn('text-lg font-bold tabular-nums leading-none', color)}>{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}

function ShiftActivity({
  windowHours, setWindowHours, currency,
}: {
  windowHours: 8 | 12 | 24 | 48
  setWindowHours: (v: 8 | 12 | 24 | 48) => void
  currency: string
}) {
  const navigate = useNavigate()
  const [shiftOpen, setShiftOpen] = useState(false)
  const since = useMemo(() => subHours(new Date(), windowHours).toISOString(), [windowHours])

  const { data: logs = [], isLoading }  = useShiftActivity(since)
  const { data: members = [] }          = useTeamMembers()
  const { data: forecast = [] }         = useConsumptionForecast(7)
  const { data: restocks = [] }         = useRestockRequests()
  const { data: products = [] }         = useProducts()

  const emailMap = useMemo(() => new Map(members.map((m) => [m.id, m.email])), [members])

  const costMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of products) for (const v of p.product_variants) m.set(v.id, v.cost)
    return m
  }, [products])

  const nonReverts  = logs.filter((l) => !l.is_revert)
  const additions   = nonReverts.filter((l) => l.quantity_change > 0)
  const writeOffs   = nonReverts.filter((l) => l.quantity_change < 0 && l.removal_category)
  const corrections = logs.filter((l) => l.is_revert)

  const staffBreakdown = useMemo(() => {
    const map = new Map<string, { email: string; added: number; removed: number; events: number }>()
    for (const l of nonReverts) {
      const key   = l.user_id ?? '__unknown__'
      const email = l.user_id ? (emailMap.get(l.user_id) ?? l.user_id.slice(0, 8) + '…') : 'System'
      const prev  = map.get(key) ?? { email, added: 0, removed: 0, events: 0 }
      map.set(key, { email, events: prev.events + 1, added: prev.added + (l.quantity_change > 0 ? l.quantity_change : 0), removed: prev.removed + (l.quantity_change < 0 ? Math.abs(l.quantity_change) : 0) })
    }
    return [...map.values()].sort((a, b) => b.events - a.events)
  }, [nonReverts, emailMap])

  const criticalForecasts = useMemo(() =>
    forecast.filter((f) => f.days_until_zero !== null && f.days_until_zero <= 3)
      .sort((a, b) => (a.days_until_zero ?? 99) - (b.days_until_zero ?? 99)),
    [forecast],
  )

  const pendingRestocks = useMemo(() => restocks.filter((r) => r.status === 'pending'), [restocks])

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        type="button"
        onClick={() => { setShiftOpen((v) => !v) }}
        className="flex w-full items-center gap-3 px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
      >
        <Flame className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 text-sm font-semibold text-muted-foreground">
          Shift Activity · last {windowHours}h
        </span>
        {isLoading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          : <span className="text-xs text-muted-foreground tabular-nums">{nonReverts.length} events</span>}
        {shiftOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {shiftOpen && (
        <div className="p-4 space-y-4 bg-muted/5">
          {/* Window selector */}
          <div className="flex items-center gap-1">
            {([8, 12, 24, 48] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => { setWindowHours(h) }}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded border transition-colors',
                  windowHours === h ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {h}h
              </button>
            ))}
          </div>

          <SummaryStrip logs={logs} currency={currency} costMap={costMap} />

          <div className="space-y-3">
            {staffBreakdown.length > 0 && (
              <Section icon={Users} title="Staff activity" count={staffBreakdown.length} defaultOpen>
                {staffBreakdown.map((s) => (
                  <Row key={s.email}>
                    <span className="flex-1 text-xs font-medium truncate">{s.email}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{s.events} events</span>
                    <span className="text-xs text-green-600 dark:text-green-400 tabular-nums">+{s.added}</span>
                    <span className="text-xs text-red-600 dark:text-red-400 tabular-nums">−{s.removed}</span>
                  </Row>
                ))}
              </Section>
            )}

            {additions.length > 0 && (
              <Section icon={ArrowUp} title="Stock added" count={additions.length} accent="text-green-500" defaultOpen={false}>
                {additions.map((l) => {
                  const name = l.variant_name !== 'Standard' ? `${l.product_name} — ${l.variant_name}` : l.product_name
                  const costImpact = costMap.get(l.variant_id)
                  return (
                    <Row key={l.id}>
                      <button
                        type="button"
                        onClick={() => { void navigate(`/flow?panel=timeline&variant=${l.variant_id}`) }}
                        className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                      >
                        {name}
                      </button>
                      {costImpact != null && (
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {formatCurrency(costImpact * l.quantity_change, currency)}
                        </span>
                      )}
                      <span className="text-xs text-green-600 dark:text-green-400 tabular-nums font-semibold">
                        +{l.quantity_change}
                      </span>
                    </Row>
                  )
                })}
              </Section>
            )}

            {writeOffs.length > 0 && (
              <Section icon={AlertTriangle} title="Write-offs" count={writeOffs.length} accent="text-orange-500" defaultOpen>
                {writeOffs.map((l) => {
                  const name = l.variant_name !== 'Standard' ? `${l.product_name} — ${l.variant_name}` : l.product_name
                  const costImpact = costMap.get(l.variant_id)
                  return (
                  <Row key={l.id}>
                    <button
                      type="button"
                      onClick={() => { void navigate(`/flow?panel=timeline&variant=${l.variant_id}`) }}
                      className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                    >
                      {name}
                    </button>
                    <Badge variant="outline" className="text-[10px] h-4">{l.removal_category}</Badge>
                    {costImpact != null && (
                      <span className="text-[11px] text-red-600 dark:text-red-400 tabular-nums">
                        -{formatCurrency(costImpact * Math.abs(l.quantity_change), currency)}
                      </span>
                    )}
                    <span className="text-xs text-orange-600 dark:text-orange-400 tabular-nums font-semibold">
                      −{Math.abs(l.quantity_change)}
                    </span>
                  </Row>
                  )
                })}
              </Section>
            )}

            {corrections.length > 0 && (
              <Section icon={RotateCcw} title="Corrections / reverts" count={corrections.length} accent="text-amber-500" defaultOpen={false}>
                {corrections.map((l) => {
                  const name = l.variant_name !== 'Standard' ? `${l.product_name} — ${l.variant_name}` : l.product_name
                  return (
                  <Row key={l.id}>
                    <button
                      type="button"
                      onClick={() => { void navigate(`/flow?panel=timeline&variant=${l.variant_id}`) }}
                      className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                    >
                      {name}
                    </button>
                    <span className={cn('text-xs tabular-nums font-semibold', l.quantity_change > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                      {l.quantity_change > 0 ? '+' : ''}{l.quantity_change}
                    </span>
                  </Row>
                  )
                })}
              </Section>
            )}

            {criticalForecasts.length > 0 && (
              <Section icon={AlertTriangle} title="Running out soon" count={criticalForecasts.length} accent="text-red-500" defaultOpen>
                {criticalForecasts.map((f) => {
                  const name = f.variant_name !== 'Standard' ? `${f.product_name} — ${f.variant_name}` : f.product_name
                  return (
                  <Row key={f.variant_id}>
                    <button
                      type="button"
                      onClick={() => { void navigate(`/flow?panel=approvals`) }}
                      className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                    >
                      {name}
                    </button>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{f.current_stock} on hand</span>
                    <span className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
                      ~{f.days_until_zero}d
                    </span>
                  </Row>
                  )
                })}
              </Section>
            )}

            {pendingRestocks.length > 0 && (
              <Section icon={Package} title="Pending restocks" count={pendingRestocks.length} defaultOpen={false}>
                {pendingRestocks.map((r) => {
                  const productName = r.product_variants?.products?.name ?? 'Unknown'
                  const variantName = r.product_variants?.name
                  const name = variantName && variantName !== 'Standard' ? `${productName} — ${variantName}` : productName
                  return (
                  <Row key={r.id}>
                    <button
                      type="button"
                      onClick={() => { void navigate('/flow?panel=approvals') }}
                      className="flex-1 text-xs truncate text-left hover:text-primary transition-colors"
                    >
                      {name}
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums">{r.quantity_needed} needed</span>
                    {r.supplier && <span className="text-[11px] text-muted-foreground truncate max-w-[80px]">{r.supplier}</span>}
                  </Row>
                  )
                })}
              </Section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const [windowHours, setWindowHours] = useState<8 | 12 | 24 | 48>(8)
  const [copied, setCopied]           = useState(false)

  const activeHotel   = useActiveHotel()
  const currency      = useCurrency()
  const role          = useAuthStore((s) => s.role ?? 'limited_access')
  const captureSnap   = useCaptureSnapshot()
  const { data: history = [] } = useIntelligenceHistory(30)

  // Auto-capture snapshot once per day on mount (server is idempotent; client guards too)
  useEffect(() => {
    if (!snapshotCapturedToday(activeHotel?.id ?? null)) {
      captureSnap.mutate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHotel?.id])

  const now = new Date()
  const greeting =
    now.getHours() < 12 ? 'Good morning' :
    now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  // Freshness label from latest snapshot
  const latestSnapshot = history[history.length - 1]
  const freshnessLabel = latestSnapshot
    ? (() => {
        const d = new Date(latestSnapshot.captured_at)
        return d.toDateString() === now.toDateString()
          ? `Analyzed today at ${format(d, 'HH:mm')}`
          : `Analyzed ${formatDistanceToNow(d, { addSuffix: true })}`
      })()
    : null

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`${greeting}, ${activeHotel?.name ?? 'hotel'} — ${format(now, 'EEE d MMM yyyy, HH:mm')}`)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => { setCopied(false) }, 2000)
  }

  const isAdminOrOwner = role === 'admin' || role === 'owner'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-8 py-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">
            {greeting}{activeHotel?.name ? `, ${activeHotel.name}` : ''}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(now, 'EEEE, d MMMM yyyy')}
            {freshnessLabel ? ` · ${freshnessLabel}` : ' · Decision feed'}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={() => { void handleCopy() }}>
          {copied ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          Copy summary
        </Button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">

          {/* ── Onboarding prompt for new hotels (admin/owner only) ── */}
          {isAdminOrOwner && <GetStartedBanner />}

          {/* ── Situation: cross-domain escalation banner (only when elevated/critical) ── */}
          <SituationBanner />

          {/* ── 30-day intelligence history sparkline ── */}
          <SituationTimeline />

          {/* ── Autonomous proposals batch panel ── */}
          <ProposalsPanel currency={currency} />

          {/* ── Primary: decision feed (proposals filtered out — handled above) ── */}
          <DecisionFeed currency={currency} />

          {/* ── Eye: forward-looking stock pressure (predictive, not reactive) ── */}
          <PressureSection />

          {/* ── Secondary: shift activity (below the fold, collapsed by default) ── */}
          <ShiftActivity
            windowHours={windowHours}
            setWindowHours={setWindowHours}
            currency={currency}
          />

        </div>
      </div>
    </div>
  )
}
