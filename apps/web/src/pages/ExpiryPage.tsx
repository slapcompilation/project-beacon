// Layer: Eye — Expiry risk management
// Palantir principle: every number carries its derived context.
// Show cost-at-risk, not just counts. Decisions live next to data.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Button,
  HTMLTable,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useExpiringVariants, useAdjustStock, useExpiryBatches, useDiscardBatch } from '@/features/inventory/hooks'
import { useSupplierWasteAnalytics } from '@/features/eye/hooks'
import { formatCurrency } from '@/lib/currency'
import { AipSignalsProvider } from '@/features/aipSignals/AipSignalsProvider'
import { AipRowBadge } from '@/features/aipSignals/AipRowBadge'
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
  /** Per-row tint preserved as Tailwind — Blueprint Tag intent handles the chip,
   * but row backgrounds need to stay subtle and themed across light/dark. */
  rowBg: string
  /** For inline number coloring inside grouped row headers. */
  textColor: string
  /** Tag config — these are the Blueprint chips per band. */
  tagIntent: Intent
  tagMinimal: boolean
}> = {
  expired:  {
    label: 'Expired',
    rowBg: 'bg-red-50/70 dark:bg-red-950/25',
    textColor: 'text-red-700 dark:text-red-400',
    tagIntent: Intent.DANGER,
    tagMinimal: false,
  },
  critical: {
    label: '≤ 7 days',
    rowBg: 'bg-orange-50/60 dark:bg-orange-950/20',
    textColor: 'text-orange-700 dark:text-orange-400',
    tagIntent: Intent.WARNING,
    tagMinimal: false,
  },
  warning:  {
    label: '≤ 30 days',
    rowBg: 'bg-yellow-50/50 dark:bg-yellow-950/15',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    tagIntent: Intent.WARNING,
    tagMinimal: true,
  },
  upcoming: {
    label: '≤ 90 days',
    rowBg: '',
    textColor: 'text-muted-foreground',
    tagIntent: Intent.NONE,
    tagMinimal: true,
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
          <Icon icon="warning-sign" size={14} />
          <span className="font-semibold tabular-nums">{formatCurrency(expiredValue, currency)}</span>
          <span className="text-xs text-muted-foreground">already expired</span>
        </span>
      )}
      {criticalValue > 0 && (
        <span className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
          <Icon icon="trending-down" size={14} />
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
    <HTMLTable compact striped interactive className="w-full">
      <thead>
        <tr>
          <th>Product / Lot</th>
          <th>SKU</th>
          <th className="text-right">Qty</th>
          <th className="text-right">Unit cost</th>
          <th className="text-right">Value at risk</th>
          <th className="text-right">Expiry</th>
          <th className="text-right">Status</th>
          <th className="w-24" />
        </tr>
      </thead>
      <tbody>
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
            <tr key={b.batch_id} className={meta.rowBg}>
              <td>
                <p className="text-sm font-medium">
                  <Link to={`/variant/${b.variant_id}`} className="hover:underline">{b.product_name}</Link>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {b.variant_name !== 'Standard' ? `${b.variant_name} · ` : ''}
                  {b.lot_number ? `Lot ${b.lot_number}` : 'No lot number'}
                  {b.category_name ? ` · ${b.category_name}` : ''}
                </p>
              </td>
              <td className="font-mono text-xs text-muted-foreground">{b.sku}</td>
              <td className="text-right tabular-nums font-semibold">{b.quantity}</td>
              <td className="text-right tabular-nums text-sm text-muted-foreground">
                {formatCurrency(b.unit_cost, currency)}
              </td>
              <td className={cn('text-right tabular-nums font-semibold text-sm', meta.textColor)}>
                {b.quantity > 0 ? formatCurrency(b.cost_at_risk, currency) : '—'}
              </td>
              <td className="text-right text-sm text-muted-foreground tabular-nums">
                {fmtDate(b.expiry_date)}
              </td>
              <td className="text-right">
                <Tag intent={meta.tagIntent} minimal={meta.tagMinimal}>{daysLabel}</Tag>
              </td>
              <td className="text-right">
                {b.quantity > 0 ? (
                  <Button
                    variant="minimal"
                    size="small"
                    intent={Intent.DANGER}
                    loading={discarding.has(b.batch_id)}
                    onClick={() => { onDiscard(b) }}
                  >
                    Write off
                  </Button>
                ) : (
                  <span className="text-[10px] text-muted-foreground">Written off</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </HTMLTable>
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
      <NonIdealState
        icon="tick-circle"
        title="No supplier waste data"
        description="Waste analytics appear once you link deliveries to suppliers when receiving stock. As batches are written off, waste rates will be computed per supplier."
      />
    )
  }
  return (
    <HTMLTable compact striped interactive className="w-full">
      <thead>
        <tr>
          <th>Supplier</th>
          <th className="text-right">Batches received</th>
          <th className="text-right">Batches wasted</th>
          <th className="text-right">Waste rate</th>
          <th className="text-right">Units wasted</th>
          <th className="text-right">Cost wasted</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const rate = r.waste_rate_pct ?? 0
          const rateCls =
            rate >= 20 ? 'text-red-700 dark:text-red-400' :
            rate >= 10 ? 'text-orange-700 dark:text-orange-400' :
            'text-muted-foreground'
          return (
            <tr key={r.supplier_id}>
              <td className="font-medium text-sm">{r.supplier_name}</td>
              <td className="text-right tabular-nums">{r.batches_received}</td>
              <td className="text-right tabular-nums">{r.batches_wasted}</td>
              <td className={cn('text-right tabular-nums font-semibold', rateCls)}>
                {rate.toFixed(1)}%
              </td>
              <td className="text-right tabular-nums text-muted-foreground">{r.units_wasted}</td>
              <td className="text-right tabular-nums font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(r.cost_wasted, currency)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </HTMLTable>
  )
}

// ─── Window options ────────────────────────────────────────────────────────────

const WINDOWS = [
  { label: '7d',  days: 7  },
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
    <AipSignalsProvider variantIds={groups.flatMap((g) => g.variants.map((v) => v.id))}>
    <div className="rounded border overflow-hidden divide-y">
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
              <Icon icon={isOpen ? 'chevron-down' : 'chevron-right'} size={14} className="text-muted-foreground flex-shrink-0" />
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
                  <AipRowBadge variantIds={[v.id]} />
                  <span className="text-xs text-muted-foreground font-mono">{v.sku}</span>
                  <span className="text-xs tabular-nums w-16 text-right">{v.current_stock} units</span>
                  <span className={cn('text-xs font-semibold tabular-nums w-20 text-right', vm.textColor)}>
                    {v.current_stock > 0 ? formatCurrency(v.costAtRisk, currency) : '—'}
                  </span>
                  {(band === 'warning' || band === 'critical') && v.current_stock > 0 && (
                    <span className="text-[10px] text-muted-foreground italic">use first</span>
                  )}
                  <div className="w-28 flex justify-center">
                    <Tag intent={vm.tagIntent} minimal={vm.tagMinimal}>{daysLabel}</Tag>
                  </div>
                  <div className="w-20 text-right">
                    {v.current_stock > 0 ? (
                      <Button
                        variant="minimal"
                        size="small"
                        intent={Intent.DANGER}
                        loading={discarding.has(v.id)}
                        disabled={batchPending}
                        onClick={() => { onDiscard(v); }}
                      >
                        Write off
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
    </AipSignalsProvider>
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
        days: daysUntil(v.expiry_date ?? ''),
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
      const existing = map.get(key)
      if (existing) existing.push(v)
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
        category: 'Spoilage',
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
            category: 'Spoilage',
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
  const actionableCount = actionable.filter((v) => v.current_stock > 0).length

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
          {/* View mode toggle — Batches / Variants / Suppliers */}
          <SegmentedControl
            size="small"
            value={viewMode}
            onValueChange={(v) => { setViewMode(v as ViewMode) }}
            options={[
              {
                value: 'batches',
                label: batches.length > 0
                  ? `By Batch (${String(batches.length)})`
                  : 'By Batch',
              },
              { value: 'variants',  label: 'By Variant' },
              { value: 'suppliers', label: 'By Supplier' },
            ]}
          />
          {/* Group toggle (variant view only) */}
          {viewMode === 'variants' && (
            <Button
              size="small"
              icon="layers"
              active={groupByProduct}
              onClick={() => { setGroupByProduct((v) => !v) }}
            >
              Group by product
            </Button>
          )}
          {/* Window toggle */}
          <SegmentedControl
            size="small"
            value={String(windowDays)}
            onValueChange={(v) => { setWindowDays(parseInt(v, 10) as 7 | 30 | 90) }}
            options={WINDOWS.map((w) => ({ value: String(w.days), label: w.label }))}
          />
          {/* Batch write-off */}
          {actionableCount > 0 && (
            <Button
              intent={Intent.DANGER}
              size="small"
              icon="warning-sign"
              loading={batchPending}
              onClick={() => { void handleBatchDiscard() }}
            >
              Write off {actionableCount} expired / critical
            </Button>
          )}
        </div>
      </div>

      {/* Cost-at-risk strip */}
      {!isLoading && <RiskStrip variants={enriched} currency={currency} />}

      {/* Table */}
      <div className="flex-1 overflow-auto px-8 py-5">
        {(isLoading || batchLoading || supplierLoading) ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </div>
        ) : viewMode === 'batches' ? (
          batches.length === 0 ? (
            <NonIdealState
              icon="tick-circle"
              title="No batch expiry data"
              description="Batch tracking activates when you enter an expiry date while receiving stock. Future deliveries with expiry dates will appear here as individual lots."
            />
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
          <NonIdealState
            icon="tick-circle"
            title="No expiry risk"
            description={`No variants with expiry dates set will expire within the next ${String(windowDays)} days. Widening the window or adding expiry dates to variants will surface them here.`}
          />
        ) : groupByProduct ? (
          <GroupedExpiryTable
            groups={productGroups}
            currency={currency}
            discarding={discarding}
            batchPending={batchPending}
            onDiscard={(v) => { void handleDiscard(v) }}
          />
        ) : (
          <HTMLTable compact striped interactive className="w-full">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Lot</th>
                <th className="text-right">Stock</th>
                <th className="text-right">Cost / unit</th>
                <th className="text-right">Value at risk</th>
                <th className="text-right">Expiry</th>
                <th className="text-right">Status</th>
                <th className="w-28" />
              </tr>
            </thead>
            <tbody>
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
                  <tr key={v.id} className={meta.rowBg}>
                    <td className="font-medium text-sm">
                      <Link to={`/variant/${v.id}`} className="hover:underline">{displayName}</Link>
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">{v.sku}</td>
                    <td className="text-xs text-muted-foreground">{v.lot_number ?? '—'}</td>
                    <td className="text-right tabular-nums font-semibold">{v.current_stock}</td>
                    <td className="text-right tabular-nums text-sm text-muted-foreground">
                      {formatCurrency(v.cost, currency)}
                    </td>
                    <td className={cn('text-right tabular-nums font-semibold text-sm', meta.textColor)}>
                      {v.current_stock > 0
                        ? formatCurrency(v.costAtRisk, currency)
                        : <span className="text-muted-foreground font-normal">—</span>}
                    </td>
                    <td className="text-right text-sm text-muted-foreground tabular-nums">
                      {fmtDate(v.expiry_date)}
                    </td>
                    <td className="text-right">
                      <Tag intent={meta.tagIntent} minimal={meta.tagMinimal}>{daysLabel}</Tag>
                    </td>
                    <td className="text-right">
                      {v.current_stock > 0 ? (
                        <Button
                          variant="minimal"
                          size="small"
                          intent={Intent.DANGER}
                          loading={discarding.has(v.id)}
                          disabled={batchPending}
                          onClick={() => { void handleDiscard(v) }}
                        >
                          Write off
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">Written off</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </HTMLTable>
        )}
      </div>
    </div>
  )
}
