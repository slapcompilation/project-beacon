// Layer: Floor
// Location Inventory Map — shows all active variants grouped by their assigned
// location. Operators see PAR health at a glance per physical area and can
// reassign a variant's location inline without navigating away.
// Palantir principle: decision support, not data display. Each location group
// shows its health state and the operator can act immediately.

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, ChevronDown, ChevronUp, Loader2,
  AlertTriangle, TrendingDown, CheckCircle2, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useInventoryByLocation, useReassignVariantLocation, useLocations } from '@/features/locations/hooks'
import type { LocationInventoryRow } from '@beacon/types'

// ─── PAR status badge ─────────────────────────────────────────────────────────

const PAR_CFG = {
  ok:       { label: 'OK',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' },
  low:      { label: 'Low',      cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' },
  critical: { label: 'Critical', cls: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' },
  out:      { label: 'Out',      cls: 'bg-red-200 text-red-800 dark:bg-red-950/60 dark:text-red-300 font-bold' },
} as const

function ParBadge({ status }: { status: LocationInventoryRow['par_status'] }) {
  const cfg = PAR_CFG[status]
  return (
    <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

// ─── Relocate popover ─────────────────────────────────────────────────────────

function RelocateSelect({
  variantId,
  currentLocationId,
  onClose,
}: {
  variantId: string
  currentLocationId: string | null
  onClose: () => void
}) {
  const { data: locations = [] } = useLocations()
  const reassign = useReassignVariantLocation()
  const [selected, setSelected] = useState<string>(currentLocationId ?? '')

  const handleSave = () => {
    reassign.mutate(
      { variantId, locationId: selected || null },
      { onSuccess: onClose }
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        autoFocus
        className="rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
        value={selected}
        onChange={(e) => { setSelected(e.target.value) }}
      >
        <option value="">— Unassigned —</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
      <button
        type="button"
        disabled={reassign.isPending}
        onClick={handleSave}
        className="px-2 py-1 rounded bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
      >
        {reassign.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
      </button>
      <button type="button" onClick={onClose}>
        <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  )
}

// ─── Variant row ─────────────────────────────────────────────────────────────

function VariantRow({
  row,
  currency,
}: {
  row: LocationInventoryRow
  currency: string
}) {
  const [relocating, setRelocating] = useState(false)

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">
          <Link to={`/variant/${row.variant_id}`} className="hover:underline" onClick={(e) => { e.stopPropagation() }}>
            {row.product_name}
            {row.variant_name !== 'Standard' && (
              <span className="text-muted-foreground ml-1">· {row.variant_name}</span>
            )}
          </Link>
          <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">{row.sku}</span>
        </p>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {/* Stock */}
        <span className={cn(
          'text-xs font-semibold tabular-nums',
          row.par_status === 'out' ? 'text-red-600' :
          row.par_status === 'critical' ? 'text-red-500' :
          row.par_status === 'low' ? 'text-amber-600' : 'text-foreground'
        )}>
          {row.current_stock}
          {row.low_stock_threshold > 0 && (
            <span className="text-[10px] font-normal text-muted-foreground ml-0.5">
              /{row.low_stock_threshold}
            </span>
          )}
        </span>

        {/* Value */}
        {row.total_value > 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums w-16 text-right">
            {formatCurrency(row.total_value, currency)}
          </span>
        )}

        {/* PAR badge */}
        <div className="w-14 text-right">
          <ParBadge status={row.par_status} />
        </div>

        {/* Relocate */}
        <div className="w-40">
          {relocating
            ? (
              <RelocateSelect
                variantId={row.variant_id}
                currentLocationId={row.location_id}
                onClose={() => { setRelocating(false) }}
              />
            )
            : (
              <button
                type="button"
                onClick={() => { setRelocating(true) }}
                className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <MapPin className="h-3 w-3" />
                {row.location_name ?? 'Unassigned'}
              </button>
            )
          }
        </div>
      </div>
    </div>
  )
}

// ─── Location group ───────────────────────────────────────────────────────────

interface LocationGroup {
  key:       string            // location_path or 'Unassigned'
  locationId: string | null
  rows:      LocationInventoryRow[]
}

function LocationGroup({
  group,
  currency,
  defaultOpen,
}: {
  group: LocationGroup
  currency: string
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  const totalValue = group.rows.reduce((s, r) => s + r.total_value, 0)
  const atRisk     = group.rows.filter((r) => r.par_status === 'critical' || r.par_status === 'out').length
  const low        = group.rows.filter((r) => r.par_status === 'low').length

  const headerStatus =
    atRisk > 0 ? 'critical' :
    low    > 0 ? 'low'      :
    'ok'

  return (
    <div className="border-b last:border-b-0">
      {/* Group header */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v) }}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/20 transition-colors',
          open ? 'bg-muted/10' : '',
        )}
      >
        <MapPin className={cn(
          'h-4 w-4 shrink-0',
          headerStatus === 'critical' ? 'text-red-500' :
          headerStatus === 'low'      ? 'text-amber-500' :
          'text-muted-foreground',
        )} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {group.key}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {group.rows.length} variant{group.rows.length !== 1 ? 's' : ''}
            {totalValue > 0 && ` · ${formatCurrency(totalValue, currency)} value`}
            {atRisk > 0 && (
              <span className="ml-1.5 text-red-600 dark:text-red-400 font-medium">
                · {atRisk} critical
              </span>
            )}
            {low > 0 && atRisk === 0 && (
              <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-medium">
                · {low} low
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {atRisk > 0 && <AlertTriangle className="h-4 w-4 text-red-500" />}
          {low > 0 && atRisk === 0 && <TrendingDown className="h-4 w-4 text-amber-500" />}
          {atRisk === 0 && low === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500/60" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Variant rows */}
      {open && (
        <div className="divide-y border-t bg-muted/5">
          {/* Sub-header */}
          <div className="flex items-center gap-3 px-4 py-1.5 bg-muted/20">
            <div className="flex-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
              Product · Variant
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-10 text-right">Stock</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-16 text-right">Value</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-14 text-right">PAR</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-40">Location</span>
            </div>
          </div>
          {group.rows.map((row) => (
            <VariantRow key={row.variant_id} row={row} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ rows, currency }: { rows: LocationInventoryRow[]; currency: string }) {
  const totalValue    = rows.reduce((s, r) => s + r.total_value, 0)
  const criticalCount = rows.filter((r) => r.par_status === 'critical' || r.par_status === 'out').length
  const lowCount      = rows.filter((r) => r.par_status === 'low').length

  return (
    <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b bg-muted/10 shrink-0">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Variants</p>
        <p className="text-xl font-bold tabular-nums mt-0.5">{rows.length}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total Stock Value</p>
        <p className="text-xl font-bold tabular-nums mt-0.5">{formatCurrency(totalValue, currency)}</p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Critical / Out</p>
        <p className={cn('text-xl font-bold tabular-nums mt-0.5', criticalCount > 0 ? 'text-red-600' : 'text-emerald-600')}>
          {criticalCount}
        </p>
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Low Stock</p>
        <p className={cn('text-xl font-bold tabular-nums mt-0.5', lowCount > 0 ? 'text-amber-600' : 'text-muted-foreground')}>
          {lowCount}
        </p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Filter = 'all' | 'issues'

export default function LocationInventoryPage() {
  const { data: rows = [], isLoading } = useInventoryByLocation()
  const currency = useCurrency()
  const [filter, setFilter] = useState<Filter>('all')

  const filtered = filter === 'issues'
    ? rows.filter((r) => r.par_status !== 'ok')
    : rows

  // Group by location_path (nulls → 'Unassigned')
  const groups = useMemo<LocationGroup[]>(() => {
    const map = new Map<string, LocationGroup>()
    for (const row of filtered) {
      const key = row.location_path ?? 'Unassigned'
      const existing = map.get(key)
      if (existing) {
        existing.rows.push(row)
      } else {
        map.set(key, { key, locationId: row.location_id, rows: [row] })
      }
    }
    // Sort: issues first, then alphabetical
    return [...map.values()].sort((a, b) => {
      const aHasIssues = a.rows.some((r) => r.par_status !== 'ok')
      const bHasIssues = b.rows.some((r) => r.par_status !== 'ok')
      if (aHasIssues && !bHasIssues) return -1
      if (!aHasIssues && bHasIssues) return 1
      // Unassigned last
      if (a.key === 'Unassigned') return 1
      if (b.key === 'Unassigned') return -1
      return a.key.localeCompare(b.key)
    })
  }, [filtered])

  const issueCount = rows.filter((r) => r.par_status !== 'ok').length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {rows.length > 0 && <SummaryStrip rows={rows} currency={currency} />}

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0">
        {(
          [
            { id: 'all'    as Filter, label: `All locations (${rows.length} variants)` },
            { id: 'issues' as Filter, label: `Issues only (${issueCount})`, warn: issueCount > 0 },
          ]
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => { setFilter(f.id) }}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium transition-colors',
              filter === f.id
                ? 'bg-primary text-primary-foreground'
                : f.warn
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20'
                  : 'text-muted-foreground hover:bg-muted/40',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Location groups */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center px-8">
            <MapPin className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {filter === 'issues'
                ? 'All locations are fully stocked.'
                : 'No active variants found. Add products in Floor · Live Stock.'}
            </p>
          </div>
        ) : (
          <div>
            {groups.map((group, i) => (
              <LocationGroup
                key={group.key}
                group={group}
                currency={currency}
                defaultOpen={i === 0 || group.rows.some((r) => r.par_status !== 'ok')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
