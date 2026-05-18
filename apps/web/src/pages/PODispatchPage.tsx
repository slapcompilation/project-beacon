// Layer: Mind — PO Dispatch & Supplier Communication (Sprint 17)
// Closes the automation loop: proposal → approved → draft PO → DISPATCHED → confirmed → received.
// approveProposalWithPO() creates draft POs only — this page drives draft → sent → confirmed.
//
// Palantir Principle #4: Decision support — operators see exactly which POs need action,
// ordered by urgency, with one-click dispatch and confirmation tracking.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo } from 'react'
import { differenceInDays, format, parseISO, addDays } from 'date-fns'
import {
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogFooter,
  Icon,
  InputGroup,
  Intent,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useActiveHotel } from '@/features/hotel/hooks'
import { usePOSummary, usePOLines, useUpdatePOStatus } from '@/features/mind/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
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
    setTimeout(() => { setCopied(false); }, 2000)
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
    <Dialog
      isOpen={!!po}
      onClose={onClose}
      title={
        <span className="font-mono text-sm">
          {po.po_number} · {po.supplier_name}
        </span>
      }
      className="!w-[36rem]"
    >
      <DialogBody>
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
              <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /> Loading items…
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
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button variant="outlined" size="small" icon={copied ? 'tick' : 'duplicate'} intent={copied ? Intent.SUCCESS : Intent.NONE} onClick={() => { void handleCopy() }}>
              {copied ? 'Copied' : 'Copy email text'}
            </Button>
            <Button variant="outlined" size="small" icon="print" onClick={() => { window.print() }}>
              Print
            </Button>
            {po.status === 'draft' && (
              <Button
                size="small"
                intent={Intent.SUCCESS}
                icon="send-message"
                loading={sending}
                disabled={linesLoading}
                onClick={() => { void handleConfirmDispatch() }}
              >
                Confirm Dispatch
              </Button>
            )}
          </>
        }
      />
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
      <Button size="small" variant="outlined" icon="calendar" onClick={() => { setOpen(true) }}>
        Mark Confirmed
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="w-36">
        <InputGroup
          type="date"
          value={eta}
          onChange={(e) => { setEta(e.target.value) }}
          size="small"
        />
      </div>
      <Button size="small" intent={Intent.PRIMARY} icon="tick-circle" loading={saving} onClick={() => { void handleSave() }}>
        Save ETA
      </Button>
      <Button size="small" variant="minimal" icon="cross" onClick={() => { setOpen(false) }} aria-label="Cancel" />
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
    <Card className="!p-3 space-y-2 hover:border-foreground/20 transition-colors">
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
            variant="minimal"
            size="small"
            intent={Intent.DANGER}
            icon="ban-circle"
            onClick={() => { onCancel(po) }}
            aria-label="Cancel"
          />
          <Button
            size="small"
            intent={Intent.PRIMARY}
            icon="send-message"
            onClick={() => { onOpen(po) }}
          >
            Review & Send
          </Button>
        </div>
      </div>
    </Card>
  )
}

function SentCard({ po, currency, onOpen, onCancel }: POCardProps) {
  const sentAt    = po.sent_at ? parseISO(po.sent_at) : null
  const daysSent  = sentAt ? differenceInDays(new Date(), sentAt) : null
  const isStale   = daysSent != null && daysSent >= 3
  return (
    <Card className={cn('!p-3 space-y-2 transition-colors', isStale && '!border-amber-500/40')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-mono font-bold">{po.po_number}</div>
          <div className="text-xs text-muted-foreground truncate">{po.supplier_name}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold font-mono">{formatCurrency(po.total_amount, currency)}</div>
          {isStale && (
            <div className="text-[10px] text-amber-400 flex items-center justify-end gap-1">
              <Icon icon="warning-sign" size={10} />
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
            variant="minimal"
            size="small"
            intent={Intent.DANGER}
            icon="ban-circle"
            onClick={() => { onCancel(po) }}
            aria-label="Cancel"
          />
          <Button
            size="small"
            variant="outlined"
            onClick={() => { onOpen(po) }}
          >
            View PO
          </Button>
        </div>
      </div>
    </Card>
  )
}

function ConfirmedCard({ po, currency }: { po: POSummaryRow; currency: string }) {
  const eta        = po.expected_delivery_date ? parseISO(po.expected_delivery_date) : null
  const daysToETA  = eta ? differenceInDays(eta, new Date()) : null
  const isOverdue  = daysToETA != null && daysToETA < 0
  const isDueSoon  = daysToETA != null && daysToETA >= 0 && daysToETA <= 2

  return (
    <Card className={cn(
      '!p-3 space-y-2',
      isOverdue && '!border-red-500/40',
      isDueSoon && '!border-emerald-500/40',
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
              <Icon icon="warning-sign" size={10} />
              {Math.abs(daysToETA)}d overdue
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
          <Icon icon="truck" size={12} />
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
    </Card>
  )
}

// ─── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ label, count, icon, accent }: {
  label: string; count: number; icon: IconName; accent: string
}) {
  return (
    <div className={cn('flex items-center gap-2 pb-2 border-b', accent)}>
      <Icon icon={icon} size={12} />
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
        <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /> Loading dispatch queue…
      </div>
    )
  }

  const summaryTiles: { label: string; value: string | number; sub: string; accent: string; icon: IconName }[] = [
    {
      label: 'Awaiting Dispatch',
      value: draftPOs.length,
      sub: 'draft POs',
      accent: draftPOs.length > 0 ? 'text-amber-400' : 'text-muted-foreground',
      icon: 'time',
    },
    {
      label: 'Sent · No Confirmation',
      value: sentPOs.length,
      sub: staleCount > 0 ? `${staleCount} stale (3d+)` : 'awaiting supplier',
      accent: staleCount > 0 ? 'text-amber-400' : 'text-blue-400',
      icon: 'send-message',
    },
    {
      label: 'In Transit',
      value: confirmedPOs.length,
      sub: overdueCount > 0 ? `${overdueCount} overdue` : 'confirmed ETAs',
      accent: overdueCount > 0 ? 'text-red-400' : 'text-emerald-400',
      icon: 'truck',
    },
    {
      label: 'Total Value In-flight',
      value: formatCurrency([...draftPOs, ...sentPOs, ...confirmedPOs].reduce((s, p) => s + p.total_amount, 0), currency),
      sub: `across ${draftPOs.length + sentPOs.length + confirmedPOs.length} open POs`,
      accent: 'text-foreground',
      icon: 'tick-circle',
    },
  ]

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">

      {/* Summary strip */}
      <div className="grid grid-cols-4 gap-3">
        {summaryTiles.map(({ label, value, sub, accent, icon }) => (
          <Card key={label} className="!p-3">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mb-1">
              <Icon icon={icon} size={12} />
              {label}
            </div>
            <div className={cn('text-xl font-mono font-bold', accent)}>{value}</div>
            <div className="text-[10px] text-muted-foreground">{sub}</div>
          </Card>
        ))}
      </div>

      {/* Three-stage kanban */}
      <div className="grid grid-cols-3 gap-5">

        {/* Stage 1: Draft */}
        <div className="space-y-3">
          <SectionHeader
            label="Awaiting Dispatch"
            count={draftPOs.length}
            icon="time"
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
            icon="send-message"
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
            icon="truck"
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
        onClose={() => { setDocPO(null) }}
      />

      {/* Cancel confirmation */}
      {cancelPO && (
        <Dialog
          isOpen={!!cancelPO}
          onClose={() => { setCancelPO(null) }}
          title={`Cancel PO ${cancelPO.po_number}?`}
          className="!w-[24rem]"
        >
          <DialogBody>
            <p className="text-xs text-muted-foreground">
              This will mark the PO as cancelled. The action will be noted in the audit log but cannot be undone.
            </p>
          </DialogBody>
          <DialogFooter
            actions={
              <>
                <Button variant="outlined" size="small" onClick={() => { setCancelPO(null) }}>
                  Keep
                </Button>
                <Button
                  size="small"
                  intent={Intent.DANGER}
                  icon="ban-circle"
                  loading={cancelling}
                  onClick={() => { void handleCancel() }}
                >
                  Cancel PO
                </Button>
              </>
            }
          />
        </Dialog>
      )}
    </div>
  )
}
