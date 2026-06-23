// Portfolio map — a pin per property, positioned by lat/lng (equirectangular,
// auto-fit to the chain's bounding box), sized + coloured by open signal load,
// click to drill into that hotel. Dependency-free SVG (no map lib / tiles); a
// street basemap would be a maplibre upgrade behind this same component later.

import { useMemo, useState } from 'react'
import { Card, Icon } from '@blueprintjs/core'
import type { PortfolioHotelSignal } from './portfolio'

const W = 720, H = 300, PAD = 40

const signalLoad = (h: PortfolioHotelSignal) => h.queue_pending + h.approvals_pending + h.cases_open
function pinColor(h: PortfolioHotelSignal): string {
  if (h.approvals_pending > 0) return '#f59e0b' // amber — needs sign-off
  if (signalLoad(h) > 0)       return '#3b82f6' // blue — open work
  return '#10b981'                               // emerald — clear
}

export function PortfolioMap({ hotels, onHop }: { hotels: PortfolioHotelSignal[]; onHop: (hotelId: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const located = useMemo(() => hotels.filter((h) => h.lat != null && h.lng != null), [hotels])
  const unlocated = hotels.length - located.length

  const projected = useMemo(() => {
    if (located.length === 0) return []
    const lats = located.map((h) => h.lat as number)
    const lngs = located.map((h) => h.lng as number)
    let minLat = Math.min(...lats), maxLat = Math.max(...lats)
    let minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
    const latSpan = Math.max(maxLat - minLat, 0.5), lngSpan = Math.max(maxLng - minLng, 0.5)
    minLat -= latSpan * 0.3; maxLat += latSpan * 0.3
    minLng -= lngSpan * 0.3; maxLng += lngSpan * 0.3
    const sx = (lng: number) => PAD + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * PAD)
    const sy = (lat: number) => PAD + ((maxLat - lat) / (maxLat - minLat)) * (H - 2 * PAD) // north up
    return located.map((h) => ({ h, x: sx(h.lng as number), y: sy(h.lat as number) }))
  }, [located])

  if (located.length === 0) {
    return (
      <Card compact className="text-xs text-muted-foreground">
        No property locations set yet — add coordinates to each hotel to see the portfolio map.
        {unlocated > 0 && ` (${String(unlocated)} propert${unlocated === 1 ? 'y' : 'ies'} without a location)`}
      </Card>
    )
  }

  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="map" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Portfolio map · {String(located.length)} propert{located.length === 1 ? 'y' : 'ies'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <Legend color="#10b981" label="clear" />
          <Legend color="#3b82f6" label="open work" />
          <Legend color="#f59e0b" label="approvals" />
        </div>
      </div>

      <div className="bg-muted/10">
        <svg viewBox={`0 0 ${String(W)} ${String(H)}`} className="w-full" style={{ aspectRatio: `${String(W)}/${String(H)}` }} role="img" aria-label="Map of properties by signal load">
          <g className="text-muted-foreground" stroke="currentColor" strokeWidth={0.5} opacity={0.25}>
            {[0.25, 0.5, 0.75].map((f) => (
              <g key={f}>
                <line x1={W * f} y1={0} x2={W * f} y2={H} />
                <line x1={0} y1={H * f} x2={W} y2={H * f} />
              </g>
            ))}
          </g>
          {projected.map(({ h, x, y }) => {
            const load = signalLoad(h)
            const r = 6 + Math.min(10, load)
            const color = pinColor(h)
            const focused = hover === h.hotel_id
            return (
              <g
                key={h.hotel_id}
                role="button"
                tabIndex={0}
                aria-label={`${h.hotel_name}: ${String(load)} open signals`}
                className="cursor-pointer outline-none"
                onClick={() => { onHop(h.hotel_id) }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHop(h.hotel_id) } }}
                onMouseEnter={() => { setHover(h.hotel_id) }}
                onMouseLeave={() => { setHover(null) }}
              >
                {load > 0 && <circle cx={x} cy={y} r={r + 5} fill={color} opacity={0.18} />}
                <circle cx={x} cy={y} r={r} fill={color} stroke="white" strokeWidth={1.5} opacity={focused ? 1 : 0.9} />
                {load > 0 && <text x={x} y={y + 3.5} textAnchor="middle" fill="white" fontSize={10} fontWeight={700}>{String(load)}</text>}
                <text x={x} y={y - r - 5} textAnchor="middle" className="fill-foreground" fontSize={11} fontWeight={600}>{h.hotel_name}</text>
              </g>
            )
          })}
        </svg>
      </div>

      {unlocated > 0 && (
        <div className="px-4 py-1.5 text-[11px] text-muted-foreground border-t">
          {String(unlocated)} propert{unlocated === 1 ? 'y' : 'ies'} without a location set.
        </div>
      )}
    </Card>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}
    </span>
  )
}
