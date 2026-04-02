// Layer: Eye — universal trend indicator.
// Shows % change between current and prior values with color-coded direction.
// invertColor=true for metrics where "up" is bad (e.g. waste, cost overrun).

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TrendProps {
  current: number
  prior: number
  /** When true, rising = red and falling = green (e.g. waste cost) */
  invertColor?: boolean
  className?: string
}

export function Trend({ current, prior, invertColor = false, className }: TrendProps) {
  if (prior === 0) return null
  const pct  = ((current - prior) / prior) * 100
  const up   = pct > 0
  const flat = Math.abs(pct) < 1
  const bad  = invertColor ? up : !up

  if (flat) {
    return (
      <span className={cn('text-[10px] text-muted-foreground flex items-center gap-0.5', className)}>
        <Minus className="h-2.5 w-2.5" />flat
      </span>
    )
  }

  return (
    <span className={cn('text-[10px] flex items-center gap-0.5 font-medium', bad ? 'text-red-600' : 'text-green-600', className)}>
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}
