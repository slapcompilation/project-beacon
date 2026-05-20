// Metric cell with value · trend % · ~days left · optional sparkline + basis.

import { Icon } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { Sparkline } from '@/components/Sparkline'

interface TrendCellProps {
  value: string | number
  unit?: string
  trendPct?: number | null
  daysLeft?: number | null
  basis?: string
  sparkData?: number[]
  /** Whether upward trend is good (green). Default true. */
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
  const trendDir = trendPct == null ? 'flat' : trendPct > 0 ? 'up' : trendPct < 0 ? 'down' : 'flat'
  const trendGood = trendDir === 'up' ? upIsGood : trendDir === 'down' ? !upIsGood : true
  const trendColor = trendDir === 'flat' ? 'text-muted-foreground' : trendGood ? 'text-emerald-400' : 'text-red-400'
  const sparkColor = trendGood ? '#34d399' : '#f87171'

  const trendIcon = trendDir === 'up' ? 'trending-up' : trendDir === 'down' ? 'trending-down' : 'minus'

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {sparkData && sparkData.length >= 2 && (
        <Sparkline data={sparkData} color={sparkColor} height={20} width={48} />
      )}

      <span className="font-mono font-medium tabular-nums text-foreground">
        {value}
      </span>
      {unit && <span className="text-muted-foreground text-[10px]">{unit}</span>}

      {trendPct != null && trendPct !== 0 && (
        <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-medium', trendColor)}>
          <Icon icon={trendIcon} size={12} />
          {Math.abs(trendPct).toFixed(0)}%
        </span>
      )}

      {daysLeft != null && (
        <span className={cn(
          'text-[10px]',
          daysLeft <= 3 ? 'text-red-400 font-medium' : daysLeft <= 7 ? 'text-amber-400' : 'text-muted-foreground',
        )}>
          ~{daysLeft}d left
        </span>
      )}

      {basis && (
        <span className="text-[10px] text-muted-foreground/50">{basis}</span>
      )}
    </div>
  )
}
