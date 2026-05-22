// Layer: Mind — 3-Way Match Engine (Sprint 11b)
// Header-level match: PO value (ordered) vs. received value vs. invoiced value.
// Palantir principle: decision support, not data display.
// Every row answers "do we owe what was invoiced?" with a clear approve/reject action.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
  Button,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
  TextArea,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import {
  usePOMatchSummary, usePOMatch, usePODiscrepancies, useReviewPODiscrepancy,
  useInvoiceIntelligence,
} from '@/features/mind/hooks'
import type { POMatchRow, PODiscrepancy } from '@beacon/types'

// ─── Match status helpers ──────────────────────────────────────────────────────

const MATCH_STATUS_STYLE = {
  matched:          { cls: 'border-green-200  bg-green-50   text-green-800  dark:bg-green-950/40  dark:text-green-300',  label: 'Matched'           },
  variance:         { cls: 'border-red-200    bg-red-50     text-red-800    dark:bg-red-950/40    dark:text-red-300',    label: 'Variance'          },
  pending_invoice:  { cls: 'border-amber-200  bg-amber-50   text-amber-800  dark:bg-amber-950/40  dark:text-amber-300',  label: 'Awaiting Invoice'  },
  pending_delivery: { cls: 'border-blue-200   bg-blue-50    text-blue-800   dark:bg-blue-950/40   dark:text-blue-300',   label: 'Awaiting Delivery' },
  no_data:          { cls: 'border-border     bg-muted      text-muted-foreground',                                       label: 'No Data'           },
}

function MatchStatusBadge({ status }: { status: POMatchRow['match_status'] }) {
  const { cls, label } = MATCH_STATUS_STYLE[status]
  return (
    <Tag minimal className={cn('!text-xs !h-5 !px-1.5 !font-medium', cls)}>
      {label}
    </Tag>
  )
}

function VariancePill({ pct }: { pct: number }) {
  if (pct === 0) return null
  const color = pct > 10 ? 'text-red-600 dark:text-red-400' : pct > 5 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
  return <span className={cn('tabular-nums text-xs font-semibold', color)}>±{pct.toFixed(1)}%</span>
}

// ─── 3-column match comparison ────────────────────────────────────────────────

function MatchTriangle({
  poValue, receivedValue, invoicedValue, currency,
}: {
  poValue: number; receivedValue: number; invoicedValue: number; currency: string
}) {
  const variance = receivedValue > 0
    ? ((invoicedValue - receivedValue) / receivedValue) * 100
    : 0
  const overbilled  = invoicedValue > receivedValue
  const hasVariance = receivedValue > 0 && Math.abs(variance) > 2

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: 'PO Value',       value: poValue,       sub: 'Ordered',   highlight: false },
        { label: 'Received Value', value: receivedValue, sub: 'Delivered',  highlight: false },
        { label: 'Invoiced',       value: invoicedValue,
          sub: hasVariance ? (overbilled ? 'Over received' : 'Under received') : 'Invoiced',
          highlight: hasVariance },
      ].map(({ label, value, sub, highlight }) => (
        <div key={label} className={cn(
          'rounded-lg border p-3',
          highlight
            ? overbilled
              ? 'bg-red-50 border-red-200 dark:bg-red-950/30'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30'
            : 'bg-muted/30',
        )}>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn(
            'text-base font-bold tabular-nums mt-0.5',
            highlight && overbilled  ? 'text-red-700 dark:text-red-300'   :
            highlight               ? 'text-amber-700 dark:text-amber-300' : '',
          )}>
            {formatCurrency(value, currency)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        </div>
      ))}
      {hasVariance && (
        <p className="col-span-3 text-xs text-muted-foreground">
          {overbilled
            ? `Invoice exceeds received by ${formatCurrency(invoicedValue - receivedValue, currency)} (${Math.abs(variance).toFixed(1)}%)`
            : `Invoice is below received by ${formatCurrency(receivedValue - invoicedValue, currency)} (${Math.abs(variance).toFixed(1)}%)`}
        </p>
      )}
    </div>
  )
}

// ─── PO detail panel ──────────────────────────────────────────────────────────

function POMatchDetail({
  poId,
  currency,
  pendingDiscrepancy,
}: {
  poId: string
  currency: string
  pendingDiscrepancy: PODiscrepancy | null
}) {
  const { data: match, isLoading } = usePOMatch(poId)
  const review = useReviewPODiscrepancy()
  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState<'approved' | 'rejected' | null>(null)

  if (isLoading) return (
    <div className="flex items-center justify-center py-12">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
    </div>
  )
  if (!match) return null

  const handleReview = (status: 'approved' | 'rejected') => {
    if (!pendingDiscrepancy) return
    review.mutate({ discrepancyId: pendingDiscrepancy.id, status, notes: notes || null })
    setConfirming(null)
    setNotes('')
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">{match.po_number}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{match.supplier_name}</p>
        </div>
        <MatchStatusBadge status={match.match_status} />
      </div>

      <MatchTriangle
        poValue={match.po_value}
        receivedValue={match.received_value}
        invoicedValue={match.invoiced_value}
        currency={currency}
      />

      {/* Approval actions — only when there's a pending discrepancy */}
      {pendingDiscrepancy && !confirming && (
        <div className="flex gap-2 pt-1">
          <Button
            size="small"
            variant="outlined"
            intent={Intent.SUCCESS}
            icon="tick"
            onClick={() => { setConfirming('approved') }}
          >
            Approve
          </Button>
          <Button
            size="small"
            variant="outlined"
            intent={Intent.DANGER}
            icon="cross"
            onClick={() => { setConfirming('rejected') }}
          >
            Reject
          </Button>
        </div>
      )}

      {confirming && (
        <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium">
            {confirming === 'approved'
              ? 'Approve — confirm variance is acceptable'
              : 'Reject — flag for supplier follow-up'}
          </p>
          <TextArea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => { setNotes(e.target.value) }}
            className="!text-xs !h-16 !resize-none"
            fill
          />
          <div className="flex gap-2">
            <Button
              size="small"
              intent={confirming === 'approved' ? Intent.SUCCESS : Intent.DANGER}
              loading={review.isPending}
              onClick={() => { handleReview(confirming) }}
            >
              Confirm {confirming === 'approved' ? 'Approval' : 'Rejection'}
            </Button>
            <Button
              size="small"
              variant="minimal"
              onClick={() => { setConfirming(null) }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Reviewed discrepancy history */}
      {match.discrepancy_status && match.discrepancy_status !== 'pending' && (
        <div className={cn(
          'rounded-md border px-3 py-2 text-xs',
          match.discrepancy_status === 'approved' ? 'border-green-200 bg-green-50 text-green-800 dark:bg-green-950/30' : 'border-red-200 bg-red-50 text-red-800 dark:bg-red-950/30',
        )}>
          Discrepancy {match.discrepancy_status}
        </div>
      )}
    </div>
  )
}

// ─── Discrepancy queue ─────────────────────────────────────────────────────────

function DiscrepancyQueue({
  currency,
  selectedPoId,
  onSelectPo,
}: {
  currency: string
  selectedPoId: string | null
  onSelectPo: (id: string) => void
}) {
  const { data: discrepancies = [], isLoading }    = usePODiscrepancies()
  const { data: invoiceIntel  = [] }               = useInvoiceIntelligence(90)
  const review                                      = useReviewPODiscrepancy()
  const [autoApproving, setAutoApproving]           = useState(false)

  // Streak lookup: supplier_name → consecutive_above_count
  const streakBySupplier = Object.fromEntries(
    (invoiceIntel).map((r) => [r.supplier_name, r.consecutive_above_count])
  )

  const pending  = discrepancies.filter((d) => d.status === 'pending')
  const reviewed = discrepancies.filter((d) => d.status !== 'pending')
  // Discrepancies at or below tolerance (≤2%) — safe to batch-approve
  const autoApprovable = pending.filter((d) => d.variance_pct <= 2)

  const handleAutoApprove = async () => {
    if (autoApprovable.length === 0) return
    setAutoApproving(true)
    for (const d of autoApprovable) {
      await review.mutateAsync({
        discrepancyId: d.id,
        status: 'approved',
        notes: 'Auto-approved: variance within 2% tolerance',
      })
    }
    setAutoApproving(false)
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
    </div>
  )

  if (pending.length === 0 && reviewed.length === 0) return (
    <NonIdealState
      icon="tick-circle"
      title="All clear"
      description="No invoice discrepancies detected. The match engine runs automatically when a PO closes with an invoice."
    />
  )

  return (
    <div className="divide-y overflow-y-auto flex-1">
      {pending.length > 0 && (
        <>
          <div className="px-4 py-2 bg-muted/30 sticky top-0 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              Needs review · {pending.length}
            </p>
            {autoApprovable.length > 0 && (
              <Button
                size="small"
                variant="outlined"
                intent={Intent.SUCCESS}
                icon="tick"
                loading={autoApproving}
                onClick={() => { void handleAutoApprove() }}
              >
                Approve {autoApprovable.length} ≤2%
              </Button>
            )}
          </div>
          {pending.map((d) => (
            <DiscrepancyRow
              key={d.id}
              d={d}
              currency={currency}
              selected={selectedPoId === d.po_id}
              onSelect={() => { onSelectPo(d.po_id) }}
              streak={d.supplier_name ? streakBySupplier[d.supplier_name] : undefined}
            />
          ))}
        </>
      )}
      {reviewed.length > 0 && (
        <>
          <p className="px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30 sticky top-0">
            Reviewed · {reviewed.length}
          </p>
          {reviewed.map((d) => (
            <DiscrepancyRow
              key={d.id}
              d={d}
              currency={currency}
              selected={selectedPoId === d.po_id}
              onSelect={() => { onSelectPo(d.po_id) }}
              streak={d.supplier_name ? streakBySupplier[d.supplier_name] : undefined}
            />
          ))}
        </>
      )}
    </div>
  )
}

function DiscrepancyRow({
  d, currency, selected, onSelect, streak,
}: {
  d: PODiscrepancy; currency: string; selected: boolean; onSelect: () => void
  streak?: number
}) {
  const navigate    = useNavigate()
  const overbilled  = d.invoiced_value > d.received_value
  const overcharge  = d.invoiced_value - d.received_value

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-muted/40 transition-colors',
        selected && 'bg-muted/60',
      )}
    >
      <div className={cn(
        'h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        d.status === 'pending'  ? 'bg-red-100 dark:bg-red-950/40' :
        d.status === 'approved' ? 'bg-green-100 dark:bg-green-950/40' : 'bg-muted',
      )}>
        <Icon
          icon={d.status === 'pending' ? 'warning-sign' : d.status === 'approved' ? 'tick' : 'cross'}
          size={12}
          className={d.status === 'pending' ? 'text-red-600 dark:text-red-400' : d.status === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-medium">
            {overbilled ? 'Overbilled' : 'Underbilled'} · {d.variance_pct.toFixed(1)}%
          </span>
          {d.supplier_name && (
            <span className="text-[10px] text-muted-foreground">{d.supplier_name}</span>
          )}
          {streak != null && streak >= 2 && (
            <Tag minimal intent={Intent.DANGER} className="!text-[9px] !h-3.5 !px-1">
              {streak}× streak
            </Tag>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {overbilled && overcharge > 0
            ? `+${formatCurrency(overcharge, currency)} overcharge`
            : `${formatCurrency(Math.abs(overcharge), currency)} under`}
          {' · '}Invoice {formatCurrency(d.invoiced_value, currency)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(d.detected_at), { addSuffix: true })}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {d.supplier_name && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void navigate('/mind?panel=intelligence') }}
            className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted"
            title="View supplier leverage"
          >
            <Icon icon="hand" size={12} />
          </button>
        )}
        <Icon icon="chevron-right" size={12} className="text-muted-foreground" />
      </div>
    </button>
  )
}

// ─── Summary tab (all POs with match status) ───────────────────────────────────

function MatchSummaryTab({
  currency,
  selectedPoId,
  onSelectPo,
}: {
  currency: string
  selectedPoId: string | null
  onSelectPo: (id: string) => void
}) {
  const { data: rows = [], isLoading } = usePOMatchSummary(90)

  if (isLoading) return (
    <div className="flex items-center justify-center py-16">
      <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
    </div>
  )

  if (rows.length === 0) return (
    <NonIdealState
      icon="chart"
      title="No purchase orders in the last 90 days"
    />
  )

  return (
    <div className="overflow-y-auto flex-1 divide-y">
      {rows.map((row) => (
        <button
          key={row.po_id}
          type="button"
          onClick={() => { onSelectPo(row.po_id) }}
          className={cn(
            'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/40 transition-colors',
            selectedPoId === row.po_id && 'bg-muted/60',
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{row.po_number}</span>
              <MatchStatusBadge status={row.match_status} />
              {row.discrepancy_status === 'pending' && (
                <Tag minimal intent={Intent.DANGER} className="!text-xs !h-4 !px-1">
                  Review needed
                </Tag>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{row.supplier_name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold tabular-nums">{formatCurrency(row.invoiced_value, currency)}</p>
            <VariancePill pct={row.variance_pct} />
          </div>
          <Icon icon="chevron-right" size={12} className="text-muted-foreground shrink-0" />
        </button>
      ))}
    </div>
  )
}

// ─── Public export ─────────────────────────────────────────────────────────────

export function POMatchContent() {
  const currency = useCurrency()
  const { data: discrepancies = [] } = usePODiscrepancies()

  const [innerTab, setInnerTab]   = useState<'queue' | 'all'>('queue')
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)

  const pendingCount = discrepancies.filter((d) => d.status === 'pending').length
  const pendingForPo = discrepancies.find((d) => d.po_id === selectedPoId && d.status === 'pending') ?? null

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: list panel */}
      <div className="w-80 flex-shrink-0 border-r flex flex-col">
        {/* Sub-tabs */}
        <div className="px-2 py-2 border-b shrink-0">
          <SegmentedControl
            size="small"
            fill
            value={innerTab}
            onValueChange={(v) => { setInnerTab(v as 'queue' | 'all') }}
            options={[
              { value: 'queue', label: `Discrepancies${pendingCount > 0 ? ` · ${String(pendingCount)}` : ''}` },
              { value: 'all',   label: 'All POs' },
            ]}
          />
        </div>

        {innerTab === 'queue' ? (
          <DiscrepancyQueue
            currency={currency}
            selectedPoId={selectedPoId}
            onSelectPo={setSelectedPoId}
          />
        ) : (
          <MatchSummaryTab
            currency={currency}
            selectedPoId={selectedPoId}
            onSelectPo={setSelectedPoId}
          />
        )}
      </div>

      {/* Right: detail panel */}
      <div className="flex-1 overflow-y-auto">
        {selectedPoId ? (
          <POMatchDetail
            poId={selectedPoId}
            currency={currency}
            pendingDiscrepancy={pendingForPo}
          />
        ) : (
          <NonIdealState
            icon="time"
            description="Select a PO to see the 3-way comparison."
          />
        )}
      </div>
    </div>
  )
}
