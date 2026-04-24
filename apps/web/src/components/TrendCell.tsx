// Layer: meta — enriched metric cell with trend arrow + sparkline
// Palantir principle #3: intelligence everywhere.
// "47 units · ↓12% · ~6d left" is correct. "47 units" alone is not.
//
// Usage:
//   <TrendCell value={47} unit="units" trendPct={-12} daysLeft={6} sparkData={[60,55,50,47]} />
//   <TrendCell value={formatCurrency(1200)} trendPct={8.5} />

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sparkline } from '@/components/Sparkline'

interface TrendCellProps {
  /** Main value to display — can be a pre-formatted string or number */
  value: string | number
  /** Unit suffix (e.g., "units", "kg") */
  unit?: string
  /** Trend percentage vs prior period (positive = up, negative = down) */
  trendPct?: number | null
  /** Days until zero / depletion (shown as "~Xd left") */
  daysLeft?: number | null
  /** Confidence basis (e.g., "30-day avg") */
  basis?: string
  /** Sparkline data points (most recent last) */
  sparkData?: number[]
  /** Whether upward trend is "good" (green) or "bad" (red). Default: true */
  upIsGood?: boolean
  className?: string
}

export function TrendCell({
  value,
  unit,
  trendPct,
  daysLeft,
  basis,
  sparkData,
  upIsGood = true,
  className,
}: TrendCellProps) {
  // Determine trend direction and color
  const trendDir = trendPct == null ? 'flat' : trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'flat'
  const trendGood = trendDir === 'up' ? upIsGood : trendDir === 'down' ? !upIsGood : true
  const trendColor = trendDir === 'flat' ? 'text-muted-foreground' : trendGood ? 'text-emerald-400' : 'text-red-400'
  const sparkColor = trendGood ? '#34d399' : '#f87171'

  const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : Minus

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {/* Sparkline (if data) */}
      {sparkData && sparkData.length >= 2 && (
        <Sparkline data={sparkData} color={sparkColor} height={20} width={48} />
      )}

      {/* Value + unit */}
      <span className="font-mono font-medium tabular-nums text-foreground">
        {value}
      </span>
      {unit && <span className="text-muted-foreground text-[10px]">{unit}</span>}

      {/* Trend arrow + percentage */}
      {trendPct != null && trendPct !== 0 && (
        <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium', trendColor)}>
          <TrendIcon className="h-3 w-3" />
          {Math.abs(trendPct).toFixed(0)}%
        </span>
      )}

      {/* Days left */}
      {daysLeft != null && (
        <span className={cn(
          'text-[10px]',
          daysLeft <= 3 ? 'text-red-400 font-medium' : daysLeft <= 7 ? 'text-amber-400' : 'text-muted-foreground',
        )}>
          ~{daysLeft}d left
        </span>
      )}

      {/* Basis */}
      {basis && (
        <span className="text-[10px] text-muted-foreground/50">{basis}</span>
      )}
    </div>
  )
}
