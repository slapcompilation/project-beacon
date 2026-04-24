import { Link, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { PackageCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TIER_CFG } from './constants'
import type { StockPressureItem } from '@beacon/types'

export function PressureRow({ item }: { item: StockPressureItem }) {
  const navigate = useNavigate()
  const tc = TIER_CFG[item.urgency_tier]
  const pct = Math.min(100, Math.max(2, (item.days_until_zero / 14) * 100))

  return (
    <div
      className={cn('flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer border-b last:border-b-0', tc.borderCls)}
      onClick={() => { void navigate(`/variant/${item.variant_id}`) }}
    >
      {/* Runway bar */}
      <div className="shrink-0 w-10">
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full', tc.barCls)} style={{ width: `${String(pct)}%` }} />
        </div>
      </div>

      {/* Label + basis */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate leading-snug">{item.label}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {item.current_stock} units · {item.avg_daily_use}/day (30d avg)
        </p>
      </div>

      {/* Days countdown */}
      <div className="shrink-0 text-right">
        <p className={cn('text-sm font-bold tabular-nums leading-none', tc.cls)}>
          ~{item.days_until_zero}d
        </p>
        <p className="text-[10px] text-muted-foreground">left</p>
      </div>

      {/* PO badge or warning */}
      {item.open_po_number ? (
        <div className="shrink-0 flex items-center gap-1 text-[10px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-100 dark:border-green-900/40 rounded px-1.5 py-0.5">
          <PackageCheck className="h-2.5 w-2.5" />
          {item.open_po_id
            ? <Link to={`/po/${item.open_po_id}`} className="hover:underline" onClick={(e) => { e.stopPropagation(); }}>{item.open_po_number}</Link>
            : item.open_po_number
          }
          {item.expected_delivery && (
            <span className="text-muted-foreground ml-0.5">
              · {format(parseISO(item.expected_delivery), 'MMM d')}
            </span>
          )}
        </div>
      ) : (
        <div className="shrink-0 flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded px-1.5 py-0.5">
          <AlertTriangle className="h-2.5 w-2.5" />
          No PO
        </div>
      )}
    </div>
  )
}
