// Layer: Floor — Mobile-first stock receiving workflow
// The highest-frequency physical touchpoint in hotel ops.
// Goal: scan or search → select open request → qty → done in 3 taps.
// Palantir principle: actions live next to data; no navigation required mid-task.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useRef, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Button,
  Callout,
  Card,
  HTMLSelect,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useRestockRequests, useReceiveRestock } from '@/features/restock/hooks'
import { useProducts, useLookupBarcode } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import type { RestockRequestRow } from '@/features/restock/api'
import { AipSignalsProvider } from '@/features/aipSignals/AipSignalsProvider'
import { AipRowBadge } from '@/features/aipSignals/AipRowBadge'

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
      <Callout intent={Intent.NONE} className="text-center">
        <span className="font-semibold text-foreground tabular-nums">{pendingCount}</span> open restock request{pendingCount !== 1 ? 's' : ''} awaiting delivery
      </Callout>

      {/* Search by name / SKU */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Search by product or SKU</p>
        <InputGroup
          inputRef={inputRef}
          leftIcon="search"
          placeholder="e.g. Orange Juice, OJ-500…"
          value={query}
          onChange={(e) => { setQuery(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(query) }}
          size="large"
        />
        <Button
          fill
          size="large"
          intent={Intent.PRIMARY}
          disabled={!query.trim()}
          onClick={() => { handleSearch(query) }}
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
        <InputGroup
          leftIcon="barcode"
          rightElement={lookupBarcode.isPending ? <Spinner size={14} intent={Intent.PRIMARY} /> : undefined}
          placeholder="Scan or type barcode…"
          value={barcode}
          onChange={(e) => { setBarcode(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleBarcode(barcode) }}
          disabled={lookupBarcode.isPending}
          size="large"
          className="[&_input]:!font-mono"
        />
      </div>

      {/* Recent open requests shortlist */}
      {pendingRequests.length > 0 && (
        <AipSignalsProvider variantIds={pendingRequests.slice(0, 8).map((r) => r.variant_id).filter(Boolean)}>
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
                  <Icon icon="box" size={16} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground tabular-nums">{r.quantity_needed} units requested{r.supplier ? ` · ${r.supplier}` : ''}</p>
                      <AipRowBadge variantIds={r.variant_id ? [r.variant_id] : []} />
                    </div>
                  </div>
                  <Icon icon="chevron-right" size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
              )
            })}
            {pendingRequests.length > 8 && (
              <p className="text-xs text-center text-muted-foreground py-1">+{pendingRequests.length - 8} more — use search above</p>
            )}
          </div>
        </div>
        </AipSignalsProvider>
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
      <Button variant="minimal" size="small" icon="arrow-left" onClick={onBack}>
        Back
      </Button>
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
              <Icon icon="box" size={16} className="text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {r.quantity_needed} units · {r.status}
                  {r.supplier ? ` · ${r.supplier}` : ''}
                </p>
              </div>
              <Icon icon="chevron-right" size={14} className="text-muted-foreground flex-shrink-0" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Cost variance indicator ──────────────────────────────────────────────────

function CostVarianceIndicator({ actual, expected }: { actual: number; expected: number }) {
  if (expected <= 0) return null
  const pct = ((actual - expected) / expected) * 100
  const absPct = Math.abs(pct)
  const isDiscount = pct < 0

  let intent: Intent = Intent.SUCCESS
  if (absPct > 10 && !isDiscount)       intent = Intent.DANGER
  else if (absPct > 2 && !isDiscount)   intent = Intent.WARNING

  return (
    <Callout intent={intent} icon={isDiscount ? 'trending-down' : 'trending-up'} compact>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold">
          {isDiscount ? '−' : '+'}{absPct.toFixed(1)}% vs expected
        </span>
        <span className="text-muted-foreground ml-auto tabular-nums">
          expected ${expected.toFixed(2)} · invoice ${actual.toFixed(2)}
        </span>
      </div>
    </Callout>
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
      <Button variant="minimal" size="small" icon="arrow-left" onClick={onBack}>
        Back
      </Button>

      {/* Product card */}
      <Card className="!p-4">
        <div className="flex items-start gap-3">
          <Icon icon="box" size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
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
      </Card>

      {/* Qty input — large tap target */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Quantity received
        </label>
        <div className="flex items-center gap-3">
          <Button
            size="large"
            className="!h-14 !w-14 !text-2xl !font-bold !flex-shrink-0 !rounded-xl"
            onClick={() => { setQty((v) => String(Math.max(1, (parseInt(v, 10) || 0) - 1))) }}
          >−</Button>
          <input
            ref={qtyRef}
            type="number"
            min="1"
            step="1"
            value={qty}
            onChange={(e) => { setQty(e.target.value) }}
            className="flex-1 h-14 rounded-xl border bg-background text-center text-3xl font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button
            size="large"
            className="!h-14 !w-14 !text-2xl !font-bold !flex-shrink-0 !rounded-xl"
            onClick={() => { setQty((v) => String((parseInt(v, 10) || 0) + 1)) }}
          >+</Button>
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
      <Button
        variant="minimal"
        size="small"
        icon={showExtra ? 'cross' : 'plus'}
        onClick={() => { setShowExtra((v) => !v) }}
      >
        {showExtra ? 'Hide' : 'Add lot number / invoice cost / notes'}
      </Button>

      {showExtra && (
        <div className="space-y-3">
          {suppliers.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Supplier</label>
              <HTMLSelect
                value={selectedSupplierId}
                onChange={(e) => { setSelectedSupplierId(e.target.value) }}
                options={[
                  { value: '', label: 'No supplier selected' },
                  ...suppliers.map((s) => ({ value: s.id, label: s.name })),
                ]}
                fill
                large
              />
            </div>
          )}
          <InputGroup
            placeholder="Lot / batch number (optional)"
            value={lot}
            onChange={(e) => { setLot(e.target.value) }}
            size="large"
          />
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Expiry date (optional)</label>
            <InputGroup
              type="date"
              value={expiryDate}
              onChange={(e) => { setExpiryDate(e.target.value) }}
              size="large"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Invoice unit cost (optional)
              {expectedCost !== null && expectedCost > 0 && (
                <span className="ml-1 font-normal">· expected ${expectedCost.toFixed(2)}</span>
              )}
            </label>
            <InputGroup
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              leftIcon="dollar"
              value={unitCostStr}
              onChange={(e) => { setUnitCostStr(e.target.value) }}
              size="large"
            />
          </div>
          {parsedUnitCost !== null && !isNaN(parsedUnitCost) && parsedUnitCost > 0 && expectedCost !== null && expectedCost > 0 && (
            <CostVarianceIndicator actual={parsedUnitCost} expected={expectedCost} />
          )}
          <InputGroup
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => { setNotes(e.target.value) }}
            size="large"
          />
        </div>
      )}

      {/* Submit */}
      <Button
        fill
        size="large"
        intent={Intent.PRIMARY}
        icon="tick-circle"
        loading={receive.isPending}
        disabled={!qty || parseInt(qty, 10) <= 0}
        onClick={() => { void handleSubmit() }}
        className="!h-14 !text-base !font-semibold !rounded-xl"
      >
        Confirm receive · {qty || '0'} units
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
        <Icon icon="tick-circle" size={40} className={fulfilled ? 'text-green-600' : 'text-blue-600'} />
      </div>

      <div>
        <p className="text-xl font-bold">
          {fulfilled ? 'Fully received!' : 'Partial receive recorded'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">{productName}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold tabular-nums text-green-600">+{received}</p>
          <p className="text-xs text-muted-foreground mt-1">units received</p>
        </Card>
        <Card className="!p-4 text-center">
          <p className="text-2xl font-bold tabular-nums">{newBalance}</p>
          <p className="text-xs text-muted-foreground mt-1">new balance</p>
        </Card>
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
                <Icon icon="box" size={14} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{label}</p>
                  <p className="text-xs text-muted-foreground">{r.quantity_needed} units</p>
                </div>
                <Icon icon="chevron-right" size={14} className="text-muted-foreground flex-shrink-0" />
              </button>
            )
          })}
          {remainingRequests.length > 4 && (
            <p className="text-xs text-center text-muted-foreground py-1">+{remainingRequests.length - 4} more</p>
          )}
        </div>
      )}

      <Button fill size="large" variant="outlined" onClick={onAnother} className="!h-12 !rounded-xl !text-base">
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
        <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
      </div>
    )
  }

  if (pendingRequests.length === 0 && step.type === 'search') {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 md:px-8 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Icon icon="box" size={16} className="text-green-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-none">Receive Stock</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Floor · receiving workflow</p>
            </div>
          </div>
        </div>
        <NonIdealState
          icon="box"
          title="No pending deliveries"
          description="All restock requests have been fulfilled or no requests exist yet. Create a restock request first, then come back here to receive it."
          action={
            <Button variant="outlined" onClick={() => { window.location.href = '/restocks' }}>
              Go to Restocks
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-4 md:px-8 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
            <Icon icon="box" size={16} className="text-green-600" />
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
