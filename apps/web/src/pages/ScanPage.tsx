// Layer: Floor — high-cadence barcode scan + quick adjustment
// Phase 6 Floor perfection:
//   - Session history strip (last N scans, in-memory)
//   - Auto-advance back to scan after success (2.5 s countdown)
//   - Name-based product search fallback when SKU not found
//   - Keyboard: Enter submits, Escape resets

import { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  RotateCcw, Plus, Minus, Loader2, Camera, X, CheckCircle2,
  Clock, Search, ChevronRight, MapPin, Flag, AlertTriangle, Layers,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { BarcodeScanner } from '@/components/BarcodeScanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useProducts, useAdjustStock, useExpiringVariants } from '@/features/inventory/hooks'
import { useLocations } from '@/features/locations/hooks'
import { useRecordPendingScan } from '@/features/floor/hooks'
import { useConsumptionForecast, useWasteRadar } from '@/features/eye/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { formatCurrency } from '@/lib/currency'
import type { ProductWithVariants, ProductVariant } from '@beacon/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Match {
  product: ProductWithVariants
  variant: ProductVariant
}

interface HistoryEntry {
  productName: string
  variantName: string
  delta: number
  newStock: number
  ts: Date
}

function findBySku(products: ProductWithVariants[], sku: string): Match | null {
  const q = sku.trim().toLowerCase()
  for (const p of products) {
    if (p.sku.toLowerCase() === q) return { product: p, variant: p.product_variants[0]! }
    for (const v of p.product_variants) {
      if (v.sku.toLowerCase() === q) return { product: p, variant: v }
    }
  }
  return null
}

function findByName(products: ProductWithVariants[], query: string): Match[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const results: Match[] = []
  for (const p of products) {
    if (p.name.toLowerCase().includes(q)) {
      results.push({ product: p, variant: p.product_variants[0]! })
    } else {
      for (const v of p.product_variants) {
        if (v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)) {
          results.push({ product: p, variant: v })
          break
        }
      }
    }
  }
  return results.slice(0, 8)
}

// ─── Quick adjust form ────────────────────────────────────────────────────────

const schema = z.object({
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  reason: z.string().min(1, 'Reason is required'),
})
type Fields = z.infer<typeof schema>

function QuickAdjustForm({
  match,
  daysUntilZero,
  hasWaste,
  expiryDays,
  currency,
  onSuccess,
  onReset,
}: {
  match: Match
  daysUntilZero: number | null
  hasWaste: boolean
  expiryDays: number | null
  currency: string
  onSuccess: (newStock: number, delta: number) => void
  onReset: () => void
}) {
  const adjustStock = useAdjustStock()
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [flagged, setFlagged] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({ resolver: zodResolver(schema), defaultValues: { quantity: 1 } })

  const qty = watch('quantity')

  // Keyboard: Escape resets
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onReset()
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler) }
  }, [onReset])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    if (photoPreview) { URL.revokeObjectURL(photoPreview); setPhotoPreview(null) }
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const onSubmit = async (data: Fields) => {
    const delta = direction === 'add' ? data.quantity : -data.quantity
    await adjustStock.mutateAsync({
      variantId: match.variant.id,
      delta,
      reason: flagged ? `[APPROX] ${data.reason}` : data.reason,
      photoFile,
    })
    reset()
    clearPhoto()
    onSuccess(match.variant.current_stock + delta, delta)
  }

  const costImpact = (qty ?? 0) * match.variant.cost

  return (
    <form onSubmit={(e) => { void handleSubmit(onSubmit)(e) }} className="space-y-4">
      {/* Product info */}
      <div className="rounded-xl border bg-muted/30 px-4 py-3 space-y-2">
        <div>
          <p className="font-semibold">{match.product.name}</p>
          {match.variant.name !== 'Standard' && (
            <p className="text-sm text-muted-foreground">{match.variant.name}</p>
          )}
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {match.variant.current_stock}
            <span className="text-sm font-normal text-muted-foreground ml-1">in stock</span>
          </p>
        </div>
        {/* Eye Layer signals */}
        <div className="flex flex-wrap gap-1.5">
          {daysUntilZero !== null && (
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border',
              daysUntilZero <= 7
                ? 'bg-red-50 border-red-200 text-red-700'
                : daysUntilZero <= 14
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  : 'bg-muted border-border text-muted-foreground'
            )}>
              ~{Math.round(daysUntilZero)}d until zero
            </span>
          )}
          {hasWaste && (
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
              waste signal
            </span>
          )}
          {expiryDays !== null && expiryDays <= 30 && (
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border',
              expiryDays <= 7
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-yellow-50 border-yellow-200 text-yellow-700'
            )}>
              expires in {expiryDays}d
            </span>
          )}
        </div>
      </div>

      {/* Direction toggle */}
      <div className="flex rounded-lg border overflow-hidden">
        <button
          type="button"
          onClick={() => { setDirection('add') }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors',
            direction === 'add' ? 'bg-green-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
          )}
        >
          <Plus className="h-4 w-4" /> Add
        </button>
        <button
          type="button"
          onClick={() => { setDirection('remove') }}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors',
            direction === 'remove' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
          )}
        >
          <Minus className="h-4 w-4" /> Remove
        </button>
      </div>

      {/* Quantity + presets */}
      <div className="space-y-1.5">
        <Label htmlFor="qty">Quantity</Label>
        <div className="flex gap-2">
          {[1, 5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => { setValue('quantity', n, { shouldValidate: true }) }}
              className={cn(
                'rounded border px-3 py-1.5 text-xs font-semibold transition-colors',
                qty === n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              {n}
            </button>
          ))}
          <Input
            id="qty"
            type="number"
            min="1"
            step="1"
            className="flex-1"
            {...register('quantity', { valueAsNumber: true })}
          />
        </div>
        {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
        {costImpact > 0 && (
          <p className="text-xs text-muted-foreground">
            {formatCurrency(costImpact, currency)} cost impact
          </p>
        )}
      </div>

      {/* Reason */}
      <div className="space-y-1.5">
        <Label htmlFor="reason">Reason</Label>
        <Textarea
          id="reason"
          rows={2}
          placeholder="e.g. Morning delivery…"
          {...register('reason')}
        />
        {errors.reason && <p className="text-sm text-destructive">{errors.reason.message}</p>}
      </div>

      {/* Photo */}
      <div className="space-y-1.5">
        <Label>Photo (optional)</Label>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
        />
        {photoPreview ? (
          <div className="relative inline-block">
            <img src={photoPreview} alt="preview" className="h-20 w-20 rounded-lg object-cover border" />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => { photoInputRef.current?.click() }}
          >
            <Camera className="mr-2 h-4 w-4" />
            Take Photo
          </Button>
        )}
      </div>

      {/* Flag for review */}
      <button
        type="button"
        onClick={() => { setFlagged((f) => !f) }}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
          flagged
            ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
            : 'border-border bg-background text-muted-foreground hover:bg-muted',
        )}
      >
        <Flag className={cn('h-4 w-4 shrink-0', flagged ? 'text-amber-600' : '')} />
        <span className="flex-1 text-left">
          {flagged ? 'Flagged as approximate — manager will review' : 'Approximate count — flag for review'}
        </span>
      </button>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onReset} className="flex-1">
          <RotateCcw className="mr-2 h-4 w-4" />
          Scan Again
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={cn('flex-1', direction === 'remove' && 'bg-red-600 hover:bg-red-700')}
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {direction === 'add' ? 'Add Stock' : 'Remove Stock'}
        </Button>
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        Press <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> to cancel
      </p>
    </form>
  )
}

// ─── Success screen with auto-advance ─────────────────────────────────────────

const AUTO_ADVANCE_MS = 2500

function SuccessScreen({
  newStock,
  delta,
  onScanAgain,
}: {
  newStock: number
  delta: number
  onScanAgain: () => void
}) {
  const [remaining, setRemaining] = useState(Math.ceil(AUTO_ADVANCE_MS / 1000))

  useEffect(() => {
    const timer = setTimeout(onScanAgain, AUTO_ADVANCE_MS)
    const tick = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    return () => { clearTimeout(timer); clearInterval(tick) }
  }, [onScanAgain])

  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <CheckCircle2 className="h-14 w-14 text-green-600" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">Stock updated</p>
        <p className="text-sm text-muted-foreground">
          <span className={cn('font-semibold', delta > 0 ? 'text-green-700' : 'text-red-700')}>
            {delta > 0 ? '+' : ''}{String(delta)} units
          </span>
          {' · '}
          <span className="font-semibold text-foreground tabular-nums">{String(newStock)}</span>
          {' now in stock'}
        </p>
      </div>

      {/* Progress bar auto-advance */}
      <div className="w-full max-w-[200px] space-y-1.5">
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-none"
            style={{
              width: `${String(((AUTO_ADVANCE_MS - remaining * 1000) / AUTO_ADVANCE_MS) * 100)}%`,
              transition: `width ${String(AUTO_ADVANCE_MS)}ms linear`,
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Returning to scan in {remaining}s…
        </p>
      </div>

      <Button size="sm" variant="outline" onClick={onScanAgain}>
        <RotateCcw className="mr-2 h-3.5 w-3.5" />
        Scan Now
      </Button>
    </div>
  )
}

// ─── Not-found state with name search ─────────────────────────────────────────

function NotFoundPanel({
  lastCode,
  products,
  onSelect,
  onReset,
  onLogPending,
}: {
  lastCode: string
  products: ProductWithVariants[]
  onSelect: (match: Match) => void
  onReset: () => void
  onLogPending: (code: string) => void
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => findByName(products, query), [products, query])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed px-4 py-5 text-center">
        <p className="font-medium">No product found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No product matched SKU{' '}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{lastCode}</code>
        </p>
      </div>

      {/* Name search fallback */}
      <div className="space-y-2">
        <Label htmlFor="name-search" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Search className="h-3.5 w-3.5" />
          Search by name or SKU
        </Label>
        <Input
          id="name-search"
          placeholder="Type product name…"
          value={query}
          onChange={(e) => { setQuery(e.target.value) }}
          autoFocus
        />
        {results.length > 0 && (
          <div className="rounded-lg border divide-y overflow-hidden">
            {results.map(({ product, variant }) => (
              <button
                key={`${product.id}-${variant.id}`}
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted transition-colors"
                onClick={() => { onSelect({ product, variant }) }}
              >
                <div>
                  <p className="text-sm font-medium">{product.name}</p>
                  {variant.name !== 'Standard' && (
                    <p className="text-xs text-muted-foreground">{variant.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    SKU {variant.sku} · {variant.current_stock} in stock
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
        {query.length >= 2 && results.length === 0 && (
          <p className="py-2 text-center text-sm text-muted-foreground">No matches for "{query}"</p>
        )}
      </div>

      <Button variant="outline" onClick={onReset} className="w-full">
        <RotateCcw className="mr-2 h-4 w-4" />
        Try Scan Again
      </Button>
      <button
        type="button"
        onClick={() => { onLogPending(lastCode) }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
      >
        <AlertTriangle className="h-4 w-4" />
        Log for manager review &amp; continue
      </button>
    </div>
  )
}

// ─── Session history strip ─────────────────────────────────────────────────────

function SessionHistory({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          This session · {entries.length} scan{entries.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="space-y-1">
        {entries.map((entry, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{entry.productName}</p>
              {entry.variantName !== 'Standard' && (
                <p className="truncate text-[10px] text-muted-foreground">{entry.variantName}</p>
              )}
            </div>
            <div className="ml-3 flex shrink-0 items-center gap-2.5">
              <span className={cn(
                'text-xs font-bold tabular-nums',
                entry.delta > 0 ? 'text-green-600' : 'text-red-600',
              )}>
                {entry.delta > 0 ? '+' : ''}{entry.delta}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {entry.newStock} stk
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(entry.ts, { addSuffix: true })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Onboarding banner — shown to new users, dismissed after first scan ────────

function OnboardingBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
          1
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Welcome to Floor Scan</p>
          <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
            Tap <strong>Start Camera</strong> and point it at any product barcode. Use the location filter to pre-sort your items. Adjustments sync automatically — even offline.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-blue-400 hover:text-blue-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const LOCATION_KEY = 'beacon-floor-location'
const ONBOARDED_KEY = 'beacon-floor-onboarded'

type PageState = 'scan' | 'found' | 'notfound' | 'done'

const MAX_HISTORY = 10

export default function ScanPage() {
  const navigate = useNavigate()
  const { data: products = [] } = useProducts()
  const { data: locations = [] } = useLocations()
  const { data: forecast = [] } = useConsumptionForecast(30)
  const { data: wasteRadar = [] } = useWasteRadar()
  const { data: expiring = [] } = useExpiringVariants(30)
  const currency = useCurrency()
  const recordPending = useRecordPendingScan()
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    () => localStorage.getItem(LOCATION_KEY),
  )
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem(ONBOARDED_KEY),
  )

  // Location-aware filtering
  const visibleProducts = useMemo(() => {
    if (!selectedLocationId) return products
    return products.filter((p) =>
      p.product_variants.some((v) => v.location_id === selectedLocationId),
    )
  }, [products, selectedLocationId])

  const forecastMap = useMemo(
    () => new Map(forecast.map((f) => [f.variant_id, f.days_until_zero])),
    [forecast],
  )
  const wasteRadarIds = useMemo(
    () => new Set(wasteRadar.map((w) => w.variant_id)),
    [wasteRadar],
  )
  const expiryMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const v of expiring) {
      if (!v.expiry_date) continue
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const exp = new Date(v.expiry_date); exp.setHours(0, 0, 0, 0)
      m.set(v.id, Math.round((exp.getTime() - today.getTime()) / 86400000))
    }
    return m
  }, [expiring])

  const [pageState, setPageState] = useState<PageState>('scan')
  const [match, setMatch] = useState<Match | null>(null)
  const [lastCode, setLastCode] = useState('')
  const [lastResult, setLastResult] = useState<{ newStock: number; delta: number } | null>(null)
  const [sessionHistory, setSessionHistory] = useState<HistoryEntry[]>([])

  const handleDetected = (code: string) => {
    setLastCode(code)
    const found = findBySku(visibleProducts, code)
    if (found) {
      setMatch(found)
      setPageState('found')
    } else {
      setMatch(null)
      setPageState('notfound')
    }
  }

  const handleLocationChange = (locId: string | null) => {
    setSelectedLocationId(locId)
    if (locId) localStorage.setItem(LOCATION_KEY, locId)
    else localStorage.removeItem(LOCATION_KEY)
  }

  const handleLogPending = (code: string) => {
    void recordPending.mutateAsync({ scannedCode: code, locationId: selectedLocationId })
    void (navigator.vibrate?.(50))
    reset()
  }

  const handleFirstScanComplete = useCallback(() => {
    if (!localStorage.getItem(ONBOARDED_KEY)) {
      localStorage.setItem(ONBOARDED_KEY, '1')
      setShowOnboarding(false)
    }
  }, [])

  const reset = useCallback(() => {
    setMatch(null)
    setLastCode('')
    setLastResult(null)
    setPageState('scan')
  }, [])

  const handleSuccess = (newStock: number, delta: number) => {
    setLastResult({ newStock, delta })
    if (match) {
      setSessionHistory((prev) => [
        {
          productName: match.product.name,
          variantName: match.variant.name,
          delta,
          newStock,
          ts: new Date(),
        },
        ...prev,
      ].slice(0, MAX_HISTORY))
    }
    handleFirstScanComplete()
    setPageState('done')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6 space-y-6">
      {showOnboarding && <OnboardingBanner onDismiss={handleFirstScanComplete} />}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Floor · Scan</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Scan a barcode or enter the SKU to adjust stock.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 text-xs"
          onClick={() => { void navigate('/scan/ar') }}
        >
          <Layers className="h-3.5 w-3.5" />
          AR Preview
        </Button>
      </div>

      {/* Location filter */}
      {locations.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <button
            type="button"
            onClick={() => { handleLocationChange(null) }}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              !selectedLocationId
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            All
          </button>
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              onClick={() => { handleLocationChange(loc.id) }}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                selectedLocationId === loc.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {loc.name}
            </button>
          ))}
        </div>
      )}

      {pageState === 'scan' && (
        <>
          <BarcodeScanner onDetected={handleDetected} />
          <SessionHistory entries={sessionHistory} />
        </>
      )}

      {pageState === 'notfound' && (
        <NotFoundPanel
          lastCode={lastCode}
          products={visibleProducts}
          onSelect={(m) => { setMatch(m); setPageState('found') }}
          onReset={reset}
          onLogPending={handleLogPending}
        />
      )}

      {pageState === 'found' && match && (
        <QuickAdjustForm
          match={match}
          daysUntilZero={forecastMap.get(match.variant.id) ?? null}
          hasWaste={wasteRadarIds.has(match.variant.id)}
          expiryDays={expiryMap.get(match.variant.id) ?? null}
          currency={currency}
          onSuccess={handleSuccess}
          onReset={reset}
        />
      )}

      {pageState === 'done' && lastResult && (
        <SuccessScreen
          newStock={lastResult.newStock}
          delta={lastResult.delta}
          onScanAgain={reset}
        />
      )}
    </div>
  )
}
