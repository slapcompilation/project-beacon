// Layer: Mind — F&B Menu Mapping
// Admin-only setup page. Maps menu items to their stock ingredients (Reality Graph
// "contains" edges). Each POS sale triggers automatic stock decrements via these bindings.
// Palantir principle: data structure as operational infrastructure — the map IS the engine.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useCallback } from 'react'
import {
  Button,
  Card,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
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
    order[r.status] > order[acc.status] ? r : acc
  )

  const CFG: Record<POSHealthRow['status'], { icon: IconName; intent: Intent; label: string }> = {
    connected:       { icon: 'globe-network', intent: Intent.SUCCESS, label: 'POS connected' },
    warning:         { icon: 'time',          intent: Intent.WARNING, label: 'POS delayed' },
    disconnected:    { icon: 'offline',       intent: Intent.DANGER,  label: 'POS disconnected' },
    never_connected: { icon: 'offline',       intent: Intent.NONE,    label: 'POS not connected' },
  }

  const cfg = CFG[worst.status]
  const sub  = worst.status === 'never_connected'
    ? `${worst.source_system} · no events`
    : worst.status === 'connected'
      ? `${worst.source_system} · ${String(worst.total_events)} events`
      : `${worst.source_system} · ${worst.hours_since_last != null ? `${String(worst.hours_since_last)}h ago` : 'unknown'}`

  return (
    <Tag icon={cfg.icon} intent={cfg.intent} minimal round>
      {cfg.label} <span className="opacity-60">· {sub}</span>
    </Tag>
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 rounded border bg-muted/20">
      <InputGroup
        autoFocus
        value={name}
        onChange={(e) => { setName(e.target.value) }}
        placeholder="Menu item name *"
        className="flex-1 min-w-0"
      />
      <InputGroup
        value={category}
        onChange={(e) => { setCategory(e.target.value) }}
        placeholder="Category"
        className="w-28"
      />
      <InputGroup
        type="number"
        min={0}
        step={0.01}
        value={sellPrice}
        onChange={(e) => { setSellPrice(e.target.value) }}
        placeholder="Sell price"
        className="w-24 tabular-nums"
      />
      <Button type="submit" icon="tick" intent={Intent.PRIMARY} size="small" aria-label="Save" />
      <Button type="button" icon="cross" variant="minimal" size="small" onClick={onCancel} aria-label="Cancel" />
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 rounded border bg-muted/10 mt-1">
      <div className="flex-1 min-w-0 relative">
        {variantId ? (
          <div className="flex items-center gap-1.5">
            <Icon icon="box" size={12} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium truncate">
              {variants.find((v) => v.id === variantId)?.label ?? variantId}
            </span>
            <Button
              icon="cross"
              variant="minimal"
              size="small"
              aria-label="Clear selection"
              onClick={() => { setVariantId(''); setSearch('') }}
              className="ml-auto"
            />
          </div>
        ) : (
          <div className="relative">
            <InputGroup
              autoFocus
              leftIcon="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              placeholder="Search ingredient…"
            />
            {search && filtered.length > 0 && (
              <Card compact className="absolute top-full left-0 z-20 mt-0.5 w-full !p-1 max-h-40 overflow-y-auto">
                {filtered.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded flex items-center gap-2"
                    onClick={() => { setVariantId(v.id); setSearch('') }}
                  >
                    <span className="font-medium truncate">{v.label}</span>
                    <span className="font-mono text-muted-foreground ml-auto flex-shrink-0">{v.sku}</span>
                  </button>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>
      <InputGroup
        type="number"
        min={0.001}
        step={0.001}
        value={qty}
        onChange={(e) => { setQty(e.target.value) }}
        placeholder="Qty/serve"
        className="w-20 tabular-nums"
      />
      <InputGroup
        value={unit}
        onChange={(e) => { setUnit(e.target.value) }}
        placeholder="unit"
        className="w-14"
      />
      <Button type="submit" icon="tick" intent={Intent.PRIMARY} size="small" aria-label="Add" />
      <Button type="button" icon="cross" variant="minimal" size="small" onClick={onCancel} aria-label="Cancel" />
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
      <Icon icon="box" size={12} className="text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium">{pv.products.name}</span>
        {pv.name !== 'Standard' && (
          <span className="text-xs text-muted-foreground"> — {pv.name}</span>
        )}
        <span className="ml-2 font-mono text-[10px] text-muted-foreground">{pv.sku}</span>
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <InputGroup
            autoFocus
            type="number"
            min={0.001}
            step={0.001}
            value={qty}
            onChange={(e) => { setQty(e.target.value) }}
            className="w-16 tabular-nums"
          />
          <InputGroup
            value={unit}
            onChange={(e) => { setUnit(e.target.value) }}
            placeholder="unit"
            className="w-12"
          />
          <Button icon="tick" variant="minimal" intent={Intent.PRIMARY} size="small" onClick={handleSave} aria-label="Save" />
          <Button icon="cross" variant="minimal" size="small" onClick={() => { setEditing(false) }} aria-label="Cancel" />
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs tabular-nums text-muted-foreground">
            {ing.qty_per_serve} {ing.unit ?? ''}
          </span>
          <div className="hidden group-hover:flex items-center gap-1">
            <Button icon="edit" variant="minimal" size="small" onClick={() => { setEditing(true) }} aria-label="Edit ingredient" />
            <Button icon="trash" variant="minimal" size="small" intent={Intent.DANGER} onClick={() => { onRemove(ing.id) }} aria-label="Remove ingredient" />
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
    <Card compact className="!p-0 overflow-hidden">
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
        <div className="flex items-center gap-2 px-3 py-2.5 group">
          <button
            type="button"
            onClick={() => { setExpanded((v) => !v) }}
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
          >
            <Icon icon={expanded ? 'chevron-down' : 'chevron-right'} size={14} className="text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium truncate">{item.name}</span>
            {item.category && (
              <Tag minimal round>{item.category}</Tag>
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
          <Button
            icon="edit"
            variant="minimal"
            size="small"
            aria-label="Edit menu item"
            onClick={() => { setEditing(true) }}
            className="flex-shrink-0 !opacity-0 group-hover:!opacity-100"
          />
          <Button
            icon="trash"
            variant="minimal"
            size="small"
            intent={Intent.DANGER}
            aria-label="Delete menu item"
            onClick={() => { onDelete(item.id) }}
            className="flex-shrink-0"
          />
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
            <Button
              icon="plus"
              variant="minimal"
              size="small"
              onClick={() => { setAddingIng(true) }}
              className="mt-1"
            >
              Add ingredient
            </Button>
          )}
        </div>
      )}
    </Card>
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
      <NonIdealState
        icon="lock"
        title="Admin access required"
        description="Menu mapping is available to admins and owners."
      />
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
        <InputGroup
          leftIcon="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value) }}
          placeholder="Search menu items…"
          className="w-48"
        />
        <div className="flex items-center gap-1.5 flex-wrap">
          <Tag
            interactive
            minimal={filterCat !== null}
            intent={filterCat === null ? Intent.PRIMARY : Intent.NONE}
            round
            onClick={() => { setFilterCat(null) }}
          >
            All
          </Tag>
          {categories.map((cat) => (
            <Tag
              key={cat}
              interactive
              minimal={filterCat !== cat}
              intent={filterCat === cat ? Intent.PRIMARY : Intent.NONE}
              round
              onClick={() => { setFilterCat(cat) }}
            >
              {cat}
            </Tag>
          ))}
        </div>
        <Button
          icon="plus"
          intent={Intent.PRIMARY}
          size="small"
          className={cn('ml-auto')}
          onClick={() => { setAddingItem(true) }}
        >
          Add menu item
        </Button>
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
            <Spinner size={SpinnerSize.SMALL} />
            <span className="text-sm">Loading menu…</span>
          </div>
        ) : displayedItems.length === 0 ? (
          <NonIdealState
            icon="menu"
            title="No menu items yet"
            description="Add menu items and bind each one to its stock ingredients. Once mapped, POS sales will automatically decrement inventory."
          />
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
