// Layer: Floor + Flow — Global Quick Actions Panel
// Sprint 5 UX: persistent floating panel available on every authenticated page.
// Most common daily operations (adjust stock, request restock) in 3 clicks
// without navigating away from the current context.
// Palantir principle: actions live next to data — operators never need to leave their screen.

import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Zap, Plus, MinusCircle, PlusCircle, RefreshCw, X, Check,
  Search, Package, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useProducts } from '@/features/inventory/hooks'
import { useAdjustStock } from '@/features/inventory/hooks'
import { useCreateRestockRequest } from '@/features/restock/hooks'
import { useAuthStore } from '@/stores/auth.store'
import { hasPermission } from '@beacon/types'
import type { ProductVariant, ProductWithVariants } from '@beacon/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickMode = 'menu' | 'adjust' | 'restock'

interface VariantMatch {
  product: ProductWithVariants
  variant: ProductVariant
  displayName: string
}

// ─── Variant search ───────────────────────────────────────────────────────────

function useVariantSearch(products: ProductWithVariants[], query: string): VariantMatch[] {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  const results: VariantMatch[] = []
  for (const p of products) {
    for (const v of p.product_variants) {
      const displayName = v.name !== 'Standard' ? `${p.name} — ${v.name}` : p.name
      if (
        p.name.toLowerCase().includes(q) ||
        v.sku.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q)
      ) {
        results.push({ product: p, variant: v, displayName })
      }
    }
  }
  return results.slice(0, 8)
}

// ─── Quick Adjust sub-panel ───────────────────────────────────────────────────

function QuickAdjust({ onDone }: { onDone: () => void }) {
  const { data: products = [] } = useProducts()
  const adjustStock = useAdjustStock()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<VariantMatch | null>(null)
  const [delta, setDelta] = useState<number>(0)
  const [reason, setReason] = useState('Manual adjustment')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const results = useVariantSearch(products, search)

  const handleSubmit = useCallback(() => {
    if (!selected || delta === 0) return
    adjustStock.mutate(
      { variantId: selected.variant.id, delta, reason },
      { onSuccess: onDone },
    )
  }, [selected, delta, reason, adjustStock, onDone])

  // Enter to submit
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selected && delta !== 0) handleSubmit()
    }
    window.addEventListener('keydown', handler)
    return () => { window.removeEventListener('keydown', handler) }
  }, [handleSubmit, selected, delta])

  if (!selected) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Adjust</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search product or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {results.length > 0 && (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {results.map(({ product, variant, displayName }) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => { setSelected({ product, variant, displayName }); setSearch('') }}
                className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate text-xs font-medium">{displayName}</span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{variant.current_stock}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
        {search.trim() && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No products found</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Adjust</p>
        <button type="button" onClick={() => { setSelected(null) }} className="text-[10px] text-muted-foreground hover:text-foreground">← back</button>
      </div>
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <p className="text-sm font-medium truncate">{selected.displayName}</p>
        <p className="text-xs text-muted-foreground">
          Current stock: <span className="font-semibold tabular-nums">{selected.variant.current_stock}</span>
          {delta !== 0 && (
            <span className={cn(
              'ml-2 font-semibold tabular-nums',
              delta > 0 ? 'text-green-600' : 'text-red-600',
            )}>
              → {selected.variant.current_stock + delta}
            </span>
          )}
        </p>
      </div>

      {/* Delta input with +/- buttons */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">Adjustment (use − for removal)</p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 flex-shrink-0"
            onClick={() => { setDelta((v) => v - 1) }}>
            <MinusCircle className="h-4 w-4" />
          </Button>
          <Input
            type="number"
            value={delta}
            onChange={(e) => { setDelta(parseInt(e.target.value, 10) || 0) }}
            className="h-8 text-center text-sm font-bold tabular-nums flex-1"
          />
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 flex-shrink-0"
            onClick={() => { setDelta((v) => v + 1) }}>
            <PlusCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">Reason</p>
        <Input
          value={reason}
          onChange={(e) => { setReason(e.target.value) }}
          className="h-8 text-sm"
          placeholder="Reason…"
        />
      </div>

      <Button
        className="w-full h-8 gap-1.5 text-sm"
        onClick={handleSubmit}
        disabled={delta === 0 || !reason.trim() || adjustStock.isPending}
      >
        {adjustStock.isPending
          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          : <Check className="h-3.5 w-3.5" />}
        Apply {delta > 0 ? `+${delta}` : delta}
      </Button>
    </div>
  )
}

// ─── Quick Restock sub-panel ──────────────────────────────────────────────────

function QuickRestock({ onDone }: { onDone: () => void }) {
  const { data: products = [] } = useProducts()
  const createRequest = useCreateRestockRequest()

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<VariantMatch | null>(null)
  const [qty, setQty] = useState(1)
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => { searchRef.current?.focus() }, [])

  const results = useVariantSearch(products, search)

  const handleSubmit = useCallback(() => {
    if (!selected || qty < 1) return
    createRequest.mutate(
      { variantId: selected.variant.id, quantityNeeded: qty, supplier: supplier || null, notes: notes || null },
      { onSuccess: onDone },
    )
  }, [selected, qty, supplier, notes, createRequest, onDone])

  if (!selected) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Restock</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            placeholder="Search product or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        {results.length > 0 && (
          <div className="space-y-0.5 max-h-48 overflow-y-auto">
            {results.map(({ product, variant, displayName }) => (
              <button
                key={variant.id}
                type="button"
                onClick={() => { setSelected({ product, variant, displayName }); setSearch('') }}
                className="w-full flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-muted transition-colors"
              >
                <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate text-xs font-medium">{displayName}</span>
                <span className={cn(
                  'text-[10px] font-mono shrink-0',
                  variant.current_stock === 0 ? 'text-red-500 font-bold' : 'text-muted-foreground',
                )}>{variant.current_stock}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        )}
        {search.trim() && results.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No products found</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Restock</p>
        <button type="button" onClick={() => { setSelected(null) }} className="text-[10px] text-muted-foreground hover:text-foreground">← back</button>
      </div>
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <p className="text-sm font-medium truncate">{selected.displayName}</p>
        <p className="text-xs text-muted-foreground">
          Stock: <span className={cn('font-semibold tabular-nums', selected.variant.current_stock === 0 ? 'text-red-600' : '')}>{selected.variant.current_stock}</span>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[11px] text-muted-foreground mb-1.5">Quantity needed</p>
          <Input type="number" min={1} value={qty} onChange={(e) => { setQty(Math.max(1, parseInt(e.target.value, 10) || 1)) }} className="h-8 text-sm" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground mb-1.5">Supplier (optional)</p>
          <Input value={supplier} onChange={(e) => { setSupplier(e.target.value) }} className="h-8 text-sm" placeholder="Supplier…" />
        </div>
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground mb-1.5">Notes (optional)</p>
        <Input value={notes} onChange={(e) => { setNotes(e.target.value) }} className="h-8 text-sm" placeholder="Notes…" />
      </div>
      <Button
        className="w-full h-8 gap-1.5 text-sm"
        onClick={handleSubmit}
        disabled={qty < 1 || createRequest.isPending}
      >
        {createRequest.isPending
          ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          : <Check className="h-3.5 w-3.5" />}
        Submit Request
      </Button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuickActions() {
  const role = useAuthStore((s) => s.role)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<QuickMode>('menu')
  const panelRef = useRef<HTMLDivElement>(null)

  const canCreate = !!role && hasPermission(role, 'can_create_restocks')
  const canAdjust = !!role && hasPermission(role, 'can_adjust_stock')

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setMode('menu') }
    }
    document.addEventListener('keydown', handler)
    return () => { document.removeEventListener('keydown', handler) }
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
        setMode('menu')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => { document.removeEventListener('mousedown', handler) }
  }, [open])

  const handleDone = () => { setOpen(false); setMode('menu') }

  // Don't show for limited_access
  if (role === 'limited_access') return null

  return (
    <div ref={panelRef} className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">

      {/* Expanded panel */}
      {open && (
        <div className="w-80 rounded-xl border bg-popover shadow-xl shadow-black/10 overflow-hidden animate-in slide-in-from-bottom-2 fade-in duration-150">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-semibold">Quick Actions</span>
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); setMode('menu') }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-4">
            {mode === 'menu' && (
              <div className="space-y-2">
                {canAdjust && (
                  <button
                    type="button"
                    onClick={() => { setMode('adjust') }}
                    className="w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
                  >
                    <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-1.5">
                      <PlusCircle className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Adjust Stock</p>
                      <p className="text-[11px] text-muted-foreground">Add or remove units from any product</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
                {canCreate && (
                  <button
                    type="button"
                    onClick={() => { setMode('restock') }}
                    className="w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
                  >
                    <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-1.5">
                      <RefreshCw className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Request Restock</p>
                      <p className="text-[11px] text-muted-foreground">Submit a restock request instantly</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { void navigate('/scan'); setOpen(false) }}
                  className="w-full flex items-center gap-3 rounded-lg border px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
                >
                  <div className="rounded-md bg-purple-50 dark:bg-purple-950/30 p-1.5">
                    <Search className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Open Scanner</p>
                    <p className="text-[11px] text-muted-foreground">Scan barcode to adjust stock</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            )}
            {mode === 'adjust'  && <QuickAdjust  onDone={handleDone} />}
            {mode === 'restock' && <QuickRestock onDone={handleDone} />}
          </div>
        </div>
      )}

      {/* FAB trigger */}
      <button
        type="button"
        onClick={() => { setOpen((v) => { if (v) setMode('menu'); return !v }) }}
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full shadow-lg shadow-black/20 transition-all duration-150',
          open
            ? 'bg-foreground text-background rotate-45'
            : 'bg-primary text-primary-foreground hover:scale-105 hover:shadow-xl',
        )}
        title="Quick actions (adjust stock, request restock)"
      >
        {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      </button>
    </div>
  )
}
