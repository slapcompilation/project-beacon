// Layer: Floor — Mobile-first stock receiving workflow
// The highest-frequency physical touchpoint in hotel ops.
// Goal: scan or search → select open request → qty → done in 3 taps.
// Palantir principle: actions live next to data; no navigation required mid-task.

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  QrCode, Search, CheckCircle2, Package, ChevronRight,
  ArrowLeft, Loader2, ScanLine, X, TrendingUp, TrendingDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useRestockRequests, useReceiveRestock } from '@/features/restock/hooks'
import { useProducts, useLookupBarcode } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import type { RestockRequestRow } from '@/features/restock/api'

// ─── Step machine ─────────────────────────────────────────────────────────────

type Step =
  | { type: 'search' }
  | { type: 'pick'; matches: RestockRequestRow[] }
  | { type: 'receive'; request: RestockRequestRow }
  | { type: 'done'; productName: string; received: number; newBalance: number; fulfilled: boolean }

// ─── Search step ──────────────────────────────────────────────────────────────

function SearchStep({
  onMatch,
  pendingRequests,
}: {
  onMatch: (matches: RestockRequestRow[]) => void
  pendingRequests: RestockRequestRow[]
}) {
  const [query, setQuery]       = useState('')
  const [barcode, setBarcode]   = useState('')
  const inputRef                = useRef<HTMLInputElement>(null)
  const lookupBarcode           = useLookupBarcode()
  const { data: products = [] } = useProducts()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSearch = (q: string) => {
    if (!q.trim()) return
    const ql = q.toLowerCase()
    const matches = pendingRequests.filter((r) => {
      const productName = (r.product_variants?.products?.name ?? '').toLowerCase()
      const variantName = (r.product_variants?.name ?? '').toLowerCase()
      const sku         = (r.product_variants?.sku ?? '').toLowerCase()
      return productName.includes(ql) || variantName.includes(ql) || sku.includes(ql)
    })
    if (matches.length === 0) {
      toast.error(`No open requests matching "${q}"`)
      return
    }
    onMatch(matches)
  }

  const handleBarcode = async (raw: string) => {
    const bc = raw.trim()
    if (!bc) return
    const hit = await lookupBarcode.mutateAsync(bc)
    setBarcode('')
    if (!hit) { toast.error(`No variant for barcode "${bc}"`); return }
    const matches = pendingRequests.filter((r) => r.variant_id === hit.variantId)
    if (matches.length === 0) {
      // No open request — prompt to check product name
      const product = products.find((p) => p.id === hit.productId)
      toast.error(`No open request for "${product?.name ?? bc}"`)
      return
    }
    onMatch(matches)
  }

  const pendingCount = pendingRequests.length

  return (
    <div className="flex flex-col gap-6">
      {/* Pending count hint */}
      <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground text-center">
        <span className="font-semibold text-foreground tabular-nums">{pendingCount}</span> open restock request{pendingCount !== 1 ? 's' : ''} awaiting delivery
      </div>

      {/* Search by name / SKU */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Search by product or SKU</p>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="e.g. Orange Juice, OJ-500…"
            value={query}
            onChange={(e) => { setQuery(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(query) }}
            className="pl-11 h-14 text-base rounded-xl"
          />
        </div>
        <Button
          className="w-full h-12 text-base rounded-xl"
          onClick={() => { handleSearch(query) }}
          disabled={!query.trim()}
        >
          Find request
        </Button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 border-t" />
        <span className="text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t" />
      </div>

      {/* Barcode scan */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scan barcode</p>
        <div className="relative">
          <ScanLine className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Scan or type barcode…"
            value={barcode}
            onChange={(e) => { setBarcode(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleBarcode(barcode) }}
            className="pl-11 h-14 text-base font-mono rounded-xl"
            disabled={lookupBarcode.isPending}
          />
          {lookupBarcode.isPending && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Recent open requests shortlist */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Or pick from open requests</p>
          <div className="space-y-2">
            {pendingRequests.slice(0, 8).map((r) => {
              const productName = r.product_variants?.products?.name ?? '—'
              const variantName = r.product_variants?.name
              const displayName = variantName && variantName !== 'Standard'
                ? `${productName} — ${variantName}`
                : productName
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onMatch([r]) }}
                  className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
                >
                  <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{r.quantity_needed} units requested{r.supplier ? ` · ${r.supplier}` : ''}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </button>
              )
            })}
            {pendingRequests.length > 8 && (
              <p className="text-xs text-center text-muted-foreground py-1">+{pendingRequests.length - 8} more — use search above</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pick step (multiple matches) ─────────────────────────────────────────────

function PickStep({
  matches,
  onSelect,
  onBack,
}: {
  matches: RestockRequestRow[]
  onSelect: (r: RestockRequestRow) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />Back
      </button>
      <p className="text-sm font-medium">{matches.length} open requests matched — select one:</p>
      <div className="space-y-2">
        {matches.map((r) => {
          const productName = r.product_variants?.products?.name ?? '—'
          const variantName = r.product_variants?.name
          const displayName = variantName && variantName !== 'Standard'
            ? `${productName} — ${variantName}`
            : productName
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => { onSelect(r) }}
              className="w-full flex items-center gap-3 rounded-xl border bg-card p-4 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
            >
              <Package className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.quantity_needed} units · {r.status}
                  {r.supplier ? ` · ${r.supplier}` : ''}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Receive step ─────────────────────────────────────────────────────────────

// ─── Cost variance indicator ──────────────────────────────────────────────────

function CostVarianceIndicator({ actual, expected }: { actual: number; expected: number }) {
  if (expected <= 0) return null
  const pct = ((actual - expected) / expected) * 100
  const absPct = Math.abs(pct)
  const isDiscount = pct < 0

  let color = 'text-green-600 dark:text-green-400'
  let bg    = 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
  if (absPct > 10 && !isDiscount) {
    color = 'text-red-600 dark:text-red-400'
    bg    = 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
  } else if (absPct > 2 && !isDiscount) {
    color = 'text-yellow-600 dark:text-yellow-400'
    bg    = 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800'
  }

  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-xs', bg, color)}>
      {isDiscount
        ? <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
        : <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />}
      <span className="font-semibold">
        {isDiscount ? '−' : '+'}{absPct.toFixed(1)}% vs expected
      </span>
      <span className="text-muted-foreground ml-auto tabular-nums">
        expected ${expected.toFixed(2)} · invoice ${actual.toFixed(2)}
      </span>
    </div>
  )
}

function ReceiveStep({
  request,
  onDone,
  onBack,
}: {
  request: RestockRequestRow
  onDone: (received: number, newBalance: number, fulfilled: boolean) => void
  onBack: () => void
}) {
  const [qty, setQty]           = useState(String(request.quantity_needed))
  const [lot, setLot]           = useState('')
  const [notes, setNotes]       = useState('')
  const [unitCostStr, setUnitCostStr] = useState('')
  const [expiryDate, setExpiryDate]   = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [showExtra, setShowExtra] = useState(false)
  const receive                 = useReceiveRestock()
  const { data: suppliers = [] } = useSuppliers()
  const qtyRef                  = useRef<HTMLInputElement>(null)

  const productName = request.product_variants?.products?.name ?? '—'
  const variantName = request.product_variants?.name
  const displayName = variantName && variantName !== 'Standard'
    ? `${productName} — ${variantName}`
    : productName
  // Prefer PO line unit_cost (the agreed price) over the product baseline cost
  const poLineCost   = request.purchase_order_lines?.[0]?.unit_cost ?? null
  const expectedCost = poLineCost ?? request.product_variants?.cost ?? null

  useEffect(() => {
    qtyRef.current?.select()
  }, [])

  const parsedUnitCost = unitCostStr ? parseFloat(unitCostStr) : null

  const handleSubmit = async () => {
    const n = parseInt(qty, 10)
    if (isNaN(n) || n <= 0) { toast.error('Enter a valid quantity'); return }
    const result = await receive.mutateAsync({
      requestId: request.id,
      quantityReceived: n,
      lotNumber: lot || null,
      notes: notes || null,
      unitCost: parsedUnitCost && !isNaN(parsedUnitCost) && parsedUnitCost > 0 ? parsedUnitCost : null,
      expiryDate: expiryDate || null,
      supplierId: selectedSupplierId || null,
    })
    onDone(n, result.newBalance, result.fulfilled)
  }

  const parsedQty = parseInt(qty, 10)
  const isPartial = !isNaN(parsedQty) && parsedQty < request.quantity_needed
  const isOver    = !isNaN(parsedQty) && parsedQty > request.quantity_needed

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />Back
      </button>

      {/* Product card */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-start gap-3">
          <Package className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-base leading-snug">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {request.quantity_needed} units requested
              {request.supplier ? ` · ${request.supplier}` : ''}
              {expectedCost !== null && expectedCost > 0
                ? ` · expected $${expectedCost.toFixed(2)}/unit${poLineCost ? ' (PO)' : ''}`
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Qty input — large tap target */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quantity received
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => { setQty((v) => String(Math.max(1, (parseInt(v, 10) || 0) - 1))) }}
            className="h-14 w-14 rounded-xl border bg-muted text-2xl font-bold flex items-center justify-center hover:bg-muted/70 active:scale-95 transition-all flex-shrink-0"
          >−</button>
          <input
            ref={qtyRef}
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => { setQty(e.target.value) }}
            className="flex-1 h-14 rounded-xl border bg-background text-center text-3xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={() => { setQty((v) => String((parseInt(v, 10) || 0) + 1)) }}
            className="h-14 w-14 rounded-xl border bg-muted text-2xl font-bold flex items-center justify-center hover:bg-muted/70 active:scale-95 transition-all flex-shrink-0"
          >+</button>
        </div>
        {isPartial && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center">
            Partial receive — {request.quantity_needed - parsedQty} units still outstanding
          </p>
        )}
        {isOver && (
          <p className="text-xs text-blue-600 dark:text-blue-400 text-center">
            Over-receive by {parsedQty - request.quantity_needed} units
          </p>
        )}
      </div>

      {/* Lot / Notes / Invoice cost (collapsed by default) */}
      <button
        type="button"
        onClick={() => { setShowExtra((v) => !v) }}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
      >
        {showExtra ? <X className="h-3 w-3" /> : <QrCode className="h-3 w-3" />}
        {showExtra ? 'Hide' : 'Add lot number / invoice cost / notes'}
      </button>

      {showExtra && (
        <div className="space-y-3">
          {suppliers.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Supplier</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => { setSelectedSupplierId(e.target.value) }}
                className="h-12 w-full rounded-xl border bg-background px-3 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                <option value="">No supplier selected</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
          <Input
            placeholder="Lot / batch number (optional)"
            value={lot}
            onChange={(e) => { setLot(e.target.value) }}
            className="h-12 rounded-xl text-base"
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Expiry date (optional)</label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => { setExpiryDate(e.target.value) }}
              className="h-12 rounded-xl text-base"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Invoice unit cost (optional)
              {expectedCost !== null && expectedCost > 0 && (
                <span className="ml-1 font-normal">· expected ${expectedCost.toFixed(2)}</span>
              )}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-base font-medium">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={unitCostStr}
                onChange={(e) => { setUnitCostStr(e.target.value) }}
                className="h-12 rounded-xl text-base pl-8"
              />
            </div>
          </div>
          {parsedUnitCost !== null && !isNaN(parsedUnitCost) && parsedUnitCost > 0 && expectedCost !== null && expectedCost > 0 && (
            <CostVarianceIndicator actual={parsedUnitCost} expected={expectedCost} />
          )}
          <Input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => { setNotes(e.target.value) }}
            className="h-12 rounded-xl text-base"
          />
        </div>
      )}

      {/* Submit */}
      <Button
        className="w-full h-14 text-base font-semibold rounded-xl"
        onClick={() => { void handleSubmit() }}
        disabled={receive.isPending || !qty || parseInt(qty, 10) <= 0}
      >
        {receive.isPending
          ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Recording…</>
          : <>Confirm receive · {qty || '0'} units</>}
      </Button>
    </div>
  )
}

// ─── Done step ────────────────────────────────────────────────────────────────

function DoneStep({
  productName,
  received,
  newBalance,
  fulfilled,
  remainingRequests,
  onAnother,
  onSelectNext,
}: {
  productName: string
  received: number
  newBalance: number
  fulfilled: boolean
  remainingRequests: RestockRequestRow[]
  onAnother: () => void
  onSelectNext: (r: RestockRequestRow) => void
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <div className={cn(
        'flex h-20 w-20 items-center justify-center rounded-full',
        fulfilled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
      )}>
        <CheckCircle2 className={cn('h-10 w-10', fulfilled ? 'text-green-600' : 'text-blue-600')} />
      </div>

      <div>
        <p className="text-xl font-bold">
          {fulfilled ? 'Fully received!' : 'Partial receive recorded'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{productName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-green-600">+{received}</p>
          <p className="text-xs text-muted-foreground mt-1">units received</p>
        </div>
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-2xl font-bold tabular-nums">{newBalance}</p>
          <p className="text-xs text-muted-foreground mt-1">new balance</p>
        </div>
      </div>

      {!fulfilled && (
        <p className="text-xs text-muted-foreground max-w-xs">
          The request remains open for the remaining units.
        </p>
      )}

      {/* Next up — remaining requests for fast serial receiving */}
      {remainingRequests.length > 0 && (
        <div className="w-full max-w-sm space-y-2 text-left">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center">
            Next up — {remainingRequests.length} remaining
          </p>
          {remainingRequests.slice(0, 4).map((r) => {
            const pName = r.product_variants?.products?.name ?? '—'
            const vName = r.product_variants?.name
            const label = vName && vName !== 'Standard' ? `${pName} — ${vName}` : pName
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { onSelectNext(r) }}
                className="w-full flex items-center gap-3 rounded-xl border bg-card p-3.5 text-left hover:bg-muted/40 active:bg-muted/60 transition-colors"
              >
                <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{label}</p>
                  <p className="text-xs text-muted-foreground">{r.quantity_needed} units</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            )
          })}
          {remainingRequests.length > 4 && (
            <p className="text-xs text-center text-muted-foreground py-1">+{remainingRequests.length - 4} more</p>
          )}
        </div>
      )}

      <Button variant="outline" className="w-full h-12 rounded-xl text-base" onClick={onAnother}>
        Search all requests
      </Button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReceivePage() {
  const { data: requests = [], isLoading } = useRestockRequests()
  const [step, setStep] = useState<Step>({ type: 'search' })
  const [params, setParams] = useSearchParams()

  const pendingRequests = useMemo(
    () => requests.filter((r) => r.status === 'pending' || r.status === 'approved'),
    [requests]
  )

  // Deep-link: ?request=<id> jumps directly to receive step for that request.
  // Used by DeliveryQueuePage to pre-select a specific PO line.
  useEffect(() => {
    const requestId = params.get('request')
    if (!requestId || isLoading) return
    const match = pendingRequests.find((r) => r.id === requestId)
    if (match) {
      setStep({ type: 'receive', request: match })
      setParams({}, { replace: true })   // clean the URL
    }
  }, [params, pendingRequests, isLoading, setParams])

  const reset = () => { setStep({ type: 'search' }) }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (pendingRequests.length === 0 && step.type === 'search') {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 md:px-8 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-none">Receive Stock</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Floor · receiving workflow</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 py-20 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Package className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <div>
            <p className="font-semibold text-base">No pending deliveries</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              All restock requests have been fulfilled or no requests exist yet.
              Create a restock request first, then come back here to receive it.
            </p>
          </div>
          <Button variant="outline" className="mt-2" onClick={() => { window.location.href = '/restocks' }}>
            Go to Restocks
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 md:px-8 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
            <Package className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-none">Receive Stock</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Floor · receiving workflow</p>
          </div>
        </div>

        {/* Progress indicator — 3 visible stages (pick is an inline branch, not a stage) */}
        <div className="flex items-center gap-1 mt-3">
          {(['search', 'receive', 'done'] as const).map((s) => {
            const isActive = step.type === s || (s === 'receive' && step.type === 'pick')
            const isDone   = (s === 'search' && ['pick','receive','done'].includes(step.type)) ||
                             (s === 'receive' && step.type === 'done')
            return (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  isActive ? 'bg-primary' : isDone ? 'bg-primary/40' : 'bg-muted',
                )}
              />
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {step.type === 'search' && (
          <SearchStep
            pendingRequests={pendingRequests}
            onMatch={(matches) => {
              if (matches.length === 1 && matches[0]) {
                setStep({ type: 'receive', request: matches[0] })
              } else {
                setStep({ type: 'pick', matches })
              }
            }}
          />
        )}

        {step.type === 'pick' && (
          <PickStep
            matches={step.matches}
            onSelect={(r) => { setStep({ type: 'receive', request: r }) }}
            onBack={reset}
          />
        )}

        {step.type === 'receive' && (
          <ReceiveStep
            request={step.request}
            onBack={() => { setStep({ type: 'search' }) }}
            onDone={(received, newBalance, fulfilled) => {
              const productName = step.request.product_variants?.products?.name ?? 'Product'
              const variantName = step.request.product_variants?.name
              const displayName = variantName && variantName !== 'Standard'
                ? `${productName} — ${variantName}`
                : productName
              setStep({ type: 'done', productName: displayName, received, newBalance, fulfilled })
            }}
          />
        )}

        {step.type === 'done' && (
          <DoneStep
            productName={step.productName}
            received={step.received}
            newBalance={step.newBalance}
            fulfilled={step.fulfilled}
            remainingRequests={pendingRequests}
            onAnother={reset}
            onSelectNext={(r) => { setStep({ type: 'receive', request: r }) }}
          />
        )}
      </div>
    </div>
  )
}
