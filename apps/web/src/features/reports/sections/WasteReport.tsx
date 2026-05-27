// Waste & Loss: categorised removals plus cross-domain synthesis
// (by operator, day-of-week, supplier).

import { useMemo } from 'react'
import { format, subDays } from 'date-fns'
import {
  Button, HTMLTable, Icon, Intent, NonIdealState, Spinner, SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { exportToCsv } from '@/lib/csv'
import { Trend } from '@/components/Trend'
import { useDateRange, DateRangeBar } from '@/components/DateRangeBar'
import { useDateFormat } from '@/features/user/hooks'
import { useStockMovementReport, useWasteReport } from '@/features/inventory/hooks/reports'
import { useTeamMembers } from '@/features/team/hooks'
import { useSuppliers } from '@/features/suppliers/hooks'
import type { Supplier, ProductVariant, ProductWithVariants } from '@beacon/types'
import { buildCostMap, rowCost } from './_shared'

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function WasteReport({
  products,
  currency,
}: {
  products: ProductWithVariants[]
  currency: string
}) {
  const fmtDate = useDateFormat()
  const dateRange = useDateRange({ defaultPreset: '30d' })
  const { dateFrom, dateTo } = dateRange

  const { data: wasteEvents = [], isLoading } = useWasteReport(dateFrom, dateTo)

  const periodDays = useMemo(() => {
    const d1 = new Date(dateFrom)
    const d2 = new Date(dateTo)
    return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1)
  }, [dateFrom, dateTo])
  const priorFrom = format(subDays(new Date(dateFrom), periodDays), 'yyyy-MM-dd')
  const priorTo   = format(subDays(new Date(dateFrom), 1), 'yyyy-MM-dd')
  const { data: priorRows = [] } = useStockMovementReport(priorFrom, priorTo)

  const { data: teamMembers = [] } = useTeamMembers()
  const { data: suppliers = [] }   = useSuppliers()

  const costMap = useMemo(() => buildCostMap(products), [products])

  const wasteRows  = wasteEvents
  const priorWaste = useMemo(() => priorRows.filter((r) => !r.is_revert && r.quantity_change < 0 && r.removal_category), [priorRows])

  const totalWasteCost  = wasteRows.reduce((s, r) => s + rowCost(r, costMap), 0)
  const priorWasteCost  = priorWaste.reduce((s, r) => s + rowCost(r, costMap), 0)
  const totalWasteUnits = wasteRows.reduce((s, r) => s + Math.abs(r.quantity_change), 0)

  const byCategory = useMemo(() => {
    const map = new Map<string, { count: number; units: number; cost: number }>()
    for (const r of wasteRows) {
      const cat  = r.removal_category ?? 'Unknown'
      const prev = map.get(cat) ?? { count: 0, units: 0, cost: 0 }
      map.set(cat, { count: prev.count + 1, units: prev.units + Math.abs(r.quantity_change), cost: prev.cost + rowCost(r, costMap) })
    }
    return [...map.entries()].sort((a, b) => b[1].cost - a[1].cost)
  }, [wasteRows, costMap])

  const memberMap = useMemo(
    () => new Map(teamMembers.map((m) => [m.id, m.email])),
    [teamMembers]
  )
  const byOperator = useMemo(() => {
    const map = new Map<string, { email: string; units: number; cost: number; events: number }>()
    for (const r of wasteRows) {
      const uid   = r.user_id ?? 'unknown'
      const email = memberMap.get(uid) ?? uid.slice(0, 8) + '…'
      const prev  = map.get(uid) ?? { email, units: 0, cost: 0, events: 0 }
      map.set(uid, {
        email,
        units:  prev.units + Math.abs(r.quantity_change),
        cost:   prev.cost + rowCost(r, costMap),
        events: prev.events + 1,
      })
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost)
  }, [wasteRows, memberMap, costMap])

  const dowCosts = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0]
    for (const r of wasteRows) {
      totals[new Date(r.timestamp).getDay()] += rowCost(r, costMap)
    }
    return totals
  }, [wasteRows, costMap])
  const dowMax = Math.max(...dowCosts, 0.01)

  const suppliersMap = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers]
  )
  const variantSupplierMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) {
      for (const v of p.product_variants) {
        const sid = (v as ProductVariant & { default_supplier_id?: string | null }).default_supplier_id
        if (sid) map.set(v.id, sid)
      }
    }
    return map
  }, [products])
  const bySupplier = useMemo(() => {
    const map = new Map<string, { name: string; units: number; cost: number; variants: Set<string> }>()
    for (const r of wasteRows) {
      const sid = variantSupplierMap.get(r.variant_id)
      if (!sid) continue
      const supplier = suppliersMap.get(sid) as (Supplier & { lead_time_days?: number | null }) | undefined
      if (!supplier) continue
      const prev = map.get(sid) ?? { name: supplier.name, units: 0, cost: 0, variants: new Set() }
      prev.units += Math.abs(r.quantity_change)
      prev.cost  += rowCost(r, costMap)
      prev.variants.add(r.variant_id)
      map.set(sid, prev)
    }
    return [...map.values()].sort((a, b) => b.cost - a.cost)
  }, [wasteRows, variantSupplierMap, suppliersMap, costMap])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeBar {...dateRange} />
        {!isLoading && wasteRows.length > 0 && (
          <div className="flex items-center gap-4 text-sm">
            <span>
              <span className="font-semibold text-red-600">{formatCurrency(totalWasteCost, currency)}</span>
              <span className="text-muted-foreground"> destroyed</span>
            </span>
            <Trend current={totalWasteCost} prior={priorWasteCost} invertColor />
            <span className="text-muted-foreground text-xs">{String(totalWasteUnits)} units · {String(wasteRows.length)} events</span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-sm text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />Loading…
        </div>
      ) : wasteRows.length === 0 ? (
        <NonIdealState
          icon="flame"
          title="No categorised removals in this period."
          description="Categorised removals are recorded when you select a removal reason (Spoilage, Breakage, etc.) during stock adjustment."
        />
      ) : (
        <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold mb-2">Cost destroyed by category</p>
            <div className="rounded-lg border divide-y">
              {byCategory.map(([cat, { count, units, cost }]) => (
                <div key={cat} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cat}</p>
                    <p className="text-xs text-muted-foreground">{String(units)} units · {String(count)} event{count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-600 tabular-nums">{formatCurrency(cost, currency)}</p>
                    <p className="text-[10px] text-muted-foreground">{totalWasteCost > 0 ? `${String(Math.round((cost / totalWasteCost) * 100))}%` : ''}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30">
                <span className="text-sm font-semibold">Total</span>
                <span className="font-bold text-red-600 tabular-nums">{formatCurrency(totalWasteCost, currency)}</span>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold">Events</p>
              <Button
                size="small"
                variant="outlined"
                icon="download"
                onClick={() => { exportToCsv(`waste-${dateFrom}-to-${dateTo}`, wasteRows.map((r) => ({ date: format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm'), product: r.product_name, variant: r.variant_name, units: Math.abs(r.quantity_change), cost: rowCost(r, costMap).toFixed(2), category: r.removal_category }))) }}
              >
                CSV
              </Button>
            </div>
            <HTMLTable interactive className="w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="text-right">Units</th>
                  <th className="text-right">Cost</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {wasteRows.map((r) => (
                  <tr key={r.id}>
                    <td className="text-xs text-muted-foreground whitespace-nowrap">
                      {`${fmtDate(new Date(r.timestamp))}, ${format(new Date(r.timestamp), 'HH:mm')}`}
                    </td>
                    <td className="text-sm">{r.product_name}</td>
                    <td className="text-right font-semibold text-red-700 tabular-nums">
                      {r.quantity_change}
                    </td>
                    <td className="text-right tabular-nums text-sm font-medium">
                      {formatCurrency(rowCost(r, costMap), currency)}
                    </td>
                    <td className="text-xs">{r.removal_category}</td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Icon icon="flash" size={14} className="text-muted-foreground" />
            Cross-domain signals
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b">
                <Icon icon="people" size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Operator</span>
              </div>
              {byOperator.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">No operator data</p>
              ) : (
                <div className="divide-y">
                  {byOperator.map((op) => (
                    <div key={op.email} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{op.email.split('@')[0]}</p>
                        <p className="text-[10px] text-muted-foreground">{String(op.events)} events · {String(op.units)} units</p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-red-600 flex-shrink-0">
                        {formatCurrency(op.cost, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b">
                <Icon icon="calendar" size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Day of Week</span>
                {dowMax > 0 && (() => {
                  const peakIdx = dowCosts.indexOf(Math.max(...dowCosts))
                  return <span className="ml-auto text-[10px] text-muted-foreground">peak: {DOW_LABELS[peakIdx]}</span>
                })()}
              </div>
              <div className="px-4 py-3 space-y-2">
                {DOW_LABELS.map((label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-7 text-[10px] text-muted-foreground text-right flex-shrink-0">{label}</span>
                    <div className="flex-1 h-4 bg-muted rounded-sm overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-sm transition-all',
                          dowCosts[i] === 0 ? '' :
                          dowCosts[i] === dowMax ? 'bg-red-500' :
                          dowCosts[i] > dowMax * 0.6 ? 'bg-orange-400' : 'bg-orange-300/70',
                        )}
                        style={{ width: `${(dowCosts[i] / dowMax) * 100}%` }}
                      />
                    </div>
                    <span className="w-14 text-[10px] tabular-nums text-muted-foreground text-right flex-shrink-0">
                      {dowCosts[i] > 0 ? formatCurrency(dowCosts[i], currency) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-2.5 bg-muted/40 border-b">
                <Icon icon="truck" size={14} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">By Supplier</span>
              </div>
              {bySupplier.length === 0 ? (
                <p className="px-4 py-6 text-xs text-muted-foreground text-center">
                  {suppliers.length === 0
                    ? 'No suppliers configured'
                    : 'No waste events matched to a supplier — assign default suppliers to variants to enable this signal'}
                </p>
              ) : (
                <div className="divide-y">
                  {bySupplier.map((s) => (
                    <div key={s.name} className="flex items-center justify-between px-4 py-2.5 gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground">{String(s.variants.size)} variant{s.variants.size !== 1 ? 's' : ''} · {String(s.units)} units</p>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-red-600 flex-shrink-0">
                        {formatCurrency(s.cost, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  )
}
