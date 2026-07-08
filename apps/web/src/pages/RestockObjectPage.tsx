// Layer: Cross-domain — Restock Request Object Page
// Palantir-pattern: every named entity is navigable to its full object context.
// Combines Floor/Flow (request lifecycle, receive history), Mind (linked PO),
// Eye (variant context: stock level, days until zero).
// Route: /restock/:restockId
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { format, formatDistanceToNow, parseISO } from 'date-fns'
import {
  Button,
  Callout,
  Card,
  Icon,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
  TextArea,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
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
import type { RestockRequest, RestockStatus, RestockReceive } from '@beacon/types'
import { GraphConnections } from '@/components/GraphConnections'
import { ObjectActions } from '@/components/ObjectActions'
import { ObjectAgentActivity } from '@/features/agents/ObjectAgentActivity'
import { ObjectViewFrame } from '@/components/ObjectViewFrame'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'
import { Metric } from '@/components/MetricStrip'
import { AuditRail } from '@/components/AuditRail'
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

const STATUS_CFG: Record<RestockStatus, { label: string; intent: Intent; icon: IconName }> = {
  pending:          { label: 'Pending',           intent: Intent.NONE,    icon: 'time' },
  pending_manager:  { label: 'Awaiting Manager',  intent: Intent.WARNING, icon: 'shield' },
  pending_director: { label: 'Awaiting Director', intent: Intent.WARNING, icon: 'shield' },
  approved:         { label: 'Approved',          intent: Intent.PRIMARY, icon: 'endorsed' },
  fulfilled:        { label: 'Fulfilled',         intent: Intent.SUCCESS, icon: 'tick-circle' },
  cancelled:        { label: 'Cancelled',         intent: Intent.NONE,    icon: 'cross-circle' },
  rejected:         { label: 'Rejected',          intent: Intent.DANGER,  icon: 'cross-circle' },
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
    <Card compact className="!p-0 overflow-hidden">
      <div className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30 border-b flex items-center gap-2">
        Approval Trail
        {tier !== 'none' && (
          <Tag intent={tier === 'director' ? Intent.WARNING : Intent.WARNING} minimal>
            {tier === 'director' ? 'Director sign-off required' : 'Manager sign-off required'}
          </Tag>
        )}
      </div>
      <div className="divide-y">
        {/* Created */}
        <div className="flex items-start gap-3 px-4 py-3">
          <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
            <Icon icon="document" size={12} className="text-slate-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">Created by {requestorEmail}</p>
            <p className="text-[10px] text-muted-foreground">{format(parseISO(req.created_at), 'MMM d, yyyy HH:mm')}</p>
            {req.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">&quot;{req.notes}&quot;</p>}
          </div>
          {req.is_auto_proposed && (
            <Tag icon="predictive-analysis" intent={Intent.SUCCESS} minimal>AI proposed</Tag>
          )}
        </div>

        {/* Approved */}
        {approverEmail && req.approved_at && (
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0 mt-0.5">
              <Icon icon="endorsed" size={12} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Approved by {approverEmail}</p>
              <p className="text-[10px] text-muted-foreground">{format(parseISO(req.approved_at), 'MMM d, yyyy HH:mm')}</p>
              {req.approval_notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">&quot;{req.approval_notes}&quot;</p>}
            </div>
          </div>
        )}

        {/* Rejected */}
        {rejectorEmail && req.rejected_at && (
          <div className="flex items-start gap-3 px-4 py-3">
            <div className="h-6 w-6 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center shrink-0 mt-0.5">
              <Icon icon="cross-circle" size={12} className="text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Rejected by {rejectorEmail}</p>
              <p className="text-[10px] text-muted-foreground">{format(parseISO(req.rejected_at), 'MMM d, yyyy HH:mm')}</p>
              {req.rejected_reason && <p className="text-[10px] text-muted-foreground italic mt-0.5">&quot;{req.rejected_reason}&quot;</p>}
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

// ─── Receive history ──────────────────────────────────────────────────────────

function ReceiveHistory({ receives, currency }: { receives: RestockReceive[]; currency: string }) {
  if (receives.length === 0) {
    return (
      <Card compact className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon icon="box" size={14} />
        No stock received against this request yet.
      </Card>
    )
  }

  const totalReceivedQty = receives.reduce((s, r) => s + r.quantity_received, 0)

  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Receive History · {receives.length} event{receives.length !== 1 ? 's' : ''}
        </p>
        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
          +{totalReceivedQty} total received
        </span>
      </div>
      <div className="divide-y">
        {receives.map((r) => (
          <div key={r.id} className="flex items-start gap-3 px-4 py-3">
            <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center shrink-0 mt-0.5">
              <Icon icon="box" size={12} className="text-emerald-600" />
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
              {r.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">&quot;{r.notes}&quot;</p>}
            </div>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {formatDistanceToNow(parseISO(r.received_at), { addSuffix: true })}
            </span>
          </div>
        ))}
      </div>
    </Card>
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
    <Card compact className="flex items-center gap-2">
      <Spinner size={SpinnerSize.SMALL} />
      <span className="text-xs text-muted-foreground">Loading PO…</span>
    </Card>
  )

  if (!po) return null

  const statusIntent =
    po.status === 'closed' ? Intent.SUCCESS :
    po.status === 'partially_received' ? Intent.WARNING :
    po.status === 'sent' || po.status === 'confirmed' ? Intent.PRIMARY :
    Intent.NONE

  return (
    <Link
      to={`/po/${po.id}`}
      className="flex items-center gap-3 rounded border bg-card px-4 py-3 hover:bg-muted/30 transition-colors"
    >
      <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
        <Icon icon="document" size={16} className="text-blue-600 dark:text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{po.po_number}</p>
        <p className="text-[10px] text-muted-foreground">
          {po.supplier_name}
          {po.expected_delivery_date && ` · Expected ${format(parseISO(po.expected_delivery_date), 'MMM d, yyyy')}`}
        </p>
      </div>
      <Tag intent={statusIntent} minimal>{po.status.replace('_', ' ')}</Tag>
      <Icon icon="chevron-right" size={14} className="text-muted-foreground shrink-0" />
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
      <Card compact className="space-y-3">
        <p className="text-sm font-medium">
          {mode === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
        </p>
        <TextArea
          placeholder={mode === 'approve' ? 'Approval notes (optional)' : 'Reason for rejection (optional)'}
          value={notes}
          onChange={(e) => { setNotes(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleConfirm() }}
          fill
          autoFocus
          rows={3}
        />
        <div className="flex items-center gap-2">
          <Button
            size="small"
            intent={mode === 'approve' ? Intent.SUCCESS : Intent.DANGER}
            loading={approve.isPending || reject.isPending}
            onClick={handleConfirm}
          >
            {mode === 'approve' ? 'Approve' : 'Reject'}
          </Button>
          <Button size="small" variant="minimal" onClick={() => { setMode(null); setNotes('') }}>
            Cancel
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        icon="endorsed"
        intent={Intent.SUCCESS}
        size="small"
        onClick={() => { setMode('approve') }}
      >
        Approve Request
      </Button>
      <Button
        icon="cross-circle"
        size="small"
        intent={Intent.DANGER}
        variant="outlined"
        onClick={() => { setMode('reject') }}
      >
        Reject
      </Button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RestockObjectPage() {
  const { restockId = '' } = useParams<{ restockId: string }>()
  const navigate      = useNavigate()
  const currency      = useCurrency()
  const role          = useAuthStore((s) => s.role ?? 'limited_access')
  const hotelId       = useActiveHotelId()

  const { data: req,      isLoading: loadingReq  } = useQuery({
    queryKey: ['restock-object', restockId],
    queryFn:  () => fetchRestockById(restockId),
    enabled:  !!restockId,
    staleTime: 30_000,
  })
  const { data: receives = [],  isLoading: loadingRecv } = useReceives(restockId)
  const { data: forecastRows = [] }                     = useConsumptionForecast(30)
  const { data: members  = [] }                         = useTeamMembers()

  const emailMap = new Map(members.map((m) => [m.id, m.email]))
  const forecast = forecastRows.find((r) => r.variant_id === req?.variant_id) ?? null

  const isLoading = loadingReq || loadingRecv

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={SpinnerSize.STANDARD} />
      </div>
    )
  }

  if (!req) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Restock request not found"
        action={
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { void navigate(-1) }}>
            Go back
          </Button>
        }
      />
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

  const isAwaiting    = req.status === 'pending_manager' || req.status === 'pending_director'
  const canApprove    = isAwaiting && (
    req.status === 'pending_director'
      ? role === 'owner'
      : hasPermission(role, 'can_approve_restocks')
  )

  return (
    <ObjectViewFrame
      header={{
        breadcrumb: pv?.id ? { label: productName, to: `/variant/${pv.id}` } : OBJECT_PRESENTATION.restock_request.home,
        icon: OBJECT_PRESENTATION.restock_request.icon,
        title: variantLabel,
        star: { id: `restock_request:${req.id}`, label: `Restock · ${variantLabel}`, subtitle: 'Restock request', path: `/restock/${req.id}`, icon: 'box' },
        tags: (
          <>
            <Tag icon={cfg.icon} intent={cfg.intent} minimal>{cfg.label}</Tag>
            {req.is_auto_proposed && <Tag icon="predictive-analysis" intent={Intent.SUCCESS} minimal>AI proposed</Tag>}
          </>
        ),
        id: req.id,
      }}
      metrics={
        <>
        <Metric label="Qty Requested" value={req.quantity_needed} sub={pv?.sku ?? undefined} />
        <Metric
          label="Qty Received"
          value={received}
          sub={`${pctFulfilled}% fulfilled · ${remaining} remaining`}
          accent={pctFulfilled === 100 ? 'green' : received > 0 ? 'amber' : undefined}
        />
        <Metric
          label="Est. Cost"
          value={req.estimated_cost != null ? formatCurrency(req.estimated_cost, currency) : '—'}
          sub={poUnitCost != null ? `PO agreed: ${formatCurrency(poUnitCost, currency)}/unit` : undefined}
        />
        <Metric
          label="Stock Now"
          value={pv?.current_stock ?? '—'}
          sub={daysLeft !== null ? `~${Math.round(daysLeft)}d runway` : undefined}
          accent={daysUrgency === 'critical' ? 'red' : daysUrgency === 'warning' ? 'amber' : 'green'}
        />
        </>
      }
      rail={<AuditRail nodeType="restock_request" nodeId={req.id} />}
    >

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
          <Callout intent={Intent.WARNING} icon="shield" title={`Awaiting ${req.status === 'pending_director' ? 'Director' : 'Manager'} approval`}>
            <div className="mt-3">
              <ApprovalActions restockId={req.id} canApprove={canApprove} />
              {!canApprove && (
                <p className="text-[10px] mt-2 opacity-80">
                  You don&apos;t have permission to approve {req.status === 'pending_director' ? 'director-tier' : 'this'} request.
                </p>
              )}
            </div>
          </Callout>
        )}

        {/* Quick action — go to receive */}
        {(req.status === 'approved' || req.status === 'partially_received' as string) && (
          <Button
            icon="box"
            intent={Intent.PRIMARY}
            size="small"
            onClick={() => { void navigate(`/flow?panel=receive&request=${req.id}`) }}
          >
            Receive stock for this request
          </Button>
        )}

        {/* Agent activity — why this item is moving + the case wrapping it */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Agent Activity</h2>
          <ObjectAgentActivity
            variantIds={[req.variant_id]}
            hotelId={hotelId ?? undefined}
            emptyHint="No agent decisions on this item. This request may have been created manually."
          />
        </div>

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
        <Card>
          <ObjectActions
            nodeType="restock_request"
            requestId={req.id}
            variantId={req.variant_id}
            status={req.status}
          />
        </Card>

        {/* ── Graph connections ── */}
        <Card>
          <GraphConnections nodeType="restock_request" nodeId={req.id} />
        </Card>
    </ObjectViewFrame>
  )
}
