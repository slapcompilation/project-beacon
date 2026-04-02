// Layer: Mind — Purchase Order Engine
// Breakthrough feature: auto-generates purchase orders from consumption forecasts.
// Groups by supplier, allows qty overrides, produces formatted POs with mailto links.
// Eliminates hours of manual procurement work weekly.
// Palantir principle: decision support — every number carries context and recommended action.

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  ShoppingCart, Copy, Check, Mail, Printer, ChevronDown, ChevronRight,
  AlertTriangle, TrendingDown, Package, Filter, RefreshCw, Info, CheckCircle, Loader2,
  SlidersHorizontal, PackageCheck,
} from 'lucide-react'
import { useDateFormat } from '@/features/user/hooks'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useSuppliers } from '@/features/suppliers/hooks'
import { useProcurementProposals, useCreateBulkRestockRequests } from '@/features/inventory/hooks'
import { useActiveHotel } from '@/features/hotel/hooks'
import { useCurrency } from '@/hooks/useCurrency'
import { useCreatePO } from '@/features/mind/hooks'
import type { ProcurementProposalRow } from '@/features/inventory/api'
import type { CreatePOInput } from '@/features/mind/api'

// Items passed via router state when coming from RestockPage
interface RestockNavItem {
  variantId:   string
  productName: string
  variantName: string
  sku:         string
  qty:         number
  unitCost:    number
  supplier:    string
  notes:       string
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface POLineItem {
  variantId: string
  productName: string
  variantName: string
  sku: string
  currentStock: number
  avgDaily: number
  daysUntilZero: number | null
  recommendedQty: number
  overrideQty: number | null // null = use recommended
  unitCost: number
  supplierId: string // '' = unassigned
  hasOpenRequest: boolean
  urgency: 'critical' | 'low' | 'reorder'
  avgLeadDays?: number | null
  _fromRestock?: boolean  // true = came from approved restock request, not forecast
}

type FilterMode = 'all' | 'critical' | 'low' | 'reorder'

// ─── Urgency helpers ──────────────────────────────────────────────────────────

function getUrgencyFromProposal(r: ProcurementProposalRow): 'critical' | 'low' | 'reorder' {
  if (r.days_until_zero != null && r.days_until_zero <= 2) return 'critical'
  if (r.days_until_zero != null && r.days_until_zero <= 7) return 'low'
  return 'reorder'
}

const URGENCY_CFG = {
  critical: { label: 'Critical',   cls: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
  low:      { label: 'Low Stock',  cls: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400' },
  reorder:  { label: 'Reorder',    cls: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
} as const

// ─── PO Text builder ──────────────────────────────────────────────────────────

function buildPOText(opts: {
  hotelName: string
  supplierName: string
  supplierEmail: string | null
  lines: POLineItem[]
  currency: string
  formattedDate: string
  poNumber?: string
  customNotes?: string
}): string {
  const { hotelName, supplierName, lines, currency, formattedDate: date, poNumber, customNotes } = opts
  const totalCost = lines.reduce((s, l) => s + (l.overrideQty ?? l.recommendedQty) * l.unitCost, 0)

  const header = [
    `PURCHASE ORDER${poNumber ? `  #${poNumber}` : ''}`,
    `Date: ${date}`,
    `Hotel: ${hotelName}`,
    `Supplier: ${supplierName}`,
    ``,
    `─────────────────────────────────────────────`,
    `SKU         | Product                | Qty  | Unit Cost | Total`,
    `─────────────────────────────────────────────`,
  ]

  const rows = lines.map((l) => {
    const qty = l.overrideQty ?? l.recommendedQty
    const lineTotal = qty * l.unitCost
    const name = l.variantName !== 'Standard' ? `${l.productName} (${l.variantName})` : l.productName
    return `${l.sku.padEnd(12)}| ${name.substring(0, 22).padEnd(22)} | ${String(qty).padStart(4)} | ${formatCurrency(l.unitCost, currency).padStart(9)} | ${formatCurrency(lineTotal, currency)}`
  })

  const footer = [
    `─────────────────────────────────────────────`,
    `TOTAL: ${formatCurrency(totalCost, currency)}`,
    ``,
    `Notes:`,
    customNotes
      ? customNotes
      : [
          `• Current stock levels as of ${date}`,
          `• Quantities based on 30-day consumption forecast`,
          `• Please confirm delivery date on receipt`,
        ].join('\n'),
  ]

  return [...header, ...rows, ...footer].join('\n')
}

// ─── Line item row ─────────────────────────────────────────────────────────────

interface LineRowProps {
  item: POLineItem
  suppliers: { id: string; name: string }[]
  onQtyChange: (variantId: string, qty: number | null) => void
  onSupplierChange: (variantId: string, supplierId: string) => void
  currency: string
}

function LineRow({ item, suppliers, onQtyChange, onSupplierChange, currency }: LineRowProps) {
  const qty = item.overrideQty ?? item.recommendedQty
  const lineTotal = qty * item.unitCost
  const urgencyCfg = URGENCY_CFG[item.urgency]

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="py-2.5 pl-4 pr-2">
        <div className="flex items-center gap-2 flex-wrap">
          {item._fromRestock ? (
            <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 font-semibold shrink-0 border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
              Restock
            </Badge>
          ) : (
            <Badge variant="outline" className={cn('text-[10px] h-4.5 px-1.5 font-semibold shrink-0', urgencyCfg.cls)}>
              {urgencyCfg.label}
            </Badge>
          )}
        </div>
      </td>
      <td className="py-2.5 px-2">
        <div>
          <p className="text-sm font-medium leading-tight">
            {item.variantName !== 'Standard' ? `${item.productName} — ${item.variantName}` : item.productName}
          </p>
          <p className="text-[10px] font-mono text-muted-foreground">{item.sku}</p>
        </div>
      </td>
      <td className="py-2.5 px-2 text-center">
        <span className={cn(
          'tabular-nums text-sm font-semibold',
          item.currentStock === 0 ? 'text-red-600' : item.urgency === 'critical' ? 'text-orange-600' : '',
        )}>
          {item.currentStock}
        </span>
        {item.daysUntilZero != null && (
          <p className="text-[10px] text-muted-foreground">~{item.daysUntilZero}d left</p>
        )}
        {item.avgLeadDays != null && (
          <p className="text-[10px] text-muted-foreground">{item.avgLeadDays}d lead</p>
        )}
      </td>
      <td className="py-2.5 px-2 text-center">
        <span className="text-xs text-muted-foreground tabular-nums">
          {item.avgDaily > 0 ? item.avgDaily.toFixed(1) : '—'}/day
        </span>
      </td>
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            value={item.overrideQty ?? item.recommendedQty}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10)
              if (isNaN(v) || v < 0) return
              // If equal to recommended, clear override
              onQtyChange(item.variantId, v === item.recommendedQty ? null : v)
            }}
            className={cn(
              'h-7 w-16 text-center text-sm tabular-nums',
              item.overrideQty != null ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : '',
            )}
          />
          {item.overrideQty != null && (
            <button
              type="button"
              onClick={() => { onQtyChange(item.variantId, null) }}
              className="text-[10px] text-muted-foreground hover:text-foreground"
              title={`Reset to recommended (${item.recommendedQty})`}
            >
              ↺
            </button>
          )}
        </div>
        {item.overrideQty != null && (
          <p className="text-[10px] text-amber-600 mt-0.5">rec: {item.recommendedQty}</p>
        )}
      </td>
      <td className="py-2.5 px-2 text-right">
        <p className="text-xs tabular-nums">{formatCurrency(item.unitCost, currency)}</p>
      </td>
      <td className="py-2.5 px-2 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatCurrency(lineTotal, currency)}</p>
      </td>
      <td className="py-2.5 pl-2 pr-4">
        <Select
          value={item.supplierId || '__none__'}
          onValueChange={(v) => { onSupplierChange(item.variantId, v === '__none__' ? '' : v) }}
        >
          <SelectTrigger className="h-7 w-36 text-xs">
            <SelectValue placeholder="Assign supplier…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">
              <span className="text-muted-foreground italic">Unassigned</span>
            </SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
    </tr>
  )
}

// ─── Supplier PO Panel ────────────────────────────────────────────────────────

interface SupplierPOPanelProps {
  supplierId: string
  supplierName: string
  supplierEmail: string | null
  items: POLineItem[]
  suppliers: { id: string; name: string }[]
  onQtyChange: (variantId: string, qty: number | null) => void
  onSupplierChange: (variantId: string, supplierId: string) => void
  currency: string
  hotelName: string
  onPlaceOrder: () => void
  poNumber?: string
  customNotes?: string
}

function SupplierPOPanel({
  supplierId,
  supplierName,
  supplierEmail,
  items,
  suppliers,
  onQtyChange,
  onSupplierChange,
  currency,
  hotelName,
  onPlaceOrder,
  poNumber,
  customNotes,
}: SupplierPOPanelProps) {
  const [open, setOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const fmtDate = useDateFormat()

  const totalQty = items.reduce((s, l) => s + (l.overrideQty ?? l.recommendedQty), 0)
  const totalCost = items.reduce((s, l) => s + (l.overrideQty ?? l.recommendedQty) * l.unitCost, 0)
  const criticalCount = items.filter((l) => l.urgency === 'critical').length

  const handleCopy = useCallback(async () => {
    const text = buildPOText({ hotelName, supplierName, supplierEmail, lines: items, currency, formattedDate: fmtDate(new Date()), poNumber, customNotes })
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 3000)
    toast.success(`PO for ${supplierName} copied to clipboard`)
  }, [hotelName, supplierName, supplierEmail, items, currency, poNumber, customNotes, fmtDate])

  const handleMailto = useCallback(() => {
    if (!supplierEmail) {
      toast.error('No email address for this supplier')
      return
    }
    const todayFormatted = fmtDate(new Date())
    const subject = encodeURIComponent(`Purchase Order${poNumber ? ` #${poNumber}` : ''} — ${hotelName} — ${todayFormatted}`)
    const body = encodeURIComponent(buildPOText({ hotelName, supplierName, supplierEmail, lines: items, currency, formattedDate: todayFormatted, poNumber, customNotes }))
    window.open(`mailto:${supplierEmail}?subject=${subject}&body=${body}`)
  }, [hotelName, supplierName, supplierEmail, items, currency, poNumber, customNotes, fmtDate])

  const isUnassigned = supplierId === '__unassigned__'

  return (
    <div className={cn(
      'rounded-lg border bg-card',
      isUnassigned ? 'border-dashed border-muted-foreground/30' : '',
    )}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors rounded-t-lg"
        onClick={() => { setOpen((v) => !v) }}
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn(
              'text-sm font-semibold',
              isUnassigned ? 'text-muted-foreground italic' : '',
            )}>
              {supplierName}
            </h3>
            {supplierEmail && (
              <span className="text-[10px] text-muted-foreground font-mono">{supplierEmail}</span>
            )}
            {criticalCount > 0 && (
              <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400">
                {criticalCount} critical
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} item{items.length !== 1 ? 's' : ''} · {totalQty} units · {formatCurrency(totalCost, currency)} est. total
          </p>
        </div>
        {!isUnassigned && (
          <div className="flex items-center gap-2 shrink-0" onClick={(e) => { e.stopPropagation() }}>
            <Button size="sm" variant="outline" onClick={() => { void handleCopy() }} className="h-7 text-xs gap-1.5">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied!' : 'Copy PO'}
            </Button>
            <Button
              size="sm"
              variant={supplierEmail ? 'default' : 'outline'}
              onClick={handleMailto}
              disabled={!supplierEmail}
              className="h-7 text-xs gap-1.5"
              title={!supplierEmail ? 'No email address on file for this supplier' : ''}
            >
              <Mail className="h-3 w-3" />
              {supplierEmail ? 'Send Email' : 'No Email'}
            </Button>
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 text-xs h-8"
              onClick={onPlaceOrder}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Place Order
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {open && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pl-4 pr-2 w-24">Urgency</th>
                <th className="py-2 px-2">Product</th>
                <th className="py-2 px-2 text-center w-20">Stock</th>
                <th className="py-2 px-2 text-center w-24">Usage</th>
                <th className="py-2 px-2 w-28">Qty to Order</th>
                <th className="py-2 px-2 text-right w-24">Unit Cost</th>
                <th className="py-2 px-2 text-right w-24">Line Total</th>
                <th className="py-2 pl-2 pr-4 w-40">Supplier</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <LineRow
                  key={item.variantId}
                  item={item}
                  suppliers={suppliers}
                  onQtyChange={onQtyChange}
                  onSupplierChange={onSupplierChange}
                  currency={currency}
                />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/20">
                <td colSpan={4} className="py-2 pl-4 text-xs text-muted-foreground">
                  {items.filter((l) => l.hasOpenRequest).length > 0 && (
                    <span className="flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      {items.filter((l) => l.hasOpenRequest).length} items already have open restock requests
                    </span>
                  )}
                </td>
                <td className="py-2 px-2 text-sm font-bold tabular-nums text-right">
                  {items.reduce((s, l) => s + (l.overrideQty ?? l.recommendedQty), 0)}
                </td>
                <td />
                <td className="py-2 px-2 text-right">
                  <p className="text-sm font-bold tabular-nums">{formatCurrency(totalCost, currency)}</p>
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PurchaseOrderContent() {
  const activeHotel = useActiveHotel()
  const currency    = useCurrency()
  const hotelName   = activeHotel?.name ?? 'Hotel'
  const fmtDate = useDateFormat()
  const location = useLocation()
  const fromRestock = (location.state as { fromRestock?: RestockNavItem[] } | null)?.fromRestock

  const { data: proposals = [], isLoading: proposalsLoading } = useProcurementProposals()
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers()
  const createBulkRequests = useCreateBulkRestockRequests()
  const createPO = useCreatePO()

  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [qtyOverrides, setQtyOverrides] = useState<Record<string, number>>({})
  const [supplierAssignments, setSupplierAssignments] = useState<Record<string, string>>({})
  const [printMode, setPrintMode] = useState(false)
  const [showTemplate, setShowTemplate] = useState(false)
  const [poNumber, setPoNumber] = useState(() => localStorage.getItem('po_number') ?? '')
  const [customNotes, setCustomNotes] = useState(() => localStorage.getItem('po_custom_notes') ?? '')
  const hasInitialized = useRef(false)

  // Pre-populate supplier assignments from proposal preferred_supplier_id (once on first load)
  useEffect(() => {
    if (hasInitialized.current) return
    if (proposals.length === 0 && !fromRestock) return
    hasInitialized.current = true

    setSupplierAssignments((prev) => {
      const next = { ...prev }
      // Forecast proposals → preferred supplier
      for (const r of proposals) {
        if (r.preferred_supplier_id && !next[r.variant_id]) {
          next[r.variant_id] = r.preferred_supplier_id
        }
      }
      // Restock items → match supplier name to id
      if (fromRestock) {
        for (const item of fromRestock) {
          if (item.supplier && !next[item.variantId]) {
            const match = suppliers.find((s) => s.name.toLowerCase() === item.supplier.toLowerCase())
            if (match) next[item.variantId] = match.id
          }
        }
      }
      return next
    })
  }, [proposals, fromRestock, suppliers])

  // Convert proposals + fromRestock → line items
  // fromRestock items take priority (appear first and override forecast entries for the same variantId)
  const allItems = useMemo<POLineItem[]>(() => {
    const restockVariantIds = new Set(fromRestock?.map((r) => r.variantId) ?? [])

    // Restock-sourced items
    const restockItems: POLineItem[] = (fromRestock ?? []).map((r) => ({
      variantId:      r.variantId,
      productName:    r.productName,
      variantName:    r.variantName,
      sku:            r.sku,
      currentStock:   0,
      avgDaily:       0,
      daysUntilZero:  null,
      recommendedQty: r.qty,
      overrideQty:    qtyOverrides[r.variantId] ?? null,
      unitCost:       r.unitCost,
      supplierId:     supplierAssignments[r.variantId] ?? '',
      hasOpenRequest: true,
      urgency:        'reorder' as const,
      _fromRestock:   true,
    }))

    // Forecast proposals (skip variants already in restock list)
    const forecastItems: POLineItem[] = proposals
      .filter((r) => !restockVariantIds.has(r.variant_id))
      .map((r) => ({
        variantId: r.variant_id,
        productName: r.product_name,
        variantName: r.variant_name,
        sku: r.sku,
        currentStock: r.current_stock,
        avgDaily: r.avg_daily ?? 0,
        daysUntilZero: r.days_until_zero,
        recommendedQty: r.suggested_qty || 1,
        overrideQty: qtyOverrides[r.variant_id] ?? null,
        unitCost: r.unit_cost,
        supplierId: supplierAssignments[r.variant_id] ?? r.preferred_supplier_id ?? '',
        hasOpenRequest: r.has_open_request,
        urgency: getUrgencyFromProposal(r),
        avgLeadDays: r.avg_lead_days,
      }))
      .sort((a, b) => {
        // Sort: critical → low → reorder, then by days_until_zero asc
        const urgencyOrder = { critical: 0, low: 1, reorder: 2 }
        if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
        }
        const aD = a.daysUntilZero ?? 999
        const bD = b.daysUntilZero ?? 999
        return aD - bD
      })

    return [...restockItems, ...forecastItems]
  }, [proposals, fromRestock, qtyOverrides, supplierAssignments])

  // Filter by mode + search
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allItems.filter((item) => {
      if (filterMode !== 'all' && item.urgency !== filterMode) return false
      if (q) {
        const name = item.variantName !== 'Standard' ? `${item.productName} ${item.variantName}` : item.productName
        return name.toLowerCase().includes(q) || item.sku.toLowerCase().includes(q)
      }
      return true
    })
  }, [allItems, filterMode, search])

  // Group by supplier
  const supplierGroups = useMemo(() => {
    const groups = new Map<string, { supplierId: string; supplierName: string; supplierEmail: string | null; items: POLineItem[] }>()

    for (const item of filteredItems) {
      const key = item.supplierId || '__unassigned__'
      let group = groups.get(key)
      if (!group) {
        const supplier = suppliers.find((s) => s.id === item.supplierId)
        group = {
          supplierId: key,
          supplierName: supplier?.name ?? 'Unassigned',
          supplierEmail: supplier?.email ?? null,
          items: [],
        }
        groups.set(key, group)
      }
      group.items.push(item)
    }

    // Sort: named suppliers first, unassigned last
    return [...groups.values()].sort((a, b) => {
      if (a.supplierId === '__unassigned__') return 1
      if (b.supplierId === '__unassigned__') return -1
      return a.supplierName.localeCompare(b.supplierName)
    })
  }, [filteredItems, suppliers])

  const handleQtyChange = useCallback((variantId: string, qty: number | null) => {
    setQtyOverrides((prev) => {
      const next = { ...prev }
      if (qty === null) {
        delete next[variantId]
      } else {
        next[variantId] = qty
      }
      return next
    })
  }, [])

  const handleSupplierChange = useCallback((variantId: string, supplierId: string) => {
    setSupplierAssignments((prev) => ({ ...prev, [variantId]: supplierId }))
  }, [])

  const handleAssignAll = useCallback((supplierId: string) => {
    // Assign all unassigned items to this supplier
    const unassigned = filteredItems.filter((i) => !i.supplierId)
    if (unassigned.length === 0) {
      toast.info('No unassigned items')
      return
    }
    setSupplierAssignments((prev) => {
      const next = { ...prev }
      for (const item of unassigned) {
        next[item.variantId] = supplierId
      }
      return next
    })
    toast.success(`Assigned ${unassigned.length} items to ${suppliers.find((s) => s.id === supplierId)?.name ?? 'supplier'}`)
  }, [filteredItems, suppliers])

  const handlePlaceOrder = useCallback((supplierId: string) => {
    const group = supplierGroups.find((g) => g.supplierId === supplierId)
    if (!group) return
    const items = group.items.map((item) => ({
      variantId: item.variantId,
      quantityNeeded: item.overrideQty ?? item.recommendedQty,
      supplier: group.supplierName,
    }))
    void createBulkRequests.mutateAsync(items)
  }, [supplierGroups, createBulkRequests])

  const handleCopyAll = useCallback(async () => {
    const namedGroups = supplierGroups.filter((g) => g.supplierId !== '__unassigned__')
    if (namedGroups.length === 0) {
      toast.error('No items assigned to suppliers yet')
      return
    }
    const todayFormatted = fmtDate(new Date())
    const allText = namedGroups.map((g) =>
      buildPOText({ hotelName, supplierName: g.supplierName, supplierEmail: g.supplierEmail, lines: g.items, currency, formattedDate: todayFormatted, poNumber, customNotes })
    ).join('\n\n══════════════════════════════════════════\n\n')
    await navigator.clipboard.writeText(allText)
    toast.success(`All POs copied (${namedGroups.length} suppliers)`)
  }, [supplierGroups, hotelName, currency, poNumber, customNotes, fmtDate])

  const handleSaveAllPOs = useCallback(async () => {
    const namedGroups = supplierGroups.filter((g) => g.supplierId !== '__unassigned__')
    if (namedGroups.length === 0) {
      toast.error('Assign items to at least one supplier before saving')
      return
    }
    if (!poNumber.trim()) {
      toast.error('Enter a PO number in Template Settings before saving')
      return
    }
    for (const group of namedGroups) {
      const input: CreatePOInput = {
        supplierId:   group.supplierId === '__unassigned__' ? null : group.supplierId,
        supplierName: group.supplierName,
        poNumber:     namedGroups.length > 1
          ? `${poNumber}-${group.supplierName.substring(0, 4).toUpperCase()}`
          : poNumber,
        notes: customNotes || null,
        lines: group.items.map((item) => ({
          variantId:  item.variantId,
          requestId:  null,
          orderedQty: item.overrideQty ?? item.recommendedQty,
          unitCost:   item.unitCost,
        })),
      }
      await createPO.mutateAsync(input)
    }
  }, [supplierGroups, suppliers, poNumber, customNotes, createPO])

  const isLoading = proposalsLoading || suppliersLoading

  // KPI summary
  const totalItems    = allItems.length
  const criticalCount = allItems.filter((i) => i.urgency === 'critical').length
  const totalEstCost  = filteredItems.reduce((s, i) => s + (i.overrideQty ?? i.recommendedQty) * i.unitCost, 0)
  const unassignedCount = filteredItems.filter((i) => !i.supplierId).length
  const assignedSupplierCount = supplierGroups.filter((g) => g.supplierId !== '__unassigned__').length

  return (
    <div className={cn('flex flex-col h-full', printMode && 'print:block')}>

      {/* Page header */}
      <div className="flex items-start justify-between border-b px-8 py-5 flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-muted-foreground" />
            Purchase Order Engine
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : (
              `${totalItems} items · ${criticalCount > 0 ? `${criticalCount} critical · ` : ''}${assignedSupplierCount} supplier${assignedSupplierCount !== 1 ? 's' : ''} · est. ${formatCurrency(totalEstCost, currency)}`
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={showTemplate ? 'secondary' : 'outline'}
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => { setShowTemplate((v) => !v) }}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Template
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => { void handleCopyAll() }}>
            <Copy className="h-3.5 w-3.5" />
            Copy All POs
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => { setPrintMode(true); setTimeout(() => { window.print(); setPrintMode(false) }, 100) }}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
        </div>
      </div>

      {/* Restock source banner */}
      {fromRestock && (
        <div className="flex items-center gap-3 px-8 py-2.5 border-b bg-blue-50/70 dark:bg-blue-950/20 text-sm flex-shrink-0">
          <PackageCheck className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span className="text-blue-700 dark:text-blue-400">
            <span className="font-semibold">{fromRestock.length} items loaded from approved restock requests.</span>
            {' '}Quantities are editable — forecast proposals for other variants appear below.
          </span>
        </div>
      )}

      {/* Template settings panel */}
      {showTemplate && (
        <div className="border-b bg-muted/20 px-8 py-4 flex-shrink-0 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">PO Template Settings</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">PO Number / Reference</label>
              <Input
                placeholder="e.g. PO-2026-001"
                value={poNumber}
                onChange={(e) => {
                  setPoNumber(e.target.value)
                  localStorage.setItem('po_number', e.target.value)
                }}
                className="h-8 text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Appears on all POs from this session</p>
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Custom Notes / Terms</label>
              <Textarea
                placeholder={`• Current stock levels as of today\n• Quantities based on 30-day consumption forecast\n• Please confirm delivery date on receipt`}
                value={customNotes}
                onChange={(e) => {
                  setCustomNotes(e.target.value)
                  localStorage.setItem('po_custom_notes', e.target.value)
                }}
                className="text-xs min-h-[64px] resize-none"
                rows={3}
              />
              <p className="text-[10px] text-muted-foreground">Replaces default notes. Leave blank to use defaults.</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-px border-b bg-border flex-shrink-0">
        {[
          { label: 'Total Items', value: totalItems, sub: 'need restocking' },
          { label: 'Critical', value: criticalCount, sub: '≤2 days of stock', highlight: criticalCount > 0 },
          { label: 'Est. Order Value', value: formatCurrency(totalEstCost, currency), sub: 'based on unit costs' },
          { label: 'Suppliers', value: assignedSupplierCount, sub: `${unassignedCount} unassigned` },
          { label: 'Modified Qtys', value: Object.keys(qtyOverrides).length, sub: 'overrides from forecast' },
        ].map(({ label, value, sub, highlight }) => (
          <div key={label} className="bg-card px-5 py-3">
            <p className={cn('text-lg font-bold tabular-nums leading-none', highlight ? 'text-red-600' : '')}>{value}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b px-6 py-2.5 flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by product or SKU…"
            value={search}
            onChange={(e) => { setSearch(e.target.value) }}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {(['all', 'critical', 'low', 'reorder'] as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => { setFilterMode(mode) }}
              className={cn(
                'px-2.5 py-1 text-xs font-medium rounded transition-colors capitalize',
                filterMode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {mode === 'all' ? `All (${allItems.length})` : mode === 'critical' ? `Critical (${allItems.filter(i => i.urgency === 'critical').length})` : mode === 'low' ? `Low (${allItems.filter(i => i.urgency === 'low').length})` : `Reorder (${allItems.filter(i => i.urgency === 'reorder').length})`}
            </button>
          ))}
        </div>
        {suppliers.length > 0 && unassignedCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-muted-foreground">{unassignedCount} unassigned →</span>
            <Select onValueChange={handleAssignAll}>
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Assign all to…" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={() => { setQtyOverrides({}); setSupplierAssignments({}); setSearch(''); setFilterMode('all') }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reset
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
            <div className="rounded-full bg-muted/50 p-4">
              <Package className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">No items match this filter</p>
            <p className="text-xs text-muted-foreground">
              {allItems.length === 0
                ? 'All stock levels are healthy — no reorders needed right now.'
                : 'Try changing the filter or search term.'}
            </p>
          </div>
        ) : (
          <>
            {/* Help banner if no suppliers set up */}
            {suppliers.length === 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-400">No suppliers configured</p>
                  <p className="text-amber-700 dark:text-amber-500 text-xs mt-0.5">
                    Add suppliers in Settings → Suppliers to enable PO email sending and grouping.
                    You can still copy PO text to send manually.
                  </p>
                </div>
              </div>
            )}

            {supplierGroups.map((group) => (
              <SupplierPOPanel
                key={group.supplierId}
                supplierId={group.supplierId}
                supplierName={group.supplierName}
                supplierEmail={group.supplierEmail}
                items={group.items}
                suppliers={suppliers}
                onQtyChange={handleQtyChange}
                onSupplierChange={handleSupplierChange}
                currency={currency}
                hotelName={hotelName}
                onPlaceOrder={() => { handlePlaceOrder(group.supplierId) }}
                poNumber={poNumber || undefined}
                customNotes={customNotes || undefined}
              />
            ))}

            {/* Summary footer */}
            <div className="rounded-lg border bg-muted/30 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Total units to order: </span>
                  <span className="font-bold tabular-nums">
                    {filteredItems.reduce((s, i) => s + (i.overrideQty ?? i.recommendedQty), 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Estimated total: </span>
                  <span className="font-bold tabular-nums">{formatCurrency(totalEstCost, currency)}</span>
                </div>
                {Object.keys(qtyOverrides).length > 0 && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <TrendingDown className="h-3.5 w-3.5" />
                    <span className="text-xs">{Object.keys(qtyOverrides).length} quantity overrides active</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => { void handleCopyAll() }}>
                  <Copy className="h-3.5 w-3.5" />
                  Copy All POs
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => { void handleSaveAllPOs() }}
                  disabled={createPO.isPending || supplierGroups.filter((g) => g.supplierId !== '__unassigned__').length === 0}
                >
                  {createPO.isPending
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…</>
                    : <><CheckCircle className="h-3.5 w-3.5" />Save &amp; Track</>}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function PurchaseOrderPage() {
  return <PurchaseOrderContent />
}
