// Layer: Flow — Reality Graph Explorer / Ontology Browser
// The single source of truth for why the world is the way it is.
// Surfaces the causal edge graph (consumes → restocks → reverts → alerts)
// for any variant. Operators investigate: "how did stock get here?"
// Palantir principle: auditability as a first-class feature.
// Sprint A: added node-type browser to explore the full ontology.

import { useMemo, useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Network, Search, Package, ChevronDown, ChevronRight,
  TrendingDown, TrendingUp, Minus, Info,
  Truck, ShoppingCart, GitBranch,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useProducts } from '@/features/inventory/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useRestockRequests } from '@/features/restock/hooks'
import { useActiveHotel } from '@/features/hotel/hooks'
import { FlowGraph } from '@/features/graph'
import { GraphConnections } from '@/components/GraphConnections'
import { EntityLink } from '@/components/EntityLink'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import type { ProductWithVariants, ProductVariant } from '@beacon/types'

// ─── Node type browser tabs ──────────────────────────────────────────────────

type BrowseNodeType = 'variant' | 'supplier' | 'restock_request'

const NODE_TYPE_TABS: { id: BrowseNodeType; label: string; icon: React.ElementType }[] = [
  { id: 'variant',         label: 'Variants',  icon: Package },
  { id: 'supplier',        label: 'Suppliers',  icon: Truck },
  { id: 'restock_request', label: 'Restocks',   icon: ShoppingCart },
]

// ─── Variant health dot ────────────────────────────────────────────────────────

function HealthDot({ variant }: { variant: ProductVariant }) {
  if (variant.current_stock === 0) {
    return <span className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" title="Out of stock" />
  }
  if (
    variant.low_stock_threshold > 0 &&
    variant.current_stock <= variant.low_stock_threshold
  ) {
    return <span className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" title="Low stock" />
  }
  return <span className="h-2 w-2 rounded-full bg-green-500 flex-shrink-0" title="In stock" />
}

// ─── Left panel — variant selector ────────────────────────────────────────────

interface VariantSelectorProps {
  products: ProductWithVariants[]
  selectedId: string | null
  onSelect: (variantId: string, label: string, sku: string, stock: number, cost: number) => void
  search: string
  onSearch: (q: string) => void
}

interface VariantEntry {
  product: ProductWithVariants
  variant: ProductVariant
  displayName: string
}

function VariantSelector({ products, selectedId, onSelect, search, onSearch }: VariantSelectorProps) {
  // Flat list filtered by search
  const flat = useMemo<VariantEntry[]>(() => {
    const q = search.trim().toLowerCase()
    const entries: VariantEntry[] = []
    for (const p of products) {
      for (const v of p.product_variants) {
        const displayName = v.name !== 'Standard' ? `${p.name} — ${v.name}` : p.name
        if (
          !q ||
          p.name.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q)
        ) {
          entries.push({ product: p, variant: v, displayName })
        }
      }
    }
    return entries
  }, [products, search])

  // Group by product for display when not searching
  const grouped = useMemo<{ product: ProductWithVariants; variants: VariantEntry[] }[]>(() => {
    const map = new Map<string, { product: ProductWithVariants; variants: VariantEntry[] }>()
    for (const entry of flat) {
      const existing = map.get(entry.product.id)
      if (existing) {
        existing.variants.push(entry)
      } else {
        map.set(entry.product.id, { product: entry.product, variants: [entry] })
      }
    }
    return [...map.values()]
  }, [flat])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (productId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const isSearching = search.trim().length > 0

  return (
    <div className="flex flex-col h-full border-r">
      {/* Search */}
      <div className="p-3 border-b flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search variants or SKU…"
            value={search}
            onChange={(e) => { onSearch(e.target.value) }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          {flat.length} variant{flat.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isSearching ? (
          // Flat search results
          <div className="space-y-0.5 p-2">
            {flat.map(({ variant, displayName }) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => {
                  onSelect(variant.id, displayName, variant.sku, variant.current_stock, variant.cost)
                }}
                className={cn(
                  'w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                  selectedId === variant.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
              >
                <HealthDot variant={variant} />
                <span className="flex-1 truncate text-xs font-medium">{displayName}</span>
                <span className={cn(
                  'text-[10px] font-mono shrink-0',
                  selectedId === variant.id ? 'text-primary-foreground/70' : 'text-muted-foreground',
                )}>
                  {variant.sku}
                </span>
              </button>
            ))}
          </div>
        ) : (
          // Grouped by product
          <div className="py-1">
            {grouped.map(({ product, variants }) => {
              const isOpen = !collapsed.has(product.id)
              return (
                <div key={product.id}>
                  {/* Product header */}
                  <button
                    type="button"
                    onClick={() => { toggle(product.id) }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    {isOpen
                      ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate text-xs font-semibold">{product.name}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {variants.length}
                    </span>
                  </button>

                  {/* Variant rows */}
                  {isOpen && variants.map(({ variant, displayName }) => (
                    <button
                      key={variant.id}
                      type="button"
                      onClick={() => {
                        onSelect(
                          variant.id,
                          displayName,
                          variant.sku,
                          variant.current_stock,
                          variant.cost,
                        )
                      }}
                      className={cn(
                        'flex w-full items-center gap-2 pl-9 pr-3 py-1.5 text-left text-xs transition-colors',
                        selectedId === variant.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted',
                      )}
                    >
                      <HealthDot variant={variant} />
                      <span className="flex-1 truncate">
                        {variant.name === 'Standard' ? product.name : variant.name}
                      </span>
                      <span className={cn(
                        'font-mono text-[10px] shrink-0',
                        selectedId === variant.id ? 'text-primary-foreground/70' : 'text-muted-foreground',
                      )}>
                        {variant.current_stock}
                      </span>
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Right panel header ────────────────────────────────────────────────────────

interface SelectedVariant {
  id: string
  displayName: string
  sku: string
  stock: number
  cost: number
}

function VariantHeader({
  selected,
  currency,
}: {
  selected: SelectedVariant
  currency: string
}) {
  const stockValue = selected.stock * selected.cost
  const stockStatus =
    selected.stock === 0 ? 'out'
    : selected.stock <= 5 ? 'low'
    : 'ok'

  return (
    <div className="flex items-start gap-6 border-b px-5 py-3 bg-surface-1 flex-shrink-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-semibold">{selected.displayName}</h2>
          <Badge variant="outline" className={cn(
            'text-[10px] h-5 px-1.5 font-semibold',
            stockStatus === 'out'
              ? 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400'
              : stockStatus === 'low'
                ? 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400'
                : 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400',
          )}>
            {stockStatus === 'out' ? 'Out of stock' : stockStatus === 'low' ? 'Low stock' : 'In stock'}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground font-mono">{selected.sku}</p>
      </div>

      <div className="flex items-center gap-6 shrink-0 text-sm">
        <div className="text-center">
          <p className={cn(
            'text-lg font-bold tabular-nums leading-none',
            stockStatus === 'out' ? 'text-red-600' : stockStatus === 'low' ? 'text-yellow-600' : '',
          )}>
            {selected.stock}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">units</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold tabular-nums leading-none">
            {formatCurrency(selected.cost, currency)}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">unit cost</p>
        </div>
        <div className="text-center">
          <p className={cn(
            'text-lg font-bold tabular-nums leading-none',
            stockValue === 0 ? 'text-muted-foreground' : '',
          )}>
            {stockValue > 0 ? formatCurrency(stockValue, currency) : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">stock value</p>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SelectedNode {
  type: BrowseNodeType
  id: string
  displayName: string
  // Variant-specific fields (only when type === 'variant')
  sku?: string
  stock?: number
  cost?: number
}

export default function GraphPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: products = [], isLoading } = useProducts()
  const { data: suppliers = [] } = useSuppliers()
  const { data: restocks = [] } = useRestockRequests()
  const activeHotel = useActiveHotel()
  const currency    = activeHotel?.currency ?? 'USD'

  const [search, setSearch] = useState('')
  const [browseType, setBrowseType] = useState<BrowseNodeType>('variant')
  const [selected, setSelected] = useState<SelectedNode | null>(null)

  // Restore selected variant from URL on mount / when products load
  const urlVariantId = searchParams.get('variant')
  useEffect(() => {
    if (!urlVariantId || products.length === 0 || selected?.id === urlVariantId) return
    for (const p of products) {
      const v = p.product_variants.find((pv) => pv.id === urlVariantId)
      if (v) {
        const displayName = v.name !== 'Standard' ? `${p.name} — ${v.name}` : p.name
        setSelected({ type: 'variant', id: v.id, displayName, sku: v.sku, stock: v.current_stock, cost: v.cost })
        break
      }
    }
  }, [urlVariantId, products, selected?.id])

  const handleSelectVariant = (variantId: string, displayName: string, sku: string, stock: number, cost: number) => {
    setSelected({ type: 'variant', id: variantId, displayName, sku, stock, cost })
    setSearchParams({ variant: variantId }, { replace: true })
  }

  const totalVariants = useMemo(
    () => products.reduce((s, p) => s + p.product_variants.length, 0),
    [products],
  )

  // Filter suppliers by search
  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(q) || (s.email ?? '').toLowerCase().includes(q)
    )
  }, [suppliers, search])

  // Filter restocks by search
  const filteredRestocks = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return restocks
    return restocks.filter((r) =>
      r.status.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    )
  }, [restocks, search])

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div className="page-header justify-between">
        <div>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-primary" />
            <h1 className="text-base font-semibold">Ontology Browser</h1>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isLoading
              ? 'Loading…'
              : `${String(totalVariants)} variants · ${String(suppliers.length)} suppliers · ${String(restocks.length)} restocks`}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
          <span>Browse any entity to see its graph connections</span>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — node type browser */}
        <div className="w-64 flex-shrink-0 flex flex-col border-r border-border bg-surface-1">
          {/* Node type tabs */}
          <div className="flex border-b border-border shrink-0">
            {NODE_TYPE_TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => { setBrowseType(tab.id); setSelected(null) }}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 px-2 py-2 text-[10px] font-medium border-b-2 transition-colors',
                    browseType === tab.id
                      ? 'border-primary text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Variant list */}
          {browseType === 'variant' && (
            <VariantSelector
              products={products}
              selectedId={selected?.type === 'variant' ? selected.id : null}
              onSelect={handleSelectVariant}
              search={search}
              onSearch={setSearch}
            />
          )}

          {/* Supplier list */}
          {browseType === 'supplier' && (
            <div className="flex flex-col h-full">
              <div className="p-3 border-b flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search suppliers…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value) }}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 p-2">
                {filteredSuppliers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelected({ type: 'supplier', id: s.id, displayName: s.name }) }}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                      selected?.id === s.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <Truck className="h-3 w-3 flex-shrink-0" />
                    <span className="flex-1 truncate font-medium">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Restock list */}
          {browseType === 'restock_request' && (
            <div className="flex flex-col h-full">
              <div className="p-3 border-b flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search restocks…"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value) }}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {filteredRestocks.length} request{filteredRestocks.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-0.5 p-2">
                {filteredRestocks.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { setSelected({ type: 'restock_request', id: r.id, displayName: `Restock #${r.id.slice(0, 8)}` }) }}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors',
                      selected?.id === r.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <ShoppingCart className="h-3 w-3 flex-shrink-0" />
                    <span className="flex-1 truncate font-medium">#{r.id.slice(0, 8)}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{r.status}</Badge>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right — detail pane */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selected?.type === 'variant' && selected.sku != null ? (
            <>
              <VariantHeader
                selected={{
                  id: selected.id,
                  displayName: selected.displayName,
                  sku: selected.sku,
                  stock: selected.stock ?? 0,
                  cost: selected.cost ?? 0,
                }}
                currency={currency}
              />
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="max-w-2xl space-y-6">
                  {/* Graph connections */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Graph Connections</span>
                    </div>
                    <PanelErrorBoundary name="Graph Connections">
                      <GraphConnections nodeType="variant" nodeId={selected.id} />
                    </PanelErrorBoundary>
                  </div>

                  {/* Causal Edge Timeline */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Network className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Causal Edge Timeline</span>
                      <span className="text-xs text-muted-foreground">
                        · most recent first · revert chains shown inline
                      </span>
                    </div>
                    <FlowGraph variantId={selected.id} variantName={selected.displayName} currentStock={selected.stock ?? 0} />
                  </div>
                </div>
              </div>
            </>
          ) : selected ? (
            /* Non-variant node: show name + graph connections */
            <div className="flex-1 overflow-y-auto">
              <div className="flex items-start gap-4 border-b px-5 py-3 bg-surface-1 flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  {browseType === 'supplier' && <Truck className="h-4 w-4" />}
                  {browseType === 'restock_request' && <ShoppingCart className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold">{selected.displayName}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{selected.id}</p>
                </div>
                <EntityLink type={selected.type} id={selected.id} className="text-xs">
                  Open full page
                </EntityLink>
              </div>
              <div className="px-5 py-4 max-w-2xl space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Graph Connections</span>
                  </div>
                  <PanelErrorBoundary name="Graph Connections">
                    <GraphConnections nodeType={selected.type} nodeId={selected.id} />
                  </PanelErrorBoundary>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-5">
              <div className="rounded-full bg-muted/50 p-5">
                <Network className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-base font-medium">Select an entity</p>
                <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                  Choose any node from the left panel to explore its graph connections,
                  edge relationships, and causal history.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2 text-left max-w-lg">
                {[
                  { icon: TrendingDown, label: 'consumes', desc: 'Stock removed via adjustment or scan', cls: 'text-slate-500' },
                  { icon: TrendingUp,   label: 'restocks',  desc: 'Stock added via restock receive',    cls: 'text-green-500' },
                  { icon: Minus,        label: 'reverts',   desc: 'Correction of a prior event',        cls: 'text-amber-500' },
                ].map(({ icon: Icon, label, desc, cls }) => (
                  <div key={label} className="rounded-lg border bg-card p-3">
                    <div className={cn('flex items-center gap-1.5 mb-1', cls)}>
                      <Icon className="h-3.5 w-3.5" />
                      <span className="text-xs font-semibold">{label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
