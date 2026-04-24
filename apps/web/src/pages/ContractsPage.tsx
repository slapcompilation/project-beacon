// Layer: Mind
// Supplier Contract Intelligence — manage contracted prices per variant/supplier.
// Shows live deviation between contracted and last-received price so operators
// know immediately when a supplier is charging above the agreed rate.

import { useState, useMemo } from 'react'
import {
  FilePlus2, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle2, Clock, Loader2, X, Pencil, Ban,
} from 'lucide-react'
import { format, addDays, parseISO, isBefore } from 'date-fns'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useSupplierContracts, useUpsertSupplierContract, useDeactivateSupplierContract } from '@/features/mind/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useProducts } from '@/features/inventory/hooks'
import type { SupplierContract } from '@beacon/types'

// ─── Deviation badge ──────────────────────────────────────────────────────────

function DeviationBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-[10px] text-muted-foreground">No receipts yet</span>
  }
  const abs = Math.abs(pct)
  if (pct > 3) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
        <AlertTriangle className="h-2.5 w-2.5" />
        +{pct.toFixed(1)}% over contract
      </span>
    )
  }
  if (pct > 0) {
    return <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">+{pct.toFixed(1)}% over</span>
  }
  if (pct < -1) {
    return <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">{pct.toFixed(1)}% under</span>
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-2.5 w-2.5" />
      Within {abs.toFixed(1)}%
    </span>
  )
}

function ExpiryLabel({ end }: { end: string | null }) {
  if (!end) return null
  const d = parseISO(end)
  const today = new Date()
  const warn  = addDays(today, 30)
  if (isBefore(d, today)) {
    return <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">Expired {format(d, 'MMM d, yyyy')}</span>
  }
  if (isBefore(d, warn)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
        <Clock className="h-2.5 w-2.5" />
        Expires {format(d, 'MMM d')}
      </span>
    )
  }
  return <span className="text-[10px] text-muted-foreground">Until {format(d, 'MMM d, yyyy')}</span>
}

// ─── Contract form ────────────────────────────────────────────────────────────

interface FormState {
  id?:               string
  supplier_id:       string
  supplier_name:     string
  variant_id:        string
  contracted_price:  string
  min_order_qty:     string
  contract_start:    string
  contract_end:      string
  notes:             string
}

const EMPTY: FormState = {
  supplier_id:      '',
  supplier_name:    '',
  variant_id:       '',
  contracted_price: '',
  min_order_qty:    '',
  contract_start:   new Date().toISOString().slice(0, 10),
  contract_end:     '',
  notes:            '',
}

function ContractForm({
  initial,
  onClose,
}: {
  initial?: SupplierContract
  onClose: () => void
}) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          id:               initial.id,
          supplier_id:      initial.supplier_id ?? '',
          supplier_name:    initial.supplier_name,
          variant_id:       initial.variant_id,
          contracted_price: String(initial.contracted_price),
          min_order_qty:    initial.min_order_qty != null ? String(initial.min_order_qty) : '',
          contract_start:   initial.contract_start,
          contract_end:     initial.contract_end ?? '',
          notes:            initial.notes ?? '',
        }
      : EMPTY
  )

  const [variantSearch, setVariantSearch] = useState(
    initial ? `${initial.product_name} · ${initial.variant_name}` : ''
  )
  const [showVariantResults, setShowVariantResults] = useState(false)

  const { data: products = [] } = useProducts()
  const { data: suppliers = [] } = useSuppliers()
  const upsert = useUpsertSupplierContract()

  // Flatten products into searchable variant list
  const allVariants = useMemo(() =>
    products.flatMap((p) =>
      p.product_variants.map((v) => ({
        variantId:   v.id,
        label:       `${p.name} · ${v.name}`,
        sku:         v.sku,
        productName: p.name,
      }))
    ), [products])

  const filteredVariants = variantSearch.length > 1
    ? allVariants.filter((v) =>
        v.label.toLowerCase().includes(variantSearch.toLowerCase()) ||
        v.sku.toLowerCase().includes(variantSearch.toLowerCase())
      ).slice(0, 8)
    : []

  const set = (key: keyof FormState, value: string) =>
    { setForm((f) => ({ ...f, [key]: value })); }

  const handleSubmit = () => {
    const price = parseFloat(form.contracted_price)
    if (!form.variant_id || !form.supplier_name || isNaN(price) || price <= 0) return
    upsert.mutate(
      {
        id:               form.id,
        supplier_id:      form.supplier_id || null,
        supplier_name:    form.supplier_name,
        variant_id:       form.variant_id,
        contracted_price: price,
        min_order_qty:    form.min_order_qty ? parseInt(form.min_order_qty, 10) : null,
        contract_start:   form.contract_start,
        contract_end:     form.contract_end || null,
        notes:            form.notes || null,
      },
      { onSuccess: onClose }
    )
  }

  const isValid = !!form.variant_id && !!form.supplier_name &&
    parseFloat(form.contracted_price) > 0 && !!form.contract_start

  return (
    <div className="border rounded-lg p-5 space-y-4 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{form.id ? 'Edit Contract' : 'New Contract'}</p>
        <button type="button" onClick={onClose}>
          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Variant search */}
      <div className="space-y-1 relative">
        <label className="text-xs text-muted-foreground">Product · Variant</label>
        <input
          className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Search by name or SKU…"
          value={variantSearch}
          onChange={(e) => {
            setVariantSearch(e.target.value)
            setShowVariantResults(true)
            if (!e.target.value) set('variant_id', '')
          }}
          onFocus={() => { setShowVariantResults(true) }}
          onBlur={() => { setTimeout(() => { setShowVariantResults(false) }, 150) }}
        />
        {showVariantResults && filteredVariants.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full rounded border bg-popover shadow-lg max-h-48 overflow-y-auto">
            {filteredVariants.map((v) => (
              <li key={v.variantId}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-xs hover:bg-muted/60"
                  onMouseDown={(e) => { e.preventDefault() }}
                  onClick={() => {
                    set('variant_id', v.variantId)
                    setVariantSearch(v.label)
                    setShowVariantResults(false)
                  }}
                >
                  <span className="font-medium">{v.label}</span>
                  <span className="ml-2 text-muted-foreground">{v.sku}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Supplier */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Supplier</label>
          <select
            className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.supplier_id}
            onChange={(e) => {
              const sup = suppliers.find((s) => s.id === e.target.value)
              set('supplier_id', e.target.value)
              if (sup) set('supplier_name', sup.name)
              else if (!e.target.value) set('supplier_name', '')
            }}
          >
            <option value="">— select or type below —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Supplier name (override)</label>
          <input
            className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="e.g. Metro Cash & Carry"
            value={form.supplier_name}
            onChange={(e) => { set('supplier_name', e.target.value) }}
          />
        </div>
      </div>

      {/* Price + MOQ */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Contracted unit price</label>
          <input
            type="number"
            min={0}
            step={0.01}
            className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="0.00"
            value={form.contracted_price}
            onChange={(e) => { set('contracted_price', e.target.value) }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Min order qty (optional)</label>
          <input
            type="number"
            min={1}
            className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="—"
            value={form.min_order_qty}
            onChange={(e) => { set('min_order_qty', e.target.value) }}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Contract start</label>
          <input
            type="date"
            className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.contract_start}
            onChange={(e) => { set('contract_start', e.target.value) }}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Contract end (optional)</label>
          <input
            type="date"
            className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            value={form.contract_end}
            onChange={(e) => { set('contract_end', e.target.value) }}
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Notes (optional)</label>
        <textarea
          rows={2}
          className="w-full rounded border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          placeholder="e.g. 90-day price lock, includes delivery"
          value={form.notes}
          onChange={(e) => { set('notes', e.target.value) }}
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded border text-sm hover:bg-muted/40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!isValid || upsert.isPending}
          onClick={handleSubmit}
          className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
        >
          {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Save Contract
        </button>
      </div>
    </div>
  )
}

// ─── Contract row ─────────────────────────────────────────────────────────────

function ContractRow({
  contract,
  currency,
  onEdit,
}: {
  contract: SupplierContract
  currency: string
  onEdit: (c: SupplierContract) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const deactivate = useDeactivateSupplierContract()

  const isOverBudget = (contract.price_deviation_pct ?? 0) > 3

  return (
    <div className={cn('divide-y', isOverBudget && 'bg-red-50/40 dark:bg-red-950/10')}>
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Expand */}
        <button
          type="button"
          onClick={() => { setExpanded((v) => !v) }}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {expanded
            ? <ChevronUp className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {/* Product + supplier */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">
            {contract.product_name} · {contract.variant_name}
            <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">{contract.sku}</span>
          </p>
          <p className="text-[10px] text-muted-foreground">{contract.supplier_name}</p>
        </div>

        {/* Prices */}
        <div className="text-right shrink-0 space-y-0.5">
          <p className="text-xs font-semibold tabular-nums">
            {formatCurrency(contract.contracted_price, currency)}
            <span className="ml-1 text-[10px] font-normal text-muted-foreground">contracted</span>
          </p>
          {contract.last_received_price != null && (
            <p className="text-[10px] tabular-nums text-muted-foreground">
              last rcv {formatCurrency(contract.last_received_price, currency)}
            </p>
          )}
        </div>

        {/* Deviation */}
        <div className="shrink-0 w-32 text-right">
          <DeviationBadge pct={contract.price_deviation_pct} />
        </div>

        {/* Expiry */}
        <div className="shrink-0 w-28 text-right">
          <ExpiryLabel end={contract.contract_end} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            title="Edit"
            onClick={() => { onEdit(contract) }}
            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Deactivate"
            disabled={deactivate.isPending}
            onClick={() => { deactivate.mutate(contract.id) }}
            className="p-1 rounded hover:bg-muted/60 text-muted-foreground hover:text-red-600 disabled:opacity-40"
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-12 py-3 bg-muted/10 text-xs text-muted-foreground space-y-1">
          <p>
            Contract period: {format(parseISO(contract.contract_start), 'MMM d, yyyy')}
            {contract.contract_end && ` → ${format(parseISO(contract.contract_end), 'MMM d, yyyy')}`}
          </p>
          {contract.min_order_qty != null && (
            <p>Min order qty: {contract.min_order_qty}</p>
          )}
          {contract.notes && <p className="italic">{contract.notes}</p>}
          <p className="text-[10px]">Created {format(parseISO(contract.created_at), 'MMM d, yyyy')}</p>
        </div>
      )}
    </div>
  )
}

// ─── Summary bar ─────────────────────────────────────────────────────────────

function SummaryBar({ contracts, currency }: { contracts: SupplierContract[]; currency: string }) {
  const overBudget   = contracts.filter((c) => (c.price_deviation_pct ?? 0) > 3)
  const expiringSoon = contracts.filter((c) => {
    if (!c.contract_end) return false
    const d = parseISO(c.contract_end)
    return isBefore(d, addDays(new Date(), 30)) && isBefore(new Date(), d)
  })
  const totalAnnual  = contracts.reduce((s, c) => {
    const moq = c.min_order_qty ?? 1
    return s + c.contracted_price * moq * 12
  }, 0)

  return (
    <div className="grid grid-cols-3 gap-4 px-6 py-4 border-b bg-muted/10 shrink-0">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Active Contracts</p>
        <p className="text-2xl font-bold tabular-nums">{contracts.length}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
          Over Contract Price
        </p>
        <p className={cn('text-2xl font-bold tabular-nums', overBudget.length > 0 ? 'text-red-600' : 'text-emerald-600')}>
          {overBudget.length}
        </p>
        {overBudget.length > 0 && (
          <p className="text-[10px] text-red-600 mt-0.5">Overpaying on {overBudget.length} item{overBudget.length !== 1 ? 's' : ''}</p>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Expiring ≤30d</p>
        <p className={cn('text-2xl font-bold tabular-nums', expiringSoon.length > 0 ? 'text-amber-600' : 'text-foreground')}>
          {expiringSoon.length}
        </p>
        {totalAnnual > 0 && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Est. annual value {formatCurrency(totalAnnual, currency)}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type FilterId = 'all' | 'deviating' | 'expiring'

export default function ContractsPage() {
  const currency                      = useCurrency()
  const { data: contracts = [], isLoading } = useSupplierContracts()
  const [filter, setFilter]           = useState<FilterId>('all')
  const [showForm, setShowForm]       = useState(false)
  const [editing, setEditing]         = useState<SupplierContract | null>(null)

  const filtered = useMemo(() => {
    if (filter === 'deviating') return contracts.filter((c) => (c.price_deviation_pct ?? 0) > 3)
    if (filter === 'expiring')  return contracts.filter((c) => {
      if (!c.contract_end) return false
      const d = parseISO(c.contract_end)
      return isBefore(d, addDays(new Date(), 30))
    })
    return contracts
  }, [contracts, filter])

  const handleEdit = (c: SupplierContract) => {
    setEditing(c)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const deviatingCount = contracts.filter((c) => (c.price_deviation_pct ?? 0) > 3).length
  const expiringCount  = contracts.filter((c) => {
    if (!c.contract_end) return false
    const d = parseISO(c.contract_end)
    return isBefore(d, addDays(new Date(), 30))
  }).length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Summary */}
      {!isLoading && contracts.length > 0 && (
        <SummaryBar contracts={contracts} currency={currency} />
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-1">
          {(
            [
              { id: 'all'       as FilterId, label: `All (${String(contracts.length)})` },
              { id: 'deviating' as FilterId, label: `Overpaying (${String(deviatingCount)})`, alert: deviatingCount > 0 },
              { id: 'expiring'  as FilterId, label: `Expiring soon (${String(expiringCount)})`, warn: expiringCount > 0 },
            ] as { id: FilterId; label: string; alert?: boolean; warn?: boolean }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => { setFilter(f.id) }}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                filter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : f.alert
                    ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
                    : f.warn
                      ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                      : 'text-muted-foreground hover:bg-muted/40',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-xs font-medium"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          Add Contract
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="px-6 py-4 border-b shrink-0">
          <ContractForm initial={editing ?? undefined} onClose={closeForm} />
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
            <FilePlus2 className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {filter === 'all'
                ? 'No active contracts. Add your first to start tracking price compliance.'
                : filter === 'deviating'
                  ? 'No contracts are currently above the contracted price.'
                  : 'No contracts expiring in the next 30 days.'}
            </p>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="rounded-none border-b divide-y">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/30">
              <div className="w-3.5 shrink-0" />
              <div className="flex-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Product · Variant
              </div>
              <div className="shrink-0 w-32 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Price
              </div>
              <div className="shrink-0 w-32 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Deviation
              </div>
              <div className="shrink-0 w-28 text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Expiry
              </div>
              <div className="shrink-0 w-16" />
            </div>
            {filtered.map((c) => (
              <ContractRow key={c.id} contract={c} currency={currency} onEdit={handleEdit} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
