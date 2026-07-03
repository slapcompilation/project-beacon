// Portfolio map — a pin per property on a real basemap (maplibre-gl), positioned
// by lat/lng, sized by open signal load, click to drill into that hotel. maplibre
// is dynamically imported so it's code-split out of the main bundle (only fetched
// when the org-scope portfolio renders). Default style is a dark, muted basemap
// (CARTO dark-matter, keyless) for a serious ops look; set VITE_MAP_STYLE_URL to
// a MapTiler/Stadia style to override.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Icon } from '@blueprintjs/core'
import type { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { PortfolioHotelSignal } from './portfolio'

const MAP_STYLE =
  (import.meta.env as unknown as Record<string, string | undefined>).VITE_MAP_STYLE_URL
  ?? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// Restrained Blueprint (Palantir) palette on the dark basemap: neutral gray for
// state-of-play, the one warm intent (orange = warning) reserved for the thing
// that actually needs a person (approvals).
const CLEAR      = '#738091' // Blueprint GRAY2 — nothing open
const OPEN_WORK  = '#ABB3BF' // Blueprint GRAY4 — open signals
const APPROVALS  = '#C87619' // Blueprint ORANGE3 — needs sign-off

const signalLoad = (h: PortfolioHotelSignal) => h.queue_pending + h.approvals_pending + h.cases_open
function pinColor(h: PortfolioHotelSignal): string {
  if (h.approvals_pending > 0) return APPROVALS
  if (signalLoad(h) > 0)       return OPEN_WORK
  return CLEAR
}

/** Builds the DOM element maplibre renders as a marker: a muted badge with the
 *  open-signal count + a dark, low-contrast hotel-name pill that sits on the
 *  dark basemap without shouting. */
function buildMarker(h: PortfolioHotelSignal, onClick: () => void): HTMLElement {
  const load = signalLoad(h)
  const size = 16 + Math.min(14, load * 2)
  const wrap = document.createElement('div')
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;cursor:pointer;'
  wrap.title = `${h.hotel_name}: ${String(load)} open signal${load === 1 ? '' : 's'}`
  wrap.setAttribute('role', 'button')
  wrap.setAttribute('aria-label', wrap.title)

  const dot = document.createElement('div')
  dot.style.cssText =
    `width:${String(size)}px;height:${String(size)}px;border-radius:9999px;background:${pinColor(h)};` +
    'box-shadow:0 0 0 1px rgba(17,20,24,.6),0 1px 3px rgba(0,0,0,.5);display:flex;align-items:center;' +
    'justify-content:center;color:#1C2127;font-size:10px;font-weight:700;'
  if (load > 0) dot.textContent = String(load)

  const label = document.createElement('div')
  label.textContent = h.hotel_name
  label.style.cssText =
    'margin-top:4px;font-size:10px;font-weight:600;color:#C5CBD3;background:rgba(28,33,39,.72);' +
    'padding:1px 5px;border-radius:3px;white-space:nowrap;letter-spacing:.02em;'

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
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (located.length === 0 || !container) return
    let cancelled = false
    let loaded = false
    let map: MaplibreMap | undefined
    const markers: MaplibreMarker[] = []
    setStatus('loading')

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
      map.on('load', () => { loaded = true; setStatus('ok'); map?.fitBounds(bounds, { padding: 56, maxZoom: 11, duration: 0 }) })
      // maplibre reports style/tile failures on this event, NOT via the import
      // promise — without it a blocked basemap CDN (ad-blocker / CSP) or offline
      // tiles fail as a silent black box. A pre-load error is fatal to the render.
      map.on('error', (e) => {
        console.error('[PortfolioMap] basemap error:', (e as { error?: Error }).error?.message ?? e)
        if (!loaded && !cancelled) setStatus('error')
      })
    }).catch((err: unknown) => {
      console.error('[PortfolioMap] failed to load maplibre-gl:', err)
      if (!cancelled) setStatus('error')
    })

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
          <Legend color={CLEAR} label="clear" />
          <Legend color={OPEN_WORK} label="open work" />
          <Legend color={APPROVALS} label="approvals" />
        </div>
      </div>

      <div className="relative h-80 w-full" style={{ background: '#111418' }}>
        <div ref={containerRef} className="absolute inset-0" />
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center">
            <Icon icon="offline" size={16} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Basemap couldn’t load — likely a blocked tile host (ad-blocker / CSP) or no network.</span>
            <span className="text-[11px] text-muted-foreground/70">Properties are still listed below. Set <code>VITE_MAP_STYLE_URL</code> to use a different basemap.</span>
          </div>
        )}
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
