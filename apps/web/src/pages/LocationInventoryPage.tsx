// Layer: Floor
// Location Inventory Map — shows all active variants grouped by their assigned
// location. Operators see PAR health at a glance per physical area and can
// reassign a variant's location inline without navigating away.
//
// 100% Blueprint — no shadcn primitives, no lucide icons.

import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Button,
  HTMLSelect,
  Icon,
  Intent,
  NonIdealState,
  SegmentedControl,
  Spinner,
  SpinnerSize,
  Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { AipSignalsProvider } from '@/features/aipSignals/AipSignalsProvider'
import { AipRowBadge } from '@/features/aipSignals/AipRowBadge'
import { formatCurrency } from '@/lib/currency'
import { useCurrency } from '@/hooks/useCurrency'
import { useInventoryByLocation, useReassignVariantLocation, useLocations } from '@/features/locations/hooks'
import type { LocationInventoryRow } from '@beacon/types'

// ─── PAR status badge ─────────────────────────────────────────────────────────

const PAR_INTENT: Record<LocationInventoryRow['par_status'], { label: string; intent: Intent }> = {
  ok:       { label: 'OK',       intent: Intent.SUCCESS },
  low:      { label: 'Low',      intent: Intent.WARNING },
  critical: { label: 'Critical', intent: Intent.DANGER  },
  out:      { label: 'Out',      intent: Intent.DANGER  },
}

function ParBadge({ status }: { status: LocationInventoryRow['par_status'] }) {
  const cfg = PAR_INTENT[status]
  return <Tag intent={cfg.intent} minimal>{cfg.label}</Tag>
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
      <HTMLSelect
        autoFocus
        value={selected}
        onChange={(e) => { setSelected(e.target.value) }}
        options={[
          { value: '', label: '— Unassigned —' },
          ...locations.map((l) => ({ value: l.id, label: l.name })),
        ]}
      />
      <Button
        size="small"
        intent={Intent.PRIMARY}
        loading={reassign.isPending}
        onClick={handleSave}
      >
        Save
      </Button>
      <Button icon="cross" variant="minimal" size="small" onClick={onClose} aria-label="Cancel" />
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
        <AipRowBadge variantIds={[row.variant_id]} />
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
        <div className="w-48">
          {relocating
            ? (
              <RelocateSelect
                variantId={row.variant_id}
                currentLocationId={row.location_id}
                onClose={() => { setRelocating(false) }}
              />
            )
            : (
              <Button
                variant="minimal"
                size="small"
                icon="map-marker"
                onClick={() => { setRelocating(true) }}
              >
                {row.location_name ?? 'Unassigned'}
              </Button>
            )
          }
        </div>
      </div>
    </div>
  )
}

// ─── Location group ───────────────────────────────────────────────────────────

interface LocationGroup {
  key:       string
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
        <Icon
          icon="map-marker"
          size={14}
          className={cn(
            'shrink-0',
            headerStatus === 'critical' ? 'text-red-500' :
            headerStatus === 'low'      ? 'text-amber-500' :
            'text-muted-foreground',
          )}
        />

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
          {atRisk > 0 && <Icon icon="warning-sign" size={14} className="text-red-500" />}
          {low > 0 && atRisk === 0 && <Icon icon="trending-down" size={14} className="text-amber-500" />}
          {atRisk === 0 && low === 0 && <Icon icon="tick-circle" size={14} className="text-emerald-500/60" />}
          <Icon icon={open ? 'chevron-up' : 'chevron-down'} size={14} className="text-muted-foreground" />
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
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground w-48">Location</span>
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
    return [...map.values()].sort((a, b) => {
      const aHasIssues = a.rows.some((r) => r.par_status !== 'ok')
      const bHasIssues = b.rows.some((r) => r.par_status !== 'ok')
      if (aHasIssues && !bHasIssues) return -1
      if (!aHasIssues && bHasIssues) return 1
      if (a.key === 'Unassigned') return 1
      if (b.key === 'Unassigned') return -1
      return a.key.localeCompare(b.key)
    })
  }, [filtered])

  const signalVariantIds = useMemo(
    () => groups.flatMap((g) => g.rows.map((r) => r.variant_id)),
    [groups],
  )

  const issueCount = rows.filter((r) => r.par_status !== 'ok').length

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner size={SpinnerSize.STANDARD} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {rows.length > 0 && <SummaryStrip rows={rows} currency={currency} />}

      {/* Filter bar */}
      <div className="flex items-center gap-2 px-6 py-3 border-b shrink-0">
        <SegmentedControl
          size="small"
          value={filter}
          onValueChange={(v) => { setFilter(v as Filter) }}
          options={[
            { value: 'all',    label: `All locations (${String(rows.length)} variants)` },
            { value: 'issues', label: `Issues only (${String(issueCount)})` },
          ]}
        />
      </div>

      {/* Location groups */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 ? (
          <NonIdealState
            icon="map-marker"
            title={filter === 'issues' ? 'All locations are fully stocked' : 'No active variants found'}
            description={filter === 'issues' ? undefined : 'Add products in Floor · Live Stock.'}
          />
        ) : (
          <AipSignalsProvider variantIds={signalVariantIds}>
            {groups.map((group, i) => (
              <LocationGroup
                key={group.key}
                group={group}
                currency={currency}
                defaultOpen={i === 0 || group.rows.some((r) => r.par_status !== 'ok')}
              />
            ))}
          </AipSignalsProvider>
        )}
      </div>
    </div>
  )
}
