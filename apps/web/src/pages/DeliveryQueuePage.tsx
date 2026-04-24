// Layer: Flow
// Delivery Queue — shows all POs that need receiving, sorted by urgency.
// Operators see "what's arriving today / what's overdue" without navigating
// to Mind · Procurement. Each line shows the ordered cost and contracted rate
// so price deviations are visible before the item hits the receiving form.
// "Receive" deep-links into ReceivePage with the request pre-selected.
//
// Palantir principle: actions live next to data — no navigation away to act.

import { useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Truck, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Loader2, ArrowRight,
} from 'lucide-react'
import { format, isPast, isToday, isTomorrow, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { usePOSummary, usePOLines, useSupplierContracts } from '@/features/mind/hooks'
import type { POSummaryRow, SupplierContract } from '@beacon/types'

// ─── ETA label ───────────────────────────────────────────────────────────────

function EtaLabel({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-[10px] text-muted-foreground">No ETA</span>
  const d = parseISO(dateStr)
  if (isPast(d) && !isToday(d)) {
    return <span className="text-[10px] font-bold text-red-600 dark:text-red-400">Overdue · {format(d, 'MMM d')}</span>
  }
  if (isToday(d))    return <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Arriving today</span>
  if (isTomorrow(d)) return <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Arriving tomorrow</span>
  return <span className="text-[10px] text-muted-foreground">{format(d, 'MMM d, yyyy')}</span>
}

// ─── Contract price deviation badge ──────────────────────────────────────────

function ContractDeviation({
  poUnitCost,
  contract,
}: {
  poUnitCost: number
  contract: SupplierContract | undefined
}) {
  if (!contract) return null
  const pct = ((poUnitCost - contract.contracted_price) / contract.contracted_price) * 100
  if (Math.abs(pct) < 0.1) return null
  const over = pct > 0
  return (
    <span className={cn(
      'text-[9px] font-bold px-1 py-0.5 rounded',
      over
        ? pct > 3 ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    )}>
      {over ? '+' : ''}{pct.toFixed(1)}% vs contract
    </span>
  )
}

// ─── PO line list ─────────────────────────────────────────────────────────────

function POLineList({
  poId,
  contracts,
  currency,
}: {
  poId: string
  contracts: SupplierContract[]
  currency: string
}) {
  const { data: lines = [], isLoading } = usePOLines(poId)
  const navigate = useNavigate()

  const handleReceive = (requestId: string | null) => {
    if (!requestId) {
      // No linked restock request — go to receive search so operator can find it manually
      void navigate('/flow?panel=receive')
      return
    }
    // Deep-link: navigate to Flow Receive with pre-selected request
    void navigate(`/flow?panel=receive&request=${requestId}`)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <p className="px-6 py-4 text-xs text-muted-foreground">No lines on this PO.</p>
    )
  }

  return (
    <div className="divide-y border-t bg-muted/5">
      {/* Column headers */}
      <div className="flex items-center gap-3 px-6 py-2 bg-muted/20">
        <div className="flex-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          Product · Variant
        </div>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-20 text-right">Ordered</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-20 text-right">Received</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-20 text-right">PO Cost</span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-32 text-right">Contract</span>
        <div className="w-20" />
      </div>

      {lines.map((line) => {
        const contract = contracts.find((c) => c.variant_id === line.variant_id)
        const fullyReceived = line.received_qty >= line.ordered_qty
        return (
          <div key={line.id} className={cn(
            'flex items-center gap-3 px-6 py-3',
            fullyReceived && 'opacity-50'
          )}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                <Link to={`/variant/${line.variant_id}`} className="hover:underline" onClick={(e) => { e.stopPropagation() }}>
                  {line.product_name}
                  {line.variant_name && line.variant_name !== 'Standard' && (
                    <span className="text-muted-foreground ml-1">· {line.variant_name}</span>
                  )}
                </Link>
              </p>
              <p className="text-[10px] text-muted-foreground">{line.sku}</p>
            </div>

            {/* Ordered */}
            <span className="text-xs tabular-nums w-20 text-right">{line.ordered_qty}</span>

            {/* Received */}
            <span className={cn(
              'text-xs tabular-nums w-20 text-right font-medium',
              fullyReceived ? 'text-emerald-600' :
              line.received_qty > 0 ? 'text-amber-600' : 'text-muted-foreground'
            )}>
              {line.received_qty}
              {fullyReceived && <CheckCircle2 className="inline h-3 w-3 ml-1 text-emerald-500" />}
            </span>

            {/* PO unit cost */}
            <span className="text-xs tabular-nums w-20 text-right text-muted-foreground">
              {formatCurrency(line.unit_cost, currency)}
            </span>

            {/* Contract column */}
            <div className="w-32 text-right">
              {contract ? (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground tabular-nums">
                    {formatCurrency(contract.contracted_price, currency)} contracted
                  </p>
                  <ContractDeviation poUnitCost={line.unit_cost} contract={contract} />
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground">No contract</span>
              )}
            </div>

            {/* Action */}
            <div className="w-20 text-right">
              {fullyReceived ? (
                <span className="text-[10px] text-emerald-600 font-medium">Done</span>
              ) : (
                <button
                  type="button"
                  onClick={() => { handleReceive(line.request_id ?? null) }}
                  className="flex items-center gap-1 text-xs text-primary hover:underline ml-auto"
                >
                  Receive <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Single PO card ───────────────────────────────────────────────────────────

function POCard({
  po,
  contracts,
  currency,
  defaultOpen,
}: {
  po: POSummaryRow
  contracts: SupplierContract[]
  currency: string
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const filledPct   = po.line_count > 0 ? Math.round((po.received_lines / po.line_count) * 100) : 0
  const isOverdue   = !!po.expected_delivery_date &&
    isPast(parseISO(po.expected_delivery_date)) && !isToday(parseISO(po.expected_delivery_date))
  const isToday_    = !!po.expected_delivery_date && isToday(parseISO(po.expected_delivery_date))
  const allReceived = po.received_lines >= po.line_count && po.line_count > 0

  return (
    <div className={cn(
      'border-b last:border-b-0',
      isOverdue && 'bg-red-50/30 dark:bg-red-950/10',
    )}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors"
      >
        {/* Icon */}
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
          isOverdue ? 'bg-red-100 dark:bg-red-950/40' :
          isToday_  ? 'bg-emerald-100 dark:bg-emerald-950/40' :
          'bg-muted/60',
        )}>
          {isOverdue
            ? <AlertTriangle className="h-4 w-4 text-red-600" />
            : allReceived
              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              : <Truck className="h-4 w-4 text-muted-foreground" />
          }
        </div>

        {/* PO info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link to={`/po/${po.id}`} className="text-sm font-semibold truncate hover:underline" onClick={(e) => { e.stopPropagation() }}>{po.po_number}</Link>
            {po.supplier_id
              ? <Link to={`/supplier/${po.supplier_id}`} className="text-xs text-muted-foreground shrink-0 hover:underline" onClick={(e) => { e.stopPropagation() }}>· {po.supplier_name}</Link>
              : <span className="text-xs text-muted-foreground shrink-0">· {po.supplier_name}</span>
            }
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <EtaLabel dateStr={po.expected_delivery_date} />
            <span className="text-[10px] text-muted-foreground">
              {po.received_lines}/{po.line_count} lines received ({filledPct}%)
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-24 shrink-0">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                allReceived ? 'bg-emerald-500' :
                filledPct > 0 ? 'bg-amber-400' : 'bg-muted-foreground/30',
              )}
              style={{ width: `${String(filledPct)}%` }}
            />
          </div>
        </div>

        {/* Amount */}
        <span className="text-xs font-semibold tabular-nums text-muted-foreground shrink-0 w-20 text-right">
          {formatCurrency(po.total_amount, currency)}
        </span>

        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        }
      </button>

      {open && (
        <POLineList poId={po.id} contracts={contracts} currency={currency} />
      )}
    </div>
  )
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ pos, currency }: { pos: POSummaryRow[]; currency: string }) {
  const overdue = pos.filter((p) =>
    !!p.expected_delivery_date &&
    isPast(parseISO(p.expected_delivery_date)) &&
    !isToday(parseISO(p.expected_delivery_date))
  ).length
  const today_   = pos.filter((p) =>
    !!p.expected_delivery_date && isToday(parseISO(p.expected_delivery_date))
  ).length
  const totalValue = pos.reduce((s, p) => s + p.total_amount, 0)

  return (
    <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b bg-muted/10 shrink-0">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Open POs</p>
        <p className="text-2xl font-bold tabular-nums mt-0.5">{pos.length}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Overdue</p>
        <p className={cn('text-2xl font-bold tabular-nums mt-0.5', overdue > 0 ? 'text-red-600' : 'text-muted-foreground')}>
          {overdue}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Arriving Today</p>
        <p className={cn('text-2xl font-bold tabular-nums mt-0.5', today_ > 0 ? 'text-emerald-600' : 'text-muted-foreground')}>
          {today_}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Open Value</p>
        <p className="text-2xl font-bold tabular-nums mt-0.5">{formatCurrency(totalValue, currency)}</p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DeliveryQueuePage() {
  const currency                           = useCurrency()
  const { data: allPos = [], isLoading }   = usePOSummary()
  const { data: contracts = [] }           = useSupplierContracts()

  // Only show POs that still need receiving work
  const openPos = useMemo(() =>
    allPos
      .filter((p) => ['confirmed', 'partially_received', 'sent'].includes(p.status))
      .sort((a, b) => {
        // Overdue first, then by ETA ascending, then no-ETA last
        const da = a.expected_delivery_date ? parseISO(a.expected_delivery_date).getTime() : Infinity
        const db = b.expected_delivery_date ? parseISO(b.expected_delivery_date).getTime() : Infinity
        return da - db
      }),
    [allPos]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (openPos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <div>
          <p className="text-base font-semibold">All deliveries up to date</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            No POs are currently awaiting receiving. Create purchase orders in Mind · Procurement.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SummaryBar pos={openPos} currency={currency} />

      <div className="flex-1 overflow-y-auto">
        <div className="divide-y">
          {openPos.map((po, i) => (
            <POCard
              key={po.id}
              po={po}
              contracts={contracts}
              currency={currency}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
