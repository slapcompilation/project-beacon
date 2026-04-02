// Layer: Mind — Saved Purchase Orders + Invoice Intelligence
// Palantir principle: auditability as a first-class feature.
// Every PO has a full lifecycle trace (draft → sent → confirmed → closed).
// Invoice 3-way match: PO total vs invoice amount — discrepancies are flagged
// automatically and require explicit approval or dispute resolution.

import { useState, useMemo } from 'react'
import {
  ShoppingCart, ChevronDown, ChevronRight, CheckCircle2, XCircle,
  AlertTriangle, FileText, Loader2, Send, PackageCheck,
  ClipboardCheck, Ban, Plus,
} from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import {
  usePOSummary, usePOLines, usePOInvoices,
  useUpdatePOStatus, useSubmitPOInvoice, useUpdateInvoiceStatus,
} from '@/features/mind/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'
import type { POSummaryRow, POStatus, POInvoiceStatus } from '@beacon/types'

// ─── Status config ────────────────────────────────────────────────────────────

const PO_STATUS_CFG: Record<POStatus, { label: string; cls: string }> = {
  draft:              { label: 'Draft',             cls: 'border-border text-muted-foreground' },
  sent:               { label: 'Sent',              cls: 'border-blue-300 text-blue-700 dark:text-blue-400' },
  confirmed:          { label: 'Confirmed',         cls: 'border-indigo-300 text-indigo-700 dark:text-indigo-400' },
  partially_received: { label: 'Partial Receipt',   cls: 'border-amber-300 text-amber-700 dark:text-amber-400' },
  closed:             { label: 'Closed',            cls: 'border-green-300 text-green-700 dark:text-green-400' },
  cancelled:          { label: 'Cancelled',         cls: 'border-red-300 text-muted-foreground' },
}

const INV_STATUS_CFG: Record<POInvoiceStatus, { label: string; cls: string; icon: React.ElementType }> = {
  pending:  { label: 'Pending Review', cls: 'border-amber-300 text-amber-700 dark:text-amber-400',   icon: AlertTriangle },
  matched:  { label: 'Matched',        cls: 'border-green-300 text-green-700 dark:text-green-400',   icon: CheckCircle2  },
  disputed: { label: 'Disputed',       cls: 'border-red-300 text-red-700 dark:text-red-400',         icon: XCircle       },
  approved: { label: 'Approved',       cls: 'border-green-300 text-green-700 dark:text-green-400',   icon: ClipboardCheck},
}

// ─── Invoice submission form ───────────────────────────────────────────────────

function InvoiceForm({ poId, onDone }: { poId: string; onDone: () => void }) {
  const submit = useSubmitPOInvoice()
  const [num,    setNum]    = useState('')
  const [date,   setDate]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [amount, setAmount] = useState('')
  const [notes,  setNotes]  = useState('')

  const handleSubmit = () => {
    const amt = parseFloat(amount)
    if (!num.trim() || !date || isNaN(amt) || amt <= 0) return
    submit.mutate(
      { poId, invoiceNumber: num, invoiceDate: date, invoiceAmount: amt, notes: notes || null },
      { onSuccess: () => { onDone() } },
    )
  }

  return (
    <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Submit Invoice</p>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Invoice Number</Label>
          <Input placeholder="INV-2026-001" value={num} onChange={(e) => { setNum(e.target.value) }} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Invoice Date</Label>
          <Input type="date" value={date} onChange={(e) => { setDate(e.target.value) }} className="h-8 text-xs" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Invoice Amount</Label>
          <Input type="number" min={0} step={0.01} placeholder="0.00" value={amount} onChange={(e) => { setAmount(e.target.value) }} className="h-8 text-xs" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes (optional)</Label>
        <Input placeholder="Discrepancy details, payment terms…" value={notes} onChange={(e) => { setNotes(e.target.value) }} className="h-8 text-xs" />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button size="sm" onClick={handleSubmit} disabled={submit.isPending || !num || !amount} className="gap-1.5 text-xs h-8">
          {submit.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
          Submit Invoice
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} className="text-xs h-8">Cancel</Button>
      </div>
    </div>
  )
}

// ─── PO detail panel (expanded) ───────────────────────────────────────────────

function PODetail({ po, currency, canApprove }: { po: POSummaryRow; currency: string; canApprove: boolean }) {
  const { data: lines    = [], isLoading: linesLoading    } = usePOLines(po.id)
  const { data: invoices = [], isLoading: invoicesLoading } = usePOInvoices(po.id)
  const updateStatus       = useUpdatePOStatus()
  const updateInvoice      = useUpdateInvoiceStatus()
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)

  const progressPct = po.line_count > 0 ? Math.round((po.received_lines / po.line_count) * 100) : 0

  const nextStatus: Partial<Record<POStatus, POStatus>> = {
    draft:     'sent',
    sent:      'confirmed',
    confirmed: 'closed',
  }
  const nextLabel: Partial<Record<POStatus, string>> = {
    draft:     'Mark Sent',
    sent:      'Confirm Receipt',
    confirmed: 'Close PO',
  }

  return (
    <div className="border-t bg-muted/10 px-4 py-4 space-y-4">
      {/* Actions bar */}
      {canApprove && (
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatus[po.status] && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7"
              disabled={updateStatus.isPending}
              onClick={() => { updateStatus.mutate({ poId: po.id, status: nextStatus[po.status]! }) }}
            >
              {updateStatus.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              {nextLabel[po.status]}
            </Button>
          )}
          {po.status !== 'cancelled' && po.status !== 'closed' && (
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive"
              disabled={updateStatus.isPending}
              onClick={() => { updateStatus.mutate({ poId: po.id, status: 'cancelled' }) }}>
              <Ban className="h-3 w-3" />Cancel PO
            </Button>
          )}
          {(po.status === 'sent' || po.status === 'confirmed' || po.status === 'closed') && !showInvoiceForm && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 ml-auto"
              onClick={() => { setShowInvoiceForm(true) }}>
              <Plus className="h-3 w-3" />Add Invoice
            </Button>
          )}
        </div>
      )}

      {/* Delivery progress */}
      {po.line_count > 0 && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Receipt progress</span>
            <span className="tabular-nums">{po.received_lines}/{po.line_count} lines fully received ({progressPct}%)</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* Line items */}
      {linesLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading lines…
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">Product</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Ordered</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Received</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Unit Cost</th>
                <th className="text-right px-3 py-2 font-medium text-muted-foreground">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => {
                const fullyReceived = l.received_qty >= l.ordered_qty
                return (
                  <tr key={l.id} className="border-t border-border/40">
                    <td className="px-3 py-2 font-medium">
                      {l.product_name}{l.variant_name && l.variant_name !== 'Standard' ? ` — ${l.variant_name}` : ''}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted-foreground">{l.sku}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.ordered_qty}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums font-semibold', fullyReceived ? 'text-green-600 dark:text-green-400' : 'text-foreground')}>
                      {l.received_qty}
                      {fullyReceived && <CheckCircle2 className="h-3 w-3 inline ml-1" />}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatCurrency(l.unit_cost, currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(l.line_total, currency)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={5} className="px-3 py-2 text-right text-xs font-bold uppercase tracking-wide text-muted-foreground">PO Total</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-base">{formatCurrency(po.total_amount, currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Invoice form */}
      {showInvoiceForm && (
        <InvoiceForm poId={po.id} onDone={() => { setShowInvoiceForm(false) }} />
      )}

      {/* Invoices */}
      {invoicesLoading ? null : invoices.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Invoices</p>
          {invoices.map((inv) => {
            const cfg = INV_STATUS_CFG[inv.status]
            const StatusIcon = cfg.icon
            const discrepancy = Number(inv.discrepancy_amount)
            const isOver  = discrepancy > 0.01
            const isUnder = discrepancy < -0.01

            return (
              <div key={inv.id} className="rounded-md border border-border/60 bg-card p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px] gap-1', cfg.cls)}>
                      <StatusIcon className="h-3 w-3" />{cfg.label}
                    </Badge>
                    <span className="text-sm font-semibold">{inv.invoice_number}</span>
                    <span className="text-xs text-muted-foreground">· {format(new Date(inv.invoice_date), 'dd MMM yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-bold text-sm">{formatCurrency(inv.invoice_amount, currency)}</span>
                    {canApprove && (inv.status === 'pending' || inv.status === 'matched') && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 gap-1 border-green-300 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950/30"
                          disabled={updateInvoice.isPending}
                          onClick={() => { updateInvoice.mutate({ invoiceId: inv.id, status: 'approved', poId: po.id }) }}>
                          <CheckCircle2 className="h-3 w-3" />Approve
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                          disabled={updateInvoice.isPending}
                          onClick={() => { updateInvoice.mutate({ invoiceId: inv.id, status: 'disputed', poId: po.id }) }}>
                          <XCircle className="h-3 w-3" />Dispute
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3-way match */}
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div className="rounded bg-muted/30 px-2 py-1.5">
                    <p className="text-muted-foreground">PO Amount</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(inv.po_amount, currency)}</p>
                  </div>
                  <div className="rounded bg-muted/30 px-2 py-1.5">
                    <p className="text-muted-foreground">Invoiced</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(inv.invoice_amount, currency)}</p>
                  </div>
                  <div className={cn('rounded px-2 py-1.5', isOver ? 'bg-red-50 dark:bg-red-950/20' : isUnder ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-green-50 dark:bg-green-950/20')}>
                    <p className={cn('text-muted-foreground', isOver ? 'text-red-600 dark:text-red-400' : isUnder ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}>
                      {isOver ? 'Over-invoiced' : isUnder ? 'Under-invoiced' : 'Matched'}
                    </p>
                    <p className={cn('font-bold tabular-nums', isOver ? 'text-red-600 dark:text-red-400' : isUnder ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}>
                      {discrepancy >= 0 ? '+' : ''}{formatCurrency(discrepancy, currency)}
                    </p>
                  </div>
                </div>

                {inv.notes && <p className="text-[11px] italic text-muted-foreground truncate">"{inv.notes}"</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── PO row (collapsed / expanded) ───────────────────────────────────────────

function PORow({ po, currency, canApprove }: { po: POSummaryRow; currency: string; canApprove: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const statusCfg = PO_STATUS_CFG[po.status]

  const hasInvoiceAlert = po.invoice_status === 'pending' || po.invoice_status === 'disputed'
  const invCfg = po.invoice_status ? INV_STATUS_CFG[po.invoice_status] : null
  const InvIcon = invCfg?.icon

  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      {/* Row header */}
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => { setExpanded((v) => !v) }}
      >
        {expanded
          ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm font-semibold tabular-nums">{po.po_number}</span>
          <span className="text-xs text-muted-foreground truncate">· {po.supplier_name}</span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasInvoiceAlert && invCfg && InvIcon && (
            <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px] gap-1', invCfg.cls)}>
              <InvIcon className="h-3 w-3" />{invCfg.label}
            </Badge>
          )}
          <Badge variant="outline" className={cn('h-5 px-1.5 text-[10px]', statusCfg.cls)}>
            {statusCfg.label}
          </Badge>
          <span className="text-sm font-bold tabular-nums text-right min-w-[80px]">
            {formatCurrency(po.total_amount, currency)}
          </span>
          <span className="text-[10px] text-muted-foreground min-w-[80px] text-right">
            {po.sent_at
              ? `Sent ${format(new Date(po.sent_at), 'dd MMM')}`
              : format(new Date(po.created_at), 'dd MMM')}
          </span>
          {po.expected_delivery_date && (
            <span className="text-[10px] text-muted-foreground">
              ETA {format(new Date(po.expected_delivery_date), 'dd MMM')}
            </span>
          )}
          {po.invoice_discrepancy != null && Math.abs(Number(po.invoice_discrepancy)) > 0.01 && (
            <span className={cn('text-[10px] font-semibold tabular-nums', Number(po.invoice_discrepancy) > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400')}>
              {Number(po.invoice_discrepancy) > 0 ? '+' : ''}{formatCurrency(Number(po.invoice_discrepancy), currency)}
            </span>
          )}
        </div>
      </button>

      {expanded && <PODetail po={po} currency={currency} canApprove={canApprove} />}
    </div>
  )
}

// ─── KPI strip ────────────────────────────────────────────────────────────────

function KpiStrip({ pos, currency }: { pos: POSummaryRow[]; currency: string }) {
  const open       = pos.filter((p) => !['closed', 'cancelled'].includes(p.status))
  const totalOpen  = open.reduce((s, p) => s + Number(p.total_amount), 0)
  const pending    = pos.filter((p) => p.invoice_status === 'pending').length
  const disputed   = pos.filter((p) => p.invoice_status === 'disputed').length
  const totalDiscrepancy = pos.reduce((s, p) => s + Math.abs(Number(p.invoice_discrepancy ?? 0)), 0)

  return (
    <div className="grid grid-cols-4 gap-px border-b bg-border flex-shrink-0">
      {[
        { label: 'Open Orders',        value: String(open.length),             sub: `${formatCurrency(totalOpen, currency)} outstanding` },
        { label: 'Invoices Pending',   value: String(pending),                  sub: 'awaiting review', highlight: pending > 0 },
        { label: 'Disputed Invoices',  value: String(disputed),                 sub: 'need resolution',  highlight: disputed > 0 },
        { label: 'Total Discrepancy',  value: formatCurrency(totalDiscrepancy, currency), sub: 'across all invoices', highlight: totalDiscrepancy > 0 },
      ].map(({ label, value, sub, highlight }) => (
        <div key={label} className="bg-card px-5 py-3">
          <p className={cn('text-lg font-bold tabular-nums leading-none', highlight ? 'text-red-600 dark:text-red-400' : '')}>{value}</p>
          <p className="text-xs font-medium mt-0.5">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SavedOrdersPage() {
  const { data: pos = [], isLoading } = usePOSummary()
  const role      = useAuthStore((s) => s.role)
  const currency  = useCurrency()
  const canApprove = !!role && hasPermission(role, 'can_approve_restocks')

  const [statusFilter, setStatusFilter] = useState<POStatus | 'all'>('all')
  const [search, setSearch]             = useState('')

  const STATUS_TABS: { key: POStatus | 'all'; label: string }[] = [
    { key: 'all',              label: `All (${pos.length})` },
    { key: 'draft',            label: `Draft (${pos.filter(p => p.status === 'draft').length})` },
    { key: 'sent',             label: `Sent (${pos.filter(p => p.status === 'sent').length})` },
    { key: 'confirmed',        label: `Confirmed (${pos.filter(p => p.status === 'confirmed').length})` },
    { key: 'partially_received', label: `Partial (${pos.filter(p => p.status === 'partially_received').length})` },
    { key: 'closed',           label: `Closed (${pos.filter(p => p.status === 'closed').length})` },
  ]

  const filtered = useMemo(() => {
    return pos
      .filter((p) => statusFilter === 'all' || p.status === statusFilter)
      .filter((p) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return p.po_number.toLowerCase().includes(q) || p.supplier_name.toLowerCase().includes(q)
      })
  }, [pos, statusFilter, search])

  // Separate: alert-worthy (invoice issues) come first
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const alertA = a.invoice_status === 'disputed' || a.invoice_status === 'pending' ? 0 : 1
      const alertB = b.invoice_status === 'disputed' || b.invoice_status === 'pending' ? 0 : 1
      if (alertA !== alertB) return alertA - alertB
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [filtered])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-muted-foreground" />
            Saved Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? 'Loading…' : `${pos.length} purchase order${pos.length !== 1 ? 's' : ''} · click to expand`}
          </p>
        </div>
        <Input
          placeholder="Search PO number or supplier…"
          value={search}
          onChange={(e) => { setSearch(e.target.value) }}
          className="h-8 w-52 text-xs"
        />
      </div>

      {/* KPI strip */}
      {pos.length > 0 && <KpiStrip pos={pos} currency={currency} />}

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b px-4 flex-shrink-0">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setStatusFilter(tab.key) }}
            className={cn(
              'px-3 py-2.5 text-xs font-medium border-b-2 transition-colors',
              statusFilter === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* PO list */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading ? (
          <div className="flex items-center gap-2 justify-center h-40 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />Loading orders…
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <ShoppingCart className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">
              {pos.length === 0
                ? 'No purchase orders yet — use the PO Generator and click Save & Track'
                : 'No orders match this filter'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((po) => (
              <PORow key={po.id} po={po} currency={currency} canApprove={canApprove} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
