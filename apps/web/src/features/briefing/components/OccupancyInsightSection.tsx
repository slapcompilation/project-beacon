import { differenceInDays, parseISO } from 'date-fns'
import { Icon, Tag } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useOccupancyAdjustedForecast } from '@/features/eye/hooks'
import { useEvents } from '@/features/events/hooks'
import { useSectionCollapse } from './useSectionCollapse'
import { LayerDot } from './LayerDot'

export function OccupancyInsightSection() {
  const { data: forecast = [], isLoading } = useOccupancyAdjustedForecast(14, 30)
  const { data: events = [] } = useEvents()
  const [open, setOpen] = useSectionCollapse('occupancy-insight', false)

  if (isLoading || forecast.length === 0) return null

  const spikes = forecast.filter((r) => r.demand_spike)
  const accelerated = forecast.filter((r) => r.adjusted_avg_daily > r.base_avg_daily * 1.2)

  // Events within the 14-day forecast window
  const now = new Date()
  const upcomingEvents = events.filter((e) => {
    const d = parseISO(e.event_date)
    const days = differenceInDays(d, now)
    return days >= 0 && days <= 14
  })

  const seen = new Set<number>()
  const occupancyDays: { pct: number }[] = []
  for (const row of forecast) {
    if (!seen.has(row.forecast_occupancy_pct)) {
      seen.add(row.forecast_occupancy_pct)
      occupancyDays.push({ pct: row.forecast_occupancy_pct })
      if (occupancyDays.length >= 7) break
    }
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => { setOpen(!open) }}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-surface-2/50 transition-colors"
      >
        <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={14} className="text-muted-foreground" />
        <LayerDot layer="eye" />
        <span className="text-sm font-medium flex-1">Occupancy & Demand Forecast</span>
        {upcomingEvents.length > 0 && (
          <Tag minimal className="!text-[10px] !text-blue-600 !border-blue-300">
            {upcomingEvents.length} event{upcomingEvents.length !== 1 ? 's' : ''}
          </Tag>
        )}
        {spikes.length > 0 && (
          <Tag minimal className="!text-[10px] !text-amber-600 !border-amber-300">
            {spikes.length} spike{spikes.length !== 1 ? 's' : ''}
          </Tag>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {occupancyDays.length > 0 && (
            <div className="flex gap-1">
              {occupancyDays.map((d, i) => {
                const color =
                  d.pct >= 90 ? 'bg-red-500' :
                  d.pct >= 75 ? 'bg-amber-500' :
                  d.pct >= 50 ? 'bg-emerald-500' : 'bg-emerald-300'
                return (
                  <div key={i} className="flex-1 text-center">
                    <div className={cn('h-4 rounded-sm', color)} style={{ opacity: Math.max(0.3, d.pct / 100) }} />
                    <p className="text-[9px] text-muted-foreground mt-0.5 tabular-nums">{d.pct}%</p>
                  </div>
                )
              })}
            </div>
          )}

          {upcomingEvents.length > 0 && (
            <div className="space-y-1">
              {upcomingEvents.slice(0, 3).map((evt) => (
                <div key={evt.id} className="flex items-center gap-2 text-[11px]">
                  <Icon icon="calendar" size={12} className="text-blue-500 shrink-0" />
                  <span className="truncate flex-1">{evt.name}</span>
                  <span className="text-muted-foreground tabular-nums">{evt.guest_count} guests</span>
                  <span className="text-blue-600 font-medium tabular-nums">{evt.demand_factor}x</span>
                </div>
              ))}
            </div>
          )}

          {spikes.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-amber-600">{spikes.length} item{spikes.length !== 1 ? 's' : ''}</span>{' '}
              with demand spikes (forecast &gt;20% above baseline)
            </div>
          )}

          {accelerated.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">{accelerated.length} item{accelerated.length !== 1 ? 's' : ''}</span>{' '}
              with accelerated depletion from occupancy changes
            </div>
          )}

          {spikes.length > 0 && (
            <div className="space-y-1">
              {spikes.slice(0, 3).map((s) => (
                <div key={s.variant_id} className="flex items-center gap-2 text-[11px]">
                  <span className="truncate flex-1">{s.variant_name}</span>
                  <span className="text-muted-foreground tabular-nums">{s.adjusted_avg_daily.toFixed(1)}/d</span>
                  <span className="text-amber-600 tabular-nums">+{((s.demand_multiplier - 1) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
