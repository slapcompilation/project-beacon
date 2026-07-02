// Layer: Cross-domain — Purchase Order Object Page
// Palantir-pattern: every named entity is navigable to its full object context.
// Combines Mind (PO header, status, supplier), Flow (delivery progress, lines),
// Eye (discrepancy analysis, cost variance).
// Route: /po/:poId
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { FavoriteStar } from '@/features/foundryShell/FavoriteStar'
import { format, isPast, isToday, formatDistanceToNow, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  Button,
  Callout,
  Card,
  FormGroup,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { supabase } from '@/lib/supabase/client'
import { usePOLines, usePOInvoices, useUpdatePOStatus, useSupplierContracts } from '@/features/mind/hooks'
import { poFulfillmentPct, fulfilledLineCount, costVariancePct, isOverdue as poIsOverdue, daysUntilDelivery } from '@beacon/reality-graph'
import { GraphConnections } from '@/components/GraphConnections'
import { ObjectAgentActivity } from '@/features/agents/ObjectAgentActivity'
import { ObjectActions } from '@/components/ObjectActions'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useAuthStore } from '@/stores/auth.store'
import type { PurchaseOrder, POStatus, SupplierContract } from '@beacon/types'

// ─── Local types ──────────────────────────────────────────────────────────────

type POLineRow = {
  id: string
  po_id: string
  variant_id: string
  request_id: string | null
  ordered_qty: number
  received_qty: number
  unit_cost: number
  line_total: number
  notes: string | null
  variant_name: string
  sku: string
  product_name: string
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchPOById(poId: string): Promise<PurchaseOrder | null> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select('*')
    .eq('id', poId)
    .single() as unknown as { data: PurchaseOrder | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG: Record<POStatus, { label: string; intent: Intent; icon: IconName }> = {
  draft:               { label: 'Draft',            intent: Intent.NONE,    icon: 'document' },
  sent:                { label: 'Sent to Supplier', intent: Intent.PRIMARY, icon: 'send-message' },
  confirmed:           { label: 'Confirmed',        intent: Intent.PRIMARY, icon: 'endorsed' },
  partially_received:  { label: 'Partially Received', intent: Intent.WARNING, icon: 'box' },
  closed:              { label: 'Closed',           intent: Intent.SUCCESS, icon: 'tick-circle' },
  cancelled:           { label: 'Cancelled',        intent: Intent.NONE,    icon: 'cross-circle' },
}

// ─── ETA label ────────────────────────────────────────────────────────────────

function EtaLabel({ dateStr }: { dateStr: string | null }) {
  if (!dateStr) return <span className="text-xs text-muted-foreground">No ETA set</span>
  const d = parseISO(dateStr)
  if (isPast(d) && !isToday(d)) {
    return <span className="text-xs font-semibold text-red-600 dark:text-red-400">Overdue · {format(d, 'MMM d, yyyy')}</span>
  }
  if (isToday(d)) return <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Arriving today</span>
  return <span className="text-xs text-muted-foreground">{format(d, 'MMM d, yyyy')}</span>
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <Card compact>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums leading-none mt-1', color ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </Card>
  )
}

// ─── Status timeline ──────────────────────────────────────────────────────────

const STATUS_STEPS: POStatus[] = ['draft', 'sent', 'confirmed', 'partially_received', 'closed']

function StatusTimeline({ po }: { po: PurchaseOrder }) {
  const currentIdx = STATUS_STEPS.indexOf(po.status)
  if (po.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-slate-400" />
        This PO was cancelled
      </div>
    )
  }
  return (
    <div className="flex items-center gap-0 flex-wrap">
      {STATUS_STEPS.map((step, i) => {
        const cfg   = STATUS_CFG[step]
        const done  = i < currentIdx
        const active= i === currentIdx
        return (
          <div key={step} className="flex items-center">
            <Tag
              icon={done ? 'tick-circle' : cfg.icon}
              intent={active ? cfg.intent : done ? Intent.SUCCESS : Intent.NONE}
              minimal={!active}
            >
              {cfg.label}
            </Tag>
            {i < STATUS_STEPS.length - 1 && (
              <Icon icon="chevron-right" size={12} className="text-muted-foreground/30 mx-0.5" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Contract deviation ───────────────────────────────────────────────────────

function ContractDevBadge({ unitCost, contract }: { unitCost: number; contract?: SupplierContract }) {
  if (!contract) return null
  const pct = ((unitCost - contract.contracted_price) / contract.contracted_price) * 100
  if (Math.abs(pct) < 0.1) return <Tag intent={Intent.SUCCESS} minimal>At contract</Tag>
  const over = pct > 0
  const intent = over
    ? pct > 3 ? Intent.DANGER : Intent.WARNING
    : Intent.SUCCESS
  return (
    <Tag intent={intent} minimal>
      {over ? '+' : ''}{pct.toFixed(1)}% vs contract
    </Tag>
  )
}

// ─── PO Lines table ───────────────────────────────────────────────────────────

function POLinesTable({
  lines,
  contracts,
  currency,
}: {
  lines: POLineRow[]
  contracts: SupplierContract[]
  currency: string
}) {
  if (lines.length === 0) {
    return (
      <Card compact className="text-center text-xs text-muted-foreground">
        No line items on this PO.
      </Card>
    )
  }

  const totalOrdered  = lines.reduce((s, l) => s + l.ordered_qty, 0)
  const totalReceived = lines.reduce((s, l) => s + l.received_qty, 0)
  const totalValue    = lines.reduce((s, l) => s + l.line_total, 0)

  return (
    <Card compact className="!p-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 bg-muted/30 border-b flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Line Items · {lines.length}
        </p>
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>{totalReceived}/{totalOrdered} units received</span>
          <span className="font-semibold text-foreground">{formatCurrency(totalValue, currency)}</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_80px_80px_80px_120px_80px] gap-3 px-4 py-2 bg-muted/10 border-b text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        <span>Product · Variant</span>
        <span className="text-right">Ordered</span>
        <span className="text-right">Received</span>
        <span className="text-right">Unit Cost</span>
        <span className="text-right">Contract</span>
        <span className="text-right">Total</span>
      </div>

      {/* Lines */}
      <div className="divide-y">
        {lines.map((line) => {
          const contract   = contracts.find((c) => c.variant_id === line.variant_id)
          const fullyRecvd = line.received_qty >= line.ordered_qty
          const partial    = line.received_qty > 0 && !fullyRecvd
          return (
            <div key={line.id} className={cn(
              'grid grid-cols-[1fr_80px_80px_80px_120px_80px] gap-3 px-4 py-3 items-center',
              fullyRecvd && 'opacity-60',
            )}>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  <Link to={`/variant/${line.variant_id}`} className="hover:underline">
                    {line.product_name}
                    {line.variant_name && line.variant_name !== 'Standard' && (
                      <span className="text-muted-foreground ml-1">· {line.variant_name}</span>
                    )}
                  </Link>
                </p>
                <p className="text-[10px] text-muted-foreground font-mono">{line.sku}</p>
                {line.notes && <p className="text-[10px] text-muted-foreground italic truncate">{line.notes}</p>}
              </div>

              <span className="text-xs tabular-nums text-right">{line.ordered_qty}</span>

              <span className={cn(
                'text-xs tabular-nums text-right font-medium',
                fullyRecvd ? 'text-emerald-600' : partial ? 'text-amber-600' : 'text-muted-foreground',
              )}>
                {line.received_qty}
                {fullyRecvd && <Icon icon="tick-circle" size={12} className="inline ml-1 text-emerald-500" />}
              </span>

              <span className="text-xs tabular-nums text-right text-muted-foreground">
                {formatCurrency(line.unit_cost, currency)}
              </span>

              <div className="text-right">
                <ContractDevBadge unitCost={line.unit_cost} contract={contract} />
              </div>

              <span className="text-xs tabular-nums text-right font-semibold">
                {formatCurrency(line.line_total, currency)}
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ─── Invoice OCR intake form ──────────────────────────────────────────────────

interface ParsedInvoiceFields {
  invoiceNumber: string | null
  invoiceDate:   string | null
  invoiceAmount: number | null
  notes:         string | null
  confidence:    'high' | 'medium' | 'low'
}

function InvoiceOCRForm({ poId, hotelId }: { poId: string; hotelId: string }) {
  const fileRef    = useRef<HTMLInputElement>(null)
  const userId     = useAuthStore((s) => s.session?.user.id ?? '')
  const [scanning,   setScanning]   = useState(false)
  const [parsed,     setParsed]     = useState<ParsedInvoiceFields | null>(null)
  const [open,       setOpen]       = useState(false)
  const [invNum,     setInvNum]     = useState('')
  const [invDate,    setInvDate]    = useState('')
  const [invAmount,  setInvAmount]  = useState('')
  const [invNotes,   setInvNotes]   = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleFile(file: File) {
    setScanning(true)
    setParsed(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data: { session } } = await supabase.auth.getSession()
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-invoice`
      const res = await fetch(fnUrl, {
        method:  'POST',
        headers: { Authorization: `Bearer ${session?.access_token ?? ''}` },
        body:    fd,
      })
      if (!res.ok) throw new Error(await res.text())
      const fields = await res.json() as ParsedInvoiceFields
      setParsed(fields)
      setInvNum(fields.invoiceNumber ?? '')
      setInvDate(fields.invoiceDate ?? '')
      setInvAmount(fields.invoiceAmount != null ? String(fields.invoiceAmount) : '')
      setInvNotes(fields.notes ?? '')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'OCR failed — check OPENAI_API_KEY')
    } finally {
      setScanning(false)
    }
  }

  async function submitInvoice() {
    const amount = parseFloat(invAmount)
    if (!invNum.trim())             { toast.error('Invoice number required'); return }
    if (!invDate)                   { toast.error('Invoice date required'); return }
    if (isNaN(amount) || amount <= 0) { toast.error('Amount must be > 0'); return }
    setSubmitting(true)
    const result = await dispatchAction(
      { type: 'SUBMIT_PO_INVOICE', poId, hotelId, invoiceNumber: invNum.trim(), invoiceDate: invDate, invoiceAmount: amount, notes: invNotes || null },
      { hotelId, actorId: userId, triggeredBy: 'user' },
    )
    setSubmitting(false)
    if (result.success) { toast.success('Invoice submitted'); setOpen(false); setParsed(null) }
    else toast.error(result.error.message)
  }

  if (!open) return (
    <Button icon="barcode" variant="minimal" size="small" intent={Intent.PRIMARY} onClick={() => { setOpen(true) }}>
      Scan &amp; submit invoice
    </Button>
  )

  return (
    <Card compact className="!border-primary/20 !bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <Icon icon="barcode" size={14} intent={Intent.PRIMARY} />Scan Invoice
        </p>
        <Button variant="minimal" size="small" onClick={() => { setOpen(false) }}>Close</Button>
      </div>
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
      <Button
        icon={scanning ? undefined : 'upload'}
        size="small"
        loading={scanning}
        onClick={() => fileRef.current?.click()}
      >
        {scanning ? 'Parsing…' : 'Upload image or PDF'}
      </Button>
      {parsed && (
        <>
          {parsed.confidence !== 'high' && (
            <Callout intent={Intent.WARNING} icon="warning-sign" compact>
              {parsed.confidence === 'low' ? 'Low confidence — verify all fields' : 'Some fields may be missing'}
            </Callout>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <FormGroup label="Invoice Number *" className="!mb-0">
              <InputGroup type="text" value={invNum} placeholder="INV-001" onChange={(e) => { setInvNum(e.target.value) }} />
            </FormGroup>
            <FormGroup label="Invoice Date *" className="!mb-0">
              <InputGroup type="date" value={invDate} onChange={(e) => { setInvDate(e.target.value) }} />
            </FormGroup>
            <FormGroup label="Amount *" className="!mb-0">
              <InputGroup type="number" value={invAmount} placeholder="0.00" onChange={(e) => { setInvAmount(e.target.value) }} />
            </FormGroup>
            <FormGroup label="Notes" className="!mb-0">
              <InputGroup type="text" value={invNotes} placeholder="Payment terms…" onChange={(e) => { setInvNotes(e.target.value) }} />
            </FormGroup>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="minimal" size="small" onClick={() => { setParsed(null) }}>Re-scan</Button>
            <Button
              icon="tick-circle"
              intent={Intent.PRIMARY}
              size="small"
              loading={submitting}
              onClick={() => { void submitInvoice() }}
            >
              Submit invoice
            </Button>
          </div>
        </>
      )}
    </Card>
  )
}

// ─── Invoices section ─────────────────────────────────────────────────────────

function InvoicesSection({ poId, currency }: { poId: string; currency: string }) {
  const { data: invoices = [], isLoading } = usePOInvoices(poId)

  if (isLoading) return null
  if (invoices.length === 0) return (
    <Card compact className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon icon="document" size={14} />
      No invoices submitted against this PO yet.
    </Card>
  )

  return (
    <Card compact className="!p-0 divide-y">
      <p className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30">
        Invoices · {invoices.length}
      </p>
      {invoices.map((inv) => {
        const varPct = costVariancePct({ total_amount: inv.po_amount }, [{ invoice_amount: inv.invoice_amount }])
        const invIntent: Intent =
          inv.status === 'approved' ? Intent.SUCCESS :
          inv.status === 'disputed' ? Intent.DANGER :
          inv.status === 'matched'  ? Intent.PRIMARY :
          Intent.NONE
        return (
          <div key={inv.id} className="flex items-center gap-4 px-4 py-3">
            <Icon icon="document" size={14} className="text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">{inv.invoice_number}</p>
              <p className="text-[10px] text-muted-foreground">
                {format(parseISO(inv.invoice_date), 'MMM d, yyyy')}
                {inv.notes && ` · ${inv.notes}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-semibold tabular-nums">{formatCurrency(inv.invoice_amount, currency)}</p>
              {varPct !== null && Math.abs(varPct) >= 0.1 && (
                <p className={cn(
                  'text-[10px] tabular-nums font-medium',
                  varPct > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400',
                )}>
                  {varPct > 0 ? '+' : ''}{varPct.toFixed(1)}% vs PO
                </p>
              )}
            </div>
            <Tag intent={invIntent} minimal>{inv.status}</Tag>
          </div>
        )
      })}
    </Card>
  )
}

// ─── Status actions ───────────────────────────────────────────────────────────

function StatusActions({ po }: { po: PurchaseOrder }) {
  const updateStatus = useUpdatePOStatus()
  const navigate     = useNavigate()

  const next: Partial<Record<POStatus, { label: string; status: POStatus }>> = {
    draft:     { label: 'Mark as Sent',      status: 'sent'     },
    sent:      { label: 'Mark as Confirmed', status: 'confirmed'},
    confirmed: { label: 'Mark Confirmed',    status: 'confirmed'},
  }
  const action = next[po.status]

  if (!action && po.status !== 'partially_received' && po.status !== 'closed') return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {action && (
        <Button
          size="small"
          loading={updateStatus.isPending}
          onClick={() => {
            updateStatus.mutate({ poId: po.id, status: action.status }, {
              onSuccess: () => { toast.success(`PO marked as ${STATUS_CFG[action.status].label}`) }
            })
          }}
        >
          {action.label}
        </Button>
      )}
      {(po.status === 'partially_received' || po.status === 'confirmed' || po.status === 'sent') && (
        <Button
          icon="box"
          intent={Intent.PRIMARY}
          size="small"
          onClick={() => { void navigate('/flow?panel=receive') }}
        >
          Go to Receive
        </Button>
      )}
      {po.status !== 'cancelled' && po.status !== 'closed' && (
        <Button
          size="small"
          intent={Intent.DANGER}
          variant="outlined"
          loading={updateStatus.isPending}
          onClick={() => {
            if (!confirm('Cancel this PO? This cannot be undone.')) return
            updateStatus.mutate({ poId: po.id, status: 'cancelled' }, {
              onSuccess: () => { toast.success('PO cancelled') }
            })
          }}
        >
          Cancel PO
        </Button>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function POObjectPage() {
  const { poId = '' } = useParams<{ poId: string }>()
  const navigate  = useNavigate()
  const currency  = useCurrency()
  useActiveHotelId()  // ensures RLS context

  const { data: po,       isLoading: loadingPO    } = useQuery({
    queryKey: ['po', poId],
    queryFn:  () => fetchPOById(poId),
    enabled:  !!poId,
    staleTime: 30 * 1000,
  })
  const { data: lines     = [], isLoading: loadingLines   } = usePOLines(poId)
  const { data: contracts = [], isLoading: loadingContracts } = useSupplierContracts()

  const isLoading = loadingPO || loadingLines || loadingContracts

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner size={SpinnerSize.STANDARD} />
      </div>
    )
  }

  if (!po) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Purchase order not found"
        action={
          <Button variant="minimal" intent={Intent.PRIMARY} onClick={() => { void navigate(-1) }}>
            Go back
          </Button>
        }
      />
    )
  }

  const cfg          = STATUS_CFG[po.status]
  const totalLines   = lines.length
  const rcvdLines    = fulfilledLineCount(lines)
  const pct          = poFulfillmentPct(lines)
  const isOverdue    = poIsOverdue(po)
  const daysUntil    = daysUntilDelivery(po)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b px-6 py-4 shrink-0 bg-background">
        <div className="flex items-start gap-4">
          <Button
            icon="arrow-left"
            variant="minimal"
            size="small"
            onClick={() => { void navigate(-1) }}
          >
            Back
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-blue-100 dark:bg-blue-950/40 shrink-0">
                <Icon icon="truck" size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold leading-none">{po.po_number}</h1>
                  <FavoriteStar item={{ id: `po:${poId}`, label: po.po_number, path: `/po/${poId}`, icon: 'document' }} />
                  <Tag icon={cfg.icon} intent={cfg.intent} minimal>{cfg.label}</Tag>
                  {isOverdue && (
                    <Tag icon="warning-sign" intent={Intent.DANGER} minimal>OVERDUE</Tag>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {po.supplier_id
                    ? <Link to={`/supplier/${po.supplier_id}`} className="flex items-center gap-1 hover:text-foreground hover:underline">
                        <Icon icon="truck" size={12} />{po.supplier_name}
                      </Link>
                    : <span className="flex items-center gap-1"><Icon icon="truck" size={12} />{po.supplier_name}</span>
                  }
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Icon icon="time" size={12} />
                    <EtaLabel dateStr={po.expected_delivery_date} />
                  </span>
                  <span>·</span>
                  <span>{formatDistanceToNow(parseISO(po.created_at), { addSuffix: true })}</span>
                </div>
              </div>
            </div>

            {/* Status timeline */}
            <div className="mt-3 overflow-x-auto">
              <StatusTimeline po={po} />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-5xl">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Total Value"
            value={formatCurrency(po.total_amount, currency)}
          />
          <StatCard
            label="Line Items"
            value={`${rcvdLines}/${totalLines}`}
            sub={`${pct}% received`}
            color={pct === 100 ? 'text-emerald-600' : pct > 0 ? 'text-amber-600' : undefined}
          />
          <StatCard
            label="Delivery"
            value={po.expected_delivery_date ? format(parseISO(po.expected_delivery_date), 'MMM d') : '—'}
            sub={isOverdue ? 'Overdue' : daysUntil !== null ? `${daysUntil}d away` : undefined}
            color={isOverdue ? 'text-red-600' : undefined}
          />
          <StatCard
            label="Status"
            value={cfg.label}
            color={po.status === 'closed' ? 'text-emerald-600' : po.status === 'cancelled' ? 'text-muted-foreground' : undefined}
          />
        </div>

        {/* Delivery progress bar */}
        {totalLines > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Receiving progress</span>
              <span className="font-semibold tabular-nums">{pct}%</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-400' : 'bg-muted-foreground/20')}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Status actions */}
        <StatusActions po={po} />

        {/* PO notes */}
        {po.notes && (
          <Card compact className="!bg-muted/20">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
            <p className="text-xs text-foreground leading-relaxed">{po.notes}</p>
          </Card>
        )}

        {/* Lines table */}
        <div>
          <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Line Items</h2>
          <POLinesTable lines={lines as POLineRow[]} contracts={contracts} currency={currency} />
        </div>

        {/* Invoices */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Invoices</h2>
            {po.status !== 'cancelled' && po.status !== 'draft' && (
              <InvoiceOCRForm poId={po.id} hotelId={po.hotel_id} />
            )}
          </div>
          <InvoicesSection poId={po.id} currency={currency} />
        </div>

        {/* Metadata footer */}
        <div className="pt-2 border-t text-[10px] text-muted-foreground space-y-0.5">
          <p>Created {format(parseISO(po.created_at), 'MMM d, yyyy HH:mm')}</p>
          {po.sent_at && <p>Sent to supplier {format(parseISO(po.sent_at), 'MMM d, yyyy HH:mm')}</p>}
          {po.confirmed_at && <p>Confirmed {format(parseISO(po.confirmed_at), 'MMM d, yyyy HH:mm')}</p>}
          {po.closed_at && <p>Closed {format(parseISO(po.closed_at), 'MMM d, yyyy HH:mm')}</p>}
        </div>

        {/* ── Inline actions ── */}
        <Card>
          <ObjectActions
            nodeType="purchase_order"
            poId={po.id}
            currentStatus={po.status}
          />
        </Card>

        {/* ── Agent decisions across this order's lines ── */}
        <ObjectAgentActivity
          variantIds={lines.map((l) => l.variant_id)}
          hotelId={po.hotel_id}
          title="Agent decisions · order's items"
          emptyHint="No agent decisions on this order's items yet. Restock and discrepancy proposals for its line items surface here."
        />

        {/* ── Graph connections ── */}
        <Card>
          <GraphConnections nodeType="purchase_order" nodeId={po.id} />
        </Card>
      </div>
    </div>
  )
}
