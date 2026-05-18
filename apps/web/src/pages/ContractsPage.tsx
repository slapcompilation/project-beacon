// Layer: Mind
// Supplier Contract Intelligence — manage contracted prices per variant/supplier.
// Shows live deviation between contracted and last-received price so operators
// know immediately when a supplier is charging above the agreed rate.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo } from 'react'
import { format, addDays, parseISO, isBefore } from 'date-fns'
import {
  Button,
  Card,
  FormGroup,
  HTMLSelect,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  TextArea,
} from '@blueprintjs/core'
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
        <Icon icon="warning-sign" size={10} />
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
      <Icon icon="tick-circle" size={10} />
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
        <Icon icon="time" size={10} />
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
    <Card className="!p-5 space-y-4 !bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{form.id ? 'Edit Contract' : 'New Contract'}</p>
        <Button variant="minimal" size="small" icon="cross" onClick={onClose} aria-label="Close" />
      </div>

      {/* Variant search */}
      <FormGroup label="Product · Variant" className="!mb-0 relative">
        <InputGroup
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
      </FormGroup>

      {/* Supplier */}
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Supplier" className="!mb-0">
          <HTMLSelect
            value={form.supplier_id}
            onChange={(e) => {
              const sup = suppliers.find((s) => s.id === e.target.value)
              set('supplier_id', e.target.value)
              if (sup) set('supplier_name', sup.name)
              else if (!e.target.value) set('supplier_name', '')
            }}
            options={[
              { value: '', label: '— select or type below —' },
              ...suppliers.map((s) => ({ value: s.id, label: s.name })),
            ]}
            fill
          />
        </FormGroup>
        <FormGroup label="Supplier name (override)" className="!mb-0">
          <InputGroup
            placeholder="e.g. Metro Cash & Carry"
            value={form.supplier_name}
            onChange={(e) => { set('supplier_name', e.target.value) }}
          />
        </FormGroup>
      </div>

      {/* Price + MOQ */}
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Contracted unit price" className="!mb-0">
          <InputGroup
            type="number"
            min={0}
            step={0.01}
            placeholder="0.00"
            value={form.contracted_price}
            onChange={(e) => { set('contracted_price', e.target.value) }}
          />
        </FormGroup>
        <FormGroup label="Min order qty (optional)" className="!mb-0">
          <InputGroup
            type="number"
            min={1}
            placeholder="—"
            value={form.min_order_qty}
            onChange={(e) => { set('min_order_qty', e.target.value) }}
          />
        </FormGroup>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <FormGroup label="Contract start" className="!mb-0">
          <InputGroup
            type="date"
            value={form.contract_start}
            onChange={(e) => { set('contract_start', e.target.value) }}
          />
        </FormGroup>
        <FormGroup label="Contract end (optional)" className="!mb-0">
          <InputGroup
            type="date"
            value={form.contract_end}
            onChange={(e) => { set('contract_end', e.target.value) }}
          />
        </FormGroup>
      </div>

      {/* Notes */}
      <FormGroup label="Notes (optional)" className="!mb-0">
        <TextArea
          rows={2}
          placeholder="e.g. 90-day price lock, includes delivery"
          value={form.notes}
          onChange={(e) => { set('notes', e.target.value) }}
          fill
          className="!resize-none"
        />
      </FormGroup>

      <div className="flex justify-end gap-2">
        <Button variant="outlined" onClick={onClose}>
          Cancel
        </Button>
        <Button
          intent={Intent.PRIMARY}
          icon="floppy-disk"
          loading={upsert.isPending}
          disabled={!isValid}
          onClick={handleSubmit}
        >
          Save Contract
        </Button>
      </div>
    </Card>
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
        <Button
          variant="minimal"
          size="small"
          icon={expanded ? 'chevron-up' : 'chevron-down'}
          onClick={() => { setExpanded((v) => !v) }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
        />

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
          <Button
            variant="minimal"
            size="small"
            icon="edit"
            onClick={() => { onEdit(contract) }}
            aria-label="Edit"
          />
          <Button
            variant="minimal"
            size="small"
            intent={Intent.DANGER}
            icon="ban-circle"
            loading={deactivate.isPending}
            onClick={() => { deactivate.mutate(contract.id) }}
            aria-label="Deactivate"
          />
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
        <SegmentedControl
          size="small"
          value={filter}
          onValueChange={(v) => { setFilter(v as FilterId) }}
          options={[
            { value: 'all',       label: `All (${String(contracts.length)})` },
            { value: 'deviating', label: `Overpaying (${String(deviatingCount)})` },
            { value: 'expiring',  label: `Expiring soon (${String(expiringCount)})` },
          ]}
        />
        <Button intent={Intent.PRIMARY} icon="document" onClick={() => { setShowForm(true) }}>
          Add Contract
        </Button>
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
            <Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <NonIdealState
            icon="document"
            title={filter === 'all'
              ? 'No active contracts'
              : filter === 'deviating'
                ? 'No contracts above the contracted price'
                : 'No contracts expiring in the next 30 days'}
            description={filter === 'all'
              ? 'Add your first to start tracking price compliance.'
              : undefined}
          />
        )}

        {!isLoading && filtered.length > 0 && (
          <div className="rounded-none border-b divide-y">
            {/* Column headers */}
            <div className="flex items-center gap-3 px-4 py-2 bg-muted/30">
              <div className="w-7 shrink-0" />
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
