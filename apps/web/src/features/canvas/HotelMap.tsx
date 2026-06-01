// Phase F2 — Canvas hotel map. V1 is a grid of zone tiles (not a true
// floor-plan with coordinates — that'd need spatial layout data we don't have
// yet). Each tile shows the zone's variant count + at-risk count + a pressure
// colour. F3 will overlay observations (proposals / alerts) on these tiles;
// F4 will wrap this in an org-level multi-hotel view.

import { Card, Icon, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useHotelMap, type HotelMapZone } from './useHotelMap'

export function HotelMap() {
  const { data: zones = [], isLoading, isError } = useHotelMap()

  if (isLoading) {
    return (
      <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading hotel map…
      </Card>
    )
  }
  if (isError) {
    return <Card compact className="text-xs text-muted-foreground">Hotel map unavailable.</Card>
  }

  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="map" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Hotel map · {String(zones.length)} zone{zones.length === 1 ? '' : 's'}
          </span>
        </div>
        {zones.some((z) => z.at_risk > 0) && (
          <Tag minimal intent="warning" className="!text-[10px]">
            {String(zones.reduce((s, z) => s + z.at_risk, 0))} variants at risk
          </Tag>
        )}
      </div>
      {zones.length === 0 ? (
        <div className="px-4 py-4 text-xs text-muted-foreground space-y-1">
          <p>No zones defined for this hotel yet.</p>
          <p>Add locations (F&amp;B outlets, housekeeping carts, room-service stations) and assign variants to them — the map will populate.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
          {zones.map((z) => <ZoneTile key={z.id} zone={z} />)}
        </div>
      )}
    </Card>
  )
}

function ZoneTile({ zone }: { zone: HotelMapZone }) {
  const pressure = zone.pressure ?? 0
  const accent =
    pressure >= 0.5  ? 'border-l-2 border-l-red-500   bg-red-500/5' :
    pressure >  0    ? 'border-l-2 border-l-amber-400 bg-amber-400/5' :
    zone.variants > 0 ? 'border-l-2 border-l-emerald-500 bg-emerald-500/5' :
                        'border-l-2 border-l-muted-foreground/30'
  return (
    <div className={cn('rounded border bg-card p-2.5 transition-colors', accent)}>
      <div className="flex items-center gap-1.5">
        <Icon icon="cube" size={11} className="text-muted-foreground/70" />
        <span className="text-xs font-medium truncate flex-1">{zone.name}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums"><strong className="text-foreground font-semibold">{zone.variants}</strong> variants</span>
        {zone.at_risk > 0 && (
          <span className="tabular-nums text-amber-600 dark:text-amber-400">
            <strong className="font-semibold">{zone.at_risk}</strong> at risk
          </span>
        )}
      </div>
    </div>
  )
}
