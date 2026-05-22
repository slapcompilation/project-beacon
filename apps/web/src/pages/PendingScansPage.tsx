// Layer: Floor — Pending Scan Resolution (manager reconciliation surface)
// Floor staff log unresolved barcodes as pending scans rather than blocking their
// workflow. This page surfaces them for managers to link to variants or dismiss.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Button,
  Card,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  Tag,
} from '@blueprintjs/core'
import { usePendingScans, useResolvePendingScan, useSkipPendingScan } from '@/features/floor/hooks'
import { useProducts } from '@/features/inventory/hooks'
import type { PendingScan, ProductWithVariants, ProductVariant } from '@beacon/types'

// ─── Variant picker for resolving a ghost entry ────────────────────────────────

function VariantPicker({
  products,
  onSelect,
  onCancel,
}: {
  products: ProductWithVariants[]
  onSelect: (variantId: string, variantLabel: string) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')

  const results = useMemo(() => {
    if (q.trim().length < 2) return []
    const lower = q.toLowerCase()
    const out: { product: ProductWithVariants; variant: ProductVariant }[] = []
    for (const p of products) {
      for (const v of p.product_variants) {
        if (
          p.name.toLowerCase().includes(lower) ||
          v.name.toLowerCase().includes(lower) ||
          v.sku.toLowerCase().includes(lower) ||
          (v.barcode ?? '').toLowerCase().includes(lower)
        ) {
          out.push({ product: p, variant: v })
        }
      }
    }
    return out.slice(0, 10)
  }, [products, q])

  return (
    <div className="mt-3 space-y-2">
      <InputGroup
        autoFocus
        leftIcon="search"
        placeholder="Search product name or SKU…"
        value={q}
        onChange={(e) => { setQ(e.target.value) }}
      />
      {results.length > 0 && (
        <Card compact className="!p-0 divide-y overflow-hidden max-h-48 overflow-y-auto">
          {results.map(({ product, variant }) => (
            <button
              key={variant.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              onClick={() => {
                onSelect(variant.id, `${product.name}${variant.name !== 'Standard' ? ` · ${variant.name}` : ''}`)
              }}
            >
              <Icon icon="tick-circle" size={14} intent={Intent.SUCCESS} className="shrink-0" />
              <div>
                <p className="font-medium">{product.name}</p>
                {variant.name !== 'Standard' && (
                  <p className="text-xs text-muted-foreground">{variant.name}</p>
                )}
                <p className="text-xs text-muted-foreground">SKU {variant.sku}</p>
              </div>
            </button>
          ))}
        </Card>
      )}
      <Button variant="minimal" onClick={onCancel} fill>
        Cancel
      </Button>
    </div>
  )
}

// ─── Single pending scan row ───────────────────────────────────────────────────

function PendingScanRow({
  scan,
  products,
}: {
  scan: PendingScan
  products: ProductWithVariants[]
}) {
  const [showPicker, setShowPicker] = useState(false)
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null)
  const resolve = useResolvePendingScan()
  const skip = useSkipPendingScan()

  const handleResolve = (variantId: string, label: string) => {
    void resolve.mutateAsync({ scanId: scan.id, variantId, updateBarcode: true })
    setResolvedLabel(label)
    setShowPicker(false)
  }

  const handleSkip = () => {
    void skip.mutateAsync(scan.id)
  }

  if (scan.status !== 'unresolved') {
    return (
      <Card compact className="!bg-muted/30 opacity-60">
        <div className="flex items-center justify-between text-sm">
          <div>
            <code className="text-xs rounded bg-muted px-1">{scan.scanned_code}</code>
            <span className="ml-2 text-muted-foreground">
              {scan.status === 'resolved' ? `→ ${resolvedLabel ?? 'resolved'}` : 'skipped'}
            </span>
          </div>
          <Tag minimal intent={scan.status === 'resolved' ? Intent.SUCCESS : Intent.NONE}>
            {scan.status}
          </Tag>
        </div>
      </Card>
    )
  }

  return (
    <Card compact>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{scan.scanned_code}</code>
            <Tag minimal intent={Intent.DANGER}>unresolved</Tag>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {scan.location_name && (
              <span className="flex items-center gap-1">
                <Icon icon="map-marker" size={12} />
                {scan.location_name}
              </span>
            )}
            {scan.approx_quantity && (
              <span className="flex items-center gap-1">
                <Icon icon="tag" size={12} />
                ~{scan.approx_quantity} units approx.
              </span>
            )}
            {scan.notes && <span>&quot;{scan.notes}&quot;</span>}
            <span>{formatDistanceToNow(new Date(scan.created_at), { addSuffix: true })}</span>
            {scan.created_by_email && <span>by {scan.created_by_email}</span>}
          </div>
        </div>
      </div>

      {showPicker ? (
        <VariantPicker
          products={products}
          onSelect={handleResolve}
          onCancel={() => { setShowPicker(false) }}
        />
      ) : (
        <div className="flex gap-2">
          <Button
            icon="search"
            fill
            onClick={() => { setShowPicker(true) }}
            disabled={resolve.isPending || skip.isPending}
          >
            Link to product
          </Button>
          <Button
            icon="cross"
            variant="minimal"
            onClick={handleSkip}
            disabled={skip.isPending || resolve.isPending}
          >
            Skip
          </Button>
        </div>
      )}
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PendingScansPage() {
  const { data: scans = [], isLoading } = usePendingScans()
  const { data: products = [] } = useProducts()

  const unresolvedCount = scans.filter((s) => s.status === 'unresolved').length

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Icon icon="warning-sign" size={18} intent={Intent.WARNING} />
          <h1 className="text-xl font-semibold">Floor · Pending Scans</h1>
          {unresolvedCount > 0 && (
            <Tag intent={Intent.DANGER}>{String(unresolvedCount)} unresolved</Tag>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Barcodes scanned by floor staff that didn&apos;t match any product. Link them to the correct variant or skip.
          When you link a scan, the barcode is written back onto the variant for automatic resolution next time.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          Loading…
        </div>
      )}

      {!isLoading && scans.length === 0 && (
        <NonIdealState
          icon="tick-circle"
          title="No pending scans"
          description="All floor scans have been resolved. Well done."
        />
      )}

      {!isLoading && scans.length > 0 && (
        <div className="space-y-3">
          {scans.map((scan) => (
            <PendingScanRow key={scan.id} scan={scan} products={products} />
          ))}
        </div>
      )}
    </div>
  )
}
