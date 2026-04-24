import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import type { AuditLogRow } from '@/features/inventory/api/reports'

export function SummaryStrip({ logs, currency, costMap }: { logs: AuditLogRow[]; currency: string; costMap: Map<string, number> }) {
  const nonReverts  = logs.filter((l) => !l.is_revert)
  const additions   = nonReverts.filter((l) => l.quantity_change > 0)
  const removals    = nonReverts.filter((l) => l.quantity_change < 0)
  const writeOffs   = nonReverts.filter((l) => l.quantity_change < 0 && l.removal_category)
  const corrections = logs.filter((l) => l.is_revert)

  const totalConsumedCost = removals.reduce((s, l) => s + (costMap.get(l.variant_id) ?? 0) * Math.abs(l.quantity_change), 0)
  const totalWasteCost    = writeOffs.reduce((s, l) => s + (costMap.get(l.variant_id) ?? 0) * Math.abs(l.quantity_change), 0)

  const stats = [
    { label: 'Events',     value: String(nonReverts.length),                                             color: '' },
    { label: 'Added',      value: `+${String(additions.reduce((s, l) => s + l.quantity_change, 0))}`,    color: 'text-green-600 dark:text-green-400' },
    { label: 'Consumed',   value: String(removals.reduce((s, l) => s + Math.abs(l.quantity_change), 0)), color: 'text-red-600 dark:text-red-400' },
    { label: 'Cost moved', value: formatCurrency(totalConsumedCost, currency),                           color: '' },
    { label: 'Waste cost', value: formatCurrency(totalWasteCost, currency),                              color: totalWasteCost > 0 ? 'text-orange-600 dark:text-orange-400' : '' },
    { label: 'Corrections',value: String(corrections.length),                                            color: corrections.length > 0 ? 'text-amber-600 dark:text-amber-400' : '' },
  ]

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="rounded-lg border bg-card px-3 py-2.5 text-center">
          <p className={cn('text-lg font-bold tabular-nums leading-none', color)}>{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  )
}
