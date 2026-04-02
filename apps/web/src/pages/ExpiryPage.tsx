// Layer: Eye — Expiry risk management
// Palantir principle: every number carries its derived context.
// Show cost-at-risk, not just counts. Decisions live next to data.

import { useMemo, useState } from 'react'
import {
  AlertTriangle, Loader2, TrendingDown, CheckCircle2, ChevronDown, ChevronRight, Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { useExpiringVariants, useAdjustStock, useExpiryBatches, useDiscardBatch } from '@/features/inventory/hooks'
import { useSupplierWasteAnalytics } from '@/features/eye/hooks'
import { formatCurrency } from '@/lib/currency'
import { daysUntil } from '@/lib/date'
import { useCurrency } from '@/hooks/useCurrency'
import { useDateFormat } from '@/features/user/hooks'
import type { ExpiringVariant } from '@/features/inventory/api'
import type { ExpiryBatchRow, SupplierWasteRow } from '@beacon/types'

// ─── Helpers ───────────────────────────────────────────────────────────────────

type Band = 'expired' | 'critical' | 'warning' | 'upcoming'

function getBand(days: number): Band {
  if (days < 0)   return 'expired'
  if (days <= 7)  return 'critical'
  if (days <= 30) return 'warning'
  return 'upcoming'
}

const BAND_META: Record<Band, {
  label: string
  dotColor: string
  rowBg: string
  textColor: string
  badgeCls: string
}> = {
  expired:  {
    label: 'Expired',
    dotColor: 'bg-red-600',
    rowBg: 'bg-red-50/70 dark:bg-red-950/25',
    textColor: 'text-red-700 dark:text-red-400',
    badgeCls: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  },
  critical: {
    label: '≤ 7 days',
    dotColor: 'bg-orange-500',
    rowBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    textColor: 'text-orange-700 dark:text-orange-400',
    badgeCls: 'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  },
  warning:  {
    label: '≤ 30 days',
    dotColor: 'bg-yellow-500',
    rowBg: 'bg-yellow-50/50 dark:bg-yellow-950/15',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    badgeCls: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400',
  },
  upcoming: {
    label: '≤ 90 days',
    dotColor: 'bg-muted-foreground/50',
    rowBg: '',
    textColor: 'text-muted-foreground',
    badgeCls: 'border-border text-muted-foreground',
  },
}

// ─── Cost-at-risk strip ────────────────────────────────────────────────────────

function RiskStrip({
  variants,
  currency,
}: {
  variants: (ExpiringVariant & { days: number; costAtRisk: number })[]
  currency: string
}) {
  const expired  = variants.filter((v) => v.days < 0)
  const critical = variants.filter((v) => v.days >= 0 && v.days <= 7)
  const warning  = variants.filter((v) => v.days > 7 && v.days <= 30)

  const expiredValue  = expired.reduce((s, v) => s + v.costAtRisk, 0)
  const criticalValue = critical.reduce((s, v) => s + v.costAtRisk, 0)
  const warningValue  = warning.reduce((s, v) => s + v.costAtRisk, 0)
  const totalValue    = variants.reduce((s, v) => s + v.costAtRisk, 0)

  if (variants.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-6 px-8 py-3 border-b bg-muted/30 text-sm">
      <span className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{variants.length}</span> variants at risk
        {' · '}
        <span className="font-semibold text-foreground">{formatCurrency(totalValue, currency)}</span> total exposure
      </span>
      {expiredValue > 0 && (
        <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums">{formatCurrency(expiredValue, currency)}</span>
          <span className="text-xs text-muted-foreground">already expired</span>
        </span>
      )}
      {criticalValue > 0 && (
        <span className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
          <TrendingDown className="h-3.5 w-3.5" />
          <span className="font-semibold tabular-nums">{formatCurrency(criticalValue, currency)}</span>
          <span className="text-xs text-muted-foreground">within 7 days</span>
        </span>
      )}
      {warningValue > 0 && (
        <span className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
          <span className="font-semibold tabular-nums">{formatCurrency(warningValue, currency)}</span>
          <span className="text-xs text-muted-foreground">within 30 days</span>
        </span>
      )}
    </div>
  )
}

// ─── Batch expiry table ────────────────────────────────────────────────────────
// Shows per-lot data from product_batches — more granular than variant-level expiry.
// Multiple batches of the same product with different expiry dates are shown separately.

function BatchExpiryTable({
  batches,
  currency,
  onDiscard,
  discarding,
}: {
  batches: ExpiryBatchRow[]
  currency: string
  onDiscard: (b: ExpiryBatchRow) => void
  discarding: Set<string>
}) {
  const fmtDate = useDateFormat()

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product / Lot</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Unit cost</TableHead>
            <TableHead className="text-right">Value at risk</TableHead>
            <TableHead className="text-right">Expiry</TableHead>
            <TableHead className="text-right">Status</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => {
            const band = getBand(b.days_until_expiry)
            const meta = BAND_META[band]
            const daysLabel =
              b.days_until_expiry < 0
                ? `Expired ${String(Math.abs(b.days_until_expiry))}d ago`
                : b.days_until_expiry === 0
                  ? 'Expires today'
                  : `${String(b.days_until_expiry)}d`
            return (
              <TableRow key={b.batch_id} className={meta.rowBg}>
                <TableCell>
                  <p className="text-sm font-medium">{b.product_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {b.variant_name !== 'Standard' ? `${b.variant_name} · ` : ''}
                    {b.lot_number ? `Lot ${b.lot_number}` : 'No lot number'}
                    {b.category_name ? ` · ${b.category_name}` : ''}
                  </p>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{b.sku}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{b.quantity}</TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {formatCurrency(b.unit_cost, currency)}
                </TableCell>
                <TableCell className={cn('text-right tabular-nums font-semibold text-sm', meta.textColor)}>
                  {b.quantity > 0 ? formatCurrency(b.cost_at_risk, currency) : '—'}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                  {fmtDate(b.expiry_date)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={cn('text-[10px] h-5 px-1.5 font-semibold', meta.badgeCls)}>
                    {daysLabel}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {b.quantity > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                      disabled={discarding.has(b.batch_id)}
                      onClick={() => { onDiscard(b) }}
                    >
                      {discarding.has(b.batch_id)
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : 'Write off'}
                    </Button>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Written off</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Supplier waste table ──────────────────────────────────────────────────────
// Eye Layer · Which suppliers correlate with the most write-offs and expiry waste?

function SupplierWasteTable({
  rows,
  currency,
}: {
  rows: SupplierWasteRow[]
  currency: string
}) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <CheckCircle2 className="h-10 w-10 text-green-500/60" />
        <p className="text-sm font-medium">No supplier waste data</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Waste analytics appear once you link deliveries to suppliers when receiving stock.
          As batches are written off, waste rates will be computed per supplier.
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead className="text-right">Batches received</TableHead>
            <TableHead className="text-right">Batches wasted</TableHead>
            <TableHead className="text-right">Waste rate</TableHead>
            <TableHead className="text-right">Units wasted</TableHead>
            <TableHead className="text-right">Cost wasted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const rate = r.waste_rate_pct ?? 0
            const rateCls =
              rate >= 20 ? 'text-red-700 dark:text-red-400' :
              rate >= 10 ? 'text-orange-700 dark:text-orange-400' :
              'text-muted-foreground'
            return (
              <TableRow key={r.supplier_id ?? r.supplier_name}>
                <TableCell className="font-medium text-sm">{r.supplier_name ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{r.batches_received}</TableCell>
                <TableCell className="text-right tabular-nums">{r.batches_wasted}</TableCell>
                <TableCell className={cn('text-right tabular-nums font-semibold', rateCls)}>
                  {rate.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{r.units_wasted}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold text-destructive">
                  {formatCurrency(r.cost_wasted, currency)}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Window options ────────────────────────────────────────────────────────────

const WINDOWS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

// ─── Grouped by product view ───────────────────────────────────────────────────

type EnrichedVariant = ExpiringVariant & { days: number; costAtRisk: number }

interface ProductGroup {
  productName: string
  variants: EnrichedVariant[]
  totalStock: number
  totalCost: number
  minDays: number
}

function GroupedExpiryTable({
  groups,
  currency,
  discarding,
  batchPending,
  onDiscard,
}: {
  groups: ProductGroup[]
  currency: string
  discarding: Set<string>
  batchPending: boolean
  onDiscard: (v: EnrichedVariant) => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(groups.map((g) => g.productName)))

  const toggleGroup = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="rounded-lg border overflow-hidden divide-y">
      {groups.map((group) => {
        const isOpen = expanded.has(group.productName)
        const worstBand = getBand(group.minDays)
        const meta = BAND_META[worstBand]
        return (
          <div key={group.productName}>
            {/* Group header row */}
            <div
              className={cn('flex items-center gap-3 px-4 py-2.5 cursor-pointer select-none hover:bg-muted/40', meta.rowBg)}
              onClick={() => { toggleGroup(group.productName); }}
            >
              {isOpen
                ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
              <p className="text-sm font-semibold flex-1">{group.productName}</p>
              <span className="text-xs text-muted-foreground tabular-nums">
                {group.variants.length} lot{group.variants.length !== 1 ? 's' : ''}
              </span>
              <span className={cn('text-xs font-semibold tabular-nums', meta.textColor)}>
                {group.minDays < 0
                  ? `Expired ${String(Math.abs(group.minDays))}d ago`
                  : group.minDays === 0
                    ? 'Expires today'
                    : `${String(group.minDays)}d`}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">
                {group.totalStock} units
              </span>
              <span className={cn('text-xs font-semibold tabular-nums w-20 text-right', meta.textColor)}>
                {formatCurrency(group.totalCost, currency)}
              </span>
            </div>

            {/* Per-variant rows */}
            {isOpen && group.variants.map((v) => {
              const band = getBand(v.days)
              const vm = BAND_META[band]
              const lotLabel = v.lot_number ? `Lot ${v.lot_number}` : v.name !== 'Standard' ? v.name : '—'
              const daysLabel =
                v.days < 0
                  ? `Expired ${String(Math.abs(v.days))}d ago`
                  : v.days === 0 ? 'Expires today' : `${String(v.days)}d`
              return (
                <div
                  key={v.id}
                  className={cn('flex items-center gap-3 pl-10 pr-4 py-2 text-sm', vm.rowBg)}
                >
                  <span className="flex-1 text-xs text-muted-foreground">{lotLabel}</span>
                  <span className="text-xs text-muted-foreground font-mono">{v.sku}</span>
                  <span className="text-xs tabular-nums w-16 text-right">{v.current_stock} units</span>
                  <span className={cn('text-xs font-semibold tabular-nums w-20 text-right', vm.textColor)}>
                    {v.current_stock > 0 ? formatCurrency(v.costAtRisk, currency) : '—'}
                  </span>
                  {(band === 'warning' || band === 'critical') && v.current_stock > 0 && (
                    <span className="text-[10px] text-muted-foreground italic">use first</span>
                  )}
                  <Badge
                    variant="outline"
                    className={cn('text-[10px] h-5 px-1.5 font-semibold w-28 justify-center', vm.badgeCls)}
                  >
                    {daysLabel}
                  </Badge>
                  <div className="w-20 text-right">
                    {v.current_stock > 0 ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                        disabled={discarding.has(v.id) || batchPending}
                        onClick={() => { onDiscard(v); }}
                      >
                        {discarding.has(v.id)
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : 'Write off'}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Written off</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ViewMode = 'batches' | 'variants' | 'suppliers'

export default function ExpiryPage() {
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(90)
  const [viewMode, setViewMode]     = useState<ViewMode>('batches')
  const [groupByProduct, setGroupByProduct] = useState(false)

  const { data: variants = [], isLoading }       = useExpiringVariants(windowDays)
  const { data: batches = [], isLoading: batchLoading } = useExpiryBatches(windowDays)
  const { data: supplierWaste = [], isLoading: supplierLoading } = useSupplierWasteAnalytics(90)
  const adjustStock  = useAdjustStock()
  const discardBatch = useDiscardBatch()
  const currency     = useCurrency()
  const fmtDate      = useDateFormat()

  const [discarding, setDiscarding]       = useState<Set<string>>(new Set())
  const [batchPending, setBatchPending]   = useState(false)

  // Enrich with days-until-expiry and cost-at-risk
  const enriched = useMemo(() =>
    variants
      .filter((v) => v.expiry_date)
      .map((v) => ({
        ...v,
        days: daysUntil(v.expiry_date!),
        costAtRisk: v.current_stock * v.cost,
      }))
      .sort((a, b) => a.days - b.days),   // most urgent first
    [variants]
  )

  const actionable = enriched.filter((v) => v.days < 0 || v.days <= 7) // expired + critical

  // Group enriched variants by product name for grouped view
  const productGroups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, EnrichedVariant[]>()
    for (const v of enriched) {
      const key = v.products?.name ?? v.name
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(v)
    }
    return Array.from(map.entries())
      .map(([productName, pvariants]) => ({
        productName,
        variants: pvariants,
        totalStock: pvariants.reduce((s, v) => s + v.current_stock, 0),
        totalCost: pvariants.reduce((s, v) => s + v.costAtRisk, 0),
        minDays: Math.min(...pvariants.map((v) => v.days)),
      }))
      .sort((a, b) => a.minDays - b.minDays)
  }, [enriched])

  // ── Batch-level discard (product_batches) ─────────────────────────────────
  const handleDiscardBatch = async (b: ExpiryBatchRow) => {
    const displayName = b.variant_name !== 'Standard'
      ? `${b.product_name} — ${b.variant_name}`
      : b.product_name
    if (!confirm(`Write off ${String(b.quantity)} units of "${displayName}"${b.lot_number ? ` (Lot ${b.lot_number})` : ''}? This cannot be undone.`)) return
    setDiscarding((prev) => new Set(prev).add(b.batch_id))
    try {
      await discardBatch.mutateAsync({ batchId: b.batch_id })
    } finally {
      setDiscarding((prev) => { const n = new Set(prev); n.delete(b.batch_id); return n })
    }
  }

  // ── Single discard ────────────────────────────────────────────────────────
  const handleDiscard = async (v: EnrichedVariant) => {
    if (v.current_stock <= 0) { toast.info('Stock is already at zero'); return }
    const displayName = v.products?.name
      ? (v.name !== 'Standard' ? `${v.products.name} — ${v.name}` : v.products.name)
      : v.name
    if (!confirm(`Write off all ${String(v.current_stock)} units of "${displayName}"? This cannot be undone.`)) return

    setDiscarding((prev) => new Set(prev).add(v.id))
    try {
      await adjustStock.mutateAsync({
        variantId: v.id,
        delta: -v.current_stock,
        reason: 'Expired — written off',
        removalCategory: 'Spoilage',
      })
    } finally {
      setDiscarding((prev) => {
        const next = new Set(prev)
        next.delete(v.id)
        return next
      })
    }
  }

  // ── Batch discard critical + expired ─────────────────────────────────────
  const handleBatchDiscard = async () => {
    const toWrite = actionable.filter((v) => v.current_stock > 0)
    if (toWrite.length === 0) { toast.info('Nothing to write off'); return }
    const totalUnits = toWrite.reduce((s, v) => s + v.current_stock, 0)
    const totalValue = toWrite.reduce((s, v) => s + v.costAtRisk, 0)
    if (!confirm(
      `Write off ${String(totalUnits)} units across ${String(toWrite.length)} variants (${formatCurrency(totalValue, currency)})? This cannot be undone.`
    )) return

    setBatchPending(true)
    try {
      const results = await Promise.allSettled(
        toWrite.map((v) =>
          adjustStock.mutateAsync({
            variantId: v.id,
            delta: -v.current_stock,
            reason: 'Batch expiry write-off',
            removalCategory: 'Spoilage',
          })
        )
      )
      const failed = results
        .map((r, i) => (r.status === 'rejected' ? toWrite[i] : null))
        .filter(Boolean)
      const succeeded = toWrite.length - failed.length

      if (failed.length === 0) {
        toast.success(`Written off ${String(succeeded)} expired variant${succeeded !== 1 ? 's' : ''}`)
      } else {
        const names = failed
          .slice(0, 3)
          .map((v) => v?.products?.name ?? v?.name ?? 'Unknown')
          .join(', ')
        toast.error(
          `${String(failed.length)} write-off${failed.length !== 1 ? 's' : ''} failed: ${names}${failed.length > 3 ? '…' : ''}`
        )
        if (succeeded > 0) {
          toast.success(`${String(succeeded)} written off successfully`)
        }
      }
    } finally {
      setBatchPending(false)
    }
  }

  const totalCount = enriched.length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Eye · Expiry Risk</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {(isLoading || batchLoading)
              ? 'Loading…'
              : viewMode === 'batches'
                ? batches.length === 0
                  ? 'No tracked batches expiring in this window'
                  : `${String(batches.length)} batch${batches.length !== 1 ? 'es' : ''} · ${formatCurrency(batches.reduce((s, b) => s + b.cost_at_risk, 0), currency)} at risk`
                : totalCount === 0
                  ? `No variants expiring within ${String(windowDays)} days`
                  : `${String(totalCount)} variant${totalCount !== 1 ? 's' : ''} expiring within ${String(windowDays)} days`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View mode toggle — Batches vs Variants */}
          <div className="flex gap-0.5 rounded-md border p-0.5">
            <button
              onClick={() => { setViewMode('batches') }}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                viewMode === 'batches'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              By Batch
              {batches.length > 0 && (
                <span className={cn(
                  'ml-1.5 rounded-full px-1.5 py-0 text-[10px] font-bold',
                  viewMode === 'batches' ? 'bg-primary-foreground/20' : 'bg-orange-100 text-orange-700',
                )}>
                  {batches.length}
                </span>
              )}
            </button>
            <button
              onClick={() => { setViewMode('variants') }}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                viewMode === 'variants'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              By Variant
            </button>
            <button
              onClick={() => { setViewMode('suppliers') }}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                viewMode === 'suppliers'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              By Supplier
            </button>
          </div>
          {/* Group toggle (variant view only) */}
          {viewMode === 'variants' && (
            <Button
              variant={groupByProduct ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => { setGroupByProduct((v) => !v) }}
              className="h-7 text-xs gap-1.5"
            >
              <Layers className="h-3.5 w-3.5" />
              Group by product
            </Button>
          )}
          {/* Window toggle */}
          <div className="flex gap-0.5 rounded-md border p-0.5">
            {WINDOWS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => { setWindowDays(opt.days) }}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  windowDays === opt.days
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Batch write-off */}
          {actionable.filter((v) => v.current_stock > 0).length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              disabled={batchPending}
              onClick={() => { void handleBatchDiscard() }}
            >
              {batchPending
                ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                : <AlertTriangle className="mr-2 h-3.5 w-3.5" />}
              Write off {actionable.filter((v) => v.current_stock > 0).length} expired / critical
            </Button>
          )}
        </div>
      </div>

      {/* Cost-at-risk strip */}
      {!isLoading && <RiskStrip variants={enriched} currency={currency} />}

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-5">
        {(isLoading || batchLoading || supplierLoading) ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading…
          </div>
        ) : viewMode === 'batches' ? (
          batches.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500/60" />
              <p className="text-sm font-medium">No batch expiry data</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Batch tracking activates when you enter an expiry date while receiving stock.
                Future deliveries with expiry dates will appear here as individual lots.
              </p>
            </div>
          ) : (
            <BatchExpiryTable
              batches={batches}
              currency={currency}
              onDiscard={(b) => { void handleDiscardBatch(b) }}
              discarding={discarding}
            />
          )
        ) : viewMode === 'suppliers' ? (
          <SupplierWasteTable rows={supplierWaste} currency={currency} />
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500/60" />
            <p className="text-sm font-medium">No expiry risk</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              No variants with expiry dates set will expire within the next {String(windowDays)} days.
              Widening the window or adding expiry dates to variants will surface them here.
            </p>
          </div>
        ) : groupByProduct ? (
          <GroupedExpiryTable
            groups={productGroups}
            currency={currency}
            discarding={discarding}
            batchPending={batchPending}
            onDiscard={(v) => { void handleDiscard(v) }}
          />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Cost / unit</TableHead>
                  <TableHead className="text-right">Value at risk</TableHead>
                  <TableHead className="text-right">Expiry</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="w-28" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {enriched.map((v) => {
                  const band = getBand(v.days)
                  const meta = BAND_META[band]
                  const displayName = v.products?.name
                    ? (v.name !== 'Standard' ? `${v.products.name} — ${v.name}` : v.products.name)
                    : v.name
                  const daysLabel =
                    v.days < 0
                      ? `Expired ${String(Math.abs(v.days))}d ago`
                      : v.days === 0
                        ? 'Expires today'
                        : `${String(v.days)}d`

                  return (
                    <TableRow key={v.id} className={meta.rowBg}>
                      <TableCell className="font-medium text-sm">{displayName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{v.sku}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{v.lot_number ?? '—'}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{v.current_stock}</TableCell>
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {formatCurrency(v.cost, currency)}
                      </TableCell>
                      <TableCell className={cn('text-right tabular-nums font-semibold text-sm', meta.textColor)}>
                        {v.current_stock > 0
                          ? formatCurrency(v.costAtRisk, currency)
                          : <span className="text-muted-foreground font-normal">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground tabular-nums">
                        {fmtDate(v.expiry_date!)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] h-5 px-1.5 font-semibold', meta.badgeCls)}
                        >
                          {daysLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {v.current_stock > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            disabled={discarding.has(v.id) || batchPending}
                            onClick={() => { void handleDiscard(v) }}
                          >
                            {discarding.has(v.id)
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : 'Write off'}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Written off</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
