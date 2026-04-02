// Layer: Floor — QR label generation and print management
// Palantir principle: operator-grade density — every action lives next to the data.
// Select by product, category, or search. Configure quantity + layout before print.

import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Printer, QrCode, CheckSquare2, Square, Search, ChevronDown,
  ChevronRight, Minus, Plus,
} from 'lucide-react'
import QRCode from 'qrcode'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useProducts } from '@/features/inventory/hooks'
import { useCategories } from '@/features/categories/hooks'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface LabelItem {
  variantId: string
  productName: string
  variantName: string
  sku: string
  categoryId: string | null | undefined
  copies: number // per-item quantity override
}

type LabelSize = 'small' | 'medium' | 'large'
type LayoutColumns = 2 | 3 | 4

const SIZE_CFG: Record<LabelSize, { label: string; canvasPx: number; printMm: number; fontSize: number }> = {
  small:  { label: 'Small',  canvasPx: 60,  printMm: 25, fontSize: 9  },
  medium: { label: 'Medium', canvasPx: 80,  printMm: 38, fontSize: 11 },
  large:  { label: 'Large',  canvasPx: 100, printMm: 50, fontSize: 13 },
}

const LAYOUT_CFG: Record<LayoutColumns, { label: string; cols: string }> = {
  2: { label: '2 cols', cols: 'repeat(2, 1fr)' },
  3: { label: '3 cols', cols: 'repeat(3, 1fr)' },
  4: { label: '4 cols', cols: 'repeat(4, 1fr)' },
}

// ─── QR canvas ──────────────────────────────────────────────────────────────

function QrCanvas({ text, size }: { text: string; size: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (ref.current) {
      void QRCode.toCanvas(ref.current, text, {
        width: size,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
    }
  }, [text, size])

  return <canvas ref={ref} />
}

// ─── Label preview chip ─────────────────────────────────────────────────────

function LabelChip({
  item,
  isChecked,
  copies,
  onToggle,
  onCopiesChange,
}: {
  item: LabelItem
  isChecked: boolean
  copies: number
  onToggle: () => void
  onCopiesChange: (n: number) => void
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        isChecked ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/30',
      )}
    >
      {/* Selection row */}
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 text-left"
      >
        {isChecked
          ? <CheckSquare2 className="h-4 w-4 shrink-0 text-primary" />
          : <Square className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <QrCode className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.productName}</p>
          {item.variantName !== 'Standard' && (
            <p className="truncate text-xs text-muted-foreground">{item.variantName}</p>
          )}
          <p className="truncate font-mono text-xs text-muted-foreground">{item.sku}</p>
        </div>
      </button>

      {/* Quantity copies row — only when selected */}
      {isChecked && (
        <div className="mt-2 flex items-center gap-2 border-t pt-2">
          <span className="text-[10px] text-muted-foreground font-medium">Copies</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { onCopiesChange(Math.max(1, copies - 1)) }}
              className="flex h-5 w-5 items-center justify-center rounded border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30"
              disabled={copies <= 1}
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-6 text-center text-xs font-semibold tabular-nums">{copies}</span>
            <button
              type="button"
              onClick={() => { onCopiesChange(Math.min(20, copies + 1)) }}
              className="flex h-5 w-5 items-center justify-center rounded border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30"
              disabled={copies >= 20}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {copies > 1 ? `${String(copies)}× labels` : '1 label'}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Print grid ─────────────────────────────────────────────────────────────

function PrintGrid({
  items,
  labelSize,
  columns,
}: {
  items: LabelItem[]
  labelSize: LabelSize
  columns: LayoutColumns
}) {
  const cfg = SIZE_CFG[labelSize]
  // Expand items by copies
  const expanded = items.flatMap((item) =>
    Array.from({ length: item.copies }, (_, i) => ({ ...item, _key: `${item.variantId}-${String(i)}` }))
  )

  return (
    <div className="hidden print:block">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-labels, .print-labels * { visibility: visible !important; }
          .print-labels { position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
      <div
        className="print-labels"
        style={{
          display: 'grid',
          gridTemplateColumns: LAYOUT_CFG[columns].cols,
          gap: '6px',
          padding: '12px',
        }}
      >
        {expanded.map((item) => (
          <div
            key={item._key}
            style={{
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              pageBreakInside: 'avoid',
            }}
          >
            <QrCanvas text={item.sku} size={cfg.canvasPx} />
            <div style={{ fontSize: `${String(cfg.fontSize)}px`, lineHeight: '1.4', minWidth: 0 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.productName}
              </div>
              {item.variantName !== 'Standard' && (
                <div style={{ color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.variantName}
                </div>
              )}
              <div style={{ fontFamily: 'monospace', marginTop: '2px', color: '#333' }}>{item.sku}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Category group ─────────────────────────────────────────────────────────

function CategoryGroup({
  categoryName,
  items,
  selectedIds,
  copiesMap,
  onToggle,
  onCopiesChange,
  onToggleAll,
}: {
  categoryName: string
  items: LabelItem[]
  selectedIds: Set<string>
  copiesMap: Map<string, number>
  onToggle: (id: string) => void
  onCopiesChange: (id: string, n: number) => void
  onToggleAll: (ids: string[]) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const allSelected = items.every((i) => selectedIds.has(i.variantId))
  const someSelected = items.some((i) => selectedIds.has(i.variantId))
  const selectedCount = items.filter((i) => selectedIds.has(i.variantId)).length

  return (
    <div className="rounded-lg border overflow-hidden">
      {/* Category header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b">
        <button
          type="button"
          onClick={() => { setExpanded((v) => !v) }}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          <span className="text-sm font-semibold truncate">{categoryName}</span>
          <span className="text-xs text-muted-foreground shrink-0">{items.length} variant{items.length !== 1 ? 's' : ''}</span>
        </button>
        {/* Select all in group */}
        <button
          type="button"
          onClick={() => { onToggleAll(items.map((i) => i.variantId)) }}
          className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {allSelected ? (
            <CheckSquare2 className="h-4 w-4 text-primary" />
          ) : someSelected ? (
            <CheckSquare2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {selectedCount > 0 ? `${String(selectedCount)} selected` : 'Select all'}
        </button>
      </div>

      {/* Items grid */}
      {expanded && (
        <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <LabelChip
              key={item.variantId}
              item={item}
              isChecked={selectedIds.has(item.variantId)}
              copies={copiesMap.get(item.variantId) ?? 1}
              onToggle={() => { onToggle(item.variantId) }}
              onCopiesChange={(n) => { onCopiesChange(item.variantId, n) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function LabelsPage() {
  const { data: products = [], isLoading } = useProducts()
  const { data: categories = [] } = useCategories()

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [copiesMap, setCopiesMap] = useState<Map<string, number>>(new Map())
  const [showPrint, setShowPrint] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('__all__')
  const [labelSize, setLabelSize] = useState<LabelSize>('medium')
  const [printColumns, setPrintColumns] = useState<LayoutColumns>(3)

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  )

  // All label items (filtered)
  const allVariants = useMemo((): LabelItem[] => {
    const q = search.trim().toLowerCase()
    return products
      .filter((p) => {
        if (categoryFilter !== '__all__' && p.category_id !== categoryFilter) return false
        if (q) {
          return (
            p.name.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.product_variants.some((v) => v.sku.toLowerCase().includes(q) || v.name.toLowerCase().includes(q))
          )
        }
        return true
      })
      .flatMap((p) =>
        p.product_variants.map((v) => ({
          variantId: v.id,
          productName: p.name,
          variantName: v.name,
          sku: v.sku,
          categoryId: p.category_id,
          copies: 1,
        }))
      )
  }, [products, search, categoryFilter])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, LabelItem[]>()
    for (const item of allVariants) {
      const key = item.categoryId ? (categoryNameMap.get(item.categoryId) ?? 'Uncategorised') : 'Uncategorised'
      const arr = map.get(key) ?? []
      arr.push(item)
      map.set(key, arr)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [allVariants, categoryNameMap])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const toggleGroup = (ids: string[]) => {
    setSelected((prev) => {
      const allIn = ids.every((id) => prev.has(id))
      const next = new Set(prev)
      if (allIn) {
        ids.forEach((id) => { next.delete(id) })
      } else {
        ids.forEach((id) => { next.add(id) })
      }
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === allVariants.length && allVariants.every((v) => selected.has(v.variantId))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allVariants.map((v) => v.variantId)))
    }
  }

  const setCopies = (id: string, n: number) => {
    setCopiesMap((prev) => {
      const next = new Map(prev)
      next.set(id, n)
      return next
    })
  }

  const setAllCopies = (n: number) => {
    setCopiesMap((prev) => {
      const next = new Map(prev)
      for (const id of selected) {
        next.set(id, n)
      }
      return next
    })
  }

  const selectedItems = allVariants
    .filter((v) => selected.has(v.variantId))
    .map((v) => ({ ...v, copies: copiesMap.get(v.variantId) ?? 1 }))

  const totalLabels = selectedItems.reduce((s, i) => s + i.copies, 0)
  const allSelected = allVariants.length > 0 && allVariants.every((v) => selected.has(v.variantId))

  const handlePrint = () => {
    setShowPrint(true)
    setTimeout(() => {
      window.print()
      setShowPrint(false)
    }, 400)
  }

  return (
    <>
      {/* Print-only label grid */}
      {showPrint && (
        <PrintGrid
          items={selectedItems}
          labelSize={labelSize}
          columns={printColumns}
        />
      )}

      {/* Main UI */}
      <div className="flex flex-col h-full print:hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
          <div>
            <h1 className="text-xl font-semibold">QR Labels</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Select variants, configure label size and layout, then print.
            </p>
          </div>
          <Button onClick={handlePrint} disabled={selected.size === 0}>
            <Printer className="mr-2 h-4 w-4" />
            Print {totalLabels > 0 ? `${String(totalLabels)} label${totalLabels !== 1 ? 's' : ''}` : 'Labels'}
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b px-8 py-3 flex-shrink-0 bg-muted/20">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product or SKU…"
              value={search}
              onChange={(e) => { setSearch(e.target.value) }}
              className="pl-9 h-8 text-sm"
            />
          </div>

          {/* Category filter */}
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-44 text-sm">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Label size */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Label size</span>
              <div className="flex rounded border overflow-hidden">
                {(Object.keys(SIZE_CFG) as LabelSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setLabelSize(s) }}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium transition-colors',
                      labelSize === s
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {SIZE_CFG[s].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Print layout */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Columns</span>
              <div className="flex rounded border overflow-hidden">
                {([2, 3, 4] as LayoutColumns[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setPrintColumns(n) }}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium transition-colors',
                      printColumns === n
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Selection strip */}
        <div className="flex items-center gap-4 border-b px-8 py-2.5 flex-shrink-0 text-sm">
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            {allSelected
              ? <CheckSquare2 className="h-4 w-4 text-primary" />
              : <Square className="h-4 w-4" />}
            Select all ({allVariants.length})
          </button>

          {selected.size > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground font-medium">
                {String(selected.size)} variant{selected.size !== 1 ? 's' : ''} selected
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {String(totalLabels)} total label{totalLabels !== 1 ? 's' : ''}
              </Badge>

              {/* Bulk copies setter */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Set all copies:</span>
                {[1, 2, 3, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setAllCopies(n) }}
                    className="rounded border px-2 py-0.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition-colors"
                  >
                    {n}×
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
          ) : allVariants.length === 0 ? (
            <div className="py-16 text-center space-y-1">
              <QrCode className="h-8 w-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">
                {search || categoryFilter !== '__all__' ? 'No variants match your filter.' : 'No products found.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-w-5xl">
              {grouped.map(([categoryName, items]) => (
                <CategoryGroup
                  key={categoryName}
                  categoryName={categoryName}
                  items={items}
                  selectedIds={selected}
                  copiesMap={copiesMap}
                  onToggle={toggle}
                  onCopiesChange={setCopies}
                  onToggleAll={toggleGroup}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
