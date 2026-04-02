// Layer: Eye — Waste Radar dashboard widget
// Shows variants with write-off spikes vs their 4-week baseline, ranked by anomaly_score.
// Compact panel version; /waste-radar is the full analytical surface.

import { Flame, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWasteRadar } from '../hooks'

function fmtCost(v: number) {
  return v >= 1000
    ? `$${(v / 1000).toFixed(1)}k`
    : `$${v.toFixed(0)}`
}

export function WasteRadar() {
  const { data: rows = [], isLoading } = useWasteRadar()

  const totalCost = rows.reduce((s, r) => s + (r.waste_cost_7d ?? 0), 0)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        {!isLoading && rows.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-600 font-semibold">
            <Flame className="h-3.5 w-3.5" />
            <span>{rows.length} spike{rows.length !== 1 ? 's' : ''} · {fmtCost(totalCost)} at risk (7d)</span>
          </div>
        )}
      </div>

      {isLoading && (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      )}

      {!isLoading && rows.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No write-off anomalies detected this week.
        </p>
      )}

      {!isLoading && rows.length > 0 && (() => {
        const max = rows[0]?.qty_7d ?? 1
        return (
          <div className="space-y-3">
            {rows.map((row) => {
              const pct = (row.qty_7d / max) * 100
              const isHot = row.anomaly_score >= 8
              const isProbableTheft = row.occupancy_band === 'low' && row.theft_qty > 0
              return (
                <div key={row.variant_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isHot
                        ? <Flame className="h-3.5 w-3.5 flex-shrink-0 text-red-500" />
                        : isProbableTheft
                          ? <ShieldAlert className="h-3.5 w-3.5 flex-shrink-0 text-red-600" />
                          : null
                      }
                      <span className="font-medium truncate">{row.variant_label}</span>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={cn('text-xs font-semibold tabular-nums', isHot ? 'text-red-600' : 'text-muted-foreground')}>
                        {row.qty_7d} units
                      </span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        (+{row.pct_above_baseline}%)
                      </span>
                      {row.waste_cost_7d > 0 && (
                        <span className={cn('ml-1.5 text-[10px] font-medium tabular-nums', isHot ? 'text-red-500' : 'text-orange-500')}>
                          · {fmtCost(row.waste_cost_7d)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isHot ? 'bg-red-500' : isProbableTheft ? 'bg-red-400' : 'bg-orange-400',
                      )}
                      style={{ width: `${String(pct)}%` }}
                    />
                  </div>
                  {isProbableTheft && (
                    <p className="text-[10px] text-red-600 font-medium">Low occupancy + Theft — probable non-operational loss</p>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}
