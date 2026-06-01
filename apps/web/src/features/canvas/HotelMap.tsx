// Phase F2/F3 — Canvas hotel map. V1 is a grid of zone tiles (not a true
// floor-plan with coordinates). Each tile shows the zone's variant count +
// at-risk + observation counts (pending proposals + unread notifications),
// and clicking surfaces it to the Copilot pane via openEntityContext so
// the operator's questions are scoped to that zone.

import { Card, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { useHotelMap, type HotelMapZone } from './useHotelMap'

export function HotelMap() {
  const { data: zones = [], isLoading, isError } = useHotelMap()
  const openEntityContext = useAppStore((s) => s.openEntityContext)
  const setContextPanelTab = useAppStore((s) => s.setContextPanelTab)
  const contextEntity = useAppStore((s) => s.contextEntity)

  // F5: focus → Detail tab (the LocationAipPanel lives there). Copilot stays
  // one tab over, still selection-aware via useCurrentSelection's
  // contextEntity fallback.
  const focusZone = (zoneId: string) => {
    openEntityContext('location', zoneId)
    setContextPanelTab('detail')
  }

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

  const totalAtRisk    = zones.reduce((s, z) => s + z.at_risk, 0)
  const totalProposals = zones.reduce((s, z) => s + z.proposals, 0)
  const totalAlerts    = zones.reduce((s, z) => s + z.alerts, 0)

  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="map" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Hotel map · {String(zones.length)} zone{zones.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {totalAtRisk    > 0 && <Tag minimal intent={Intent.WARNING} className="!text-[10px]">{totalAtRisk} at risk</Tag>}
          {totalProposals > 0 && <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">{totalProposals} queued</Tag>}
          {totalAlerts    > 0 && <Tag minimal intent={Intent.DANGER}  className="!text-[10px]">{totalAlerts} alerts</Tag>}
        </div>
      </div>
      {zones.length === 0 ? (
        <div className="px-4 py-4 text-xs text-muted-foreground space-y-1">
          <p>No zones defined for this hotel yet.</p>
          <p>Add locations (F&amp;B outlets, housekeeping carts, room-service stations) and assign variants to them — the map will populate.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3">
          {zones.map((z) => (
            <ZoneTile
              key={z.id}
              zone={z}
              isFocused={contextEntity?.type === 'location' && contextEntity.id === z.id}
              onFocus={() => { focusZone(z.id) }}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

function ZoneTile({ zone, isFocused, onFocus }: { zone: HotelMapZone; isFocused: boolean; onFocus: () => void }) {
  const pressure = zone.pressure ?? 0
  const accent =
    pressure >= 0.5   ? 'border-l-2 border-l-red-500   bg-red-500/5' :
    pressure >  0     ? 'border-l-2 border-l-amber-400 bg-amber-400/5' :
    zone.variants > 0 ? 'border-l-2 border-l-emerald-500 bg-emerald-500/5' :
                        'border-l-2 border-l-muted-foreground/30'
  return (
    <button
      type="button"
      onClick={onFocus}
      className={cn(
        'text-left rounded border bg-card p-2.5 transition-colors hover:bg-muted/40 hover:border-foreground/20',
        accent,
        isFocused && 'ring-1 ring-primary',
      )}
    >
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
      {(zone.proposals > 0 || zone.alerts > 0) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          {zone.proposals > 0 && <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">{zone.proposals} queued</Tag>}
          {zone.alerts    > 0 && <Tag minimal intent={Intent.DANGER}  className="!text-[10px]">{zone.alerts} alerts</Tag>}
        </div>
      )}
    </button>
  )
}
