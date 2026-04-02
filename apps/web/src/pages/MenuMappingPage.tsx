// Layer: Mind — F&B Menu Mapping
// Admin-only setup page. Maps menu items to their stock ingredients (Reality Graph
// "contains" edges). Each POS sale triggers automatic stock decrements via these bindings.
// Palantir principle: data structure as operational infrastructure — the map IS the engine.

import { useState, useCallback } from 'react'
import {
  Plus, ChevronDown, ChevronRight, Pencil, Trash2,
  Loader2, UtensilsCrossed, Wifi, WifiOff, Clock,
  Package, AlertCircle, Check, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth.store'
import { useMenuItems, useCreateMenuItem, useUpdateMenuItem, useDeleteMenuItem,
         useAddIngredient, useUpdateIngredient, useRemoveIngredient, usePOSHealth } from '@/features/fb/hooks'
import { useProducts } from '@/features/inventory/hooks'
import type { MenuItemWithIngredients, MenuItemIngredient, POSHealthRow } from '@beacon/types'

// ─── POS health badge ──────────────────────────────────────────────────────────

function POSHealthBadge({ rows }: { rows: POSHealthRow[] }) {
  if (rows.length === 0) return null

  const order = { connected: 0, warning: 1, disconnected: 2, never_connected: 3 } as const
  const worst = rows.reduce((acc, r) =>
    (order[r.status] ?? 0) > (order[acc.status] ?? 0) ? r : acc
  )

  const CFG = {
    connected:       { icon: Wifi,    color: 'text-green-600 dark:text-green-400',   bg: 'bg-green-50 dark:bg-green-950/30',   label: 'POS connected' },
    warning:         { icon: Clock,   color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/20', label: 'POS delayed' },
    disconnected:    { icon: WifiOff, color: 'text-red-600 dark:text-red-400',       bg: 'bg-red-50 dark:bg-red-950/20',       label: 'POS disconnected' },
    never_connected: { icon: WifiOff, color: 'text-muted-foreground',               bg: 'bg-muted/40',                        label: 'POS not connected' },
  } as const

  const cfg  = CFG[worst.status]
  const Icon = cfg.icon
  const sub  = worst.status === 'never_connected'
    ? `${worst.source_system} · no events`
    : worst.status === 'connected'
      ? `${worst.source_system} · ${String(worst.total_events)} events`
      : `${worst.source_system} · ${worst.hours_since_last != null ? `${String(worst.hours_since_last)}h ago` : 'unknown'}`

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1', cfg.bg)}>
      <Icon className={cn('h-3 w-3', cfg.color)} />
      <span className={cn('text-[11px] font-medium', cfg.color)}>{cfg.label}</span>
      <span className="text-[10px] text-muted-foreground">· {sub}</span>
    </div>
  )
}

// ─── Add / edit menu item form ────────────────────────────────────────────────

function MenuItemForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: { name: string; category: string; sell_price: string }
  onSave: (v: { name: string; category: string | null; sell_price: number | null }) => void
  onCancel: () => void
}) {
  const [name,       setName]       = useState(initial?.name       ?? '')
  const [category,   setCategory]   = useState(initial?.category   ?? '')
  const [sellPrice,  setSellPrice]  = useState(initial?.sell_price ?? '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      name:       name.trim(),
      category:   category.trim() || null,
      sell_price: sellPrice !== '' ? parseFloat(sellPrice) : null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/20">
      <input
        autoFocus
        value={name}
        onChange={(e) => { setName(e.target.value) }}
        placeholder="Menu item name *"
        className="flex-1 min-w-0 rounded border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
      />
      <input
        value={category}
        onChange={(e) => { setCategory(e.target.value) }}
        placeholder="Category"
        className="w-28 rounded border bg-background px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary/40"
      />
      <input
        type="number"
        min={0}
        step={0.01}
        value={sellPrice}
        onChange={(e) => { setSellPrice(e.target.value) }}
        placeholder="Sell price"
        className="w-24 rounded border bg-background px-2 py-1.5 text-sm text-right outline-none focus:ring-1 focus:ring-primary/40 tabular-nums"
      />
      <button type="submit" className="rounded p-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
        <Check className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={onCancel} className="rounded p-1.5 hover:bg-muted">
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  )
}

// ─── Add ingredient row ───────────────────────────────────────────────────────

interface VariantOption { id: string; label: string; sku: string }

function AddIngredientRow({
  menuItemId,
  variants,
  usedVariantIds,
  onAdd,
  onCancel,
}: {
  menuItemId:     string
  variants:       VariantOption[]
  usedVariantIds: Set<string>
  onAdd:          (v: { menu_item_id: string; variant_id: string; qty_per_serve: number; unit: string | null }) => void
  onCancel:       () => void
}) {
  const [variantId, setVariantId] = useState('')
  const [qty,       setQty]       = useState('')
  const [unit,      setUnit]      = useState('')
  const [search,    setSearch]    = useState('')

  const filtered = variants.filter(
    (v) => !usedVariantIds.has(v.id) &&
      (v.label.toLowerCase().includes(search.toLowerCase()) ||
       v.sku.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 12)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = parseFloat(qty)
    if (!variantId || isNaN(q) || q <= 0) return
    onAdd({ menu_item_id: menuItemId, variant_id: variantId, qty_per_serve: q, unit: unit.trim() || null })
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/10 mt-1">
      <div className="flex-1 min-w-0 relative">
        {variantId ? (
          <div className="flex items-center gap-1.5">
            <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium truncate">
              {variants.find((v) => v.id === variantId)?.label ?? variantId}
            </span>
            <button type="button" onClick={() => { setVariantId(''); setSearch('') }} className="ml-auto text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              placeholder="Search ingredient…"
              className="w-full rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/40"
            />
            {search && filtered.length > 0 && (
              <div className="absolute top-full left-0 z-20 mt-0.5 w-full rounded-lg border bg-popover shadow-lg py-1 max-h-40 overflow-y-auto">
                {filtered.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted flex items-center gap-2"
                    onClick={() => { setVariantId(v.id); setSearch('') }}
                  >
                    <span className="font-medium truncate">{v.label}</span>
                    <span className="font-mono text-muted-foreground ml-auto flex-shrink-0">{v.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <input
        type="number"
        min={0.001}
        step={0.001}
        value={qty}
        onChange={(e) => { setQty(e.target.value) }}
        placeholder="Qty/serve"
        className="w-20 rounded border bg-background px-2 py-1.5 text-xs text-right outline-none focus:ring-1 focus:ring-primary/40 tabular-nums"
      />
      <input
        value={unit}
        onChange={(e) => { setUnit(e.target.value) }}
        placeholder="unit"
        className="w-14 rounded border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary/40"
      />
      <button type="submit" className="rounded p-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
        <Check className="h-3 w-3" />
      </button>
      <button type="button" onClick={onCancel} className="rounded p-1.5 hover:bg-muted">
        <X className="h-3 w-3" />
      </button>
    </form>
  )
}

// ─── Ingredient row ───────────────────────────────────────────────────────────

function IngredientRow({
  ing,
  onUpdate,
  onRemove,
}: {
  ing:      MenuItemIngredient & { product_variants: { id: string; name: string; sku: string; cost: number; products: { name: string } } }
  onUpdate: (id: string, patch: Partial<{ qty_per_serve: number; unit: string | null }>) => void
  onRemove: (id: string) => void
}) {
  const [editing, setEditing]   = useState(false)
  const [qty,     setQty]       = useState(String(ing.qty_per_serve))
  const [unit,    setUnit]      = useState(ing.unit ?? '')

  const handleSave = () => {
    const q = parseFloat(qty)
    if (!isNaN(q) && q > 0) {
      onUpdate(ing.id, { qty_per_serve: q, unit: unit.trim() || null })
    }
    setEditing(false)
  }

  const pv = ing.product_variants

  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/20 group">
      <Package className="h-3 w-3 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium">{pv.products.name}</span>
        {pv.name !== 'Standard' && (
          <span className="text-xs text-muted-foreground"> — {pv.name}</span>
        )}
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">{pv.sku}</span>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            autoFocus
            type="number"
            min={0.001}
            step={0.001}
            value={qty}
            onChange={(e) => { setQty(e.target.value) }}
            className="w-16 rounded border bg-background px-1.5 py-0.5 text-xs text-right outline-none focus:ring-1 focus:ring-primary/40 tabular-nums"
          />
          <input
            value={unit}
            onChange={(e) => { setUnit(e.target.value) }}
            placeholder="unit"
            className="w-12 rounded border bg-background px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button type="button" onClick={handleSave} className="text-primary hover:text-primary/80">
            <Check className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => { setEditing(false) }} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs tabular-nums text-muted-foreground">
            {ing.qty_per_serve} {ing.unit ?? ''}
          </span>
          <div className="hidden group-hover:flex items-center gap-1">
            <button type="button" onClick={() => { setEditing(true) }} className="rounded p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground">
              <Pencil className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => { onRemove(ing.id) }} className="rounded p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Menu item card ───────────────────────────────────────────────────────────

function MenuItemCard({
  item,
  variants,
  onUpdate,
  onDelete,
}: {
  item:     MenuItemWithIngredients
  variants: VariantOption[]
  onUpdate: (id: string, patch: Partial<{ name: string; category: string | null; sell_price: number | null }>) => void
  onDelete: (id: string) => void
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [editing,     setEditing]     = useState(false)
  const [addingIng,   setAddingIng]   = useState(false)

  const addIngredient    = useAddIngredient()
  const updateIngredient = useUpdateIngredient()
  const removeIngredient = useRemoveIngredient()

  const usedVariantIds = new Set(item.menu_item_ingredients.map((i) => i.variant_id))
  const ingredientCount = item.menu_item_ingredients.length

  const handleUpdateIng = useCallback((id: string, patch: Partial<{ qty_per_serve: number; unit: string | null }>) => {
    updateIngredient.mutate({ id, patch })
  }, [updateIngredient])

  const handleRemoveIng = useCallback((id: string) => {
    removeIngredient.mutate(id)
  }, [removeIngredient])

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* Header */}
      {editing ? (
        <div className="p-2">
          <MenuItemForm
            initial={{ name: item.name, category: item.category ?? '', sell_price: item.sell_price != null ? String(item.sell_price) : '' }}
            onSave={(v) => { onUpdate(item.id, v); setEditing(false) }}
            onCancel={() => { setEditing(false) }}
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => { setExpanded((v) => !v) }}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
            <span className="text-sm font-medium truncate">{item.name}</span>
            {item.category && (
              <span className="text-[10px] text-muted-foreground border rounded-full px-1.5 py-0.5 flex-shrink-0">{item.category}</span>
            )}
            <span className="ml-auto flex-shrink-0 text-[10px] text-muted-foreground">
              {ingredientCount} ingredient{ingredientCount !== 1 ? 's' : ''}
            </span>
            {item.sell_price != null && (
              <span className="flex-shrink-0 text-[10px] text-muted-foreground tabular-nums ml-2">
                @ {item.sell_price.toFixed(2)}
              </span>
            )}
          </button>
          <button type="button" onClick={() => { setEditing(true) }} className="flex-shrink-0 rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100">
            <Pencil className="h-3 w-3" />
          </button>
          <button type="button" onClick={() => { onDelete(item.id) }} className="flex-shrink-0 rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Ingredients accordion */}
      {expanded && (
        <div className="border-t px-3 py-2 space-y-0.5 bg-muted/10">
          {item.menu_item_ingredients.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No ingredients mapped yet.</p>
          ) : (
            item.menu_item_ingredients.map((ing) => (
              <IngredientRow
                key={ing.id}
                ing={ing as MenuItemIngredient & { product_variants: { id: string; name: string; sku: string; cost: number; products: { name: string } } }}
                onUpdate={handleUpdateIng}
                onRemove={handleRemoveIng}
              />
            ))
          )}

          {addingIng ? (
            <AddIngredientRow
              menuItemId={item.id}
              variants={variants}
              usedVariantIds={usedVariantIds}
              onAdd={(payload) => {
                addIngredient.mutate(payload)
                setAddingIng(false)
              }}
              onCancel={() => { setAddingIng(false) }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { setAddingIng(true) }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mt-1 py-0.5"
            >
              <Plus className="h-3 w-3" />
              Add ingredient
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MenuMappingPage() {
  const role = useAuthStore((s) => s.role ?? 'limited_access')

  const [addingItem, setAddingItem]   = useState(false)
  const [filterCat,  setFilterCat]    = useState<string | null>(null)
  const [search,     setSearch]       = useState('')

  const { data: items = [], isLoading: itemsLoading } = useMenuItems()
  const { data: posHealth = [] }                       = usePOSHealth()
  const createMenuItem  = useCreateMenuItem()
  const updateMenuItem  = useUpdateMenuItem()
  const deleteMenuItem  = useDeleteMenuItem()

  // Build flat variant list for ingredient search
  const { data: products = [] } = useProducts()
  const allVariants: VariantOption[] = (products as { name: string; product_variants: { id: string; name: string; sku: string }[] }[])
    .flatMap((p) => p.product_variants.map((v) => ({
      id:    v.id,
      label: v.name === 'Standard' ? p.name : `${p.name} — ${v.name}`,
      sku:   v.sku,
    })))

  if (!['admin', 'owner'].includes(role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm font-medium">Admin access required</p>
        <p className="text-xs text-muted-foreground">Menu mapping is available to admins and owners.</p>
      </div>
    )
  }

  // Unique categories for filter chips
  const categories = [...new Set(items.map((i) => i.category).filter(Boolean) as string[])].sort()

  const displayedItems = items.filter((i) => {
    if (filterCat && i.category !== filterCat) return false
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Mind · Menu Mapping</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bind menu items to stock ingredients. Every POS sale auto-decrements inventory.
          </p>
        </div>
        {posHealth.length > 0 && <POSHealthBadge rows={posHealth} />}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 px-8 py-3 border-b flex-shrink-0 flex-wrap">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value) }}
          placeholder="Search menu items…"
          className="h-7 w-48 rounded border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-primary/40"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
              filterCat === null ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
            onClick={() => { setFilterCat(null) }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                filterCat === cat ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted')}
              onClick={() => { setFilterCat(cat) }}
            >
              {cat}
            </button>
          ))}
        </div>
        <button
          className="ml-auto flex items-center gap-1.5 rounded-lg border bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90"
          onClick={() => { setAddingItem(true) }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add menu item
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-5">
        {addingItem && (
          <div className="mb-3">
            <MenuItemForm
              onSave={(v) => { createMenuItem.mutate(v); setAddingItem(false) }}
              onCancel={() => { setAddingItem(false) }}
            />
          </div>
        )}

        {itemsLoading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading menu…</span>
          </div>
        ) : displayedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <UtensilsCrossed className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">No menu items yet</p>
            <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
              Add menu items and bind each one to its stock ingredients.
              Once mapped, POS sales will automatically decrement inventory.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-w-3xl">
            {displayedItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                variants={allVariants}
                onUpdate={(id, patch) => { updateMenuItem.mutate({ id, patch }) }}
                onDelete={(id) => { deleteMenuItem.mutate(id) }}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
