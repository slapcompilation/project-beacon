// Layer: Flow — Inventory
// Dense, virtualized product table with inline stock correction, intelligence
// strips, multi-variant rollups, and bulk actions. The default operator workspace.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Button,
  Drawer,
  HTMLSelect,
  HTMLTable,
  Icon,
  InputGroup,
  Intent,
  Menu,
  MenuDivider,
  MenuItem,
  NonIdealState,
  Popover,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import { ParOptimizerContent } from '@/pages/ParOptimizerPage'
import { cn } from '@/lib/utils'
import { addDays, format } from 'date-fns'
import { StockBadge } from '@/features/inventory/components/StockBadge'
import { ProductFormModal } from '@/features/inventory/components/ProductFormModal'
import { StockAdjustModal } from '@/features/inventory/components/StockAdjustModal'
import { StockLogDrawer } from '@/features/inventory/components/StockLogDrawer'
import { TransferModal } from '@/features/inventory/components/TransferModal'
import { VoiceAdjustButton } from '@/components/VoiceAdjustButton'
import { ImportModal } from '@/features/inventory/components/CsvImportModal'
import { VariantManagerDrawer } from '@/features/inventory/components/VariantManagerDrawer'
import {
  useProducts,
  useDeleteProduct,
  useForecast,
  useUpdateProduct,
  useAdjustStock,
  useLookupBarcode,
} from '@/features/inventory/hooks'
import { useCreateRestockRequest, useRestockRequests } from '@/features/restock/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { WhyButton } from '@/components/WhySheet'
import type { Supplier } from '@beacon/types'
import { useCategories } from '@/features/categories/hooks'
import { useLocations } from '@/features/locations/hooks'
import { useWasteRadar, useInventoryIntelligence } from '@/features/eye/hooks'
import type { InventoryIntelligenceRow } from '@/features/eye/api'
import { useCurrency } from '@/hooks/useCurrency'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EntityLink } from '@/components/EntityLink'
import { printVariantLabels } from '@/lib/labels'
import { exportToCsv } from '@/lib/csv'
import { formatCurrency } from '@/lib/currency'
import { getTotalStock } from '@beacon/types'
import type { ProductWithVariants, ProductVariant } from '@beacon/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Modal =
  | { type: 'add' }
  | { type: 'edit'; product: ProductWithVariants }
  | { type: 'adjust'; product: ProductWithVariants; prefill?: { delta: number; reason: string } }
  | { type: 'history'; product: ProductWithVariants }
  | { type: 'variants'; product: ProductWithVariants }
  | null

// ─── Days-left indicator (Principle 3: intelligence everywhere) ───────────────
// Shows: ~6d left · ↑12% vs last week · 30d avg · last recv 18d ago

function DaysLeft({ variantIds, currentStocks, forecastMap, intelligenceMap }: {
  variantIds: string[]
  currentStocks: number[]
  forecastMap: Map<string, number>
  intelligenceMap: Map<string, InventoryIntelligenceRow>
}) {
  if (variantIds.length === 0) return <span className="text-muted-foreground">—</span>
  let minDays = Infinity
  let anyData = false
  let primaryAvg: number | undefined
  let primaryVariantId: string | undefined
  for (let i = 0; i < variantIds.length; i++) {
    const stock = currentStocks[i] ?? 0
    if (stock === 0) return <span className="text-red-600 font-medium text-xs">Out</span>
    const avgDaily = forecastMap.get(variantIds[i] ?? '')
    if (avgDaily && avgDaily > 0) {
      anyData = true
      const days = stock / avgDaily
      if (days < minDays) { minDays = days; primaryAvg = avgDaily; primaryVariantId = variantIds[i] }
    }
  }
  if (!anyData) return null
  const d = Math.round(minDays)
  const intel = primaryVariantId ? intelligenceMap.get(primaryVariantId) : undefined
  const trendPct = intel?.trend_pct ?? null
  const lastRecvDays = intel?.last_received_days_ago ?? null

  return (
    <div className="text-xs leading-tight space-y-0.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('font-medium', d <= 7 ? 'text-red-600' : d <= 14 ? 'text-yellow-600' : 'text-muted-foreground')}>
          ~{d}d
        </span>
        {trendPct !== null && (
          <span className={cn(
            'inline-flex items-center gap-0.5 tabular-nums',
            trendPct > 5  ? 'text-rose-600 dark:text-rose-400' :
            trendPct < -5 ? 'text-emerald-600 dark:text-emerald-400' :
            'text-muted-foreground',
          )}>
            <Icon
              icon={trendPct > 5 ? 'trending-up' : trendPct < -5 ? 'trending-down' : 'minus'}
              size={10}
            />
            {Math.abs(Math.round(trendPct))}%
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
        {primaryAvg != null && <span>~{primaryAvg.toFixed(1)}/d · 30d avg</span>}
        {lastRecvDays != null && <span>· recv {lastRecvDays}d ago</span>}
      </div>
    </div>
  )
}

// ─── Row intelligence strip ────────────────────────────────────────────────────
// Eye Layer — surfaces forecast + waste + par context inline on every row.
// Principle 3: intelligence everywhere. Turns a data row into a decision surface.
// Format: 47 units · par 60 · ↓12% · ~6d left · [Request Restock]

function RowIntelStrip({
  product,
  forecastMap,
  intelligenceMap,
  wasteRadarIds,
  openRestockIds,
  suppliersMap,
  onRequestRestock,
}: {
  product: ProductWithVariants
  forecastMap: Map<string, number>
  intelligenceMap: Map<string, InventoryIntelligenceRow>
  wasteRadarIds: Set<string>
  openRestockIds: Set<string>
  suppliersMap: Map<string, Supplier>
  onRequestRestock: (variantId: string, qty: number) => void
}) {
  const variants = product.product_variants
  if (variants.length === 0) return null

  const totalStock = getTotalStock(variants)
  const primaryVariant = variants.reduce((worst, v) => {
    const dw = (forecastMap.get(worst.id) ?? 0) > 0 ? worst.current_stock / (forecastMap.get(worst.id) ?? 1) : Infinity
    const dv = (forecastMap.get(v.id)    ?? 0) > 0 ? v.current_stock    / (forecastMap.get(v.id)    ?? 1) : Infinity
    return dv < dw ? v : worst
  }, variants[0])

  const par       = primaryVariant.low_stock_threshold
  const avgDaily  = forecastMap.get(primaryVariant.id)
  const days      = avgDaily && avgDaily > 0 ? Math.round(totalStock / avgDaily) : null
  const intel     = intelligenceMap.get(primaryVariant.id)
  const trendPct  = intel?.trend_pct ?? null
  const hasWaste  = variants.some((v) => wasteRadarIds.has(v.id))
  const hasOpen   = variants.some((v) => openRestockIds.has(v.id))
  const showCta   = days !== null && days <= 14 && !hasOpen && totalStock > 0

  const supplierEntry = (primaryVariant as ProductVariant & { default_supplier_id?: string }).default_supplier_id
    ? suppliersMap.get((primaryVariant as ProductVariant & { default_supplier_id?: string }).default_supplier_id)
    : undefined
  const leadTimeDays = (supplierEntry as (Supplier & { lead_time_days?: number | null }) | undefined)?.lead_time_days ?? null
  const supplyGap = days !== null && leadTimeDays !== null ? days - leadTimeDays : null

  const hasAnySig = days !== null || (trendPct !== null && Math.abs(trendPct) > 3) || hasWaste || (par > 0)
  if (!hasAnySig) return null

  return (
    <div className="flex items-center gap-1.5 mt-1 flex-wrap min-w-0">
      {/* Par vs current */}
      {par > 0 && (
        <span className={cn(
          'text-[10px] tabular-nums',
          totalStock <= par ? 'text-yellow-600 dark:text-yellow-500 font-medium' : 'text-muted-foreground',
        )}>
          par {par}
        </span>
      )}

      {/* Burn-rate trend */}
      {trendPct !== null && Math.abs(trendPct) > 3 && (
        <span className={cn(
          'inline-flex items-center gap-0.5 text-[10px] tabular-nums',
          trendPct > 5  ? 'text-rose-600 dark:text-rose-400' :
          trendPct < -5 ? 'text-emerald-600 dark:text-emerald-400' :
          'text-muted-foreground',
        )}>
          <Icon icon={trendPct > 3 ? 'trending-up' : 'trending-down'} size={10} />
          {Math.abs(Math.round(trendPct))}%
        </span>
      )}

      {/* Days until zero */}
      {days !== null && (
        <span className={cn(
          'text-[10px] font-medium tabular-nums',
          days === 0   ? 'text-red-600' :
          days <= 7   ? 'text-red-600' :
          days <= 14  ? 'text-yellow-600 dark:text-yellow-500' :
          'text-muted-foreground',
        )}>
          ~{days}d
        </span>
      )}

      {/* Waste spike */}
      {hasWaste && (
        <span className="text-[10px] text-orange-600 dark:text-orange-400">waste↑</span>
      )}

      {/* Inline restock CTA */}
      {showCta && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            const reorderQty = (() => {
              if (par > 0 && avgDaily && avgDaily > 0 && leadTimeDays !== null) {
                return Math.max(Math.ceil(par - totalStock + avgDaily * leadTimeDays), par)
              }
              if (par > 0) return Math.max(par * 2 - totalStock, par)
              return Math.max(primaryVariant.current_stock * 2, 10)
            })()
            onRequestRestock(primaryVariant.id, reorderQty)
          }}
          className={cn(
            'inline-flex items-center gap-0.5 rounded border px-1.5 py-px text-[10px] font-medium transition-colors',
            supplyGap !== null && supplyGap <= 0
              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50'
              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400 dark:hover:bg-blue-950/50',
          )}
        >
          {supplyGap !== null && supplyGap <= 0 ? '⚠ Order Now' : '↗ Restock'}
        </button>
      )}

      {/* Already requested */}
      {hasOpen && days !== null && days <= 14 && (
        <span className="text-[10px] text-muted-foreground italic">restock pending</span>
      )}

      {/* Lead-time gap → date-based order deadline */}
      {supplyGap !== null && days !== null && (
        supplyGap <= 0 ? (
          <span className="inline-flex items-center gap-0.5 rounded border border-red-200 bg-red-50 px-1.5 py-px text-[10px] font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
            ⚠ order now · stockout {format(addDays(new Date(), days), 'MMM d')}
          </span>
        ) : supplyGap <= 7 ? (
          <span className={cn(
            'text-[10px] font-medium',
            supplyGap <= 3 ? 'text-yellow-600 dark:text-yellow-500' : 'text-muted-foreground',
          )}>
            order by {format(addDays(new Date(), supplyGap), 'MMM d')} · {String(days)}d left
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            lead {String(leadTimeDays)}d
          </span>
        )
      )}

      {/* Causal history — surfaces the graph inline for critical items */}
      {days !== null && days <= 14 && (
        <WhyButton
          variantId={primaryVariant.id}
          variantName={variants.length > 1 ? `${product.name} — ${primaryVariant.name}` : product.name}
          currentStock={totalStock}
        />
      )}
    </div>
  )
}

// ─── Inline stock cell ────────────────────────────────────────────────────────
// Flow Layer — physical count correction with auto-delta calculation

function InlineStockCell({
  product,
  forecastMap,
  intelligenceMap,
  onOpenModal,
}: {
  product: ProductWithVariants
  forecastMap: Map<string, number>
  intelligenceMap: Map<string, InventoryIntelligenceRow>
  onOpenModal: () => void
}) {
  const adjustStock = useAdjustStock()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const variants = product.product_variants
  const isSingle = variants.length === 1
  const variant = isSingle ? variants[0] : null
  const totalStock = getTotalStock(variants)
  const threshold = variant?.low_stock_threshold ?? 0

  const parRatio = variant && threshold > 0
    ? Math.min(variant.current_stock / threshold, 2)
    : null

  const primaryV = variants.length > 0
    ? variants.reduce((worst, v) => {
        const dw = (forecastMap.get(worst.id) ?? 0) > 0 ? worst.current_stock / (forecastMap.get(worst.id) ?? 1) : Infinity
        const dv = (forecastMap.get(v.id)    ?? 0) > 0 ? v.current_stock    / (forecastMap.get(v.id)    ?? 1) : Infinity
        return dv < dw ? v : worst
      }, variants[0])
    : null
  const avgDailyCell = primaryV ? (forecastMap.get(primaryV.id) ?? null) : null
  const daysCell = avgDailyCell && avgDailyCell > 0 ? Math.round(totalStock / avgDailyCell) : null
  const trendPctCell = primaryV ? (intelligenceMap.get(primaryV.id)?.trend_pct ?? null) : null

  const startEdit = () => {
    if (!isSingle || !variant) { onOpenModal(); return }
    setValue(String(variant.current_stock))
    setEditing(true)
    setTimeout(() => { inputRef.current?.select() }, 0)
  }

  const commit = async () => {
    if (!variant) { setEditing(false); return }
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed < 0) { setEditing(false); return }
    const delta = parsed - variant.current_stock
    if (delta === 0) { setEditing(false); return }
    try {
      await adjustStock.mutateAsync({ variantId: variant.id, delta, reason: 'Physical count' })
      toast.success(`Stock corrected: ${delta > 0 ? '+' : ''}${String(delta)}`)
    } catch {
      toast.error('Failed to update stock')
    }
    setEditing(false)
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => { setValue(e.target.value) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void commit()
            if (e.key === 'Escape') setEditing(false)
          }}
          onBlur={() => { void commit() }}
          className="h-7 w-20 rounded border border-primary bg-background px-2 text-right text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/50"
          autoFocus
        />
      ) : (
        <button
          onClick={startEdit}
          className={cn(
            'rounded px-1 py-0.5 text-sm font-semibold tabular-nums transition-colors -mr-1',
            isSingle ? 'hover:bg-muted cursor-pointer' : 'cursor-default',
            totalStock === 0 && 'text-red-600',
          )}
          title={isSingle ? 'Click to enter physical count' : 'Open Adjust Stock to edit multi-variant'}
        >
          {totalStock}{isSingle && variant?.unit_of_measure ? ` ${variant.unit_of_measure}` : ''}
        </button>
      )}
      {/* Intelligence sub-line: trend · ~days left · rate basis */}
      {!editing && (daysCell !== null || trendPctCell !== null) && (
        <div className="flex items-center gap-1 text-[10px] tabular-nums">
          {trendPctCell !== null && Math.abs(trendPctCell) > 1 && (
            <span className={cn(
              'inline-flex items-center gap-0.5',
              trendPctCell > 5  ? 'text-rose-600 dark:text-rose-400' :
              trendPctCell < -5 ? 'text-emerald-600 dark:text-emerald-400' :
              'text-muted-foreground',
            )}>
              <Icon icon={trendPctCell > 1 ? 'trending-up' : 'trending-down'} size={10} />
              {Math.abs(Math.round(trendPctCell))}%
            </span>
          )}
          {daysCell !== null && (
            <span className={cn(
              'font-medium',
              daysCell <= 7  ? 'text-red-600' :
              daysCell <= 14 ? 'text-yellow-600 dark:text-yellow-500' :
              'text-muted-foreground',
            )}>
              ~{daysCell}d
            </span>
          )}
          {avgDailyCell !== null && avgDailyCell > 0 && (
            <span className="text-muted-foreground/70" title="Based on 30-day avg consumption">
              · {avgDailyCell.toFixed(1)}/day
            </span>
          )}
        </div>
      )}

      {/* Par health bar */}
      {parRatio !== null && !editing && (
        <div className="w-14 h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              parRatio === 0 ? 'bg-red-500' :
              parRatio <= 1 ? 'bg-yellow-500' :
              parRatio <= 1.5 ? 'bg-green-500' : 'bg-blue-400'
            )}
            style={{ width: `${String(Math.min(parRatio / 2, 1) * 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Inventory summary strip ──────────────────────────────────────────────────

function InventorySummaryStrip({
  products,
  currency,
}: {
  products: ProductWithVariants[]
  currency: string
}) {
  const { totalValue, outOfStock, lowStock } = useMemo(() => {
    let total = 0
    let oos = 0
    let low = 0
    for (const p of products) {
      let allZero = true
      let anyLow = false
      for (const v of p.product_variants) {
        total += v.current_stock * v.cost
        if (v.current_stock > 0) allZero = false
        if (v.low_stock_threshold > 0 && v.current_stock > 0 && v.current_stock <= v.low_stock_threshold) anyLow = true
      }
      if (allZero && p.product_variants.length > 0) oos++
      if (anyLow) low++
    }
    return { totalValue: total, outOfStock: oos, lowStock: low }
  }, [products])

  return (
    <div className="flex flex-wrap items-center gap-6 border-b px-8 py-2.5 bg-muted/30 text-sm">
      <span className="text-muted-foreground">
        <span className="font-semibold text-foreground tabular-nums">{products.length}</span> products
        {' · '}
        <span className="font-semibold text-foreground">{formatCurrency(totalValue, currency)}</span> total value
      </span>
      {outOfStock > 0 && (
        <span className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span className="font-semibold tabular-nums">{outOfStock}</span> out of stock
        </span>
      )}
      {lowStock > 0 && (
        <span className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-600">
          <span className="h-2 w-2 rounded-full bg-yellow-500" />
          <span className="font-semibold tabular-nums">{lowStock}</span> low stock
        </span>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { data: products = [], isLoading } = useProducts()
  const deleteProduct = useDeleteProduct()
  const updateProduct = useUpdateProduct()
  const { data: categories = [] } = useCategories()
  const { data: locations = [] } = useLocations()
  const { data: forecastMap = new Map() } = useForecast()
  const { data: wasteRadar = [] } = useWasteRadar()
  const { data: intelligenceMap = new Map() } = useInventoryIntelligence()
  const { data: suppliers = [] } = useSuppliers()
  const currency = useCurrency()
  const wasteRadarIds = useMemo(
    () => new Set(wasteRadar.map((w) => w.variant_id)),
    [wasteRadar]
  )
  const { data: restockRequests = [] } = useRestockRequests()
  const openRestockIds = useMemo(
    () => new Set(
      restockRequests
        .filter((r) => r.status === 'pending' || r.status === 'approved')
        .map((r) => r.variant_id)
    ),
    [restockRequests]
  )
  const suppliersMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  )
  const locationNameMap = useMemo(
    () => new Map(locations.map((l) => [l.id, l.name])),
    [locations]
  )

  const lookupBarcode = useLookupBarcode()

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('__all__')
  const [locationFilter, setLocationFilter] = useState<string>('__all__')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [transferVariant, setTransferVariant] = useState<ProductVariant | null>(null)
  const [searchParams] = useSearchParams()
  const [importOpen, setImportOpen] = useState(false)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [parOptimizerOpen, setParOptimizerOpen] = useState(false)
  const navigate = useNavigate()

  // Column visibility (defaults: hide SKU + Value to reduce noise)
  const [colSku,     setColSku]     = useState(false)
  const [colValue,   setColValue]   = useState(false)
  const [colStatus,  setColStatus]  = useState(true)
  const [colDays,    setColDays]    = useState(false)
  const [colLocation, setColLocation] = useState(true)

  // Batch selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const createRestock = useCreateRestockRequest()

  const toggleSelect = (id: string) =>
    { setSelected((prev) => { const next = new Set(prev); if (next.has(id)) { next.delete(id) } else { next.add(id) }; return next }); }

  useEffect(() => {
    if (searchParams.get('import') === '1') setImportOpen(true)
  }, [searchParams])
  const [barcodeInput, setBarcodeInput] = useState('')

  const handleVoiceCommand = useCallback((productQuery: string, delta: number, reason: string) => {
    const q = productQuery.toLowerCase()
    const match = products.find((p) =>
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.product_variants.some((v) => v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))
    )
    if (!match) {
      toast.error(`No product found matching "${productQuery}"`)
      return
    }
    setModal({ type: 'adjust', product: match, prefill: { delta, reason } })
  }, [products])

  const handleBarcodeScan = async (raw: string) => {
    const barcode = raw.trim()
    if (!barcode) return
    const match = await lookupBarcode.mutateAsync(barcode)
    setBarcodeInput('')
    if (!match) {
      toast.error(`No variant found for barcode "${barcode}"`)
      return
    }
    const product = products.find((p) => p.id === match.productId)
    if (!product) {
      toast.error('Product not found in inventory')
      return
    }
    setModal({ type: 'adjust', product })
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const result = products.filter((p) => {
      const matchesSearch =
        !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) ||
        p.product_variants.some((v) => v.sku.toLowerCase().includes(q))
      const matchesCategory = categoryFilter === '__all__' || p.category_id === categoryFilter
      const matchesLocation =
        locationFilter === '__all__' ||
        p.product_variants.some((v) => v.location_id === locationFilter)
      const matchesTag = !tagFilter || p.tags.includes(tagFilter)
      return matchesSearch && matchesCategory && matchesLocation && matchesTag
    })
    const urgency = (p: ProductWithVariants) => {
      if (p.product_variants.every((v) => v.current_stock === 0)) return 0
      if (p.product_variants.some((v) => v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold)) return 1
      if (p.product_variants.some((v) => wasteRadarIds.has(v.id))) return 2
      return 3
    }
    return [...result].sort((a, b) => urgency(a) - urgency(b))
  }, [products, search, categoryFilter, locationFilter, tagFilter, wasteRadarIds])

  // ── Virtualized table ─────────────────────────────────────────────────────
  const tableScrollRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => tableScrollRef.current,
    estimateSize: () => 64,
    overscan: 8,
  })

  const isAllSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id))
  const toggleAll = () =>
    { setSelected(isAllSelected ? new Set() : new Set(filtered.map((p) => p.id))); }

  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      for (const t of p.tags) set.add(t)
    }
    return [...set].sort()
  }, [products])

  const handleBulkExport = () => {
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]))
    const rows = products
      .filter((p) => selected.has(p.id))
      .flatMap((p) => p.product_variants.map((v) => ({
        product: p.name,
        variant: v.name,
        sku: v.sku,
        current_stock: v.current_stock,
        category: p.category_id ? (categoryNameMap.get(p.category_id) ?? '') : '',
      })))
    exportToCsv(`inventory-selection-${new Date().toISOString().slice(0, 10)}`, rows)
  }

  const handleBulkDelete = () => {
    setBulkDeleteConfirm(true)
  }

  const confirmBulkDelete = () => {
    for (const id of selected) deleteProduct.mutate(id)
    setSelected(new Set())
  }

  const handleBulkRestock = async () => {
    const selectedProducts = products.filter((p) => selected.has(p.id))
    let count = 0
    for (const p of selectedProducts) {
      for (const v of p.product_variants) {
        if (v.low_stock_threshold > 0 && v.current_stock <= v.low_stock_threshold) {
          const qty = Math.max(1, v.low_stock_threshold * 2 - v.current_stock)
          await createRestock.mutateAsync({ variantId: v.id, quantityNeeded: qty })
          count++
        }
      }
    }
    toast.success(`${String(count)} restock request${count !== 1 ? 's' : ''} created`)
    setSelected(new Set())
  }

  const handlePrintLabels = async (product: ProductWithVariants) => {
    await printVariantLabels(
      product.product_variants.map((v) => ({
        sku: v.sku,
        name: v.name !== 'Standard' ? v.name : '',
        productName: product.name,
      }))
    )
  }

  const handleExportInventory = () => {
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]))
    const rows = products.flatMap((p) =>
      p.product_variants.map((v) => ({
        product: p.name,
        product_sku: p.sku,
        variant: v.name,
        variant_sku: v.sku,
        barcode: v.barcode ?? '',
        category: p.category_id ? (categoryNameMap.get(p.category_id) ?? '') : '',
        location: v.location_id ? (locationNameMap.get(v.location_id) ?? '') : '',
        current_stock: v.current_stock,
        low_stock_threshold: v.low_stock_threshold,
        unit_cost: v.cost.toFixed(2),
        total_value: (v.current_stock * v.cost).toFixed(2),
        lot_number: v.lot_number ?? '',
        expiry_date: v.expiry_date ?? '',
      }))
    )
    exportToCsv(`inventory-${new Date().toISOString().slice(0, 10)}`, rows)
  }

  const isOverstock = (p: ProductWithVariants) =>
    p.product_variants.some(
      (v) => v.low_stock_threshold > 0 && v.current_stock > v.low_stock_threshold * 2
    )

  const columnsMenu = (
    <Menu>
      <MenuDivider title="Visible columns" />
      <MenuItem
        icon={colSku ? 'tick' : 'blank'}
        text="SKU"
        shouldDismissPopover={false}
        onClick={() => { setColSku((v) => !v) }}
      />
      <MenuItem
        icon={colValue ? 'tick' : 'blank'}
        text="Value"
        shouldDismissPopover={false}
        onClick={() => { setColValue((v) => !v) }}
      />
      <MenuItem
        icon={colStatus ? 'tick' : 'blank'}
        text="Status"
        shouldDismissPopover={false}
        onClick={() => { setColStatus((v) => !v) }}
      />
      <MenuItem
        icon={colDays ? 'tick' : 'blank'}
        text="Days Left"
        shouldDismissPopover={false}
        onClick={() => { setColDays((v) => !v) }}
      />
      {locations.length > 0 && (
        <MenuItem
          icon={colLocation ? 'tick' : 'blank'}
          text="Location"
          shouldDismissPopover={false}
          onClick={() => { setColLocation((v) => !v) }}
        />
      )}
    </Menu>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5">
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} product{products.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outlined" icon="download" onClick={handleExportInventory} disabled={products.length === 0}>
            Export CSV
          </Button>
          <Button variant="outlined" icon="upload" onClick={() => { setImportOpen(true); }}>
            Import CSV
          </Button>
          <Button variant="outlined" icon="tag" onClick={() => { void navigate('/labels') }}>
            Print Labels
          </Button>
          <Button variant="outlined" icon="settings" onClick={() => { setParOptimizerOpen(true); }}>
            Optimize Pars
          </Button>
          <Button intent={Intent.PRIMARY} icon="plus" onClick={() => { setModal({ type: 'add' }); }}>
            Add Product
          </Button>
        </div>
      </div>

      {/* Products content */}
      <div className="flex flex-col flex-1 overflow-hidden">
          {/* Summary strip */}
          {!isLoading && products.length > 0 && (
            <InventorySummaryStrip products={products} currency={currency} />
          )}

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-8 py-4 border-b">
            <div className="flex-1 max-w-xs">
              <InputGroup
                leftIcon="search"
                placeholder="Search by name or SKU…"
                value={search}
                onChange={(e) => { setSearch(e.target.value) }}
              />
            </div>
            {/* Barcode scan-to-open */}
            <div className="w-44">
              <InputGroup
                leftIcon="barcode"
                placeholder="Scan barcode…"
                value={barcodeInput}
                onChange={(e) => { setBarcodeInput(e.target.value) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleBarcodeScan(barcodeInput)
                }}
                className="!font-mono"
                disabled={lookupBarcode.isPending}
              />
            </div>
            {categories.length > 0 && (
              <HTMLSelect
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value) }}
                options={[
                  { value: '__all__', label: 'All categories' },
                  ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
                ]}
                className="!w-44"
              />
            )}
            {locations.length > 0 && (
              <HTMLSelect
                value={locationFilter}
                onChange={(e) => { setLocationFilter(e.target.value) }}
                options={[
                  { value: '__all__', label: 'All locations' },
                  ...locations.map((loc) => ({ value: loc.id, label: loc.name })),
                ]}
                className="!w-44"
              />
            )}
            <VoiceAdjustButton onCommand={handleVoiceCommand} className="ml-auto" />
            {/* Column visibility */}
            <Popover content={columnsMenu} placement="bottom-end">
              <Button size="small" variant="outlined" icon="column-layout" endIcon="caret-down">
                Columns
              </Button>
            </Popover>
          </div>

          {/* Tag filter chips */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-8 py-2 border-b">
              <button
                onClick={() => { setTagFilter(null) }}
                className={cn(
                  'rounded-full border px-3 py-0.5 text-xs font-medium transition-colors',
                  tagFilter === null
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                All tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => { setTagFilter(tagFilter === tag ? null : tag) }}
                  className={cn(
                    'rounded-full border px-3 py-0.5 text-xs font-medium transition-colors',
                    tagFilter === tag
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Bulk actions bar */}
          {selected.size > 0 && (
            <div className="flex items-center gap-3 px-8 py-2.5 bg-primary/5 border-b border-primary/20 text-sm">
              <span className="font-medium text-primary tabular-nums">{selected.size} selected</span>
              <Button size="small" variant="outlined" icon="download" onClick={handleBulkExport}>
                Export
              </Button>
              <Button
                size="small"
                variant="outlined"
                icon="refresh"
                loading={createRestock.isPending}
                onClick={() => { void handleBulkRestock() }}
              >
                Request Restock
              </Button>
              <Button
                size="small"
                variant="outlined"
                intent={Intent.DANGER}
                icon="trash"
                onClick={handleBulkDelete}
              >
                Delete
              </Button>
              <Button variant="minimal" size="small" className="!ml-auto" onClick={() => { setSelected(new Set()) }}>
                Clear
              </Button>
            </div>
          )}

          {/* Table */}
          <div ref={tableScrollRef} className="flex-1 overflow-auto px-8 py-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-24 text-muted-foreground text-sm gap-2">
                <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <NonIdealState
                icon="box"
                title={search ? 'No products match your search.' : 'No products yet.'}
                action={!search ? (
                  <Button variant="outlined" icon="plus" onClick={() => { setModal({ type: 'add' }); }}>
                    Add your first product
                  </Button>
                ) : undefined}
              />
            ) : (
              <HTMLTable interactive className="w-full">
                <thead>
                  <tr>
                    <th className="w-8 px-3">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
                      />
                    </th>
                    <th className="w-10" />
                    <th>Product</th>
                    {colSku && <th>SKU</th>}
                    <th>Category</th>
                    {locations.length > 0 && colLocation && <th>Location</th>}
                    <th className="text-right">Stock ✎</th>
                    {colValue && <th className="text-right">Value</th>}
                    {colStatus && <th>Status</th>}
                    {colDays && <th>Days Left · Burn</th>}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {/* Spacer row to position virtualized rows */}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: rowVirtualizer.getVirtualItems()[0].start }} />
                  )}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const product = filtered[virtualRow.index]
                    const rowMenu = (
                      <Menu>
                        <MenuItem
                          icon="layers"
                          text="Manage Variants"
                          onClick={() => { setModal({ type: 'variants', product }) }}
                        />
                        <MenuItem
                          icon="settings"
                          text="Adjust Stock"
                          disabled={product.product_variants.length === 0}
                          onClick={() => { setModal({ type: 'adjust', product }) }}
                        />
                        <MenuItem
                          icon="history"
                          text="View History"
                          disabled={product.product_variants.length === 0}
                          onClick={() => { setModal({ type: 'history', product }) }}
                        />
                        <MenuItem
                          icon="swap-horizontal"
                          text="Transfer Stock"
                          disabled={product.product_variants.length === 0}
                          onClick={() => { setTransferVariant(product.product_variants[0]) }}
                        />
                        <MenuItem
                          icon="barcode"
                          text="Print Labels"
                          onClick={() => { void handlePrintLabels(product) }}
                        />
                        <MenuDivider />
                        <MenuItem
                          icon="edit"
                          text="Edit"
                          onClick={() => { setModal({ type: 'edit', product }) }}
                        />
                        <MenuItem
                          icon="trash"
                          text="Delete"
                          intent={Intent.DANGER}
                          onClick={() => { deleteProduct.mutate(product.id) }}
                        />
                      </Menu>
                    )
                    return (
                    <tr
                      key={product.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className={selected.has(product.id) ? 'bg-primary/5' : undefined}
                    >
                      <td className="px-3">
                        <input
                          type="checkbox"
                          checked={selected.has(product.id)}
                          onChange={() => { toggleSelect(product.id) }}
                          className="h-3.5 w-3.5 rounded border-muted-foreground/30 accent-primary"
                        />
                      </td>
                      <td>
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-9 w-9 rounded-md object-cover border" />
                        ) : (
                          <div className="h-9 w-9 rounded-md bg-muted border flex items-center justify-center text-muted-foreground/40 text-xs">—</div>
                        )}
                      </td>
                      <td>
                        <div>
                          <EntityLink type="product" id={product.id} className="font-medium text-sm">{product.name}</EntityLink>
                          {product.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-xs">{product.description}</p>
                          )}
                          {product.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {product.tags.map((tag) => (
                                <button
                                  key={tag}
                                  onClick={() => { setTagFilter(tagFilter === tag ? null : tag) }}
                                  className={cn(
                                    'rounded-full border px-2 py-px text-[10px] font-medium transition-colors',
                                    tagFilter === tag
                                      ? 'bg-primary text-primary-foreground border-primary'
                                      : 'bg-muted text-muted-foreground hover:text-foreground',
                                  )}
                                >
                                  {tag}
                                </button>
                              ))}
                            </div>
                          )}
                          <RowIntelStrip
                            product={product}
                            forecastMap={forecastMap}
                            intelligenceMap={intelligenceMap}
                            wasteRadarIds={wasteRadarIds}
                            openRestockIds={openRestockIds}
                            suppliersMap={suppliersMap}
                            onRequestRestock={(variantId, qty) => {
                              createRestock.mutate({ variantId, quantityNeeded: qty })
                            }}
                          />
                        </div>
                      </td>
                      {colSku && <td className="text-muted-foreground font-mono text-sm">{product.sku}</td>}

                      {/* Inline category select */}
                      <td>
                        <HTMLSelect
                          value={product.category_id ?? '__none__'}
                          onChange={(e) => {
                            updateProduct.mutate({
                              id: product.id,
                              input: { category_id: e.target.value === '__none__' ? null : e.target.value },
                            })
                          }}
                          options={[
                            { value: '__none__', label: '—' },
                            ...categories.map((cat) => ({ value: cat.id, label: cat.name })),
                          ]}
                          minimal
                          className="!w-36"
                        />
                      </td>

                      {locations.length > 0 && colLocation && (
                        <td className="text-xs text-muted-foreground">
                          {(() => {
                            const locIds = [...new Set(product.product_variants.map((v) => v.location_id).filter(Boolean))]
                            if (locIds.length === 0) return '—'
                            if (locIds.length === 1) return locationNameMap.get(locIds[0] ?? '') ?? '—'
                            return `${String(locIds.length)} locations`
                          })()}
                        </td>
                      )}
                      <td className="text-right">
                        <InlineStockCell
                          product={product}
                          forecastMap={forecastMap}
                          intelligenceMap={intelligenceMap}
                          onOpenModal={() => { setModal({ type: 'adjust', product }) }}
                        />
                      </td>
                      {colValue && (
                        <td className="text-right tabular-nums text-sm text-muted-foreground">
                          {formatCurrency(
                            product.product_variants.reduce((s, v) => s + v.current_stock * v.cost, 0),
                            currency
                          )}
                        </td>
                      )}
                      {colStatus && (
                        <td>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <StockBadge variants={product.product_variants} />
                            {isOverstock(product) && (
                              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                Overstock
                              </span>
                            )}
                            {product.product_variants.some((v) => wasteRadarIds.has(v.id)) && (
                              <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-medium text-orange-700 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-400">
                                waste
                              </span>
                            )}
                          </div>
                        </td>
                      )}
                      {colDays && (
                        <td>
                          <DaysLeft
                            variantIds={product.product_variants.map((v) => v.id)}
                            currentStocks={product.product_variants.map((v) => v.current_stock)}
                            forecastMap={forecastMap}
                            intelligenceMap={intelligenceMap}
                          />
                        </td>
                      )}
                      <td>
                        <Popover content={rowMenu} placement="bottom-end">
                          <Button variant="minimal" size="small" icon="more" aria-label="Row actions" />
                        </Popover>
                      </td>
                    </tr>
                    )
                  })}
                  {/* Bottom spacer for correct scroll height */}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0) }} />
                  )}
                </tbody>
              </HTMLTable>
            )}
          </div>
      </div>

      {/* Modals */}
      <ProductFormModal
        open={modal?.type === 'add' || modal?.type === 'edit'}
        onClose={() => { setModal(null); }}
        product={modal?.type === 'edit' ? modal.product : null}
      />
      {modal?.type === 'adjust' && (
        <StockAdjustModal open onClose={() => { setModal(null); }} product={modal.product} prefill={modal.prefill} />
      )}
      {modal?.type === 'history' && (
        <StockLogDrawer open onClose={() => { setModal(null); }} product={modal.product} />
      )}
      <ImportModal open={importOpen} onClose={() => { setImportOpen(false); }} />
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={`Delete ${String(selected.size)} product${selected.size !== 1 ? 's' : ''}?`}
        description="All variants and stock history will be permanently removed."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmBulkDelete}
        onCancel={() => { setBulkDeleteConfirm(false) }}
      />
      {modal?.type === 'variants' && (
        <VariantManagerDrawer open onClose={() => { setModal(null); }} product={modal.product} />
      )}
      {transferVariant && (
        <TransferModal
          open={!!transferVariant}
          onClose={() => { setTransferVariant(null) }}
          sourceVariant={transferVariant}
        />
      )}

      {/* Par Optimizer drawer */}
      <Drawer
        isOpen={parOptimizerOpen}
        onClose={() => { setParOptimizerOpen(false) }}
        position="right"
        size="80%"
        title="Par Level Optimizer"
        className="!p-0"
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          <ParOptimizerContent />
        </div>
      </Drawer>
    </div>
  )
}
