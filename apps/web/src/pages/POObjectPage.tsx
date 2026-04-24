// Layer: Cross-domain — Purchase Order Object Page
// Palantir-pattern: every named entity is navigable to its full object context.
// Combines Mind (PO header, status, supplier), Flow (delivery progress, lines),
// Eye (discrepancy analysis, cost variance).
// Route: /po/:poId

import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { usePOLines, usePOInvoices, useUpdatePOStatus, useSupplierContracts } from '@/features/mind/hooks'
import { poFulfillmentPct, fulfilledLineCount, costVariancePct, isOverdue as poIsOverdue, daysUntilDelivery } from '@beacon/reality-graph'
import { GraphConnections } from '@/components/GraphConnections'
import { ObjectActions } from '@/components/ObjectActions'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { format, isPast, isToday, formatDistanceToNow, parseISO } from 'date-fns'
import {
  ArrowLeft, Truck, Package, CheckCircle2, AlertTriangle, Clock,
  FileText, ChevronRight, Loader2, ScanLine, Upload,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { dispatchAction } from '@/lib/actions/dispatch'
import { useAuthStore } from '@/stores/auth.store'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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

const STATUS_CFG: Record<POStatus, { label: string; cls: string; dot: string }> = {
  draft:               { label: 'Draft',            cls: 'bg-muted text-muted-foreground border-border',            dot: 'bg-slate-400' },
  sent:                { label: 'Sent to Supplier',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/40', dot: 'bg-blue-500' },
  confirmed:           { label: 'Confirmed',         cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/40', dot: 'bg-blue-500' },
  partially_received:  { label: 'Partially Received',cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/40', dot: 'bg-amber-500' },
  closed:              { label: 'Closed',            cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40', dot: 'bg-emerald-500' },
  cancelled:           { label: 'Cancelled',         cls: 'bg-muted text-muted-foreground border-border line-through',dot: 'bg-slate-400' },
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
    <div className="rounded-lg border bg-card px-4 py-3 space-y-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={cn('text-2xl font-bold tabular-nums leading-none', color ?? 'text-foreground')}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
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
    <div className="flex items-center gap-0">
      {STATUS_STEPS.map((step, i) => {
        const cfg   = STATUS_CFG[step]
        const done  = i < currentIdx
        const active= i === currentIdx
        return (
          <div key={step} className="flex items-center">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium border',
              active ? cfg.cls : done ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40' : 'bg-muted/30 text-muted-foreground/50 border-border/30',
            )}>
              {done
                ? <CheckCircle2 className="h-3 w-3" />
                : <span className={cn('h-2 w-2 rounded-full', active ? cfg.dot : 'bg-muted-foreground/30')} />
              }
              {active || done ? cfg.label : STATUS_CFG[step].label}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/30 mx-0.5" />
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
  if (Math.abs(pct) < 0.1) return <span className="text-[9px] text-emerald-600 font-medium">At contract</span>
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
      <div className="rounded-lg border px-4 py-8 text-center text-xs text-muted-foreground">
        No line items on this PO.
      </div>
    )
  }

  const totalOrdered  = lines.reduce((s, l) => s + l.ordered_qty, 0)
  const totalReceived = lines.reduce((s, l) => s + l.received_qty, 0)
  const totalValue    = lines.reduce((s, l) => s + l.line_total, 0)

  return (
    <div className="rounded-lg border overflow-hidden">
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
      <div className="grid grid-cols-[1fr_80px_80px_80px_100px_80px] gap-3 px-4 py-2 bg-muted/10 border-b text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
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
              'grid grid-cols-[1fr_80px_80px_80px_100px_80px] gap-3 px-4 py-3 items-center',
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
                {fullyRecvd && <CheckCircle2 className="inline h-3 w-3 ml-1 text-emerald-500" />}
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
    </div>
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
    else toast.error(result.error)
  }

  if (!open) return (
    <button type="button" onClick={() => { setOpen(true); }}
      className="flex items-center gap-1.5 text-xs text-primary hover:underline">
      <ScanLine className="h-3.5 w-3.5" /> Scan &amp; submit invoice
    </button>
  )

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <ScanLine className="h-3.5 w-3.5 text-primary" />Scan Invoice
        </p>
        <button type="button" onClick={() => { setOpen(false); }} className="text-[10px] text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f) }} />
      <button type="button" disabled={scanning} onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-border bg-background hover:bg-muted/40 transition-colors disabled:opacity-50">
        {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {scanning ? 'Parsing…' : 'Upload image or PDF'}
      </button>
      {parsed && (
        <>
          {parsed.confidence !== 'high' && (
            <p className="text-[10px] text-amber-500 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {parsed.confidence === 'low' ? 'Low confidence — verify all fields' : 'Some fields may be missing'}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {([
              { label: 'Invoice Number *', val: invNum,    set: setInvNum,    type: 'text',   ph: 'INV-001' },
              { label: 'Invoice Date *',   val: invDate,   set: setInvDate,   type: 'date',   ph: '' },
              { label: 'Amount *',         val: invAmount, set: setInvAmount, type: 'number', ph: '0.00' },
              { label: 'Notes',            val: invNotes,  set: setInvNotes,  type: 'text',   ph: 'Payment terms…' },
            ] as const).map(({ label, val, set, type, ph }) => (
              <div key={label}>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
                <input type={type} value={val} placeholder={ph}
                  onChange={(e) => { set(e.target.value); }}
                  className="w-full rounded border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setParsed(null); }} className="text-xs text-muted-foreground hover:text-foreground">Re-scan</button>
            <button type="button" disabled={submitting} onClick={() => { void submitInvoice() }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              Submit invoice
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Invoices section ─────────────────────────────────────────────────────────

function InvoicesSection({ poId, currency }: { poId: string; currency: string }) {
  const { data: invoices = [], isLoading } = usePOInvoices(poId)

  if (isLoading) return null
  if (invoices.length === 0) return (
    <div className="rounded-lg border px-4 py-4 text-xs text-muted-foreground flex items-center gap-2">
      <FileText className="h-4 w-4" />
      No invoices submitted against this PO yet.
    </div>
  )

  return (
    <div className="rounded-lg border divide-y">
      <p className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/30">
        Invoices · {invoices.length}
      </p>
      {invoices.map((inv) => {
        const varPct = costVariancePct({ total_amount: inv.po_amount }, [{ invoice_amount: inv.invoice_amount }])
        return (
          <div key={inv.id} className="flex items-center gap-4 px-4 py-3">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
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
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0',
              inv.status === 'approved' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40' :
              inv.status === 'disputed' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-900/40' :
              inv.status === 'matched'  ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/40' :
              'bg-muted text-muted-foreground border-border',
            )}>
              {inv.status}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Status actions ───────────────────────────────────────────────────────────

function StatusActions({ po }: { po: PurchaseOrder }) {
  const updateStatus = useUpdatePOStatus()
  const navigate     = useNavigate()

  const next: Partial<Record<POStatus, { label: string; status: POStatus; variant?: 'default' | 'destructive' | 'outline' }>> = {
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
          size="sm"
          variant="outline"
          disabled={updateStatus.isPending}
          className="h-8 text-xs"
          onClick={() => {
            updateStatus.mutate({ poId: po.id, status: action.status }, {
              onSuccess: () => { toast.success(`PO marked as ${STATUS_CFG[action.status].label}`) }
            })
          }}
        >
          {updateStatus.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          {action.label}
        </Button>
      )}
      {(po.status === 'partially_received' || po.status === 'confirmed' || po.status === 'sent') && (
        <Button
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => { void navigate('/flow?panel=receive') }}
        >
          <Package className="h-3.5 w-3.5" />
          Go to Receive
        </Button>
      )}
      {po.status !== 'cancelled' && po.status !== 'closed' && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400"
          disabled={updateStatus.isPending}
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
  const { poId } = useParams<{ poId: string }>()
  const navigate  = useNavigate()
  const currency  = useCurrency()
  useActiveHotelId()  // ensures RLS context

  const { data: po,       isLoading: loadingPO    } = useQuery({
    queryKey: ['po', poId],
    queryFn:  () => fetchPOById(poId!),
    enabled:  !!poId,
    staleTime: 30 * 1000,
  })
  const { data: lines     = [], isLoading: loadingLines   } = usePOLines(poId ?? null)
  const { data: contracts = [], isLoading: loadingContracts } = useSupplierContracts()

  const isLoading = loadingPO || loadingLines || loadingContracts

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
        <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Purchase order not found.</p>
        <Button variant="outline" size="sm" onClick={() => { void navigate(-1) }}>Go back</Button>
      </div>
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
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/40 shrink-0">
                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold leading-none">{po.po_number}</h1>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border', cfg.cls)}>
                    <span className={cn('inline-block h-1.5 w-1.5 rounded-full mr-1', cfg.dot)} />
                    {cfg.label}
                  </span>
                  {isOverdue && (
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" />OVERDUE
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {po.supplier_id
                    ? <Link to={`/supplier/${po.supplier_id}`} className="flex items-center gap-1 hover:text-foreground hover:underline">
                        <Truck className="h-3 w-3" />{po.supplier_name}
                      </Link>
                    : <span className="flex items-center gap-1"><Truck className="h-3 w-3" />{po.supplier_name}</span>
                  }
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
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
          <div className="rounded-lg border bg-muted/20 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
            <p className="text-xs text-foreground leading-relaxed">{po.notes}</p>
          </div>
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
        <div className="rounded-lg border border-border bg-card p-4">
          <ObjectActions
            nodeType="purchase_order"
            poId={po.id}
            currentStatus={po.status}
          />
        </div>

        {/* ── Graph connections ── */}
        <div className="rounded-lg border border-border bg-card p-4">
          <GraphConnections nodeType="purchase_order" nodeId={po.id} />
        </div>
      </div>
    </div>
  )
}
