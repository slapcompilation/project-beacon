// Layer: Floor — Pending Scan Resolution (manager reconciliation surface)
// Floor staff log unresolved barcodes as pending scans rather than blocking their
// workflow. This page surfaces them for managers to link to variants or dismiss.

import { useState, useMemo } from 'react'
import { Search, CheckCircle2, X, Tag, MapPin, AlertTriangle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
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
      <Input
        autoFocus
        placeholder="Search product name or SKU…"
        value={q}
        onChange={(e) => { setQ(e.target.value) }}
      />
      {results.length > 0 && (
        <div className="rounded-lg border divide-y overflow-hidden max-h-48 overflow-y-auto">
          {results.map(({ product, variant }) => (
            <button
              key={variant.id}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
              onClick={() => {
                onSelect(variant.id, `${product.name}${variant.name !== 'Standard' ? ` · ${variant.name}` : ''}`)
              }}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              <div>
                <p className="font-medium">{product.name}</p>
                {variant.name !== 'Standard' && (
                  <p className="text-xs text-muted-foreground">{variant.name}</p>
                )}
                <p className="text-xs text-muted-foreground">SKU {variant.sku}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      <Button variant="ghost" size="sm" onClick={onCancel} className="w-full">
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
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3 text-sm opacity-60">
        <div>
          <code className="text-xs rounded bg-muted px-1">{scan.scanned_code}</code>
          <span className="ml-2 text-muted-foreground">
            {scan.status === 'resolved' ? `→ ${resolvedLabel ?? 'resolved'}` : 'skipped'}
          </span>
        </div>
        <Badge variant="outline" className={cn(scan.status === 'resolved' ? 'text-green-700 border-green-300' : '')}>
          {scan.status}
        </Badge>
      </div>
    )
  }

  return (
    <div className="rounded-lg border px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{scan.scanned_code}</code>
            <Badge variant="destructive" className="text-[10px]">unresolved</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {scan.location_name && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {scan.location_name}
              </span>
            )}
            {scan.approx_quantity && (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                ~{scan.approx_quantity} units approx.
              </span>
            )}
            {scan.notes && <span>"{scan.notes}"</span>}
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
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => { setShowPicker(true) }}
            disabled={resolve.isPending || skip.isPending}
          >
            <Search className="mr-1.5 h-3.5 w-3.5" />
            Link to product
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={handleSkip}
            disabled={skip.isPending || resolve.isPending}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Skip
          </Button>
        </div>
      )}
    </div>
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
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <h1 className="text-xl font-semibold">Floor · Pending Scans</h1>
          {unresolvedCount > 0 && (
            <Badge variant="destructive">{unresolvedCount} unresolved</Badge>
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
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-12 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
          <p className="font-medium">No pending scans</p>
          <p className="text-sm text-muted-foreground">
            All floor scans have been resolved. Well done.
          </p>
        </div>
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
