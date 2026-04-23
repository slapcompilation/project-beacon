// Layer: Mind — Unified Procurement workspace
// Merges Suppliers + Leverage Engine + Purchase Orders into a single entity surface.
// Palantir principle: ontology navigation, not menu navigation. One supplier node
// shows all connected context: performance, open orders, leverage, delivery history.

import { useMemo, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, Loader2, Search, Mail, Phone,
  ShoppingCart, Truck, ChevronDown,
  Copy, Check, Handshake, Package, PackageCheck,
  AlertTriangle, SlidersHorizontal, TrendingDown, Activity,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { scoreToGrade, GRADE_STYLES, GRADE_ICONS } from '@/lib/grades'
import { useCurrency } from '@/hooks/useCurrency'
import { useDateFormat } from '@/features/user/hooks'
import { useActiveHotel } from '@/features/hotel/hooks'
import {
  useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  useSupplierScorecard, useSupplierLeverage, useSupplierPriceHistory,
  useLogDelivery,
} from '@/features/suppliers/hooks'
import { useProcurementProposals, useCreateBulkRestockRequests, useForecast } from '@/features/inventory/hooks'
import { useRestockRequests } from '@/features/restock/hooks'
import { useProducts } from '@/features/inventory/hooks'
import type { Supplier, SupplierScorecard, DeliveryEventInput } from '@beacon/types'
import type { SupplierLeverageRow, SupplierPriceHistoryRow } from '@beacon/types'
import { PurchaseOrderContent } from '@/pages/PurchaseOrderPage'
import SavedOrdersPage from '@/pages/SavedOrdersPage'
import { POMatchContent } from '@/pages/POMatchPage'
import PODispatchPage from '@/pages/PODispatchPage'
import { usePODiscrepancies, usePOSummary } from '@/features/mind/hooks'

// ─── Score helpers ─────────────────────────────────────────────────────────────

function computeScore(sc: SupplierScorecard): number | null {
  if (sc.total_deliveries === 0) return null
  const onTime = (sc.on_time_rate  ?? 50) * 0.4
  const fill   = (sc.avg_fill_rate ?? 80) * 0.4
  const drift  = sc.avg_price_drift_pct ?? 0
  const price  = 20 - Math.min(Math.max(drift * 2, 0), 20)
  return Math.round(onTime + fill + price)
}

function ScorePill({ score }: { score: number | null }) {
  const grade = scoreToGrade(score)
  const Icon  = GRADE_ICONS[grade]
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs font-bold h-5 px-1.5', GRADE_STYLES[grade])}>
      <Icon className="h-3 w-3" />
      {grade === '—' ? 'No data' : `${String(score)} · ${grade}`}
    </Badge>
  )
}

// ─── Supplier form ─────────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name:           z.string().min(1, 'Name is required'),
  contact_name:   z.string().optional(),
  email:          z.string().email('Invalid email').optional().or(z.literal('')),
  phone:          z.string().optional(),
  notes:          z.string().optional(),
  lead_time_days: z.number().int().positive().optional().nullable(),
})
type SupplierFields = z.infer<typeof supplierSchema>

function SupplierFormDialog({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const create = useCreateSupplier()
  const update = useUpdateSupplier()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SupplierFields>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name:           supplier?.name ?? '',
      contact_name:   supplier?.contact_name ?? '',
      email:          supplier?.email ?? '',
      phone:          supplier?.phone ?? '',
      notes:          supplier?.notes ?? '',
      lead_time_days: supplier?.lead_time_days ?? null,
    },
  })
  const onSubmit = async (data: SupplierFields) => {
    const input = {
      name: data.name,
      contact_name: data.contact_name || null,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
      lead_time_days: data.lead_time_days ?? null,
    }
    if (supplier) await update.mutateAsync({ id: supplier.id, input })
    else await create.mutateAsync(input)
    onClose()
  }
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Company Name</Label>
            <Input {...register('name')} autoFocus />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Contact Name</Label>
              <Input placeholder="Optional" {...register('contact_name')} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input placeholder="Optional" {...register('phone')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" placeholder="Optional" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Lead Time (days)</Label>
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 5"
              {...register('lead_time_days', { valueAsNumber: true, setValueAs: (v: string) => v === '' ? null : parseInt(v, 10) })}
            />
            <p className="text-xs text-muted-foreground">
              Average days from order to delivery. Used for gap analysis in inventory rows.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={2} placeholder="Payment terms, delivery conditions…" {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {supplier ? 'Save' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Log Delivery form ────────────────────────────────────────────────────────

const deliverySchema = z.object({
  ordered_qty:        z.number().positive(),
  received_qty:       z.number().min(0),
  expected_date:      z.string().min(1),
  actual_date:        z.string().optional(),
  unit_cost_expected: z.number().optional(),
  unit_cost_actual:   z.number().optional(),
  notes:              z.string().optional(),
})
type DeliveryFields = z.infer<typeof deliverySchema>

function LogDeliveryDialog({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const logDelivery = useLogDelivery()
  const { data: requests = [] } = useRestockRequests()
  const openReqs = useMemo(
    () => requests.filter((r) => r.supplier === supplier.name && r.status !== 'fulfilled' && r.status !== 'cancelled'),
    [requests, supplier.name],
  )
  const [linkedId, setLinkedId] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DeliveryFields>({
    resolver: zodResolver(deliverySchema),
    defaultValues: { expected_date: format(new Date(), 'yyyy-MM-dd'), actual_date: format(new Date(), 'yyyy-MM-dd') },
  })
  const onSubmit = async (data: DeliveryFields) => {
    const input: DeliveryEventInput = {
      supplier_id: supplier.id, restock_request_id: linkedId || null,
      ordered_qty: data.ordered_qty, received_qty: data.received_qty,
      expected_date: data.expected_date, actual_date: data.actual_date || null,
      unit_cost_expected: data.unit_cost_expected ?? null, unit_cost_actual: data.unit_cost_actual ?? null,
      notes: data.notes || null,
    }
    await logDelivery.mutateAsync(input)
    onClose()
  }
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Log Delivery — {supplier.name}</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-3 py-1">
          {openReqs.length > 0 && (
            <div className="space-y-1.5">
              <Label>Link to restock request (optional)</Label>
              <select value={linkedId} onChange={(e) => { setLinkedId(e.target.value) }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                <option value="">— None —</option>
                {openReqs.map((r) => {
                  const row = r as typeof r & { product_variants?: { name: string; products?: { name: string } } }
                  const n = row.product_variants?.products?.name ?? 'Unknown'
                  const v = row.product_variants?.name
                  return <option key={r.id} value={r.id}>{v && v !== 'Standard' ? `${n} — ${v}` : n} ×{r.quantity_needed}</option>
                })}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Qty Ordered</Label>
              <Input type="number" min={1} {...register('ordered_qty', { valueAsNumber: true })} />
              {errors.ordered_qty && <p className="text-xs text-destructive">Required</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Qty Received</Label>
              <Input type="number" min={0} {...register('received_qty', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Expected Date</Label>
              <Input type="date" {...register('expected_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>Actual Date</Label>
              <Input type="date" {...register('actual_date')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unit Cost Expected</Label>
              <Input type="number" step="0.01" min={0} placeholder="Optional" {...register('unit_cost_expected', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Unit Cost Actual</Label>
              <Input type="number" step="0.01" min={0} placeholder="Optional" {...register('unit_cost_actual', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input placeholder="Optional" {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Delivery
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Brief generator ──────────────────────────────────────────────────────────

function buildBrief(s: SupplierLeverageRow, currency: string, todayFormatted: string): string {
  const drift  = s.avg_price_drift_pct ?? 0
  const onTime = s.on_time_rate ?? 100
  const fill   = s.avg_fill_rate ?? 100
  const late   = s.avg_days_late ?? 0
  const overAmt = Math.max(0, (drift / 100) * s.total_spend)
  const lateN   = Math.round(s.completed_deliveries * (1 - onTime / 100))
  const underN  = Math.round(s.completed_deliveries * (1 - fill / 100))

  const lines: string[] = [
    `NEGOTIATION BRIEF — ${s.supplier_name.toUpperCase()}`,
    `Generated ${todayFormatted}`,
    '',
    `${s.total_deliveries} deliveries · ${s.completed_deliveries} completed · Total spend: ${formatCurrency(s.total_spend, currency)}`,
    '',
  ]
  const issues = drift > 2 || onTime < 85 || fill < 90 || late > 1
  if (issues) {
    lines.push('PERFORMANCE ISSUES')
    if (drift > 2)   lines.push(`• Price drift: +${drift.toFixed(1)}% above baseline — est. overcharge ${formatCurrency(overAmt, currency)}`)
    if (onTime < 85) lines.push(`• On-time: ${onTime.toFixed(0)}% — ${lateN} late deliveries, avg ${late.toFixed(1)}d late`)
    if (fill < 90)   lines.push(`• Fill rate: ${fill.toFixed(0)}% — under-delivered on ${underN} occasions`)
    lines.push('')
    lines.push('TALKING POINTS')
    let n = 1
    if (drift > 2)   { lines.push(`${n}. "Invoice prices are ${drift.toFixed(1)}% above our baseline. We need a return to contracted rates."`); n++ }
    if (onTime < 85) { lines.push(`${n}. "Late deliveries force excess safety stock. We expect ≥95% on-time performance."`); n++ }
    if (fill < 90)   { lines.push(`${n}. "Consistent under-delivery (${fill.toFixed(0)}%) disrupts operations. We expect ≥95% fill rate."`); n++ }
    lines.push(`${n}. "Our spend of ${formatCurrency(s.total_spend, currency)} represents a meaningful partnership. We expect this reflected in service."`)
  } else {
    lines.push(s.recommended_action === 'Preferred Supplier'
      ? 'PERFORMANCE — EXCELLENT\nThis supplier is performing above standard. Consider preferred vendor status.'
      : 'PERFORMANCE — ADEQUATE\nNo material issues. Continue monitoring.')
  }
  lines.push('')
  lines.push(`RECOMMENDATION: ${s.recommended_action.toUpperCase()}`)
  lines.push(`Leverage Score: ${s.leverage_score}/100  ·  Reliability: ${s.reliability_score}/100`)
  return lines.join('\n')
}

// ─── Price drift chart ────────────────────────────────────────────────────────

function PriceDriftBar({ history }: { history: SupplierPriceHistoryRow[] }) {
  const rows = history.filter((h) => h.price_drift_pct !== null)
  if (rows.length < 2) return <p className="text-xs text-muted-foreground italic">Not enough price data</p>
  const maxAbs = Math.max(...rows.map((h) => Math.abs(h.price_drift_pct ?? 0)), 1)
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Price drift — {rows.length} deliveries
      </p>
      <div className="flex items-end gap-0.5 h-12">
        {rows.map((h) => {
          const pct = h.price_drift_pct ?? 0
          const heightPct = Math.max((Math.abs(pct) / maxAbs) * 100, 6)
          return (
            <div
              key={h.delivery_id}
              title={`${h.delivery_date}: ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
              className={cn('flex-1 min-w-[6px] rounded-sm cursor-help hover:opacity-70', pct > 0 ? 'bg-red-400' : pct < 0 ? 'bg-green-400' : 'bg-slate-300')}
              style={{ height: `${heightPct}%` }}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>{rows[0]?.delivery_date}</span>
        <span className="text-center">red=overcharged · green=discount</span>
        <span>{rows.at(-1)?.delivery_date}</span>
      </div>
    </div>
  )
}

// ─── Leverage verdict ─────────────────────────────────────────────────────────

const PERF_TARGETS = { onTime: 92, fillRate: 90, priceDrift: 2 } as const

type LeverageTier = 'STRONG' | 'MODERATE' | 'WEAK' | 'NONE'

const VERDICT_STYLES: Record<LeverageTier, { banner: string; label: string; dot: string }> = {
  STRONG:   { banner: 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800',     label: 'text-red-700 dark:text-red-400',    dot: 'bg-red-500' },
  MODERATE: { banner: 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800', label: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-400' },
  WEAK:     { banner: 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800', label: 'text-blue-700 dark:text-blue-400',   dot: 'bg-blue-400' },
  NONE:     { banner: 'bg-muted/40 border-border',                                            label: 'text-muted-foreground',              dot: 'bg-muted-foreground/50' },
}

const RELATIONSHIP_LABEL: Record<SupplierLeverageRow['recommended_action'], { label: string; cls: string }> = {
  'Preferred Supplier': { label: 'Partner',  cls: 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400' },
  'Monitor':            { label: 'Stable',   cls: 'border-border bg-muted text-muted-foreground' },
  'Renegotiate':        { label: 'At Risk',  cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-400' },
  'Find Alternative':   { label: 'Replace',  cls: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400' },
}

function getLeverageVerdict(lev: SupplierLeverageRow): { tier: LeverageTier; reason: string; action: string } {
  const onTime = lev.on_time_rate ?? 100
  const fill   = lev.avg_fill_rate ?? 100
  const drift  = lev.avg_price_drift_pct ?? 0
  const score  = lev.leverage_score

  const gaps: string[] = []
  if (fill   < PERF_TARGETS.fillRate)  gaps.push('below-target fill rate')
  if (onTime < PERF_TARGETS.onTime)    gaps.push('delivery delays')
  if (drift  > PERF_TARGETS.priceDrift) gaps.push('price overcharges')

  if (score >= 60) {
    const parts = lev.total_spend > 0 ? ['significant spend volume', ...gaps.slice(0, 1)] : gaps.slice(0, 2)
    return {
      tier: 'STRONG',
      reason: parts.length > 0 ? parts.join(' + ') : 'high leverage score',
      action: lev.recommended_action === 'Find Alternative'
        ? 'Trigger competitive tender or switch supplier'
        : 'Renegotiate pricing and service terms',
    }
  }
  if (score >= 35) return {
    tier: 'MODERATE',
    reason: gaps.length > 0 ? gaps.slice(0, 2).join(' + ') : 'performance gaps documented',
    action: 'Schedule formal review — performance below target',
  }
  if (score >= 15) return {
    tier: 'WEAK',
    reason: gaps[0] ?? 'minor performance variance',
    action: 'Monitor and document for future negotiations',
  }
  return {
    tier: 'NONE',
    reason: 'supplier performing to standard',
    action: 'Maintain relationship — no active leverage needed',
  }
}

// ─── Scorecard tab ────────────────────────────────────────────────────────────

function ScorecardTab({ supplierId, currency }: { supplierId: string; currency: string }) {
  const fmtDate = useDateFormat()
  const [briefExpanded, setBriefExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const { data: leverageRows = [], isLoading: levLoading } = useSupplierLeverage(90)
  const leverage = leverageRows.find((r) => r.supplier_id === supplierId) ?? null
  const { data: history = [], isLoading: histLoading } = useSupplierPriceHistory(supplierId, 90)

  const brief = useMemo(
    () => leverage ? buildBrief(leverage, currency, fmtDate(new Date())) : null,
    [leverage, currency, fmtDate],
  )

  const handleCopy = useCallback(async () => {
    if (!brief) return
    await navigator.clipboard.writeText(brief)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2500)
  }, [brief])

  if (levLoading) return (
    <div className="flex items-center justify-center h-40"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  )

  if (!leverage) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Handshake className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm font-medium">No delivery data yet</p>
      <p className="text-xs text-muted-foreground max-w-xs">Log deliveries to start building leverage intelligence.</p>
    </div>
  )

  const verdict  = getLeverageVerdict(leverage)
  const vs       = VERDICT_STYLES[verdict.tier]
  const onTime   = leverage.on_time_rate ?? 0
  const fill     = leverage.avg_fill_rate ?? 0
  const drift    = leverage.avg_price_drift_pct ?? 0
  const overAmt  = Math.max(0, (drift / 100) * leverage.total_spend)
  const fillGap  = fill - PERF_TARGETS.fillRate     // positive = above target = good
  const onTimeGap = onTime - PERF_TARGETS.onTime

  // Score component breakdown (matches computeScore formula)
  const onTimePts = Math.round((leverage.on_time_rate ?? 50) * 0.4)
  const fillPts   = Math.round((leverage.avg_fill_rate ?? 80) * 0.4)
  const pricePts  = Math.round(20 - Math.min(Math.max(drift * 2, 0), 20))

  return (
    <div className="space-y-4">

      {/* ① Brief CTA — top, collapsed by default */}
      {brief && (
        <div className="rounded-lg border overflow-hidden">
          <button
            type="button"
            onClick={() => { setBriefExpanded((v) => !v) }}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Handshake className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold">Your brief is ready</span>
              <span className="text-xs text-muted-foreground">· copy &amp; send</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm" variant="outline"
                className="h-6 text-xs gap-1.5 px-2"
                onClick={(e) => { e.stopPropagation(); void handleCopy() }}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', briefExpanded && 'rotate-180')} />
            </div>
          </button>
          {briefExpanded && (
            <pre className="whitespace-pre-wrap text-xs leading-relaxed font-mono bg-muted/20 border-t px-4 py-3 text-foreground/80 max-h-64 overflow-y-auto">
              {brief}
            </pre>
          )}
        </div>
      )}

      {/* ② Leverage verdict banner */}
      <div className={cn('rounded-lg border px-4 py-3', vs.banner)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-block h-2 w-2 rounded-full flex-shrink-0', vs.dot)} />
          <span className={cn('text-sm font-bold tracking-wide', vs.label)}>
            {verdict.tier === 'NONE' ? 'NO ACTIVE LEVERAGE' : `${verdict.tier} LEVERAGE`}
          </span>
          <span className="text-xs text-muted-foreground">· {verdict.reason}</span>
        </div>
        <p className={cn('text-xs mt-0.5 pl-4', vs.label)}>→ {verdict.action}</p>
      </div>

      {/* ③ Three lever input cards */}
      <div className="grid grid-cols-3 gap-2">
        {/* Spend Weight */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Spend Weight</p>
          <p className="text-base font-bold tabular-nums">{formatCurrency(leverage.total_spend, currency)}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">your volume = your bargaining chip</p>
        </div>
        {/* Performance Deficit */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance Deficit</p>
          {(fillGap < 0 || onTimeGap < 0) ? (
            <div className="space-y-0.5">
              {fillGap < 0 && (
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
                  Fill {fillGap.toFixed(0)}pp vs {PERF_TARGETS.fillRate}% target
                </p>
              )}
              {onTimeGap < 0 && (
                <p className="text-xs font-semibold text-red-600 dark:text-red-400 tabular-nums">
                  On-time {onTimeGap.toFixed(0)}pp vs {PERF_TARGETS.onTime}% target
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">Both on target ✓</p>
          )}
          <p className="text-[10px] text-muted-foreground leading-tight">fill rate + on-time vs baseline</p>
        </div>
        {/* Price Drift */}
        <div className="rounded-lg border bg-card p-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Price Drift</p>
          <p className={cn(
            'text-base font-bold tabular-nums',
            drift > PERF_TARGETS.priceDrift ? 'text-red-600 dark:text-red-400' :
            drift < 0 ? 'text-green-600 dark:text-green-400' : 'text-foreground',
          )}>
            {drift >= 0 ? '+' : ''}{drift.toFixed(1)}%
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {drift > PERF_TARGETS.priceDrift
              ? `est. overcharge ${formatCurrency(overAmt, currency)}`
              : drift < 0 ? 'below baseline — discount' : 'within target ≤2%'}
          </p>
        </div>
      </div>

      {/* ④ Metrics with contextual benchmarks */}
      <div className="rounded-lg border overflow-hidden">
        <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between gap-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance vs Target</p>
          <p className="text-[10px] text-muted-foreground font-mono shrink-0">
            score = on-time({onTimePts}) + fill({fillPts}) + price({pricePts}) = {leverage.leverage_score}
          </p>
        </div>
        <div className="divide-y">
          {([
            {
              label: 'On-time delivery',
              actual: onTime,
              actualFmt: `${onTime.toFixed(0)}%`,
              target: `target ${PERF_TARGETS.onTime}%`,
              gap: onTimeGap,
              gapFmt: `${onTimeGap >= 0 ? '+' : ''}${onTimeGap.toFixed(0)}pp`,
              good: onTimeGap >= 0,
            },
            {
              label: 'Fill rate',
              actual: fill,
              actualFmt: `${fill.toFixed(0)}%`,
              target: `target ${PERF_TARGETS.fillRate}%`,
              gap: fillGap,
              gapFmt: `${fillGap >= 0 ? '+' : ''}${fillGap.toFixed(0)}pp`,
              good: fillGap >= 0,
            },
            {
              label: 'Price drift',
              actual: drift,
              actualFmt: `${drift >= 0 ? '+' : ''}${drift.toFixed(1)}%`,
              target: `target ≤${PERF_TARGETS.priceDrift}%`,
              gap: PERF_TARGETS.priceDrift - drift,  // positive = on track
              gapFmt: drift > PERF_TARGETS.priceDrift ? `+${(drift - PERF_TARGETS.priceDrift).toFixed(1)}pp overcharge` : 'on track',
              good: drift <= PERF_TARGETS.priceDrift,
            },
          ] as const).map(({ label, actualFmt, target, gap, gapFmt, good }) => (
            <div key={label} className="flex items-center gap-3 px-3 py-2.5 text-xs">
              <span className="flex-1 font-medium">{label}</span>
              <span className={cn('tabular-nums font-bold w-14 text-right', good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {actualFmt}
              </span>
              <span className="text-muted-foreground w-24 text-right tabular-nums">{target}</span>
              <span className={cn(
                'w-36 text-right font-semibold tabular-nums',
                good ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              )}>
                {gapFmt}{!good && gap < -2 ? ' → leverage point' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ⑤ Price drift chart */}
      {!histLoading && <PriceDriftBar history={history} />}
    </div>
  )
}

// ─── Orders tab ───────────────────────────────────────────────────────────────

function OrdersTab({ supplierId, supplierName, supplierEmail, currency, hotelName }: {
  supplierId: string
  supplierName: string
  supplierEmail: string | null
  currency: string
  hotelName: string
}) {
  const fmtDate = useDateFormat()
  const navigate = useNavigate()
  const { data: proposals = [], isLoading } = useProcurementProposals()
  const createBulk = useCreateBulkRestockRequests()
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({})
  const [copied, setCopied] = useState(false)

  // Filter proposals for this supplier
  const items = useMemo(() =>
    proposals.filter((r) => r.preferred_supplier_id === supplierId),
    [proposals, supplierId],
  )

  const totalCost = items.reduce((s, r) => {
    const qty = qtyOverrides[r.variant_id] ?? r.suggested_qty ?? 1
    return s + qty * r.unit_cost
  }, 0)

  const buildPOLines = () => items.map((r) => {
    const qty = qtyOverrides[r.variant_id] ?? r.suggested_qty ?? 1
    const lineTotal = qty * r.unit_cost
    const name = r.variant_name !== 'Standard' ? `${r.product_name} (${r.variant_name})` : r.product_name
    return `${r.sku.padEnd(12)}| ${name.substring(0, 22).padEnd(22)} | ${String(qty).padStart(4)} | ${formatCurrency(r.unit_cost, currency).padStart(9)} | ${formatCurrency(lineTotal, currency)}`
  }).join('\n')

  const handleCopy = useCallback(async () => {
    const today = fmtDate(new Date())
    const header = `PURCHASE ORDER\nDate: ${today}\nHotel: ${hotelName}\nSupplier: ${supplierName}\n\n${'─'.repeat(60)}\nSKU         | Product                | Qty  | Unit Cost | Total\n${'─'.repeat(60)}\n`
    const footer = `\n${'─'.repeat(60)}\nTOTAL: ${formatCurrency(totalCost, currency)}\n`
    await navigator.clipboard.writeText(header + buildPOLines() + footer)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2500)
  }, [items, qtyOverrides, supplierName, hotelName, currency, totalCost, fmtDate])

  const handleMailto = useCallback(() => {
    if (!supplierEmail) return
    const today = fmtDate(new Date())
    const subject = encodeURIComponent(`Purchase Order — ${hotelName} — ${today}`)
    const header = `PURCHASE ORDER\nDate: ${today}\nHotel: ${hotelName}\nSupplier: ${supplierName}\n\n${'─'.repeat(60)}\nSKU         | Product                | Qty  | Unit Cost | Total\n${'─'.repeat(60)}\n`
    const footer = `\n${'─'.repeat(60)}\nTOTAL: ${formatCurrency(totalCost, currency)}\n`
    const body = encodeURIComponent(header + buildPOLines() + footer)
    window.open(`mailto:${supplierEmail}?subject=${subject}&body=${body}`)
  }, [items, qtyOverrides, supplierName, hotelName, supplierEmail, currency, totalCost, fmtDate])

  const handlePlaceOrder = useCallback(async () => {
    await createBulk.mutateAsync(items.map((r) => ({
      variantId: r.variant_id,
      quantityNeeded: qtyOverrides[r.variant_id] ?? r.suggested_qty ?? 1,
      supplier: supplierName,
    })))
  }, [items, qtyOverrides, supplierName, createBulk])

  if (isLoading) return <div className="flex items-center justify-center h-32"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>

  if (items.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Package className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm font-medium">No items assigned to this supplier</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Assign this supplier to product variants in Inventory to see forecasted orders here.
      </p>
      <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-2" onClick={() => { navigate('/purchase-orders') }}>
        <ShoppingCart className="h-3.5 w-3.5" />
        Open full PO Engine
      </Button>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {items.length} items · est. <span className="font-semibold text-foreground">{formatCurrency(totalCost, currency)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => { void handleCopy() }}>
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy PO'}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={!supplierEmail} onClick={handleMailto}>
            <Mail className="h-3 w-3" />
            {supplierEmail ? 'Email' : 'No email'}
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1.5" disabled={createBulk.isPending} onClick={() => { void handlePlaceOrder() }}>
            {createBulk.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
            Place Order
          </Button>
        </div>
      </div>

      {/* Items table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-3 pr-2">Product</th>
              <th className="py-2 px-2 text-center w-20">Stock</th>
              <th className="py-2 px-2 text-center w-24">Qty to Order</th>
              <th className="py-2 px-2 text-right w-20">Unit Cost</th>
              <th className="py-2 pl-2 pr-3 text-right w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => {
              const qty = qtyOverrides[r.variant_id] ?? r.suggested_qty ?? 1
              const urgent = r.days_until_zero != null && r.days_until_zero <= 7
              return (
                <tr key={r.variant_id} className={cn('border-b border-border/40', urgent ? 'bg-red-50/30 dark:bg-red-950/10' : '')}>
                  <td className="py-2 pl-3 pr-2">
                    <p className="text-sm font-medium leading-tight">
                      {r.variant_name !== 'Standard' ? `${r.product_name} — ${r.variant_name}` : r.product_name}
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground">{r.sku}</p>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={cn('tabular-nums text-sm font-semibold', r.current_stock === 0 ? 'text-red-600' : '')}>{r.current_stock}</span>
                    {r.days_until_zero != null && <p className="text-[10px] text-muted-foreground">~{r.days_until_zero}d</p>}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <Input
                      type="number" min={0}
                      value={qty}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10)
                        if (!isNaN(v) && v >= 0) {
                          setQtyOverrides((prev) => {
                            const next = { ...prev }
                            if (v === (r.suggested_qty ?? 1)) { delete next[r.variant_id] } else { next[r.variant_id] = v }
                            return next
                          })
                        }
                      }}
                      className={cn('h-7 w-16 text-center text-sm tabular-nums mx-auto', qtyOverrides[r.variant_id] != null ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : '')}
                    />
                  </td>
                  <td className="py-2 px-2 text-right text-xs text-muted-foreground tabular-nums">{formatCurrency(r.unit_cost, currency)}</td>
                  <td className="py-2 pl-2 pr-3 text-right text-sm font-semibold tabular-nums">{formatCurrency(qty * r.unit_cost, currency)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/20">
              <td colSpan={3} className="py-2 pl-3 text-xs text-muted-foreground">
                <Button variant="ghost" size="sm" className="h-6 text-xs gap-1.5 px-2" onClick={() => { navigate('/purchase-orders') }}>
                  <SlidersHorizontal className="h-3 w-3" />Full PO Engine
                </Button>
              </td>
              <td className="py-2 px-2 text-right text-xs text-muted-foreground">Total</td>
              <td className="py-2 pl-2 pr-3 text-right font-bold text-sm tabular-nums">{formatCurrency(totalCost, currency)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ─── Stock Health tab ─────────────────────────────────────────────────────────
// Eye Layer synthesis: supplier object → each supplied variant's operational health.
// Turns the supplier from a contact record into an operational object.

function StockHealthTab({ supplierId }: { supplierId: string }) {
  const fmtDate = useDateFormat()
  const { data: products = [], isLoading: loadingProducts } = useProducts()
  const { data: forecastMap = new Map<string, number>(), isLoading: loadingForecast } = useForecast()
  const { data: scorecard = [] } = useSupplierScorecard()

  const sc = scorecard.find((s) => s.supplier_id === supplierId)

  // Collect all variants assigned to this supplier across all products
  const variants = useMemo(() => {
    const rows: Array<{
      variantId: string
      label: string
      current_stock: number
      low_stock_threshold: number
      avg_daily: number | null
      days_until_zero: number | null
    }> = []
    for (const product of products) {
      for (const v of product.product_variants) {
        if (v.default_supplier_id !== supplierId) continue
        if (!v.enabled) continue
        const avgDaily = forecastMap.get(v.id) ?? null
        const dtz = avgDaily && avgDaily > 0
          ? Math.floor(v.current_stock / avgDaily)
          : null
        const label = v.name !== 'Standard'
          ? `${product.name} — ${v.name}`
          : product.name
        rows.push({
          variantId: v.id,
          label,
          current_stock: v.current_stock,
          low_stock_threshold: v.low_stock_threshold,
          avg_daily: avgDaily,
          days_until_zero: dtz,
        })
      }
    }
    // Sort: critical first (dtz ≤ 3), then warning (≤ 7), then watch (≤ 14), then safe, then no-data
    return rows.sort((a, b) => {
      const tierOrder = (dtz: number | null) => {
        if (dtz === null) return 4
        if (dtz <= 3) return 0
        if (dtz <= 7) return 1
        if (dtz <= 14) return 2
        return 3
      }
      const ta = tierOrder(a.days_until_zero)
      const tb = tierOrder(b.days_until_zero)
      if (ta !== tb) return ta - tb
      if (a.days_until_zero !== null && b.days_until_zero !== null) return a.days_until_zero - b.days_until_zero
      return a.label.localeCompare(b.label)
    })
  }, [products, forecastMap, supplierId])

  const isLoading = loadingProducts || loadingForecast

  if (isLoading) return (
    <div className="flex items-center justify-center h-32">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  if (variants.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Activity className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm font-medium">No variants assigned to this supplier</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Set this as the default supplier on product variants in Inventory to track stock health here.
      </p>
    </div>
  )

  const criticalCount = variants.filter((v) => v.days_until_zero !== null && v.days_until_zero <= 3).length
  const warningCount  = variants.filter((v) => v.days_until_zero !== null && v.days_until_zero > 3 && v.days_until_zero <= 7).length

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{variants.length} variant{variants.length !== 1 ? 's' : ''}</span>
        {criticalCount > 0 && (
          <span className="flex items-center gap-1 text-red-600 font-semibold">
            <AlertTriangle className="h-3 w-3" />{criticalCount} critical
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 text-amber-600 font-semibold">
            <TrendingDown className="h-3 w-3" />{warningCount} low
          </span>
        )}
        {sc?.last_delivery_date && (
          <span className="ml-auto">Last delivery {fmtDate(sc.last_delivery_date)}</span>
        )}
      </div>

      {/* Variant health table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="py-2 pl-3 pr-2">Variant</th>
              <th className="py-2 px-2 text-center w-20">Stock</th>
              <th className="py-2 px-2 text-center w-24">Runway</th>
              <th className="py-2 pl-2 pr-3 text-right w-20">Daily Use</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const dtz = v.days_until_zero
              const isCritical = dtz !== null && dtz <= 3
              const isWarning  = dtz !== null && dtz > 3 && dtz <= 7
              const isWatch    = dtz !== null && dtz > 7 && dtz <= 14
              const atThreshold = v.current_stock <= v.low_stock_threshold && v.low_stock_threshold > 0

              return (
                <tr
                  key={v.variantId}
                  className={cn(
                    'border-b border-border/40',
                    isCritical ? 'bg-red-50/40 dark:bg-red-950/10' :
                    isWarning  ? 'bg-amber-50/30 dark:bg-amber-950/10' : '',
                  )}
                >
                  <td className="py-2 pl-3 pr-2">
                    <p className="text-sm font-medium leading-tight">{v.label}</p>
                    {atThreshold && (
                      <p className="text-[10px] text-amber-600 font-medium">Below threshold</p>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={cn(
                      'tabular-nums text-sm font-semibold',
                      v.current_stock === 0 ? 'text-red-600' : isCritical ? 'text-red-500' : '',
                    )}>
                      {v.current_stock}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    {dtz !== null ? (
                      <span className={cn(
                        'tabular-nums text-sm font-semibold',
                        isCritical ? 'text-red-600' :
                        isWarning  ? 'text-amber-600' :
                        isWatch    ? 'text-yellow-600' :
                        'text-green-600',
                      )}>
                        ~{dtz}d
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pl-2 pr-3 text-right">
                    {v.avg_daily !== null && v.avg_daily > 0 ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {v.avg_daily.toFixed(1)}/day
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">no data</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Runway based on 30-day avg consumption · sorted by urgency
      </p>
    </div>
  )
}

// ─── Deliveries tab ───────────────────────────────────────────────────────────

function DeliveriesTab({ supplier, currency }: { supplier: Supplier; currency: string }) {
  const fmtDate = useDateFormat()
  const { data: scorecard } = useSupplierScorecard()
  const { data: requests = [] } = useRestockRequests()
  const [showLog, setShowLog] = useState(false)

  const sc = scorecard?.find((s) => s.supplier_id === supplier.id)
  const linked = useMemo(
    () => requests.filter((r) => r.supplier === supplier.name).slice(0, 10),
    [requests, supplier.name],
  )

  const STATUS_CLS: Record<string, string> = {
    pending:   'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
    approved:  'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    fulfilled: 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    cancelled: 'border-border text-muted-foreground',
  }

  return (
    <div className="space-y-4">
      {/* Summary metrics */}
      {sc && sc.total_deliveries > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Deliveries', value: String(sc.total_deliveries) },
            { label: 'Pending', value: String(sc.pending_deliveries) },
            { label: 'Total Spend', value: formatCurrency(sc.total_received_value ?? 0, currency) },
            { label: 'Avg Late', value: sc.avg_days_late != null ? `${sc.avg_days_late.toFixed(1)}d` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-card p-2.5 text-center">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-sm font-bold tabular-nums mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Log button */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {linked.length > 0 ? `${linked.length} linked restock requests` : 'No linked requests yet'}
        </p>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => { setShowLog(true) }}>
          <Plus className="h-3 w-3" />
          Log Delivery
        </Button>
      </div>

      {/* Restock request history */}
      {linked.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <div className="divide-y">
            {linked.map((r) => {
              const row = r as typeof r & { product_variants?: { name: string; products?: { name: string } } }
              const pName = row.product_variants?.products?.name ?? '—'
              const vName = row.product_variants?.name
              const name  = vName && vName !== 'Standard' ? `${pName} — ${vName}` : pName
              return (
                <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                  <span className="w-20 shrink-0 text-muted-foreground tabular-nums">{fmtDate(new Date(r.date))}</span>
                  <span className="flex-1 truncate font-medium">{name}</span>
                  <span className="tabular-nums text-muted-foreground">×{r.quantity_needed}</span>
                  <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', STATUS_CLS[r.status] ?? '')}>
                    {r.status}
                  </Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {showLog && <LogDeliveryDialog supplier={supplier} onClose={() => { setShowLog(false) }} />}
    </div>
  )
}

// ─── Supplier workspace ───────────────────────────────────────────────────────

function SupplierWorkspace({ supplier, scorecard, currency, onEdit, onDelete }: {
  supplier: Supplier
  scorecard: SupplierScorecard | undefined
  currency: string
  onEdit: () => void
  onDelete: () => void
}) {
  const navigate = useNavigate()
  const activeHotel = useActiveHotel()
  const [showLog, setShowLog] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const score = scorecard ? computeScore(scorecard) : null

  const { data: leverageRows = [] } = useSupplierLeverage(90)
  const leverageRow = leverageRows.find((r) => r.supplier_id === supplier.id)
  const relLabel = leverageRow ? RELATIONSHIP_LABEL[leverageRow.recommended_action] : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Workspace header */}
      <div className="border-b px-6 py-4 flex items-start justify-between flex-shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-lg font-semibold leading-none">{supplier.name}</h2>
            <ScorePill score={score} />
            {relLabel && (
              <span className={cn('inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide', relLabel.cls)}>
                {relLabel.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground flex-wrap">
            {supplier.contact_name && <span>{supplier.contact_name}</span>}
            {supplier.email && (
              <a href={`mailto:${supplier.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <Mail className="h-3 w-3" />{supplier.email}
              </a>
            )}
            {supplier.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3 w-3" />{supplier.phone}
              </span>
            )}
            {supplier.notes && <span className="italic truncate max-w-xs">{supplier.notes}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => { setShowLog(true) }}>
            <Truck className="h-3.5 w-3.5" />Log Delivery
          </Button>
          <Button size="sm" variant="default" className="h-7 text-xs gap-1.5"
            onClick={() => {
              navigate('/purchase-orders', {
                state: { fromRestock: [], _supplierId: supplier.id },
              })
            }}
          >
            <ShoppingCart className="h-3.5 w-3.5" />Draft PO
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => { setDeleteOpen(true) }}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="scorecard" className="flex flex-col h-full">
          <TabsList className="mx-6 mt-3 mb-0 shrink-0 w-fit">
            <TabsTrigger value="scorecard" className="text-xs">Scorecard</TabsTrigger>
            <TabsTrigger value="orders" className="text-xs">Purchase Orders</TabsTrigger>
            <TabsTrigger value="deliveries" className="text-xs">Deliveries</TabsTrigger>
            <TabsTrigger value="stock-health" className="text-xs">Stock Health</TabsTrigger>
          </TabsList>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <TabsContent value="scorecard" className="mt-0">
              <ScorecardTab supplierId={supplier.id} currency={currency} />
            </TabsContent>
            <TabsContent value="orders" className="mt-0">
              <OrdersTab
                supplierId={supplier.id}
                supplierName={supplier.name}
                supplierEmail={supplier.email ?? null}
                currency={currency}
                hotelName={activeHotel?.name ?? 'Hotel'}
              />
            </TabsContent>
            <TabsContent value="deliveries" className="mt-0">
              <DeliveriesTab supplier={supplier} currency={currency} />
            </TabsContent>
            <TabsContent value="stock-health" className="mt-0">
              <StockHealthTab supplierId={supplier.id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {showLog && <LogDeliveryDialog supplier={supplier} onClose={() => { setShowLog(false) }} />}
      <ConfirmDialog
        open={deleteOpen}
        title={`Remove ${supplier.name}?`}
        description="This removes the supplier from the list. Delivery history and leverage data are preserved."
        confirmLabel="Remove"
        destructive
        onConfirm={onDelete}
        onCancel={() => { setDeleteOpen(false) }}
      />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProcurementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const topTab = searchParams.get('tab') ?? 'suppliers'

  const currency = useCurrency()
  const { data: suppliers = [], isLoading } = useSuppliers()
  const { data: scorecard = [] } = useSupplierScorecard()
  const { data: leverageRows = [] } = useSupplierLeverage(90)
  const deleteSupplier = useDeleteSupplier()
  const { data: discrepancies = [] } = usePODiscrepancies()
  const pendingDiscrepancyCount = discrepancies.filter((d) => d.status === 'pending').length
  const { data: allPOs = [] } = usePOSummary()
  const draftPOCount = allPOs.filter(p => p.status === 'draft').length

  const [search, setSearch]             = useState('')
  const [selectedId, setSelectedId]     = useState<string | null>(null)
  const [addOpen, setAddOpen]           = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  const scorecardMap = useMemo(
    () => new Map(scorecard.map((s) => [s.supplier_id, s])),
    [scorecard],
  )
  const leverageMap = useMemo(
    () => new Map(leverageRows.map((r) => [r.supplier_id, r])),
    [leverageRows],
  )

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return suppliers
      .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.contact_name ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        // Sort worst-performing first (lowest score = most attention needed)
        const sc = scorecardMap.get(a.id)
        const sb = scorecardMap.get(b.id)
        const scoreA = sc ? computeScore(sc) : null
        const scoreB = sb ? computeScore(sb) : null
        if (scoreA === null && scoreB === null) return a.name.localeCompare(b.name)
        if (scoreA === null) return 1
        if (scoreB === null) return -1
        return scoreA - scoreB  // ascending: worst first
      })
  }, [suppliers, search, scorecardMap])

  const selected = suppliers.find((s) => s.id === selectedId) ?? filtered[0] ?? null

  const handleDelete = (s: Supplier) => {
    deleteSupplier.mutate(s.id)
    if (selectedId === s.id) setSelectedId(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between border-b px-8 py-4 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Handshake className="h-5 w-5 text-muted-foreground" />
            Mind · Procurement
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suppliers · performance · purchase orders in one workspace
          </p>
        </div>
        {topTab === 'suppliers' && (
          <Button size="sm" onClick={() => { setAddOpen(true) }} className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" />Add Supplier
          </Button>
        )}
      </div>

      {/* Top-level tab bar: Suppliers workspace | PO Generator */}
      <div className="flex items-center gap-1 border-b px-8 bg-muted/10 flex-shrink-0">
        {[
          { id: 'suppliers', label: 'Suppliers & Scorecards', icon: Handshake },
          { id: 'orders',    label: 'PO Generator',           icon: ShoppingCart },
          { id: 'dispatch',  label: `Mind · Dispatch${draftPOCount > 0 ? ` · ${draftPOCount}` : ''}`, icon: Truck },
          { id: 'saved',     label: 'Saved Orders',           icon: PackageCheck },
          { id: 'match',     label: `3-Way Match${pendingDiscrepancyCount > 0 ? ` · ${pendingDiscrepancyCount}` : ''}`, icon: AlertTriangle },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setSearchParams({ tab: id }) }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px',
              topTab === id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* PO Generator tab */}
      {topTab === 'orders' && (
        <div className="flex-1 overflow-hidden">
          <PurchaseOrderContent />
        </div>
      )}

      {/* Saved Orders tab */}
      {topTab === 'saved' && (
        <div className="flex-1 overflow-hidden">
          <SavedOrdersPage />
        </div>
      )}

      {/* PO Dispatch tab */}
      {topTab === 'dispatch' && (
        <div className="flex-1 overflow-hidden">
          <PODispatchPage />
        </div>
      )}

      {/* 3-Way Match tab */}
      {topTab === 'match' && (
        <div className="flex-1 overflow-hidden">
          <POMatchContent />
        </div>
      )}

      {/* Suppliers & Scorecards tab */}
      {topTab === 'suppliers' && (
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: supplier list ── */}
        <div className="w-64 flex-shrink-0 border-r flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search suppliers…"
                value={search}
                onChange={(e) => { setSearch(e.target.value) }}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 px-4 text-center">
                <Truck className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  {suppliers.length === 0 ? 'No suppliers yet. Add one to get started.' : 'No suppliers match your search.'}
                </p>
              </div>
            ) : (
              filtered.map((s) => {
                const sc      = scorecardMap.get(s.id)
                const lev     = leverageMap.get(s.id)
                const score   = sc ? computeScore(sc) : null
                const grade   = scoreToGrade(score)
                const GIcon   = GRADE_ICONS[grade]
                const isActive = (selected?.id ?? null) === s.id
                const needsAction = lev?.recommended_action === 'Find Alternative' || lev?.recommended_action === 'Renegotiate'

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedId(s.id) }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b border-border/40 transition-colors',
                      isActive ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/30',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold shrink-0', GRADE_STYLES[grade])}>
                        <GIcon className="h-2.5 w-2.5" />{grade}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {s.lead_time_days != null && (
                        <span className={cn(
                          'text-[10px] font-medium tabular-nums',
                          s.lead_time_days <= 3 ? 'text-emerald-600 dark:text-emerald-400' :
                          s.lead_time_days <= 7 ? 'text-muted-foreground' :
                          'text-yellow-600 dark:text-yellow-500',
                        )}>
                          {s.lead_time_days}d lead
                        </span>
                      )}
                      {sc && sc.total_deliveries > 0 && sc.on_time_rate != null && (
                        <span className={cn(
                          'text-[10px] tabular-nums',
                          sc.on_time_rate >= 90 ? 'text-emerald-600 dark:text-emerald-400' :
                          sc.on_time_rate >= 70 ? 'text-yellow-600 dark:text-yellow-500' :
                          'text-red-600 dark:text-red-400',
                        )}>
                          {Math.round(sc.on_time_rate)}% on-time
                        </span>
                      )}
                      {needsAction && (
                        <span className="flex items-center gap-0.5 text-[10px] text-orange-500">
                          <AlertTriangle className="h-2.5 w-2.5" />action needed
                        </span>
                      )}
                    </div>
                    {(!sc || sc.total_deliveries === 0) && s.lead_time_days == null && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">No delivery data</p>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Right panel: entity workspace ── */}
        <div className="flex-1 overflow-hidden">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="rounded-full bg-muted/50 p-5">
                <Handshake className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-base font-medium">No supplier selected</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Select a supplier to see their performance scorecard, forecasted orders, and delivery history.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setAddOpen(true) }} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />Add first supplier
              </Button>
            </div>
          ) : (
            <SupplierWorkspace
              key={selected.id}
              supplier={selected}
              scorecard={scorecardMap.get(selected.id)}
              currency={currency}
              onEdit={() => { setEditSupplier(selected) }}
              onDelete={() => { handleDelete(selected) }}
            />
          )}
        </div>
      </div>
      )}

      {/* Modals */}
      {addOpen && <SupplierFormDialog onClose={() => { setAddOpen(false) }} />}
      {editSupplier && <SupplierFormDialog supplier={editSupplier} onClose={() => { setEditSupplier(null) }} />}
    </div>
  )
}
