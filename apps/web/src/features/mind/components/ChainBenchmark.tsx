// @surface-orphan-ok — chain benchmarking panel, exported by a barrel nobody imported. ChainPage may already cover it; needs a look before deleting.
// Layer: Mind — Chain benchmarking panel (multi-hotel owners only)
// Compares waste rate, supplier fill rate, and throughput across all hotels.

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useChainBenchmarks } from '../hooks'

const RANGE_OPTIONS = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

export function ChainBenchmark() {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const { data: rows = [], isLoading } = useChainBenchmarks(days)

  if (isLoading || rows.length < 2) return null  // Only meaningful for multi-hotel

  const maxWasted = Math.max(...rows.map((r) => r.total_wasted), 1)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Chain Benchmarking</p>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => { setDays(opt.days) }}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                days === opt.days
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row) => {
          const wasteRatePct  = Math.round(row.waste_rate * 100)
          const barPct        = (row.total_wasted / maxWasted) * 100
          const isWorst       = row.hotel_id === rows[0]?.hotel_id && rows.length > 1
          const fillRate      = row.avg_fill_rate
          const onTimeRate    = row.avg_on_time_rate
          return (
            <div key={row.hotel_id} className="space-y-1">
              <div className="flex items-center justify-between text-sm gap-2">
                <span className="font-medium truncate">{row.hotel_name}</span>
                <div className="flex-shrink-0 flex items-center gap-3 text-xs text-muted-foreground">
                  {fillRate != null && (
                    <span className={cn(
                      'tabular-nums',
                      fillRate >= 95 ? 'text-green-600 dark:text-green-400'
                      : fillRate >= 80 ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400',
                    )}>
                      {fillRate.toFixed(0)}% fill
                    </span>
                  )}
                  {onTimeRate != null && (
                    <span className={cn(
                      'tabular-nums',
                      onTimeRate >= 90 ? 'text-green-600 dark:text-green-400'
                      : onTimeRate >= 75 ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-red-600 dark:text-red-400',
                    )}>
                      {onTimeRate.toFixed(0)}% on-time
                    </span>
                  )}
                  <span>{row.total_wasted} wasted</span>
                  <span className={cn(
                    'font-semibold',
                    wasteRatePct > 20 ? 'text-red-600' : wasteRatePct > 10 ? 'text-yellow-600' : 'text-green-600'
                  )}>
                    {wasteRatePct}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', isWorst ? 'bg-red-500' : 'bg-primary')}
                  style={{ width: `${String(barPct)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
