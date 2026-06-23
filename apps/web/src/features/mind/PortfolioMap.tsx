// Portfolio map — a pin per property on a real basemap (maplibre-gl), positioned
// by lat/lng, sized + coloured by open signal load, click to drill into that
// hotel. maplibre is dynamically imported so it's code-split out of the main
// bundle (only fetched when the org-scope portfolio renders). Default style is
// the keyless MapLibre demotiles; set VITE_MAP_STYLE_URL to a MapTiler/Stadia
// style for street-level tiles.

import { useEffect, useMemo, useRef } from 'react'
import { Card, Icon } from '@blueprintjs/core'
import type { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { PortfolioHotelSignal } from './portfolio'

const MAP_STYLE =
  (import.meta.env as unknown as Record<string, string | undefined>).VITE_MAP_STYLE_URL
  ?? 'https://demotiles.maplibre.org/style.json'

const signalLoad = (h: PortfolioHotelSignal) => h.queue_pending + h.approvals_pending + h.cases_open
function pinColor(h: PortfolioHotelSignal): string {
  if (h.approvals_pending > 0) return '#f59e0b' // amber — needs sign-off
  if (signalLoad(h) > 0)       return '#3b82f6' // blue — open work
  return '#10b981'                               // emerald — clear
}

/** Builds the DOM element maplibre renders as a marker: a coloured badge with
 *  the open-signal count + a readable hotel-name pill. */
function buildMarker(h: PortfolioHotelSignal, onClick: () => void): HTMLElement {
  const load = signalLoad(h)
  const size = 18 + Math.min(16, load * 2)
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;'
  wrap.title = `${h.hotel_name}: ${String(load)} open signal${load === 1 ? '' : 's'}`
  wrap.setAttribute('role', 'button')
  wrap.setAttribute('aria-label', wrap.title)

  const dot = document.createElement('div')
  dot.style.cssText =
    `width:${String(size)}px;height:${String(size)}px;border-radius:9999px;background:${pinColor(h)};` +
    'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;' +
    'justify-content:center;color:#fff;font-size:10px;font-weight:700;'
  if (load > 0) dot.textContent = String(load)

  const label = document.createElement('div')
  label.textContent = h.hotel_name
  label.style.cssText =
    'margin-top:3px;font-size:11px;font-weight:600;color:#111;background:rgba(255,255,255,.85);' +
    'padding:0 4px;border-radius:3px;white-space:nowrap;'

  wrap.append(dot, label)
  wrap.addEventListener('click', onClick)
  return wrap
}

export function PortfolioMap({ hotels, onHop }: { hotels: PortfolioHotelSignal[]; onHop: (hotelId: string) => void }) {
  const located = useMemo(() => hotels.filter((h) => h.lat != null && h.lng != null), [hotels])
  const unlocated = hotels.length - located.length
  const containerRef = useRef<HTMLDivElement>(null)
  const onHopRef = useRef(onHop)
  onHopRef.current = onHop

  useEffect(() => {
    const container = containerRef.current
    if (located.length === 0 || !container) return
    let cancelled = false
    let map: MaplibreMap | undefined
    const markers: MaplibreMarker[] = []

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled) return
      map = new maplibregl.Map({ container, style: MAP_STYLE, attributionControl: { compact: true } })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      const bounds = new maplibregl.LngLatBounds()
      for (const h of located) {
        const lngLat: [number, number] = [h.lng as number, h.lat as number]
        bounds.extend(lngLat)
        markers.push(
          new maplibregl.Marker({ element: buildMarker(h, () => { onHopRef.current(h.hotel_id) }), anchor: 'center' })
            .setLngLat(lngLat).addTo(map),
        )
      }
      map.on('load', () => { map?.fitBounds(bounds, { padding: 56, maxZoom: 11, duration: 0 }) })
    }).catch(() => { /* lib/tiles unavailable — the container stays blank, tiles below still list hotels */ })

    return () => {
      cancelled = true
      markers.forEach((m) => { m.remove() })
      map?.remove()
    }
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

      <div ref={containerRef} className="h-80 w-full" />

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
