// Layer: Flow — Pick Lists
// Operators create lists of items needed for a job or service round.
// A picker works through items scanning or tapping; stock deducts on commit.
// Principle: actions live next to data — pick quantity inline, commit from the same view.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { format } from 'date-fns'
import { useDateFormat } from '@/features/user/hooks'
import {
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  Divider,
  FormGroup,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
  TextArea,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AipSignalsProvider } from '@/features/aipSignals/AipSignalsProvider'
import { AipRowBadge } from '@/features/aipSignals/AipRowBadge'
import {
  usePickLists, usePickListItems, useCreatePickList, useUpdatePickList,
  useDeletePickList, useAddPickListItem, useUpdatePickListItem,
  useRemovePickListItem, useCommitPickList,
} from '@/features/pick-lists'
import { useProducts, useFefoBatchMap } from '@/features/inventory/hooks'
import type { PickList, PickListItemWithVariant, ProductWithVariants, ProductVariant, FefoBatchRow } from '@beacon/types'

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CFG = {
  draft:       { label: 'Draft',       intent: Intent.NONE },
  in_progress: { label: 'In progress', intent: Intent.PRIMARY },
  completed:   { label: 'Completed',   intent: Intent.SUCCESS },
  cancelled:   { label: 'Cancelled',   intent: Intent.NONE },
} as const

// ─── Create / edit pick list dialog ───────────────────────────────────────────

function PickListFormDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean
  onClose: () => void
  editing?: PickList | null
}) {
  const create = useCreatePickList()
  const update = useUpdatePickList()
  const [name, setName] = useState(editing?.name ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [dueDate, setDueDate] = useState(editing?.due_date ?? '')

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setNotes(editing?.notes ?? '')
      setDueDate(editing?.due_date ?? '')
    }
  }, [open, editing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          input: { name: name.trim(), notes: notes.trim() || null, due_date: dueDate || null },
        })
      } else {
        await create.mutateAsync({
          name: name.trim(),
          notes: notes.trim() || undefined,
          due_date: dueDate || null,
        })
      }
      onClose()
    } catch {
      toast.error('Failed to save pick list')
    }
  }

  const isPending = create.isPending || update.isPending

  return (
    <Dialog
      isOpen={open}
      onClose={onClose}
      title={editing ? 'Edit Pick List' : 'New Pick List'}
      className="!w-[24rem]"
    >
      <form onSubmit={(e) => { void handleSubmit(e) }}>
        <DialogBody>
          <FormGroup label="Name">
            <InputGroup
              placeholder="e.g. VIP Room Setup · 18 Mar"
              value={name}
              onChange={(e) => { setName(e.target.value) }}
              autoFocus
            />
          </FormGroup>
          <FormGroup label="Notes (optional)">
            <TextArea
              placeholder="e.g. Suite 201–205, check minibar + toiletries"
              rows={2}
              value={notes}
              onChange={(e) => { setNotes(e.target.value) }}
              fill
            />
          </FormGroup>
          <FormGroup label="Due date (optional)">
            <InputGroup
              type="date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value) }}
            />
          </FormGroup>
        </DialogBody>
        <DialogFooter
          actions={
            <>
              <Button variant="minimal" onClick={onClose}>Cancel</Button>
              <Button type="submit" intent={Intent.PRIMARY} loading={isPending} disabled={!name.trim()}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </>
          }
        />
      </form>
    </Dialog>
  )
}

// ─── Add item dialog ──────────────────────────────────────────────────────────

function AddItemDialog({
  open,
  pickListId,
  existingVariantIds,
  onClose,
}: {
  open: boolean
  pickListId: string
  existingVariantIds: Set<string>
  onClose: () => void
}) {
  const addItem = useAddPickListItem()
  const { data: products = [] } = useProducts()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<{ product: ProductWithVariants; variant: ProductVariant } | null>(null)
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) { setQuery(''); setSelected(null); setQty(1); setNotes('') }
  }, [open])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 1) return []
    const out: { product: ProductWithVariants; variant: ProductVariant }[] = []
    for (const p of products) {
      for (const v of p.product_variants) {
        if (existingVariantIds.has(v.id)) continue
        if (
          p.name.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          v.sku.toLowerCase().includes(q)
        ) {
          out.push({ product: p, variant: v })
        }
      }
    }
    return out.slice(0, 10)
  }, [products, query, existingVariantIds])

  const handleAdd = async () => {
    if (!selected) return
    try {
      await addItem.mutateAsync({
        pick_list_id: pickListId,
        variant_id: selected.variant.id,
        quantity_planned: qty,
        notes: notes.trim() || undefined,
      })
      setSelected(null)
      setQuery('')
      setQty(1)
      setNotes('')
    } catch {
      toast.error('Failed to add item')
    }
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title="Add Item" className="!w-[24rem]">
      <DialogBody>
        {!selected ? (
          <FormGroup label="Search product">
            <InputGroup
              leftIcon="search"
              placeholder="Name or SKU…"
              value={query}
              onChange={(e) => { setQuery(e.target.value) }}
              autoFocus
            />
            {results.length > 0 && (
              <div className="mt-2 rounded-lg border divide-y max-h-48 overflow-y-auto">
                {results.map(({ product, variant }) => (
                  <button
                    key={variant.id}
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted transition-colors"
                    onClick={() => { setSelected({ product, variant }); setQuery('') }}
                  >
                    <div>
                      <p className="text-sm font-medium">{product.name}</p>
                      {variant.name !== 'Standard' && (
                        <p className="text-xs text-muted-foreground">{variant.name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        SKU {variant.sku} · {variant.current_stock}{variant.unit_of_measure ? ` ${variant.unit_of_measure}` : ''} in stock
                      </p>
                    </div>
                    <Icon icon="arrow-right" size={14} className="text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {query.length >= 1 && results.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">No matches</p>
            )}
          </FormGroup>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 bg-muted/30">
              <div>
                <p className="text-sm font-medium">{selected.product.name}</p>
                {selected.variant.name !== 'Standard' && (
                  <p className="text-xs text-muted-foreground">{selected.variant.name}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {selected.variant.current_stock}{selected.variant.unit_of_measure ? ` ${selected.variant.unit_of_measure}` : ''} in stock
                </p>
              </div>
              <Button variant="minimal" size="small" icon="cross" onClick={() => { setSelected(null) }} aria-label="Clear" />
            </div>
            <FormGroup label="Quantity needed">
              <div className="flex items-center gap-2">
                {[1, 2, 5, 10].map((n) => (
                  <Button
                    key={n}
                    size="small"
                    intent={qty === n ? Intent.PRIMARY : Intent.NONE}
                    variant={qty === n ? undefined : 'outlined'}
                    onClick={() => { setQty(n) }}
                  >
                    {n}
                  </Button>
                ))}
                <InputGroup
                  type="number"
                  min="1"
                  value={String(qty)}
                  onChange={(e) => { setQty(Math.max(1, parseInt(e.target.value, 10) || 1)) }}
                  className="!w-20"
                />
              </div>
            </FormGroup>
            <FormGroup label="Notes (optional)">
              <InputGroup
                placeholder="e.g. Check expiry date"
                value={notes}
                onChange={(e) => { setNotes(e.target.value) }}
              />
            </FormGroup>
          </div>
        )}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button variant="minimal" onClick={onClose}>Cancel</Button>
            <Button
              intent={Intent.PRIMARY}
              loading={addItem.isPending}
              onClick={() => { void handleAdd() }}
              disabled={!selected || addItem.isPending}
            >
              Add
            </Button>
          </>
        }
      />
    </Dialog>
  )
}

// ─── Pick item row ────────────────────────────────────────────────────────────

function PickItemRow({
  item,
  pickListId,
  isActive,
  isHighlighted,
  rowRef,
  fefoBatch,
}: {
  item: PickListItemWithVariant
  pickListId: string
  isActive: boolean
  isHighlighted: boolean
  rowRef: (el: HTMLDivElement | null) => void
  fefoBatch?: FefoBatchRow | null
}) {
  const updateItem = useUpdatePickListItem(pickListId)
  const removeItem = useRemovePickListItem(pickListId)
  const pv = item.product_variants
  const isFulfilled = item.quantity_picked >= item.quantity_planned

  const handlePick = (delta: number) => {
    const next = Math.max(0, Math.min(item.quantity_planned, item.quantity_picked + delta))
    updateItem.mutate({ id: item.id, input: { quantity_picked: next } })
  }

  const productName = pv?.products?.name ?? '—'
  const variantLabel = pv?.name !== 'Standard' ? `${productName} — ${pv?.name ?? ''}` : productName
  const uom = pv?.unit_of_measure ?? ''

  return (
    <div
      ref={rowRef}
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b last:border-b-0 transition-colors',
        isFulfilled && 'bg-green-50/40 dark:bg-green-950/10',
        isHighlighted && 'ring-2 ring-inset ring-primary bg-primary/5 dark:bg-primary/10',
      )}
    >
      {/* Status circle */}
      <div className="shrink-0">
        <Icon
          icon={isFulfilled ? 'tick-circle' : 'circle'}
          size={18}
          className={isFulfilled ? 'text-green-600' : 'text-muted-foreground/40'}
        />
      </div>

      {/* Item info */}
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', isFulfilled && 'line-through text-muted-foreground')}>
          {pv?.id
            ? <Link to={`/variant/${pv.id}`} className="hover:underline" onClick={(e) => { e.stopPropagation() }}>{variantLabel}</Link>
            : variantLabel
          }
        </p>
        <p className="text-xs text-muted-foreground">
          SKU {pv?.sku ?? '—'}
          {pv?.current_stock != null && ` · ${String(pv.current_stock)}${uom ? ` ${uom}` : ''} in stock`}
          {item.notes && ` · ${item.notes}`}
        </p>
        {pv?.id && <AipRowBadge variantIds={[pv.id]} />}
        {fefoBatch && (
          <p className="mt-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
            Use {fefoBatch.lot_number ? `Lot ${fefoBatch.lot_number}` : 'oldest batch'}
            {fefoBatch.expiry_date && ` · exp ${fefoBatch.expiry_date}`}
            {fefoBatch.days_until_expiry != null && fefoBatch.days_until_expiry <= 14 && (
              <span className="ml-1 text-red-600 dark:text-red-400">({String(fefoBatch.days_until_expiry)}d left)</span>
            )}
            {' '}· {String(fefoBatch.quantity)}{uom ? ` ${uom}` : ''} avail
          </p>
        )}
      </div>

      {/* Progress: picked / planned */}
      <div className="shrink-0 text-right">
        <p className={cn(
          'text-sm font-bold tabular-nums',
          isFulfilled ? 'text-green-600' : item.quantity_picked > 0 ? 'text-blue-600' : 'text-muted-foreground',
        )}>
          {item.quantity_picked} / {item.quantity_planned}
          {uom ? ` ${uom}` : ''}
        </p>
        {/* progress bar */}
        <div className="mt-0.5 h-1 w-20 overflow-hidden rounded-full bg-muted">
          <div
            className={cn('h-full rounded-full transition-all', isFulfilled ? 'bg-green-500' : 'bg-blue-500')}
            style={{ width: `${String(Math.min((item.quantity_picked / item.quantity_planned) * 100, 100))}%` }}
          />
        </div>
      </div>

      {/* Increment / decrement (only when list is active) */}
      {isActive && (
        <div className="shrink-0 flex items-center gap-1">
          <Button
            size="small"
            variant="outlined"
            icon="chevron-down"
            disabled={item.quantity_picked === 0 || updateItem.isPending}
            onClick={() => { handlePick(-1) }}
            aria-label="Decrement"
          />
          <Button
            size="small"
            variant="outlined"
            icon="chevron-up"
            disabled={isFulfilled || updateItem.isPending}
            onClick={() => { handlePick(1) }}
            aria-label="Increment"
          />
          <Button
            size="small"
            variant="outlined"
            intent={Intent.SUCCESS}
            icon="tick-circle"
            disabled={isFulfilled || updateItem.isPending}
            onClick={() => { handlePick(item.quantity_planned - item.quantity_picked) }}
            title="Mark all as picked"
            aria-label="Pick all"
          />
          <Button
            size="small"
            variant="minimal"
            intent={Intent.DANGER}
            icon="trash"
            disabled={removeItem.isPending}
            onClick={() => { removeItem.mutate(item.id) }}
            aria-label="Remove"
            className="!ml-1"
          />
        </div>
      )}
    </div>
  )
}

// ─── Pick List detail panel ───────────────────────────────────────────────────

function PickListDetail({
  list,
  onBack,
}: {
  list: PickList
  onBack: () => void
}) {
  const { data: items = [], isLoading } = usePickListItems(list.id)
  const { data: fefoBatchMap } = useFefoBatchMap()
  const updateList = useUpdatePickList()
  const commit = useCommitPickList()
  const fmtDate = useDateFormat()

  const [addOpen, setAddOpen] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [commitConfirm, setCommitConfirm] = useState(false)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const isActive = list.status === 'draft' || list.status === 'in_progress'
  const existingVariantIds = useMemo(() => new Set(items.map((i) => i.variant_id)), [items])

  // Shortfall: items where we plan to pick more than is currently in stock
  const shortfalls = useMemo(
    () => items.filter((i) => {
      const stock = i.product_variants?.current_stock ?? 0
      return i.quantity_planned > stock
    }),
    [items],
  )

  const pickedCount = items.filter((i) => i.quantity_picked >= i.quantity_planned).length
  const allPicked = items.length > 0 && pickedCount === items.length

  // Auto-start list on first pick
  useEffect(() => {
    if (list.status === 'draft' && items.some((i) => i.quantity_picked > 0)) {
      updateList.mutate({ id: list.id, input: { status: 'in_progress' } })
    }
  }, [items, list.status, list.id, updateList])

  // Clear scan error after 3s
  useEffect(() => {
    if (!scanError) return
    const t = setTimeout(() => { setScanError(null) }, 3000)
    return () => { clearTimeout(t) }
  }, [scanError])

  // Clear highlight after 2.5s
  useEffect(() => {
    if (!highlightedItemId) return
    const t = setTimeout(() => { setHighlightedItemId(null) }, 2500)
    return () => { clearTimeout(t) }
  }, [highlightedItemId])

  const handleScanToPick = useCallback((raw: string) => {
    const q = raw.trim().toLowerCase()
    if (!q) return
    const match = items.find((item) => {
      const pv = item.product_variants
      if (!pv) return false
      return (
        pv.sku.toLowerCase() === q ||
        (pv.barcode?.toLowerCase() ?? '') === q
      )
    })
    if (!match) {
      setScanError(`Not in list: "${raw}"`)
      setScanInput('')
      return
    }
    setHighlightedItemId(match.id)
    setScanInput('')
    setTimeout(() => {
      rowRefs.current.get(match.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 50)
  }, [items])

  const handleCommit = async (force = false) => {
    if (!allPicked && !force) { setCommitConfirm(true); return }
    try {
      await commit.mutateAsync(list.id)
      toast.success('Pick list committed — stock updated')
      onBack()
    } catch {
      toast.error('Failed to commit pick list')
    }
  }

  const cfg = STATUS_CFG[list.status]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Pick Lists
            </button>
          </div>
          <h1 className="text-xl font-semibold">{list.name}</h1>
          <div className="mt-1 flex items-center gap-3 flex-wrap">
            <Tag minimal intent={cfg.intent} className="!text-[10px] !uppercase !tracking-wide">
              {cfg.label}
            </Tag>
            {list.due_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Icon icon="calendar" size={12} />
                Due {fmtDate(new Date(list.due_date))}
              </span>
            )}
            {list.notes && (
              <span className="text-xs text-muted-foreground italic">{list.notes}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Progress pill */}
          {items.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', allPicked ? 'bg-green-500' : 'bg-blue-500')}
                  style={{ width: `${String((pickedCount / items.length) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums text-muted-foreground">
                {pickedCount} / {items.length}
              </span>
              {allPicked && <Icon icon="tick-circle" size={14} className="text-green-600" />}
            </div>
          )}

          {isActive && (
            <Button
              size="small"
              variant="outlined"
              icon="plus"
              onClick={() => { setAddOpen(true) }}
            >
              Add Item
            </Button>
          )}

          {isActive && items.length > 0 && (
            <Button
              size="small"
              intent={Intent.PRIMARY}
              icon="confirm"
              loading={commit.isPending}
              onClick={() => { void handleCommit() }}
              className={cn(!allPicked && '!opacity-80')}
            >
              Commit &amp; Deduct Stock
            </Button>
          )}
        </div>
      </div>

      {/* Scan to Pick toolbar */}
      {isActive && items.length > 0 && (
        <div className="flex items-center gap-3 border-b px-8 py-2.5 flex-shrink-0 bg-muted/20">
          <Icon icon="barcode" size={14} className="text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">Scan to Pick:</span>
          <div className="relative w-56">
            <InputGroup
              placeholder="Scan barcode or enter SKU…"
              value={scanInput}
              onChange={(e) => { setScanInput(e.target.value) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { handleScanToPick(scanInput); e.preventDefault() }
              }}
              intent={scanError ? Intent.DANGER : Intent.NONE}
              autoFocus
              size="small"
            />
            {scanError && (
              <p className="absolute top-full mt-1 whitespace-nowrap text-[10px] text-destructive z-10">
                {scanError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Shortfall warning */}
      {shortfalls.length > 0 && (
        <div className="flex-shrink-0 border-b bg-yellow-50/60 dark:bg-yellow-950/20 px-8 py-3">
          <div className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300">
            <Icon icon="warning-sign" size={14} className="mt-0.5 shrink-0 text-yellow-600" />
            <div>
              <span className="font-semibold">
                {shortfalls.length} item{shortfalls.length !== 1 ? 's' : ''} may be short on stock
              </span>
              <div className="mt-1 space-y-0.5">
                {shortfalls.map((i) => {
                  const pv = i.product_variants
                  const productName = pv?.products?.name ?? '—'
                  const label = pv?.name !== 'Standard' ? `${productName} — ${pv?.name ?? ''}` : productName
                  const stock = pv?.current_stock ?? 0
                  const deficit = i.quantity_planned - stock
                  return (
                    <p key={i.id} className="text-xs text-yellow-700 dark:text-yellow-400">
                      {label}
                      {' · '}need {i.quantity_planned}, have {stock}
                      {' · '}
                      <span className="font-semibold">{deficit} short</span>
                    </p>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /> Loading…
          </div>
        ) : items.length === 0 ? (
          <NonIdealState
            icon="clipboard"
            title="No items yet"
            action={isActive ? (
              <Button size="small" variant="outlined" icon="plus" onClick={() => { setAddOpen(true) }}>
                Add first item
              </Button>
            ) : undefined}
          />
        ) : (
          <AipSignalsProvider variantIds={items.map((i) => i.variant_id)}>
          <div className="rounded-none divide-y-0">
            {items.map((item) => (
              <PickItemRow
                key={item.id}
                item={item}
                pickListId={list.id}
                isActive={isActive}
                isHighlighted={highlightedItemId === item.id}
                rowRef={(el) => {
                  if (el) rowRefs.current.set(item.id, el)
                  else rowRefs.current.delete(item.id)
                }}
                fefoBatch={fefoBatchMap?.get(item.variant_id) ?? null}
              />
            ))}
          </div>
          </AipSignalsProvider>
        )}
      </div>

      <AddItemDialog
        open={addOpen}
        pickListId={list.id}
        existingVariantIds={existingVariantIds}
        onClose={() => { setAddOpen(false) }}
      />
      <ConfirmDialog
        open={commitConfirm}
        title="Commit with unpicked items?"
        description={`${String(items.length - pickedCount)} item(s) not fully picked. Stock will only deduct for what was picked.`}
        confirmLabel="Commit anyway"
        onConfirm={() => { void handleCommit(true) }}
        onCancel={() => { setCommitConfirm(false) }}
      />
    </div>
  )
}

// ─── Pick list card (list view) ────────────────────────────────────────────────

function PickListCard({
  list,
  onOpen,
  onEdit,
  onDelete,
}: {
  list: PickList
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const fmtDate = useDateFormat()
  const cfg = STATUS_CFG[list.status]
  const isPast = list.due_date && new Date(list.due_date) < new Date() && list.status !== 'completed'

  return (
    <div className="rounded-lg border bg-card hover:bg-muted/20 transition-colors group">
      <button
        type="button"
        className="w-full text-left px-4 pt-4 pb-3"
        onClick={onOpen}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium truncate">{list.name}</p>
            {list.notes && (
              <p className="mt-0.5 text-xs text-muted-foreground truncate italic">{list.notes}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <Tag minimal intent={cfg.intent} className="!text-[10px] !uppercase !tracking-wide">
                {cfg.label}
              </Tag>
              {list.due_date && (
                <span className={cn('flex items-center gap-1 text-xs', isPast ? 'text-red-600 font-medium' : 'text-muted-foreground')}>
                  <Icon icon="calendar" size={12} />
                  {isPast ? 'Overdue · ' : 'Due '}
                  {fmtDate(new Date(list.due_date))}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {`${fmtDate(new Date(list.created_at))}, ${format(new Date(list.created_at), 'HH:mm')}`}
              </span>
            </div>
          </div>
          <Icon icon="arrow-right" size={14} className="text-muted-foreground shrink-0 mt-1 group-hover:text-foreground transition-colors" />
        </div>
      </button>
      <Divider className="!m-0" />
      <div className="flex items-center justify-end gap-1 px-3 py-2">
        <Button
          variant="minimal"
          size="small"
          icon="edit"
          onClick={(e) => { e.stopPropagation(); onEdit() }}
          aria-label="Edit"
        />
        <Button
          variant="minimal"
          size="small"
          intent={Intent.DANGER}
          icon="trash"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          aria-label="Delete"
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PickListsPage() {
  const { data: lists = [], isLoading } = usePickLists()
  const deleteList = useDeletePickList()

  const [createOpen, setCreateOpen] = useState(false)
  const [editingList, setEditingList] = useState<PickList | null>(null)
  const [detailList, setDetailList] = useState<PickList | null>(null)
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active')
  const [deleteConfirm, setDeleteConfirm] = useState<PickList | null>(null)

  // If user was viewing a detail and list updates in the background, keep the reference fresh
  const freshDetail = useMemo(
    () => (detailList ? (lists.find((l) => l.id === detailList.id) ?? detailList) : null),
    [detailList, lists],
  )

  const filtered = useMemo(() => {
    if (statusFilter === 'active') {
      return lists.filter((l) => l.status === 'draft' || l.status === 'in_progress')
    }
    return lists
  }, [lists, statusFilter])

  const activeCount = lists.filter((l) => l.status === 'draft' || l.status === 'in_progress').length

  const handleDelete = (list: PickList) => {
    setDeleteConfirm(list)
  }

  if (freshDetail) {
    return (
      <PickListDetail
        list={freshDetail}
        onBack={() => { setDetailList(null) }}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold">Flow · Pick Lists</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Build item lists for jobs, events, or service rounds. Stock deducts on commit.
          </p>
        </div>
        <Button intent={Intent.PRIMARY} icon="plus" onClick={() => { setCreateOpen(true) }}>
          New Pick List
        </Button>
      </div>

      {/* Filter strip */}
      <div className="flex items-center gap-3 border-b px-8 py-3 flex-shrink-0 bg-muted/20">
        <SegmentedControl
          options={[
            { value: 'active', label: activeCount > 0 ? `Active (${String(activeCount)})` : 'Active' },
            { value: 'all',    label: 'All' },
          ]}
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v as 'active' | 'all') }}
          size="small"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <NonIdealState
            icon="clipboard"
            title={statusFilter === 'active' ? 'No active pick lists' : 'No pick lists yet'}
            description="Create a pick list to plan items for an event, room service, or any picking job. Stock only deducts when you commit."
            action={
              <Button intent={Intent.PRIMARY} icon="plus" onClick={() => { setCreateOpen(true) }}>
                New Pick List
              </Button>
            }
          />
        ) : (
          <div className="grid gap-3 max-w-2xl">
            {filtered.map((list) => (
              <PickListCard
                key={list.id}
                list={list}
                onOpen={() => { setDetailList(list) }}
                onEdit={() => { setEditingList(list); setCreateOpen(true) }}
                onDelete={() => { handleDelete(list) }}
              />
            ))}
          </div>
        )}
      </div>

      <PickListFormDialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); setEditingList(null) }}
        editing={editingList}
      />
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={`Delete "${deleteConfirm?.name ?? ''}"?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => { if (deleteConfirm) void deleteList.mutateAsync(deleteConfirm.id) }}
        onCancel={() => { setDeleteConfirm(null) }}
      />
    </div>
  )
}
