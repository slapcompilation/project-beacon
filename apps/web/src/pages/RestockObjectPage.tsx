// Layer: Cross-domain — Restock Request Object Page
// Palantir-pattern: every named entity is navigable to its full object context.
// Combines Floor/Flow (request lifecycle, receive history), Mind (linked PO),
// Eye (variant context: stock level, days until zero).
// Route: /restock/:restockId

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { useReceives, useApproveRestock, useRejectRestock } from '@/features/restock/hooks'
import { useConsumptionForecast } from '@/features/eye/hooks'
import {
  restockFulfillmentPct, totalReceived, remainingQty, consumptionUrgency,
} from '@beacon/reality-graph'
import { useTeamMembers } from '@/features/team/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  ArrowLeft, Package, CheckCircle2, XCircle, Clock, ShieldCheck,
  ShieldAlert, Loader2, Sparkles, AlertTriangle,
  ChevronRight, FileText, PackageCheck,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { RestockRequest, RestockStatus, RestockReceive } from '@beacon/types'
import { GraphConnections } from '@/components/GraphConnections'
import { ObjectActions } from '@/components/ObjectActions'
import { hasPermission } from '@beacon/types'

// ─── Local types ──────────────────────────────────────────────────────────────

interface RestockRequestWithContext extends RestockRequest {
  product_variants: {
    id: string
    name: string
    sku: string
    cost: number | null
    current_stock: number
    low_stock_threshold: number
    default_supplier_id: string | null
    products: { id: string; name: string } | null
  } | null
  purchase_order_lines: { unit_cost: number; po_id: string }[] | null
}

interface LinkedPO {
  id: string
  po_number: string
  status: string
  supplier_name: string
  expected_delivery_date: string | null
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchRestockById(restockId: string): Promise<RestockRequestWithContext | null> {
  const { data, error } = await supabase
    .from('restock_requests')
    .select(`
      *,
      product_variants(
        id, name, sku, cost, current_stock, low_stock_threshold,
        default_supplier_id,
        products(id, name)
      ),
      purchase_order_lines(unit_cost, po_id)
    `)
    .eq('id', restockId)
    .single() as unknown as { data: RestockRequestWithContext | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data
}

async function fetchLinkedPO(poId: string): Promise<LinkedPO | null> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('id, po_number, status, supplier_name, expected_delivery_date')
    .eq('id', poId)
    .single() as unknown as { data: LinkedPO | null; error: { message: string } | null }
  if (error) return null
  return data
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<RestockStatus, { label: string; cls: string; dot: string; icon: React.ElementType }> = {
  pending:          { label: 'Pending',           cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-border',                        dot: 'bg-slate-400',    icon: Clock        },
  pending_manager:  { label: 'Awaiting Manager',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/40',  dot: 'bg-amber-500',  icon: ShieldAlert  },
  pending_director: { label: 'Awaiting Director', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-200 dark:border-orange-900/40', dot: 'bg-orange-500', icon: ShieldAlert  },
  approved:         { label: 'Approved',          cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/40',    dot: 'bg-blue-500',   icon: ShieldCheck  },
  fulfilled:        { label: 'Fulfilled',         cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40', dot: 'bg-emerald-500', icon: CheckCircle2 },
  cancelled:        { label: 'Cancelled',         cls: 'bg-muted text-muted-foreground border-border',                                                              dot: 'bg-slate-400',    icon: XCircle      },
  rejected:         { label: 'Rejected',          cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900/40',          dot: 'bg-red-500',    icon: XCircle      },
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums leading-none', color ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ─── Approval trail ───────────────────────────────────────────────────────────

function ApprovalTrail({
  req,
  emailMap,
}: {
  req: RestockRequestWithContext
  emailMap: Map<string, string>
}) {
  const tier = req.required_approval_tier

  if (tier === 'none' && req.status !== 'rejected') return null

  const requestorEmail = emailMap.get(req.requestor_id) ?? req.requestor_id.slice(0, 8) + '…'
  const approverEmail  = req.approved_by ? (emailMap.get(req.approved_by) ?? req.approved_by.slice(0, 8) + '…') : null
  const rejectorEmail  = req.rejected_by ? (emailMap.get(req.rejected_by) ?? req.rejected_by.slice(0, 8) + '…') : null

  return (
    <div className="rounded-lg border overflow-hidden">
      <p className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 border-b">
        Approval Trail
        {tier !== 'none' && (
          <span className={cn(
            'ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold border',
            tier === 'director'
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-200 dark:border-orange-900/40'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/40',
          )}>
            {tier === 'director' ? 'Director sign-off required' : 'Manager sign-off required'}
          </span>
        )}
      </p>
      <div className="divide-y">
        {/* Created */}
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
            <FileText className="h-3 w-3 text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Created by {requestorEmail}</p>
            <p className="text-[10px] text-muted-foreground">{format(parseISO(req.created_at), 'MMM d, yyyy HH:mm')}</p>
            {req.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{req.notes}"</p>}
          </div>
          {req.is_auto_proposed && (
            <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 shrink-0">
              <Sparkles className="h-3 w-3" />AI proposed
            </span>
          )}
        </div>

        {/* Approved */}
        {approverEmail && req.approved_at && (
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Approved by {approverEmail}</p>
              <p className="text-[10px] text-muted-foreground">{format(parseISO(req.approved_at), 'MMM d, yyyy HH:mm')}</p>
              {req.approval_notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{req.approval_notes}"</p>}
            </div>
          </div>
        )}

        {/* Rejected */}
        {rejectorEmail && req.rejected_at && (
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="h-6 w-6 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0 mt-0.5">
              <XCircle className="h-3 w-3 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Rejected by {rejectorEmail}</p>
              <p className="text-[10px] text-muted-foreground">{format(parseISO(req.rejected_at), 'MMM d, yyyy HH:mm')}</p>
              {req.rejected_reason && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{req.rejected_reason}"</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Receive history ──────────────────────────────────────────────────────────

function ReceiveHistory({ receives, currency }: { receives: RestockReceive[]; currency: string }) {
  if (receives.length === 0) {
    return (
      <div className="rounded-lg border px-4 py-4 text-xs text-muted-foreground flex items-center gap-2">
        <PackageCheck className="h-4 w-4" />
        No stock received against this request yet.
      </div>
    )
  }

  const totalReceived = receives.reduce((s, r) => s + r.quantity_received, 0)

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Receive History · {receives.length} event{receives.length !== 1 ? 's' : ''}
        </p>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          +{totalReceived} total received
        </span>
      </div>
      <div className="divide-y">
        {receives.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-3">
            <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0 mt-0.5">
              <PackageCheck className="h-3 w-3 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold tabular-nums">
                +{r.quantity_received} units received
              </p>
              <p className="text-[10px] text-muted-foreground">
                {format(parseISO(r.received_at), 'MMM d, yyyy HH:mm')}
                {r.lot_number && ` · Lot ${r.lot_number}`}
                {r.unit_cost != null && r.unit_cost > 0 && ` · ${formatCurrency(r.unit_cost, currency)}/unit`}
              </p>
              {r.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{r.notes}"</p>}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {formatDistanceToNow(parseISO(r.received_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Linked PO card ───────────────────────────────────────────────────────────

function LinkedPOCard({ poId }: { poId: string }) {
  const { data: po, isLoading } = useQuery({
    queryKey: ['linked-po', poId],
    queryFn:  () => fetchLinkedPO(poId),
    staleTime: 60_000,
  })

  if (isLoading) return (
    <div className="rounded-lg border px-4 py-4 flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Loading PO…</span>
    </div>
  )

  if (!po) return null

  const statusCls = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
    partially_received: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    closed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    cancelled: 'bg-muted text-muted-foreground',
  }[po.status] ?? 'bg-muted text-muted-foreground'

  return (
    <Link
      to={`/po/${po.id}`}
      className="flex items-center gap-3 rounded-lg border px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{po.po_number}</p>
        <p className="text-[10px] text-muted-foreground">
          {po.supplier_name}
          {po.expected_delivery_date && ` · Expected ${format(parseISO(po.expected_delivery_date), 'MMM d, yyyy')}`}
        </p>
      </div>
      <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', statusCls)}>
        {po.status.replace('_', ' ')}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </Link>
  )
}

// ─── Inline approval form ─────────────────────────────────────────────────────

function ApprovalActions({
  restockId,
  canApprove,
}: {
  restockId: string
  canApprove: boolean
}) {
  const approve  = useApproveRestock()
  const reject   = useRejectRestock()
  const [mode, setMode]   = useState<'approve' | 'reject' | null>(null)
  const [notes, setNotes] = useState('')

  if (!canApprove) return null

  const handleConfirm = () => {
    if (mode === 'approve') {
      approve.mutate({ id: restockId, notes: notes || null }, {
        onSuccess: () => { setMode(null); setNotes('') },
      })
    } else if (mode === 'reject') {
      reject.mutate({ id: restockId, reason: notes || null }, {
        onSuccess: () => { setMode(null); setNotes('') },
      })
    }
  }

  if (mode) {
    return (
      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">
          {mode === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
        </p>
        <Textarea
          placeholder={mode === 'approve' ? 'Approval notes (optional)' : 'Reason for rejection (optional)'}
          value={notes}
          onChange={(e) => { setNotes(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleConfirm() }}
          className="text-sm min-h-[60px] resize-none"
          autoFocus
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={mode === 'approve' ? 'default' : 'destructive'}
            disabled={approve.isPending || reject.isPending}
            onClick={handleConfirm}
            className="h-8 text-xs"
          >
            {(approve.isPending || reject.isPending) && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {mode === 'approve' ? 'Approve' : 'Reject'}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setMode(null); setNotes('') }}>
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
        onClick={() => { setMode('approve') }}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        Approve Request
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400"
        onClick={() => { setMode('reject') }}
      >
        <XCircle className="h-3.5 w-3.5" />
        Reject
      </Button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RestockObjectPage() {
  const { restockId } = useParams<{ restockId: string }>()
  const navigate      = useNavigate()
  const currency      = useCurrency()
  const role          = useAuthStore((s) => s.role ?? 'limited_access')
  useActiveHotelId()

  const { data: req,      isLoading: loadingReq  } = useQuery({
    queryKey: ['restock-object', restockId],
    queryFn:  () => fetchRestockById(restockId!),
    enabled:  !!restockId,
    staleTime: 30_000,
  })
  const { data: receives = [],  isLoading: loadingRecv } = useReceives(restockId ?? null)
  const { data: forecastRows = [] }                     = useConsumptionForecast(30)
  const { data: members  = [] }                         = useTeamMembers()

  const emailMap = new Map(members.map((m) => [m.id, m.email]))
  const forecast = forecastRows.find((r) => r.variant_id === req?.variant_id) ?? null

  const isLoading = loadingReq || loadingRecv

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!req) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Restock request not found.</p>
        <Button variant="outline" size="sm" onClick={() => { void navigate(-1) }}>Go back</Button>
      </div>
    )
  }

  const cfg           = STATUS_CFG[req.status]
  const pv            = req.product_variants
  const productName   = pv?.products?.name ?? 'Unknown product'
  const variantLabel  = pv?.name && pv.name !== 'Standard' ? `${productName} — ${pv.name}` : productName

  const received      = totalReceived(receives)
  const remaining     = remainingQty(req, receives)
  const pctFulfilled  = restockFulfillmentPct(req, receives)

  const daysLeft      = forecast?.days_until_zero ?? null
  const daysUrgency   = consumptionUrgency(daysLeft, pv?.default_supplier_id ? 4 : 7)

  const linkedPoId = req.purchase_order_lines?.[0]?.po_id ?? null
  const poUnitCost = req.purchase_order_lines?.[0]?.unit_cost ?? null

  // Approval permission: pending_manager → admin or owner; pending_director → owner only
  const isAwaiting    = req.status === 'pending_manager' || req.status === 'pending_director'
  const canApprove    = isAwaiting && (
    req.status === 'pending_director'
      ? role === 'owner'
      : hasPermission(role, 'can_approve_restocks')
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0 bg-background">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => { void navigate(-1) }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-950/40 shrink-0">
                <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-bold leading-none">
                    {pv?.id
                      ? <Link to={`/variant/${pv.id}`} className="hover:underline">{variantLabel}</Link>
                      : variantLabel
                    }
                  </h1>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border flex items-center gap-1', cfg.cls)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', cfg.dot)} />
                    {cfg.label}
                  </span>
                  {req.is_auto_proposed && (
                    <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                      <Sparkles className="h-3 w-3" />AI proposed
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {pv?.sku && <span className="font-mono">{pv.sku}</span>}
                  {req.supplier && <span>· from {req.supplier}</span>}
                  <span>· {formatDistanceToNow(parseISO(req.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-4xl">

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Qty Requested"
            value={req.quantity_needed}
            sub={pv?.sku ?? undefined}
          />
          <StatCard
            label="Qty Received"
            value={received}
            sub={`${pctFulfilled}% fulfilled · ${remaining} remaining`}
            color={pctFulfilled === 100 ? 'text-emerald-600' : received > 0 ? 'text-amber-600' : undefined}
          />
          <StatCard
            label="Est. Cost"
            value={req.estimated_cost != null ? formatCurrency(req.estimated_cost, currency) : '—'}
            sub={poUnitCost != null ? `PO agreed: ${formatCurrency(poUnitCost, currency)}/unit` : undefined}
          />
          <StatCard
            label="Stock Now"
            value={pv?.current_stock ?? '—'}
            sub={daysLeft !== null ? `~${Math.round(daysLeft)}d runway` : undefined}
            color={
              daysUrgency === 'critical' ? 'text-red-600' :
              daysUrgency === 'warning'  ? 'text-amber-600' :
              'text-emerald-600'
            }
          />
        </div>

        {/* Fulfillment progress bar */}
        {req.quantity_needed > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Fulfillment progress</span>
              <span className="font-semibold tabular-nums">{pctFulfilled}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  pctFulfilled === 100 ? 'bg-emerald-500' : pctFulfilled > 0 ? 'bg-amber-400' : 'bg-muted-foreground/20',
                )}
                style={{ width: `${pctFulfilled}%` }}
              />
            </div>
          </div>
        )}

        {/* Approval actions (if awaiting) */}
        {isAwaiting && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/10 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                Awaiting {req.status === 'pending_director' ? 'Director' : 'Manager'} approval
              </p>
            </div>
            <ApprovalActions restockId={req.id} canApprove={canApprove} />
            {!canApprove && (
              <p className="text-[10px] text-muted-foreground">
                You don't have permission to approve {req.status === 'pending_director' ? 'director-tier' : 'this'} request.
              </p>
            )}
          </div>
        )}

        {/* Quick action — go to receive */}
        {(req.status === 'approved' || req.status === 'partially_received' as string) && (
          <Button
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => { void navigate(`/flow?panel=receive&request=${req.id}`) }}
          >
            <PackageCheck className="h-3.5 w-3.5" />
            Receive stock for this request
          </Button>
        )}

        {/* Linked PO */}
        {linkedPoId && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Linked Purchase Order</h2>
            <LinkedPOCard poId={linkedPoId} />
          </div>
        )}

        {/* Approval trail */}
        <ApprovalTrail req={req} emailMap={emailMap} />

        {/* Receive history */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Receive History</h2>
          <ReceiveHistory receives={receives} currency={currency} />
        </div>

        {/* Metadata */}
        <div className="pt-2 border-t text-[10px] text-muted-foreground space-y-0.5">
          <p>Request ID: <span className="font-mono">{req.id.slice(0, 8)}…</span></p>
          <p>Created {format(parseISO(req.created_at), 'MMM d, yyyy HH:mm')}</p>
          {req.escalation_count > 0 && <p>Escalated {req.escalation_count}× · last {req.last_escalated_at ? formatDistanceToNow(parseISO(req.last_escalated_at), { addSuffix: true }) : '—'}</p>}
        </div>

        {/* ── Inline actions ── */}
        <div className="rounded-lg border border-border bg-card p-4">
          <ObjectActions
            nodeType="restock_request"
            requestId={req.id}
            variantId={req.variant_id}
            status={req.status}
          />
        </div>

        {/* ── Graph connections ── */}
        <div className="rounded-lg border border-border bg-card p-4">
          <GraphConnections nodeType="restock_request" nodeId={req.id} />
        </div>
      </div>
    </div>
  )
}
