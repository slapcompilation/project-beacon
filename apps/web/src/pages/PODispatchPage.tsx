// Layer: Mind — PO Dispatch & Supplier Communication (Sprint 17)
// Closes the automation loop: proposal → approved → draft PO → DISPATCHED → confirmed → received.
// approveProposalWithPO() creates draft POs only — this page drives draft → sent → confirmed.
//
// Palantir Principle #4: Decision support — operators see exactly which POs need action,
// ordered by urgency, with one-click dispatch and confirmation tracking.
//
// No new SQL — uses existing update_po_status RPC, get_po_summary, get_po_lines, suppliers.

import { useState, useMemo } from 'react'
import { differenceInDays, format, parseISO, addDays } from 'date-fns'
import {
  Send, Clock, CheckCircle2, AlertTriangle, Loader2,
  Copy, Check, Printer, X, Truck, CalendarDays, Ban,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useActiveHotel } from '@/features/hotel/hooks'
import { usePOSummary, usePOLines, useUpdatePOStatus } from '@/features/mind/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { POSummaryRow } from '@beacon/types'

// ─── PO Document Modal ────────────────────────────────────────────────────────

interface PODocumentModalProps {
  po: POSummaryRow | null
  hotelName: string
  supplierEmail: string | null
  onClose: () => void
}

function PODocumentModal({ po, hotelName, supplierEmail, onClose }: PODocumentModalProps) {
  const currency   = useCurrency()
  const updatePO   = useUpdatePOStatus()
  const [copied, setCopied]   = useState(false)
  const [sending, setSending] = useState(false)

  const { data: lines = [], isLoading: linesLoading } = usePOLines(po?.id ?? null)

  const emailText = useMemo(() => {
    if (!po) return ''
    const dateStr = format(new Date(), 'dd MMM yyyy')
    const etaLine = po.expected_delivery_date
      ? `\nRequested delivery by: ${format(parseISO(po.expected_delivery_date), 'dd MMM yyyy')}`
      : ''
    const lineRows = lines
      .map(l => `  - ${l.product_name} — ${l.variant_name} (${l.sku}) × ${l.ordered_qty} units @ ${formatCurrency(l.unit_cost, currency)} = ${formatCurrency(l.line_total, currency)}`)
      .join('\n')
    return `PURCHASE ORDER: ${po.po_number}\n\nFrom: ${hotelName}\nTo:   ${po.supplier_name}\nDate: ${dateStr}${etaLine}\n\nItems:\n${lineRows}\n\nTotal: ${formatCurrency(po.total_amount, currency)}\n\nPlease confirm receipt of this order and advise your expected dispatch date.\n\nThank you,\n${hotelName}`
  }, [po, lines, hotelName, currency])

  async function handleCopy() {
    await navigator.clipboard.writeText(emailText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleConfirmDispatch() {
    if (!po) return
    setSending(true)
    try {
      await updatePO.mutateAsync({ poId: po.id, status: 'sent' })
      toast.success(`PO ${po.po_number} marked as sent`)
      onClose()
    } catch {
      /* toast already shown by mutation */
    } finally {
      setSending(false)
    }
  }

  if (!po) return null

  return (
    <Dialog open={!!po} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {po.po_number} · {po.supplier_name}
          </DialogTitle>
        </DialogHeader>

        {/* Document body */}
        <div className="border rounded-lg p-5 bg-card text-xs space-y-4 font-mono">
          {/* Header */}
          <div className="flex justify-between">
            <div>
              <div className="text-muted-foreground">FROM</div>
              <div className="font-semibold text-sm">{hotelName}</div>
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">DATE</div>
              <div>{format(new Date(), 'dd MMM yyyy')}</div>
            </div>
          </div>

          <div className="flex justify-between border-t pt-3">
            <div>
              <div className="text-muted-foreground">TO</div>
              <div className="font-semibold">{po.supplier_name}</div>
              {supplierEmail && <div className="text-muted-foreground">{supplierEmail}</div>}
            </div>
            <div className="text-right">
              <div className="text-muted-foreground">PO NUMBER</div>
              <div className="font-bold">{po.po_number}</div>
              {po.expected_delivery_date && (
                <>
                  <div className="text-muted-foreground mt-1">REQ. DELIVERY</div>
                  <div>{format(parseISO(po.expected_delivery_date), 'dd MMM yyyy')}</div>
                </>
              )}
            </div>
          </div>

          {/* Line items */}
          {linesLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-3">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading items…
            </div>
          ) : (
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left pb-1.5 font-medium">Item</th>
                  <th className="text-left pb-1.5 font-medium">SKU</th>
                  <th className="text-right pb-1.5 font-medium">Qty</th>
                  <th className="text-right pb-1.5 font-medium">Unit</th>
                  <th className="text-right pb-1.5 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id} className="border-b border-dashed border-border/40">
                    <td className="py-1.5 pr-2">
                      <div>{l.product_name}</div>
                      <div className="text-muted-foreground">{l.variant_name}</div>
                    </td>
                    <td className="py-1.5 pr-2 text-muted-foreground">{l.sku}</td>
                    <td className="py-1.5 text-right font-semibold">{l.ordered_qty}</td>
                    <td className="py-1.5 pl-3 text-right">{formatCurrency(l.unit_cost, currency)}</td>
                    <td className="py-1.5 pl-3 text-right font-semibold">{formatCurrency(l.line_total, currency)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-3 text-right font-semibold text-sm">TOTAL</td>
                  <td className="pt-3 pl-3 text-right font-bold text-base">{formatCurrency(po.total_amount, currency)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5 text-xs">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy email text'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs">
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
          </div>

          {po.status === 'draft' && (
            <Button
              size="sm"
              onClick={handleConfirmDispatch}
              disabled={sending || linesLoading}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Confirm Dispatch
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Inline ETA confirmation ──────────────────────────────────────────────────

function ETAConfirmRow({ po }: { po: POSummaryRow }) {
  const updatePO  = useUpdatePOStatus()
  const [open, setOpen]       = useState(false)
  const [eta, setEta]         = useState(
    po.expected_delivery_date ?? format(addDays(new Date(), 7), 'yyyy-MM-dd'),
  )
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updatePO.mutateAsync({ poId: po.id, status: 'confirmed', expectedDeliveryDate: eta })
      toast.success(`PO ${po.po_number} confirmed — ETA ${format(parseISO(eta), 'dd MMM')}`)
      setOpen(false)
    } catch {
      /* toast shown by mutation */
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="gap-1.5 text-xs h-7">
        <CalendarDays className="w-3 h-3" />
        Mark Confirmed
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Input
        type="date"
        value={eta}
        onChange={e => setEta(e.target.value)}
        className="h-7 text-xs w-36"
      />
      <Button size="sm" onClick={handleSave} disabled={saving} className="h-7 text-xs gap-1">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
        Save ETA
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-7 px-2">
        <X className="w-3 h-3" />
      </Button>
    </div>
  )
}

// ─── PO card ──────────────────────────────────────────────────────────────────

interface POCardProps {
  po: POSummaryRow
  currency: string
  onOpen: (po: POSummaryRow) => void
  onCancel: (po: POSummaryRow) => void
}

function DraftCard({ po, currency, onOpen, onCancel }: POCardProps) {
  const ageDays = differenceInDays(new Date(), parseISO(po.created_at))
  return (
    <div className="border rounded-lg p-3 space-y-2 bg-card hover:border-foreground/20 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-mono font-bold">{po.po_number}</div>
          <div className="text-xs text-muted-foreground truncate">{po.supplier_name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold font-mono">{formatCurrency(po.total_amount, currency)}</div>
          <div className="text-[10px] text-muted-foreground">{po.line_count} line{po.line_count !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground">
          Created {ageDays === 0 ? 'today' : `${ageDays}d ago`}
          {ageDays >= 2 && <span className="ml-1 text-amber-400">· waiting</span>}
        </div>
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(po)}
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
          >
            <Ban className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            onClick={() => onOpen(po)}
            className="h-7 text-xs gap-1.5 bg-primary/90 hover:bg-primary"
          >
            <Send className="w-3 h-3" />
            Review & Send
          </Button>
        </div>
      </div>
    </div>
  )
}

function SentCard({ po, currency, onOpen, onCancel }: POCardProps) {
  const sentAt    = po.sent_at ? parseISO(po.sent_at) : null
  const daysSent  = sentAt ? differenceInDays(new Date(), sentAt) : null
  const isStale   = daysSent != null && daysSent >= 3
  return (
    <div className={cn(
      'border rounded-lg p-3 space-y-2 bg-card transition-colors',
      isStale ? 'border-amber-500/40' : '',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-mono font-bold">{po.po_number}</div>
          <div className="text-xs text-muted-foreground truncate">{po.supplier_name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold font-mono">{formatCurrency(po.total_amount, currency)}</div>
          {isStale && (
            <div className="text-[10px] text-amber-400 flex items-center justify-end gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              {daysSent}d no reply
            </div>
          )}
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground">
        Sent {sentAt ? format(sentAt, 'dd MMM yyyy') : '—'}
        {po.expected_delivery_date && (
          <> · ETA request: {format(parseISO(po.expected_delivery_date), 'dd MMM')}</>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <ETAConfirmRow po={po} />
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onCancel(po)}
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
          >
            <Ban className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpen(po)}
            className="h-7 text-xs gap-1"
          >
            View PO
          </Button>
        </div>
      </div>
    </div>
  )
}

function ConfirmedCard({ po, currency }: { po: POSummaryRow; currency: string }) {
  const eta        = po.expected_delivery_date ? parseISO(po.expected_delivery_date) : null
  const daysToETA  = eta ? differenceInDays(eta, new Date()) : null
  const isOverdue  = daysToETA != null && daysToETA < 0
  const isDueSoon  = daysToETA != null && daysToETA >= 0 && daysToETA <= 2

  return (
    <div className={cn(
      'border rounded-lg p-3 space-y-2 bg-card',
      isOverdue  ? 'border-red-500/40' :
      isDueSoon  ? 'border-emerald-500/40' : '',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-mono font-bold">{po.po_number}</div>
          <div className="text-xs text-muted-foreground truncate">{po.supplier_name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold font-mono">{formatCurrency(po.total_amount, currency)}</div>
          {isOverdue && (
            <div className="text-[10px] text-red-400 flex items-center justify-end gap-1">
              <AlertTriangle className="w-2.5 h-2.5" />
              {Math.abs(daysToETA!)}d overdue
            </div>
          )}
          {isDueSoon && (
            <div className="text-[10px] text-emerald-400">
              Due {daysToETA === 0 ? 'today' : `in ${daysToETA}d`}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Truck className="w-3 h-3" />
          {eta ? (
            isOverdue
              ? `Expected ${format(eta, 'dd MMM')} — chase supplier`
              : `Arriving ${format(eta, 'dd MMM yyyy')}`
          ) : 'No ETA set'}
        </div>
        <div className="flex items-center gap-1.5">
          {po.received_lines > 0 && (
            <div className="text-[10px] text-muted-foreground">
              {po.received_lines}/{po.line_count} received
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, icon: Icon, accent }: {
  label: string; count: number; icon: React.ElementType; accent: string
}) {
  return (
    <div className={cn('flex items-center gap-2 pb-2 border-b', accent)}>
      <Icon className="w-3.5 h-3.5" />
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">{count}</span>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptySection({ label }: { label: string }) {
  return (
    <div className="text-[10px] text-muted-foreground italic py-3 text-center border border-dashed rounded-lg">
      No {label} POs
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function PODispatchPage() {
  const currency              = useCurrency()
  const activeHotel           = useActiveHotel()
  const hotelName             = activeHotel?.name ?? 'Hotel'

  const { data: allPOs = [], isLoading } = usePOSummary()
  const { data: suppliers = [] }         = useSuppliers()
  const updatePO                          = useUpdatePOStatus()

  const [docPO,    setDocPO]   = useState<POSummaryRow | null>(null)
  const [cancelPO, setCancelPO] = useState<POSummaryRow | null>(null)
  const [cancelling, setCancelling] = useState(false)

  // Split by lifecycle stage
  const draftPOs     = useMemo(() => allPOs.filter(p => p.status === 'draft'), [allPOs])
  const sentPOs      = useMemo(() => allPOs.filter(p => p.status === 'sent'), [allPOs])
  const confirmedPOs = useMemo(() => allPOs.filter(p => p.status === 'confirmed' || p.status === 'partially_received'), [allPOs])

  // Summary metrics
  const overdueCount = confirmedPOs.filter(p => {
    if (!p.expected_delivery_date) return false
    return differenceInDays(parseISO(p.expected_delivery_date), new Date()) < 0
  }).length

  const staleCount = sentPOs.filter(p => {
    if (!p.sent_at) return false
    return differenceInDays(new Date(), parseISO(p.sent_at)) >= 3
  }).length

  // Supplier email lookup
  const supplierEmailMap = useMemo(() => {
    const map = new Map<string, string | null>()
    for (const s of suppliers) map.set(s.id, s.email)
    return map
  }, [suppliers])

  function getSupplierEmail(po: POSummaryRow): string | null {
    if (!po.supplier_id) return null
    return supplierEmailMap.get(po.supplier_id) ?? null
  }

  async function handleCancel() {
    if (!cancelPO) return
    setCancelling(true)
    try {
      await updatePO.mutateAsync({ poId: cancelPO.id, status: 'cancelled' })
      toast.success(`PO ${cancelPO.po_number} cancelled`)
      setCancelPO(null)
    } catch {
      /* toast shown by mutation */
    } finally {
      setCancelling(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-xs text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading dispatch queue…
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          {
            label: 'Awaiting Dispatch',
            value: draftPOs.length,
            sub: 'draft POs',
            accent: draftPOs.length > 0 ? 'text-amber-400' : 'text-muted-foreground',
            icon: Clock,
          },
          {
            label: 'Sent · No Confirmation',
            value: sentPOs.length,
            sub: staleCount > 0 ? `${staleCount} stale (3d+)` : 'awaiting supplier',
            accent: staleCount > 0 ? 'text-amber-400' : 'text-blue-400',
            icon: Send,
          },
          {
            label: 'In Transit',
            value: confirmedPOs.length,
            sub: overdueCount > 0 ? `${overdueCount} overdue` : 'confirmed ETAs',
            accent: overdueCount > 0 ? 'text-red-400' : 'text-emerald-400',
            icon: Truck,
          },
          {
            label: 'Total Value In-flight',
            value: formatCurrency([...draftPOs, ...sentPOs, ...confirmedPOs].reduce((s, p) => s + p.total_amount, 0), currency),
            sub: `across ${draftPOs.length + sentPOs.length + confirmedPOs.length} open POs`,
            accent: 'text-foreground',
            icon: CheckCircle2,
          },
        ].map(({ label, value, sub, accent, icon: Icon }) => (
          <div key={label} className="border rounded-lg p-3 bg-card">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
              <Icon className="w-3 h-3" />
              {label}
            </div>
            <div className={cn('text-xl font-mono font-bold', accent)}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{sub}</div>
          </div>
        ))}
      </div>

      {/* Three-stage kanban */}
      <div className="grid grid-cols-3 gap-5">

        {/* Stage 1: Draft */}
        <div className="space-y-3">
          <SectionHeader
            label="Awaiting Dispatch"
            count={draftPOs.length}
            icon={Clock}
            accent="border-amber-500/40 text-amber-400"
          />
          {draftPOs.length === 0 ? (
            <EmptySection label="draft" />
          ) : (
            draftPOs
              .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
              .map(po => (
                <DraftCard
                  key={po.id}
                  po={po}
                  currency={currency}
                  onOpen={setDocPO}
                  onCancel={setCancelPO}
                />
              ))
          )}
        </div>

        {/* Stage 2: Sent */}
        <div className="space-y-3">
          <SectionHeader
            label="Sent · Awaiting Confirmation"
            count={sentPOs.length}
            icon={Send}
            accent="border-blue-500/40 text-blue-400"
          />
          {sentPOs.length === 0 ? (
            <EmptySection label="sent" />
          ) : (
            sentPOs
              .sort((a, b) => new Date(a.sent_at ?? 0).getTime() - new Date(b.sent_at ?? 0).getTime())
              .map(po => (
                <SentCard
                  key={po.id}
                  po={po}
                  currency={currency}
                  onOpen={setDocPO}
                  onCancel={setCancelPO}
                />
              ))
          )}
        </div>

        {/* Stage 3: Confirmed / In Transit */}
        <div className="space-y-3">
          <SectionHeader
            label="Confirmed · In Transit"
            count={confirmedPOs.length}
            icon={Truck}
            accent="border-emerald-500/40 text-emerald-400"
          />
          {confirmedPOs.length === 0 ? (
            <EmptySection label="confirmed" />
          ) : (
            confirmedPOs
              .sort((a, b) => {
                // Sort overdue first, then by ETA
                const etaA = a.expected_delivery_date ? parseISO(a.expected_delivery_date).getTime() : Infinity
                const etaB = b.expected_delivery_date ? parseISO(b.expected_delivery_date).getTime() : Infinity
                return etaA - etaB
              })
              .map(po => (
                <ConfirmedCard key={po.id} po={po} currency={currency} />
              ))
          )}
        </div>
      </div>

      {/* PO Document Modal */}
      <PODocumentModal
        po={docPO}
        hotelName={hotelName}
        supplierEmail={docPO ? getSupplierEmail(docPO) : null}
        onClose={() => setDocPO(null)}
      />

      {/* Cancel confirmation */}
      {cancelPO && (
        <Dialog open={!!cancelPO} onOpenChange={() => setCancelPO(null)}>
          <DialogContent className="max-w-sm">
            <div className="space-y-4">
              <div>
                <div className="font-semibold text-sm">Cancel PO {cancelPO.po_number}?</div>
                <div className="text-xs text-muted-foreground mt-1">
                  This will mark the PO as cancelled. The action can be noted in the audit log but cannot be undone.
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setCancelPO(null)} className="text-xs">
                  Keep
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="text-xs gap-1"
                >
                  {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                  Cancel PO
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
