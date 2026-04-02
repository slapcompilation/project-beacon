// Layer: Flow — Restock Kanban with Tiered Approval Workflows
// Sprint 3 UX: 3-column kanban. Now extended with a 4th "Awaiting Approval" column.
// Approval tiers are auto-classified on request creation via DB trigger:
//   pending_manager  → requires admin or owner sign-off
//   pending_director → requires owner-only sign-off
// Palantir principle: every number carries its derived context — estimated cost is shown
// inline on every card so approvers can make decisions without navigating away.

import { useState, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Plus, CheckCircle2, XCircle, PackageCheck, ShoppingCart, Circle,
  Sparkles, Loader2, TrendingDown, AlertTriangle, Archive, Zap,
  Search, ShieldCheck, ShieldAlert, User, BookOpen, X,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { EntityContextPanel } from '@/features/eye/components/EntityContextPanel'
import { RestockRequestModal } from '@/features/restock/components/RestockRequestModal'
import { ReceiveModal } from '@/features/restock/components/ReceiveModal'
import {
  useRestockRequests, useUpdateRestockStatus, useAutoPropose,
  useApproveRestock, useRejectRestock,
} from '@/features/restock/hooks'
import { useTeamMembers } from '@/features/team/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { useDateFormat } from '@/features/user/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { hasPermission } from '@beacon/types'
import { useConsumptionForecast, useWasteRadar, useDeadStock } from '@/features/eye'
import type { RestockRequestRow } from '@/features/restock/api'

// ─── Consolidated request type ────────────────────────────────────────────────

interface ConsolidatedRequest {
  req: RestockRequestRow
  allIds: string[]
  totalQty: number
}

function consolidateByVariant(rows: RestockRequestRow[]): ConsolidatedRequest[] {
  const map = new Map<string, RestockRequestRow[]>()
  for (const r of rows) {
    const existing = map.get(r.variant_id) ?? []
    map.set(r.variant_id, [...existing, r])
  }
  return [...map.values()].flatMap((group) => {
    const primary = group[0]
    if (!primary) return []
    return [{ req: primary, allIds: group.map((r) => r.id), totalQty: group.reduce((s, r) => s + r.quantity_needed, 0) }]
  })
}

// ─── Briefing context banner ──────────────────────────────────────────────────
// Shown when the operator navigates here from a Briefing action (fromBriefing=true).
// Surfaces the entity intelligence panel so the operator sees WHY they're here
// without navigating back. The "cross-layer context is one-way" gap closed.

interface BriefingNavState {
  fromBriefing?: boolean
  actionType?: string
  entityLabel?: string
  entityId?: string | null
}

function BriefingContextBanner() {
  const location = useLocation()
  const state = location.state as BriefingNavState | null
  const [dismissed, setDismissed] = useState(false)

  if (!state?.fromBriefing || dismissed) return null

  const isLowStock = state.actionType === 'low_stock_no_po'

  return (
    <div className="border-b bg-amber-50/50 dark:bg-amber-950/10 border-amber-100 dark:border-amber-900/30 px-6 py-3">
      <div className="flex items-start gap-3">
        <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
              From Briefing
              {state.entityLabel && (
                <span className="text-amber-700 dark:text-amber-400"> · {state.entityLabel}</span>
              )}
            </p>
          </div>
          {isLowStock && state.entityId && (
            <EntityContextPanel variantId={state.entityId} compact />
          )}
        </div>
        <button
          type="button"
          onClick={() => { setDismissed(true) }}
          className="shrink-0 rounded p-0.5 text-amber-500 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Eye signal chips ─────────────────────────────────────────────────────────

interface EyeSignals {
  daysUntilZero: number | null
  wasteEvents: number | null
  isDeadStock: boolean
}

function EyeSignalChips({ signals }: { signals: EyeSignals }) {
  const chips: React.ReactNode[] = []
  if (signals.daysUntilZero !== null) {
    const d = signals.daysUntilZero
    chips.push(
      <span key="days" className={cn(
        'flex items-center gap-1 text-[10px] font-semibold tabular-nums',
        d <= 7 ? 'text-red-600 dark:text-red-400' : d <= 30 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400',
      )}>
        <TrendingDown className="h-2.5 w-2.5" />{d <= 0 ? 'Out of stock' : `${d}d left`}
      </span>
    )
  }
  if (signals.wasteEvents !== null && signals.wasteEvents > 0) {
    chips.push(
      <span key="waste" className="flex items-center gap-1 text-[10px] text-orange-600 dark:text-orange-400">
        <Zap className="h-2.5 w-2.5" />{signals.wasteEvents} waste event{signals.wasteEvents !== 1 ? 's' : ''}
      </span>
    )
  }
  if (signals.isDeadStock) {
    chips.push(
      <span key="dead" className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Archive className="h-2.5 w-2.5" />idle — verify demand
      </span>
    )
  }
  if (chips.length === 0) return null
  return <div className="flex items-center gap-3 mt-1">{chips}</div>
}

// ─── Approval action dialog ───────────────────────────────────────────────────

function ApprovalDialog({
  open,
  mode,
  onClose,
  onConfirm,
  isPending,
}: {
  open: boolean
  mode: 'approve' | 'reject'
  onClose: () => void
  onConfirm: (text: string) => void
  isPending: boolean
}) {
  const [text, setText] = useState('')
  const handleClose = () => { setText(''); onClose() }
  const handleConfirm = () => { onConfirm(text); setText('') }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-sm" onKeyDown={(e) => { if (e.key === 'Escape') handleClose() }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {mode === 'approve'
              ? <><ShieldCheck className="h-4 w-4 text-green-600" />Approve Request</>
              : <><ShieldAlert className="h-4 w-4 text-destructive" />Reject Request</>
            }
          </DialogTitle>
        </DialogHeader>
        <Textarea
          placeholder={mode === 'approve' ? 'Approval notes (optional)' : 'Reason for rejection (optional)'}
          value={text}
          onChange={(e) => { setText(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleConfirm() }}
          className="text-sm min-h-[72px] resize-none"
          autoFocus
        />
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          <Button
            size="sm"
            variant={mode === 'approve' ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={isPending}
            className="gap-1"
          >
            {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {mode === 'approve' ? 'Approve' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Tier badge ───────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: 'manager' | 'director' }) {
  return tier === 'director'
    ? (
      <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 border-red-300 text-red-700 dark:text-red-400 shrink-0">
        <ShieldAlert className="h-2.5 w-2.5" />Director
      </Badge>
    ) : (
      <Badge variant="outline" className="h-4 px-1 text-[9px] gap-0.5 border-orange-300 text-orange-700 dark:text-orange-400 shrink-0">
        <ShieldCheck className="h-2.5 w-2.5" />Manager
      </Badge>
    )
}

// ─── Kanban card ──────────────────────────────────────────────────────────────

function KanbanCard({
  req,
  allIds,
  totalQty,
  canApprove,
  canApproveDirector,
  emailMap,
  currencyCode,
  onReceive,
  onApprove,
  onReject,
  signals,
  isMutating,
}: {
  req: RestockRequestRow
  allIds: string[]
  totalQty: number
  canApprove: boolean
  canApproveDirector: boolean
  emailMap: Map<string, string>
  currencyCode: string
  onReceive?: (req: RestockRequestRow) => void
  onApprove?: (id: string, notes: string) => void
  onReject?: (id: string, reason: string) => void
  signals?: EyeSignals
  isMutating: boolean
}) {
  const update    = useUpdateRestockStatus()
  const fmtDate   = useDateFormat()
  const [dialogMode, setDialogMode] = useState<'approve' | 'reject' | null>(null)

  const fmtCost = (v: number) => {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 }).format(v)
    } catch {
      return `${currencyCode} ${v.toFixed(2)}`
    }
  }

  const productName = req.product_variants?.products?.name ?? 'Unknown product'
  const variantName = req.product_variants?.name
  const displayName = variantName && variantName !== 'Standard'
    ? `${productName} — ${variantName}`
    : productName
  const requestorEmail  = emailMap.get(req.requestor_id)
  const approverEmail   = req.approved_by ? (emailMap.get(req.approved_by) ?? req.approved_by.slice(0, 8)) : null
  const rejectorEmail   = req.rejected_by ? (emailMap.get(req.rejected_by) ?? req.rejected_by.slice(0, 8)) : null
  const mergedCount     = allIds.length - 1

  const urgency = signals?.daysUntilZero != null
    ? signals.daysUntilZero <= 7 ? 'critical' : signals.daysUntilZero <= 30 ? 'warning' : null
    : null

  const tier = req.required_approval_tier
  const isAwaiting = req.status === 'pending_manager' || req.status === 'pending_director'
  const canActOnThis = isAwaiting
    ? (req.status === 'pending_director' ? canApproveDirector : canApprove)
    : (req.status === 'pending' ? canApprove : false)

  const cancelAll = () => { for (const id of allIds) update.mutate({ id, status: 'cancelled' }) }

  const handleApproveConfirm = (notes: string) => {
    setDialogMode(null)
    for (const id of allIds) onApprove?.(id, notes)
  }

  const handleRejectConfirm = (reason: string) => {
    setDialogMode(null)
    for (const id of allIds) onReject?.(id, reason)
  }

  const estimatedCost = req.estimated_cost != null ? fmtCost(Number(req.estimated_cost)) : null

  return (
    <>
      <div className={cn(
        'rounded-lg border bg-card p-3 space-y-2 shadow-sm',
        urgency === 'critical' ? 'border-l-2 border-l-red-500' :
        urgency === 'warning'  ? 'border-l-2 border-l-yellow-500' : '',
      )}>
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium leading-snug truncate">{displayName}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{req.product_variants?.sku ?? ''}</p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {req.is_auto_proposed && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] gap-0.5 shrink-0">
                <Sparkles className="h-2.5 w-2.5" />AI
              </Badge>
            )}
            {(tier === 'manager' || tier === 'director') && (
              <TierBadge tier={tier} />
            )}
            {mergedCount > 0 && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground shrink-0"
                title={`${String(allIds.length)} duplicate requests merged`}>
                ×{String(allIds.length)}
              </Badge>
            )}
            {req.status === 'cancelled' && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] text-muted-foreground">Cancelled</Badge>
            )}
            {req.status === 'rejected' && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] border-red-300 text-red-700 dark:text-red-400">Rejected</Badge>
            )}
            {req.status === 'fulfilled' && (
              <Badge variant="outline" className="h-4 px-1 text-[9px] border-green-300 text-green-700 dark:text-green-400">Fulfilled</Badge>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="text-[11px] text-muted-foreground space-y-0.5">
          <p>
            <span className="font-semibold text-foreground tabular-nums">{totalQty}</span> units
            {estimatedCost && <span className="font-semibold text-foreground"> · {estimatedCost}</span>}
            {req.supplier && <span> · {req.supplier}</span>}
          </p>
          <p>
            {fmtDate(new Date(req.date))}
            {requestorEmail && <span> · {requestorEmail}</span>}
          </p>
          {req.notes && <p className="italic truncate">{req.notes}</p>}
          {/* Approval audit trail */}
          {req.approved_at && approverEmail && (
            <p className="flex items-center gap-1 text-green-700 dark:text-green-500">
              <User className="h-2.5 w-2.5 shrink-0" />
              Approved by {approverEmail} · {format(new Date(req.approved_at), 'dd MMM HH:mm')}
            </p>
          )}
          {req.approval_notes && (
            <p className="italic text-green-700 dark:text-green-500 truncate">"{req.approval_notes}"</p>
          )}
          {req.rejected_at && rejectorEmail && (
            <p className="flex items-center gap-1 text-red-700 dark:text-red-400">
              <User className="h-2.5 w-2.5 shrink-0" />
              Rejected by {rejectorEmail} · {format(new Date(req.rejected_at), 'dd MMM HH:mm')}
            </p>
          )}
          {req.rejected_reason && (
            <p className="italic text-red-700 dark:text-red-400 truncate">"{req.rejected_reason}"</p>
          )}
        </div>

        {/* Eye signals */}
        {signals && <EyeSignalChips signals={signals} />}

        {/* Actions */}
        {(req.status === 'pending' || isAwaiting) && (
          <div className="flex items-center gap-1.5 pt-1">
            {canActOnThis && onApprove ? (
              <>
                <Button size="sm" variant="outline"
                  className="h-6 gap-1 text-[11px] px-2 flex-1 border-green-300 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30"
                  onClick={() => { setDialogMode('approve') }}
                  disabled={isMutating}>
                  <CheckCircle2 className="h-3 w-3" />Approve{allIds.length > 1 ? ' all' : ''}
                </Button>
                {onReject && (
                  <Button size="sm" variant="ghost"
                    className="h-6 gap-1 text-[11px] px-2 text-destructive hover:text-destructive"
                    onClick={() => { setDialogMode('reject') }}
                    disabled={isMutating}>
                    <XCircle className="h-3 w-3" />
                  </Button>
                )}
              </>
            ) : isAwaiting ? (
              // Not authorized for this tier — show informational badge
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldAlert className="h-3 w-3" />
                {req.status === 'pending_director' ? 'Owner approval required' : 'Admin approval required'}
              </span>
            ) : (
              // Plain pending — no approval tier, canApprove is false
              <span className="text-[10px] text-muted-foreground">Awaiting approval</span>
            )}
            {req.status === 'pending' && canApprove && !isAwaiting && (
              <Button size="sm" variant="ghost"
                className="h-6 gap-1 text-[11px] px-2 text-destructive hover:text-destructive"
                onClick={cancelAll}
                disabled={update.isPending}>
                <XCircle className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
        {req.status === 'approved' && (
          <div className="flex items-center gap-1.5 pt-1">
            <Button size="sm" variant="outline"
              className="h-6 gap-1 text-[11px] px-2 flex-1"
              onClick={() => { onReceive?.(req) }}>
              <PackageCheck className="h-3 w-3" />Receive
            </Button>
            {canApprove && (
              <Button size="sm" variant="ghost"
                className="h-6 gap-1 text-[11px] px-2 text-destructive hover:text-destructive"
                onClick={cancelAll}
                disabled={update.isPending}>
                <XCircle className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Approval / Rejection dialog */}
      {dialogMode && (
        <ApprovalDialog
          open
          mode={dialogMode}
          onClose={() => { setDialogMode(null) }}
          onConfirm={dialogMode === 'approve' ? handleApproveConfirm : handleRejectConfirm}
          isPending={isMutating}
        />
      )}
    </>
  )
}

// ─── Kanban column ────────────────────────────────────────────────────────────

function KanbanColumn({ title, count, badge, accent, children, headerActions }: {
  title: string
  count: number
  badge?: React.ReactNode
  accent?: string
  children: React.ReactNode
  headerActions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col min-w-0 flex-1 min-w-[200px]">
      <div className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-t-lg border-b mb-3',
        accent ?? 'bg-muted/40 border-border',
      )}>
        <span className="text-xs font-bold uppercase tracking-wide">{title}</span>
        <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-background border text-[10px] font-bold tabular-nums px-1">
          {count}
        </span>
        {badge}
        {headerActions && <div className="ml-auto">{headerActions}</div>}
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 px-0.5">
        {children}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RestockPage() {
  const navigate    = useNavigate()
  const { data: requests = [], isLoading } = useRestockRequests()
  const { data: members = [] }             = useTeamMembers()
  const role        = useAuthStore((s) => s.role)
  const currency    = useCurrency()
  const canApprove         = !!role && hasPermission(role, 'can_approve_restocks')
  const canApproveDirector = role === 'owner'
  const canCreate          = !!role && hasPermission(role, 'can_create_restocks')
  const emailMap    = useMemo(() => new Map(members.map((m) => [m.id, m.email])), [members])

  const autoProposeMutation = useAutoPropose()
  const approve             = useApproveRestock()
  const reject              = useRejectRestock()
  const update              = useUpdateRestockStatus()
  const [modalOpen,    setModalOpen]    = useState(false)
  const [receivingReq, setReceivingReq] = useState<RestockRequestRow | null>(null)
  const [search, setSearch]             = useState('')

  // Eye Layer signals
  const { data: forecastRows   = [] } = useConsumptionForecast(30)
  const { data: wasteRadarRows = [] } = useWasteRadar()
  const { data: deadStockRows  = [] } = useDeadStock(30)

  const forecastMap  = useMemo(() => new Map(forecastRows.map((r) => [r.variant_id, r.days_until_zero])), [forecastRows])
  const wasteMap     = useMemo(() => new Map(wasteRadarRows.map((r) => [r.variant_id, r.qty_7d])), [wasteRadarRows])
  const deadStockIds = useMemo(() => new Set(deadStockRows.map((r) => r.variant_id)), [deadStockRows])

  const signalsFor = (variantId: string): EyeSignals => ({
    daysUntilZero: forecastMap.has(variantId) ? (forecastMap.get(variantId) ?? null) : null,
    wasteEvents:   wasteMap.get(variantId) ?? null,
    isDeadStock:   deadStockIds.has(variantId),
  })

  const filterReq = useCallback((r: RestockRequestRow) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    const name = r.product_variants?.products?.name?.toLowerCase() ?? ''
    const sku  = r.product_variants?.sku?.toLowerCase() ?? ''
    const sup  = r.supplier?.toLowerCase() ?? ''
    return name.includes(q) || sku.includes(q) || sup.includes(q)
  }, [search])

  // Column 1: plain pending (no tier)
  const toAction = useMemo(() => {
    const rows = requests
      .filter((r) => r.status === 'pending' && r.required_approval_tier === 'none')
      .filter(filterReq)
    return consolidateByVariant(rows).sort((a, b) => {
      const da = forecastMap.get(a.req.variant_id) ?? Infinity
      const db = forecastMap.get(b.req.variant_id) ?? Infinity
      return da - db
    })
  }, [requests, forecastMap, filterReq])

  const aiProposals = toAction.filter((c) => c.req.is_auto_proposed)

  // Column 2: awaiting approval (tiered)
  const awaitingApproval = useMemo(() => {
    const rows = requests
      .filter((r) => r.status === 'pending_manager' || r.status === 'pending_director')
      .filter(filterReq)
    return consolidateByVariant(rows).sort((a, b) => {
      // Director tier first, then by urgency
      if (a.req.status !== b.req.status) {
        return a.req.status === 'pending_director' ? -1 : 1
      }
      const da = forecastMap.get(a.req.variant_id) ?? Infinity
      const db = forecastMap.get(b.req.variant_id) ?? Infinity
      return da - db
    })
  }, [requests, forecastMap, filterReq])

  const directorCount = awaitingApproval.filter((c) => c.req.status === 'pending_director').length

  // Column 3: approved
  const approved = useMemo(() => {
    const rows = requests.filter((r) => r.status === 'approved').filter(filterReq)
    return consolidateByVariant(rows)
  }, [requests, filterReq])

  // Column 4: done (fulfilled / cancelled / rejected)
  const done = useMemo(() =>
    requests.filter((r) => ['fulfilled', 'cancelled', 'rejected'].includes(r.status)).filter(filterReq),
  [requests, filterReq])

  const urgentCount = toAction.filter((c) => {
    const d = forecastMap.get(c.req.variant_id)
    return d != null && d <= 7
  }).length

  const handleApproveAllAI = () => {
    for (const c of aiProposals) {
      for (const id of c.allIds) approve.mutate({ id })
    }
  }

  const isMutating = approve.isPending || reject.isPending || update.isPending

  return (
    <div className="flex flex-col h-full">
      {/* Briefing context banner (shown when navigating from a Briefing action) */}
      <BriefingContextBanner />

      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Restocks</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading
              ? 'Loading…'
              : `${toAction.length} to action · ${awaitingApproval.length} awaiting approval · ${approved.length} approved · ${done.length} in history`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product, SKU, supplier…"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              className="pl-8 h-8 w-52 text-xs"
            />
          </div>
          {canApprove && (
            <Button variant="outline" size="sm"
              onClick={() => { autoProposeMutation.mutate({}) }}
              disabled={autoProposeMutation.isPending}
              className="gap-1.5 text-xs h-8"
            >
              {autoProposeMutation.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Sparkles className="h-3.5 w-3.5" />}
              Run Proposals
            </Button>
          )}
          {canCreate && (
            <Button size="sm" onClick={() => { setModalOpen(true) }} className="gap-1.5 text-xs h-8">
              <Plus className="h-3.5 w-3.5" />New Request
            </Button>
          )}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-hidden px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />Loading…
          </div>
        ) : (
          <div className="flex gap-3 h-full overflow-x-auto">

            {/* ── Column 1: To Action ── */}
            <KanbanColumn
              title="To Action"
              count={toAction.length}
              accent="bg-amber-50/50 dark:bg-amber-950/10 border-amber-200/60 dark:border-amber-800/40"
              badge={urgentCount > 0 ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
                  <AlertTriangle className="h-3 w-3" />{urgentCount} urgent
                </span>
              ) : undefined}
              headerActions={aiProposals.length > 0 && canApprove ? (
                <Button size="sm" variant="outline"
                  className="h-6 text-[10px] px-2 gap-1 border-green-300 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30"
                  onClick={handleApproveAllAI}
                  disabled={isMutating}
                >
                  <CheckCircle2 className="h-3 w-3" />Approve all AI ({aiProposals.length})
                </Button>
              ) : undefined}
            >
              {toAction.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500/40" />
                  <p className="text-xs text-muted-foreground">All caught up</p>
                </div>
              ) : (
                toAction.map((c) => (
                  <KanbanCard
                    key={c.req.id}
                    req={c.req}
                    allIds={c.allIds}
                    totalQty={c.totalQty}
                    canApprove={canApprove}
                    canApproveDirector={canApproveDirector}
                    emailMap={emailMap}
                    currencyCode={currency}
                    signals={signalsFor(c.req.variant_id)}
                    onApprove={(id, notes) => { approve.mutate({ id, notes }) }}
                    onReject={(id, reason) => { reject.mutate({ id, reason }) }}
                    isMutating={isMutating}
                  />
                ))
              )}
            </KanbanColumn>

            {/* ── Column 2: Awaiting Approval ── */}
            <KanbanColumn
              title="Awaiting Approval"
              count={awaitingApproval.length}
              accent="bg-orange-50/50 dark:bg-orange-950/10 border-orange-200/60 dark:border-orange-800/40"
              badge={directorCount > 0 ? (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600 dark:text-red-400">
                  <ShieldAlert className="h-3 w-3" />{directorCount} director
                </span>
              ) : undefined}
            >
              {awaitingApproval.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                  <ShieldCheck className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">No approvals pending</p>
                </div>
              ) : (
                awaitingApproval.map((c) => (
                  <KanbanCard
                    key={c.req.id}
                    req={c.req}
                    allIds={c.allIds}
                    totalQty={c.totalQty}
                    canApprove={canApprove}
                    canApproveDirector={canApproveDirector}
                    emailMap={emailMap}
                    currencyCode={currency}
                    signals={signalsFor(c.req.variant_id)}
                    onApprove={(id, notes) => { approve.mutate({ id, notes }) }}
                    onReject={(id, reason) => { reject.mutate({ id, reason }) }}
                    isMutating={isMutating}
                  />
                ))
              )}
            </KanbanColumn>

            {/* ── Column 3: Approved ── */}
            <KanbanColumn
              title="Approved"
              count={approved.length}
              accent="bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/60 dark:border-blue-800/40"
              headerActions={approved.length > 0 ? (
                <Button size="sm" variant="default"
                  className="h-6 text-[10px] px-2 gap-1"
                  onClick={() => {
                    navigate('/purchase-orders', {
                      state: {
                        fromRestock: approved.map((c) => ({
                          variantId:   c.req.variant_id,
                          productName: c.req.product_variants?.products?.name ?? 'Unknown',
                          variantName: c.req.product_variants?.name ?? 'Standard',
                          sku:         c.req.product_variants?.sku ?? '',
                          qty:         c.totalQty,
                          unitCost:    c.req.product_variants?.cost ?? 0,
                          supplier:    c.req.supplier ?? '',
                          notes:       c.req.notes ?? '',
                        })),
                      },
                    })
                  }}
                >
                  <ShoppingCart className="h-3 w-3" />Draft PO ({approved.length})
                </Button>
              ) : undefined}
            >
              {approved.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                  <Circle className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">None approved yet</p>
                </div>
              ) : (
                approved.map((c) => (
                  <KanbanCard
                    key={c.req.id}
                    req={c.req}
                    allIds={c.allIds}
                    totalQty={c.totalQty}
                    canApprove={canApprove}
                    canApproveDirector={canApproveDirector}
                    emailMap={emailMap}
                    currencyCode={currency}
                    onReceive={setReceivingReq}
                    signals={signalsFor(c.req.variant_id)}
                    isMutating={isMutating}
                  />
                ))
              )}
            </KanbanColumn>

            {/* ── Column 4: Done ── */}
            <KanbanColumn
              title="Done"
              count={done.length}
              accent="bg-muted/30 border-border/60"
            >
              {done.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                  <Circle className="h-8 w-8 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">No history yet</p>
                </div>
              ) : (
                done.slice(0, 20).map((r) => (
                  <KanbanCard
                    key={r.id}
                    req={r}
                    allIds={[r.id]}
                    totalQty={r.quantity_needed}
                    canApprove={false}
                    canApproveDirector={false}
                    emailMap={emailMap}
                    currencyCode={currency}
                    isMutating={false}
                  />
                ))
              )}
              {done.length > 20 && (
                <p className="text-center text-[10px] text-muted-foreground py-2">
                  +{done.length - 20} more in audit log
                </p>
              )}
            </KanbanColumn>

          </div>
        )}
      </div>

      <RestockRequestModal open={modalOpen} onClose={() => { setModalOpen(false) }} />
      {receivingReq && (
        <ReceiveModal open onClose={() => { setReceivingReq(null) }} request={receivingReq} />
      )}
    </div>
  )
}
