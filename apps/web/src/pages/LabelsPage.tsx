// Layer: Floor — QR label generation and print management
// Palantir principle: operator-grade density — every action lives next to the data.
// Select by product, category, or search. Configure quantity + layout before print.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useEffect, useRef, useMemo } from 'react'
import QRCode from 'qrcode'
import {
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  HTMLSelect,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  SegmentedControl,
  Tag,
} from '@blueprintjs/core'
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
    <Card
      compact
      interactive
      onClick={onToggle}
      className={cn(
        'transition-colors cursor-pointer',
        isChecked && '!border-primary !bg-primary/5',
      )}
    >
      {/* Selection row */}
      <div className="flex w-full items-center gap-2">
        <Checkbox checked={isChecked} onChange={onToggle} className="!mb-0 !mt-0" />
        <Icon icon="barcode" size={14} className="shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.productName}</p>
          {item.variantName !== 'Standard' && (
            <p className="truncate text-xs text-muted-foreground">{item.variantName}</p>
          )}
          <p className="truncate font-mono text-xs text-muted-foreground">{item.sku}</p>
        </div>
      </div>

      {/* Quantity copies row — only when selected */}
      {isChecked && (
        <div
          className="mt-2 flex items-center gap-2 border-t pt-2"
          onClick={(e) => { e.stopPropagation() }}
        >
          <span className="text-[10px] text-muted-foreground font-medium">Copies</span>
          <ButtonGroup>
            <Button
              icon="minus"
              variant="minimal"
              size="small"
              onClick={(e) => { e.stopPropagation(); onCopiesChange(Math.max(1, copies - 1)) }}
              disabled={copies <= 1}
              aria-label="Decrease copies"
            />
            <span className="w-6 text-center text-xs font-semibold tabular-nums self-center">{copies}</span>
            <Button
              icon="plus"
              variant="minimal"
              size="small"
              onClick={(e) => { e.stopPropagation(); onCopiesChange(Math.min(20, copies + 1)) }}
              disabled={copies >= 20}
              aria-label="Increase copies"
            />
          </ButtonGroup>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {copies > 1 ? `${String(copies)}× labels` : '1 label'}
          </span>
        </div>
      )}
    </Card>
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
    <Card compact className="!p-0 overflow-hidden">
      {/* Category header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b">
        <button
          type="button"
          onClick={() => { setExpanded((v) => !v) }}
          className="flex items-center gap-2 flex-1 text-left min-w-0"
        >
          <Icon icon={expanded ? 'chevron-down' : 'chevron-right'} size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-semibold truncate">{categoryName}</span>
          <span className="text-xs text-muted-foreground shrink-0">{items.length} variant{items.length !== 1 ? 's' : ''}</span>
        </button>
        {/* Select all in group */}
        <Button
          variant="minimal"
          size="small"
          onClick={() => { onToggleAll(items.map((i) => i.variantId)) }}
          className="shrink-0"
          icon={allSelected || someSelected ? 'tick' : 'square'}
          intent={allSelected ? Intent.PRIMARY : Intent.NONE}
        >
          {selectedCount > 0 ? `${String(selectedCount)} selected` : 'Select all'}
        </Button>
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
    </Card>
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
          <Button icon="print" intent={Intent.PRIMARY} onClick={handlePrint} disabled={selected.size === 0}>
            Print {totalLabels > 0 ? `${String(totalLabels)} label${totalLabels !== 1 ? 's' : ''}` : 'Labels'}
          </Button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b px-8 py-3 flex-shrink-0 bg-muted/20">
          {/* Search */}
          <InputGroup
            leftIcon="search"
            placeholder="Search product or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
            className="flex-1 min-w-[200px] max-w-xs"
          />

          {/* Category filter */}
          {categories.length > 0 && (
            <HTMLSelect
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value) }}
              options={[
                { value: '__all__', label: 'All categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}

          <div className="ml-auto flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Label size</span>
              <SegmentedControl
                size="small"
                value={labelSize}
                onValueChange={(v) => { setLabelSize(v as LabelSize) }}
                options={(Object.keys(SIZE_CFG) as LabelSize[]).map((s) => ({
                  value: s,
                  label: SIZE_CFG[s].label,
                }))}
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Columns</span>
              <SegmentedControl
                size="small"
                value={String(printColumns)}
                onValueChange={(v) => { setPrintColumns(parseInt(v, 10) as LayoutColumns) }}
                options={[
                  { value: '2', label: '2' },
                  { value: '3', label: '3' },
                  { value: '4', label: '4' },
                ]}
              />
            </div>
          </div>
        </div>

        {/* Selection strip */}
        <div className="flex items-center gap-4 border-b px-8 py-2.5 flex-shrink-0 text-sm">
          <Button
            variant="minimal"
            size="small"
            icon={allSelected ? 'tick' : 'square'}
            intent={allSelected ? Intent.PRIMARY : Intent.NONE}
            onClick={toggleAll}
          >
            Select all ({allVariants.length})
          </Button>

          {selected.size > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground font-medium">
                {String(selected.size)} variant{selected.size !== 1 ? 's' : ''} selected
              </span>
              <Tag minimal>
                {String(totalLabels)} total label{totalLabels !== 1 ? 's' : ''}
              </Tag>

              {/* Bulk copies setter */}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Set all copies:</span>
                <ButtonGroup>
                  {[1, 2, 3, 5].map((n) => (
                    <Button
                      key={n}
                      variant="minimal"
                      size="small"
                      onClick={() => { setAllCopies(n) }}
                    >
                      {n}×
                    </Button>
                  ))}
                </ButtonGroup>
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Loading…</p>
          ) : allVariants.length === 0 ? (
            <NonIdealState
              icon="barcode"
              title={search || categoryFilter !== '__all__' ? 'No matches' : 'No products'}
              description={search || categoryFilter !== '__all__' ? 'No variants match your filter.' : 'No products found.'}
            />
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
