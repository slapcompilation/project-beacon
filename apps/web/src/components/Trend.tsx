// % delta vs prior with color + arrow. invertColor=true when up is bad (waste, cost).

import { Icon } from '@blueprintjs/core'
import { cn } from '@/lib/utils'

interface TrendProps {
  current: number
  prior: number
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
        <Icon icon="minus" size={10} />flat
      </span>
    )
  }

  return (
    <span className={cn('text-[10px] flex items-center gap-0.5 font-medium', bad ? 'text-red-600' : 'text-green-600', className)}>
      <Icon icon={up ? 'trending-up' : 'trending-down'} size={10} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  )
}
