// Layer: Mind — Supplier intelligence hub (trading desk)
// Palantir principle: every supplier row answers "should I trust this supplier?"
// Primary sort: reliability score ASC (worst first — operators act on the bottom).
// Composite score = on-time (40%) + fill rate (40%) + price stability (20%).
// Log Delivery modal is the primary data entry point for the performance engine.

import { useMemo, useState } from 'react'
import {
  Plus, Pencil, Trash2, Loader2, Search, Download,
  Mail, Phone, ChevronDown, Package,
  CheckCircle2, Clock, AlertTriangle, TrendingUp, Truck,
  TrendingDown, Minus, ShieldCheck, ShieldAlert,
  CalendarCheck, BarChart3,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, parseISO } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { exportToCsv } from '@/lib/csv'
import { formatCurrency } from '@/lib/currency'
import { scoreToGrade, GRADE_STYLES, GRADE_ICONS } from '@/lib/grades'
import { useCurrency } from '@/hooks/useCurrency'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import {
  useSuppliers, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  useSupplierScorecard, useLogDelivery,
} from '@/features/suppliers/hooks'
import { useRestockRequests } from '@/features/restock/hooks'
import type { Supplier, SupplierScorecard, DeliveryEventInput } from '@beacon/types'

// ─── Score engine ─────────────────────────────────────────────────────────────
// on_time_rate   → 40 pts  (rate × 0.4)
// avg_fill_rate  → 40 pts  (rate × 0.4)
// price stability→ 20 pts  (20 − clamp(drift × 2, 0, 20))

function computeScore(sc: SupplierScorecard): number | null {
  if (sc.total_deliveries === 0) return null
  const onTime   = (sc.on_time_rate  ?? 50) * 0.4
  const fill     = (sc.avg_fill_rate ?? 80) * 0.4
  const drift    = sc.avg_price_drift_pct ?? 0
  const price    = 20 - Math.min(Math.max(drift * 2, 0), 20)
  return Math.round(onTime + fill + price)
}

function ScoreBadge({ score }: { score: number | null }) {
  const grade = scoreToGrade(score)
  const Icon  = GRADE_ICONS[grade]
  return (
    <Badge variant="outline" className={cn('gap-1 text-xs font-bold h-6 px-2', GRADE_STYLES[grade])}>
      <Icon className="h-3 w-3" />
      {grade === '—' ? 'No data' : `${String(score)} · ${grade}`}
    </Badge>
  )
}

// ─── Helper text formatters ───────────────────────────────────────────────────

function rateColor(rate: number | null, thresholds: [number, number]): string {
  if (rate === null) return 'text-muted-foreground'
  if (rate >= thresholds[0]) return 'text-green-600 dark:text-green-400'
  if (rate >= thresholds[1]) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function driftColor(drift: number | null): string {
  if (drift === null) return 'text-muted-foreground'
  if (drift <= 0)  return 'text-green-600 dark:text-green-400'
  if (drift <= 3)  return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function DriftIcon({ drift }: { drift: number | null }) {
  if (drift === null) return <Minus className="h-3 w-3 text-muted-foreground" />
  if (drift <= 0)     return <TrendingDown className="h-3 w-3 text-green-500" />
  return <TrendingUp className="h-3 w-3 text-red-500" />
}

// ─── Supplier Modal ───────────────────────────────────────────────────────────

const supplierSchema = z.object({
  name:         z.string().min(1, 'Name is required'),
  contact_name: z.string().optional(),
  email:        z.string().email('Invalid email').optional().or(z.literal('')),
  phone:        z.string().optional(),
  notes:        z.string().optional(),
})

type SupplierFields = z.infer<typeof supplierSchema>

function SupplierModal({ supplier, onClose }: { supplier?: Supplier; onClose: () => void }) {
  const createSupplier = useCreateSupplier()
  const updateSupplier = useUpdateSupplier()

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<SupplierFields>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name:         supplier?.name ?? '',
      contact_name: supplier?.contact_name ?? '',
      email:        supplier?.email ?? '',
      phone:        supplier?.phone ?? '',
      notes:        supplier?.notes ?? '',
    },
  })

  const onSubmit = async (data: SupplierFields) => {
    const input = {
      name:         data.name,
      contact_name: data.contact_name || null,
      email:        data.email || null,
      phone:        data.phone || null,
      notes:        data.notes || null,
    }
    if (supplier) await updateSupplier.mutateAsync({ id: supplier.id, input })
    else await createSupplier.mutateAsync(input)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add Supplier'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Company Name</Label>
            <Input id="name" {...register('name')} autoFocus />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input id="contact_name" placeholder="Optional" {...register('contact_name')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="Optional" {...register('phone')} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="Optional" {...register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} placeholder="Payment terms, lead times, special conditions…" {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {supplier ? 'Save Changes' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Log Delivery Modal ───────────────────────────────────────────────────────

const deliverySchema = z.object({
  ordered_qty:        z.number().positive('Must be > 0'),
  received_qty:       z.number().min(0, 'Must be ≥ 0'),
  expected_date:      z.string().min(1, 'Required'),
  actual_date:        z.string().optional(),
  unit_cost_expected: z.number().optional(),
  unit_cost_actual:   z.number().optional(),
  notes:              z.string().optional(),
})

type DeliveryFields = z.infer<typeof deliverySchema>

function LogDeliveryModal({
  supplier,
  onClose,
}: {
  supplier: Supplier
  onClose: () => void
}) {
  const logDelivery = useLogDelivery()
  const { data: requests = [] } = useRestockRequests()
  const openRequests = useMemo(
    () => requests.filter((r) => r.supplier === supplier.name && r.status !== 'fulfilled' && r.status !== 'cancelled'),
    [requests, supplier.name],
  )

  const [linkedRequestId, setLinkedRequestId] = useState<string>('')

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<DeliveryFields>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      expected_date: format(new Date(), 'yyyy-MM-dd'),
      actual_date:   format(new Date(), 'yyyy-MM-dd'),
    },
  })

  const onSubmit = async (data: DeliveryFields) => {
    const input: DeliveryEventInput = {
      supplier_id:        supplier.id,
      restock_request_id: linkedRequestId || null,
      ordered_qty:        data.ordered_qty,
      received_qty:       data.received_qty,
      expected_date:      data.expected_date,
      actual_date:        data.actual_date || null,
      unit_cost_expected: data.unit_cost_expected ?? null,
      unit_cost_actual:   data.unit_cost_actual ?? null,
      notes:              data.notes || null,
    }
    await logDelivery.mutateAsync(input)
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Delivery — {supplier.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4 py-2">

          {/* Link to open request (optional) */}
          {openRequests.length > 0 && (
            <div className="space-y-1.5">
              <Label>Link to open restock request (optional)</Label>
              <select
                value={linkedRequestId}
                onChange={(e) => { setLinkedRequestId(e.target.value) }}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— None —</option>
                {openRequests.map((r) => {
                  const row = r as typeof r & { product_variants?: { name: string; products?: { name: string } } }
                  const pName = row.product_variants?.products?.name ?? 'Unknown'
                  const vName = row.product_variants?.name
                  const label = vName && vName !== 'Standard' ? `${pName} — ${vName}` : pName
                  return (
                    <option key={r.id} value={r.id}>
                      {label} ×{r.quantity_needed} ({r.status})
                    </option>
                  )
                })}
              </select>
            </div>
          )}

          {/* Qty */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ordered_qty">Ordered qty</Label>
              <Input id="ordered_qty" type="number" step="0.001" {...register('ordered_qty', { valueAsNumber: true })} />
              {errors.ordered_qty && <p className="text-xs text-destructive">{errors.ordered_qty.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="received_qty">Received qty</Label>
              <Input id="received_qty" type="number" step="0.001" {...register('received_qty', { valueAsNumber: true })} />
              {errors.received_qty && <p className="text-xs text-destructive">{errors.received_qty.message}</p>}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="expected_date">Expected date</Label>
              <Input id="expected_date" type="date" {...register('expected_date')} />
              {errors.expected_date && <p className="text-xs text-destructive">{errors.expected_date.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="actual_date">Actual date <span className="text-muted-foreground">(leave blank if in transit)</span></Label>
              <Input id="actual_date" type="date" {...register('actual_date')} />
            </div>
          </div>

          {/* Cost — optional */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit_cost_expected">Expected unit cost <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="unit_cost_expected" type="number" step="0.0001" placeholder="0.00" {...register('unit_cost_expected', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit_cost_actual">Actual unit cost <span className="text-muted-foreground">(optional)</span></Label>
              <Input id="unit_cost_actual" type="number" step="0.0001" placeholder="0.00" {...register('unit_cost_actual', { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d_notes">Notes</Label>
            <Textarea id="d_notes" rows={2} placeholder="e.g. short-shipped, substituted item, invoice mismatch…" {...register('notes')} />
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

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: string
}

function KpiTile({ label, value, sub, icon: Icon, accent = 'text-foreground' }: KpiTileProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn('mt-0.5 text-lg font-semibold tabular-nums leading-none', accent)}>{value}</p>
        {sub && <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Expanded restock history ─────────────────────────────────────────────────

function ExpandedHistory({ supplierName }: { supplierName: string }) {
  const { data: all = [] } = useRestockRequests()
  const fmtDate = useDateFormat()
  const rows = useMemo(
    () => all.filter((r) => r.supplier === supplierName).slice(0, 8),
    [all, supplierName],
  )

  if (rows.length === 0) {
    return (
      <div className="px-12 py-4 text-xs text-muted-foreground">
        No restock requests linked to this supplier yet.
      </div>
    )
  }

  const STATUS_CLS: Record<string, string> = {
    pending:   'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
    approved:  'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
    fulfilled: 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
    cancelled: 'border-border text-muted-foreground',
  }

  return (
    <div className="border-t bg-muted/20 px-12 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Recent Restock Requests
      </p>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const row = r as typeof r & { product_variants?: { name: string; products?: { name: string } } }
          const pName    = row.product_variants?.products?.name ?? '—'
          const vName    = row.product_variants?.name
          const dispName = vName && vName !== 'Standard' ? `${pName} — ${vName}` : pName
          return (
            <div key={r.id} className="flex items-center gap-3 text-xs">
              <span className="w-24 shrink-0 text-muted-foreground tabular-nums">
                {fmtDate(new Date(r.date))}
              </span>
              <span className="flex-1 truncate font-medium">{dispName}</span>
              <span className="tabular-nums text-muted-foreground">×{r.quantity_needed}</span>
              <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', STATUS_CLS[r.status] ?? '')}>
                {r.status}
              </Badge>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Supplier Row ─────────────────────────────────────────────────────────────

interface SupplierRowProps {
  supplier: Supplier
  scorecard: SupplierScorecard | undefined
  currency: string
  rank: number
  onEdit: () => void
  onDelete: () => void
  onLogDelivery: () => void
}

function SupplierRow({ supplier, scorecard, currency, rank, onEdit, onDelete, onLogDelivery }: SupplierRowProps) {
  const [expanded, setExpanded] = useState(false)
  const fmtDate = useDateFormat()
  const score = scorecard ? computeScore(scorecard) : null
  const grade = scoreToGrade(score)

  return (
    <>
      <TableRow
        className={cn('cursor-pointer transition-colors hover:bg-muted/40', expanded && 'bg-muted/20')}
        onClick={() => { setExpanded((v) => !v) }}
      >
        {/* Rank + expand */}
        <TableCell className="w-10 text-center text-[10px] text-muted-foreground font-mono">
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
            : <span>{rank}</span>}
        </TableCell>

        {/* Name + contact */}
        <TableCell>
          <div>
            <p className="font-medium text-sm">{supplier.name}</p>
            {supplier.contact_name && (
              <p className="text-[11px] text-muted-foreground">{supplier.contact_name}</p>
            )}
            <div className="mt-0.5 flex items-center gap-2">
              {supplier.email && (
                <a
                  href={`mailto:${supplier.email}`}
                  onClick={(e) => { e.stopPropagation() }}
                  className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Mail className="h-2.5 w-2.5" />{supplier.email}
                </a>
              )}
              {supplier.phone && (
                <a
                  href={`tel:${supplier.phone}`}
                  onClick={(e) => { e.stopPropagation() }}
                  className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Phone className="h-2.5 w-2.5" />{supplier.phone}
                </a>
              )}
            </div>
          </div>
        </TableCell>

        {/* Reliability score */}
        <TableCell>
          <ScoreBadge score={score} />
          {scorecard && scorecard.total_deliveries > 0 && (
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {scorecard.total_deliveries} deliveries
              {scorecard.pending_deliveries > 0 && (
                <span className="ml-1 text-yellow-600 dark:text-yellow-400">
                  · {scorecard.pending_deliveries} pending
                </span>
              )}
            </p>
          )}
        </TableCell>

        {/* On-time rate */}
        <TableCell className="text-right">
          {scorecard && scorecard.completed_deliveries > 0 ? (
            <div>
              <span className={cn('text-sm font-semibold tabular-nums', rateColor(scorecard.on_time_rate, [90, 70]))}>
                {scorecard.on_time_rate?.toFixed(0) ?? '—'}%
              </span>
              <p className="text-[10px] text-muted-foreground">on-time</p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Fill rate */}
        <TableCell className="text-right">
          {scorecard && scorecard.total_deliveries > 0 ? (
            <div>
              <span className={cn('text-sm font-semibold tabular-nums', rateColor(scorecard.avg_fill_rate, [95, 80]))}>
                {scorecard.avg_fill_rate?.toFixed(0) ?? '—'}%
              </span>
              <p className="text-[10px] text-muted-foreground">fill rate</p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Price drift */}
        <TableCell className="text-right">
          {scorecard?.avg_price_drift_pct != null ? (
            <div className="flex items-center justify-end gap-1">
              <DriftIcon drift={scorecard.avg_price_drift_pct} />
              <div>
                <span className={cn('text-sm font-semibold tabular-nums', driftColor(scorecard.avg_price_drift_pct))}>
                  {scorecard.avg_price_drift_pct > 0 ? '+' : ''}{scorecard.avg_price_drift_pct.toFixed(1)}%
                </span>
                <p className="text-[10px] text-muted-foreground">vs expected</p>
              </div>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Avg days late */}
        <TableCell className="text-right">
          {scorecard?.avg_days_late != null ? (
            <div>
              <span className={cn(
                'text-sm font-semibold tabular-nums',
                scorecard.avg_days_late <= 0 ? 'text-green-600 dark:text-green-400'
                : scorecard.avg_days_late <= 2 ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400',
              )}>
                {scorecard.avg_days_late > 0 ? '+' : ''}{scorecard.avg_days_late.toFixed(1)}d
              </span>
              <p className="text-[10px] text-muted-foreground">avg delay</p>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Total value */}
        <TableCell className="text-right">
          {scorecard && scorecard.total_received_value > 0 ? (
            <div>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(scorecard.total_received_value, currency)}
              </span>
              {scorecard.last_delivery_date && (
                <p className="text-[10px] text-muted-foreground">
                  last {fmtDate(parseISO(scorecard.last_delivery_date))}
                </p>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>

        {/* Grade context — for A/B suppliers, a green dot; D = warning */}
        <TableCell>
          {grade === 'D' && (
            <div className="flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 font-medium">
              <AlertTriangle className="h-3 w-3" />
              Underperforming
            </div>
          )}
          {grade === 'C' && (
            <div className="flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-3 w-3" />
              Watch
            </div>
          )}
          {(grade === 'A' || grade === 'B') && (
            <div className="flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              Reliable
            </div>
          )}
        </TableCell>

        {/* Actions */}
        <TableCell onClick={(e) => { e.stopPropagation() }}>
          <div className="flex items-center gap-1 justify-end">
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => { onLogDelivery() }}
            >
              Log delivery
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onEdit() }}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => { onDelete() }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={10} className="p-0">
            <ExpandedHistory supplierName={supplier.name} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers()
  const { data: scorecards = [], isLoading: scLoading }       = useSupplierScorecard()
  const deleteSupplier = useDeleteSupplier()
  const currency       = useCurrency()

  const [modal,         setModal]         = useState<'create' | Supplier | null>(null)
  const [logSupplier,   setLogSupplier]   = useState<Supplier | null>(null)
  const [search,        setSearch]        = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const isLoading = suppliersLoading || scLoading

  // Scorecard lookup by supplier_id
  const scorecardMap = useMemo(() => {
    const m = new Map<string, SupplierScorecard>()
    for (const sc of scorecards) m.set(sc.supplier_id, sc)
    return m
  }, [scorecards])

  // Enrich + compute scores
  const enriched = useMemo(() =>
    suppliers.map((s) => {
      const sc    = scorecardMap.get(s.id)
      const score = sc ? computeScore(sc) : null
      return { supplier: s, scorecard: sc, score }
    }),
    [suppliers, scorecardMap],
  )

  // Sort: worst score first (nulls last so new suppliers go to bottom)
  const sorted = useMemo(() =>
    [...enriched].sort((a, b) => {
      if (a.score === null && b.score === null) return 0
      if (a.score === null) return 1
      if (b.score === null) return -1
      return a.score - b.score   // lowest score = most risk = top of list
    }),
    [enriched],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter(({ supplier }) =>
      supplier.name.toLowerCase().includes(q) ||
      (supplier.contact_name?.toLowerCase().includes(q) ?? false) ||
      (supplier.email?.toLowerCase().includes(q) ?? false),
    )
  }, [sorted, search])

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const withData = enriched.filter((e) => e.scorecard && e.scorecard.total_deliveries > 0)
    const totalDeliveries = scorecards.reduce((s, sc) => s + sc.total_deliveries, 0)
    const pending         = scorecards.reduce((s, sc) => s + sc.pending_deliveries, 0)
    const avgScore        = withData.length > 0
      ? Math.round(withData.reduce((s, e) => s + (e.score ?? 0), 0) / withData.length)
      : null
    const worst = withData.length > 0
      ? withData.reduce((a, b) => (a.score ?? 100) < (b.score ?? 100) ? a : b)
      : null
    const best = withData.length > 0
      ? withData.reduce((a, b) => (a.score ?? 0) > (b.score ?? 0) ? a : b)
      : null
    const totalValue = scorecards.reduce((s, sc) => s + sc.total_received_value, 0)
    return { avgScore, worst, best, totalDeliveries, pending, totalValue }
  }, [enriched, scorecards])

  const handleDelete = (id: string) => {
    setDeleteConfirm(id)
  }

  const handleExport = () => {
    exportToCsv(`suppliers-${format(new Date(), 'yyyy-MM-dd')}`, filtered.map(({ supplier, scorecard, score }) => ({
      name:               supplier.name,
      contact_name:       supplier.contact_name ?? '',
      email:              supplier.email ?? '',
      phone:              supplier.phone ?? '',
      reliability_score:  score ?? '',
      grade:              scoreToGrade(score),
      on_time_rate:       scorecard?.on_time_rate ?? '',
      avg_fill_rate:      scorecard?.avg_fill_rate ?? '',
      avg_price_drift_pct: scorecard?.avg_price_drift_pct ?? '',
      avg_days_late:      scorecard?.avg_days_late ?? '',
      total_deliveries:   scorecard?.total_deliveries ?? 0,
      total_received_value: scorecard?.total_received_value.toFixed(2) ?? '0.00',
      notes:              supplier.notes ?? '',
    })))
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 md:px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Mind · Suppliers</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : `${String(suppliers.length)} supplier${suppliers.length !== 1 ? 's' : ''} · sorted by reliability score · worst first`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={suppliers.length === 0}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
          <Button size="sm" onClick={() => { setModal('create') }}>
            <Plus className="mr-2 h-4 w-4" />Add Supplier
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      {!isLoading && suppliers.length > 0 && (
        <div className="grid grid-cols-2 gap-3 px-4 md:px-8 py-4 border-b sm:grid-cols-4 flex-shrink-0">
          <KpiTile
            label="Chain avg reliability"
            value={kpis.avgScore != null ? `${String(kpis.avgScore)} · ${scoreToGrade(kpis.avgScore)}` : '—'}
            sub={`${String(kpis.totalDeliveries)} deliveries logged`}
            icon={BarChart3}
            accent={kpis.avgScore != null ? (kpis.avgScore >= 85 ? 'text-green-600 dark:text-green-400'
              : kpis.avgScore >= 70 ? 'text-lime-600 dark:text-lime-400'
              : kpis.avgScore >= 50 ? 'text-orange-600 dark:text-orange-400'
              : 'text-red-600 dark:text-red-400') : ''}
          />
          <KpiTile
            label="Most reliable"
            value={kpis.best?.supplier.name ?? '—'}
            sub={kpis.best?.score != null ? `Score ${String(kpis.best.score)} · ${scoreToGrade(kpis.best.score)}` : 'No data yet'}
            icon={ShieldCheck}
            accent="text-green-600 dark:text-green-400"
          />
          <KpiTile
            label="Needs attention"
            value={kpis.worst?.supplier.name ?? '—'}
            sub={kpis.worst?.score != null ? `Score ${String(kpis.worst.score)} · ${scoreToGrade(kpis.worst.score)}` : 'No data yet'}
            icon={ShieldAlert}
            accent={kpis.worst?.score != null && kpis.worst.score < 70 ? 'text-red-600 dark:text-red-400' : ''}
          />
          <KpiTile
            label="Pending deliveries"
            value={String(kpis.pending)}
            sub={kpis.totalValue > 0 ? `${formatCurrency(kpis.totalValue, currency)} total received` : 'Start logging deliveries'}
            icon={Truck}
            accent={kpis.pending > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}
          />
        </div>
      )}

      {/* Filter bar */}
      {suppliers.length > 0 && (
        <div className="flex items-center gap-3 border-b px-4 md:px-8 py-3 flex-shrink-0 bg-muted/20">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search suppliers…"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              className="pl-9 h-8 text-sm"
            />
          </div>
          {search && (
            <button type="button" onClick={() => { setSearch('') }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground hidden md:block">
            Score = on-time (40%) + fill rate (40%) + price stability (20%) · Click row to expand
          </span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto px-4 md:px-8 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Truck className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No suppliers yet</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Add suppliers and log deliveries to start tracking on-time rates, fill rates, and price drift.
            </p>
            <Button size="sm" onClick={() => { setModal('create') }} className="mt-1">
              <Plus className="mr-2 h-4 w-4" />Add Supplier
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            No suppliers match "{search}".
            <button type="button" onClick={() => { setSearch('') }} className="ml-1 text-primary hover:underline">
              Clear search
            </button>
          </div>
        ) : (
          <>
            {/* Onboarding nudge: suppliers exist but no delivery data logged yet */}
            {scorecards.length === 0 && suppliers.length > 0 && (
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300">
                <BarChart3 className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div>
                  <p className="font-medium">Reliability scores are empty — no deliveries logged yet</p>
                  <p className="mt-0.5 text-xs opacity-80">
                    Click <strong>Log delivery</strong> on any supplier row to record your first delivery.
                    On-time rate, fill rate, and price drift will appear immediately.
                  </p>
                </div>
              </div>
            )}

            {/* Callout: D-grade suppliers at top if any */}
            {(() => {
              const dCount = filtered.filter((e) => scoreToGrade(e.score) === 'D').length
              return dCount > 0 ? (
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>
                    <strong>{dCount} supplier{dCount > 1 ? 's' : ''}</strong> scoring below 50 — review their performance and consider alternatives.
                  </span>
                </div>
              ) : null
            })()}

            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Reliability</TableHead>
                    <TableHead className="text-right">On-time</TableHead>
                    <TableHead className="text-right">Fill rate</TableHead>
                    <TableHead className="text-right">Price drift</TableHead>
                    <TableHead className="text-right">Avg delay</TableHead>
                    <TableHead className="text-right">Value received</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-36" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(({ supplier, scorecard }, idx) => (
                    <SupplierRow
                      key={supplier.id}
                      supplier={supplier}
                      scorecard={scorecard}
                      currency={currency}
                      rank={idx + 1}
                      onEdit={() => { setModal(supplier) }}
                      onDelete={() => { handleDelete(supplier.id) }}
                      onLogDelivery={() => { setLogSupplier(supplier) }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Package className="h-3 w-3" />Scores from all logged deliveries</span>
              <span className="flex items-center gap-1.5"><span className="inline-flex h-2 w-2 rounded-full bg-green-500" />A ≥85 · B ≥70 · <span className="inline-flex h-2 w-2 rounded-full bg-orange-500 ml-1" />C ≥50 · <span className="inline-flex h-2 w-2 rounded-full bg-red-500 ml-1" />D &lt;50</span>
              <span className="flex items-center gap-1"><CalendarCheck className="h-3 w-3" />Price drift: positive = overcharged vs PO</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Avg delay: negative = arrived early</span>
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      {modal !== null && (
        <SupplierModal
          supplier={modal === 'create' ? undefined : modal}
          onClose={() => { setModal(null) }}
        />
      )}
      {logSupplier !== null && (
        <LogDeliveryModal
          supplier={logSupplier}
          onClose={() => { setLogSupplier(null) }}
        />
      )}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title="Remove supplier?"
        description="The supplier and all associated scorecard data will be removed."
        confirmLabel="Remove"
        destructive
        onConfirm={() => { if (deleteConfirm) void deleteSupplier.mutateAsync(deleteConfirm) }}
        onCancel={() => { setDeleteConfirm(null) }}
      />
    </div>
  )
}
