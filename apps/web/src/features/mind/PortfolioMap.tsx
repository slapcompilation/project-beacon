// Portfolio map — a pin per property on a real basemap (maplibre-gl), positioned
// by lat/lng, sized by open signal load, click to drill into that hotel. maplibre
// is dynamically imported so it's code-split out of the main bundle (only fetched
// when the org-scope portfolio renders).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Icon } from '@blueprintjs/core'
import type { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { PortfolioHotelSignal } from './portfolio'

// Dark, muted basemaps for a serious ops look, tried in order until one loads.
// CARTO dark-matter is the primary; OpenFreeMap dark is a keyless fallback on a
// host that ad-blockers / CSPs don't commonly block — cartocdn.com sits on
// several blocklists, so without a fallback a filtered client gets a black box.
// The chain keeps the map active through that. VITE_MAP_STYLE_URL pins one style.
const OVERRIDE = (import.meta.env as unknown as Record<string, string | undefined>).VITE_MAP_STYLE_URL
const MAP_STYLES = OVERRIDE
  ? [OVERRIDE]
  : [
      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      'https://tiles.openfreemap.org/styles/dark',
    ]

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

    let styleIdx = 0
    let loadTimer: ReturnType<typeof setTimeout> | undefined

    void import('maplibre-gl').then(({ default: maplibregl }) => {
      if (cancelled) return
      map = new maplibregl.Map({ container, style: MAP_STYLES[0], attributionControl: { compact: true } })
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
      // Belt-and-suspenders: blocked tile hosts sometimes hang without emitting
      // an `error`, which would leave a black box forever. If nothing has loaded
      // in time, fall back to the tile-free pin map.
      loadTimer = setTimeout(() => {
        if (!loaded && !cancelled) { console.warn('[PortfolioMap] basemap did not load in time — using offline pin map'); setStatus('error') }
      }, 8000)
      // Markers are independent of the style, so they survive a setStyle swap.
      map.on('load', () => { loaded = true; if (loadTimer) clearTimeout(loadTimer); setStatus('ok'); map?.fitBounds(bounds, { padding: 56, maxZoom: 11, duration: 0 }) })
      // maplibre reports style/tile failures on this event, NOT via the import
      // promise. On a pre-load failure (blocked CDN / CSP / offline) fall through
      // to the next style; once the whole chain fails, render the tile-free SVG
      // pin map — never a black box.
      map.on('error', (e) => {
        console.error('[PortfolioMap] basemap error:', (e as { error?: Error }).error?.message ?? e)
        if (loaded || cancelled) return
        if (styleIdx < MAP_STYLES.length - 1) {
          styleIdx += 1
          map?.setStyle(MAP_STYLES[styleIdx])
        } else {
          setStatus('error')
        }
      })
    }).catch((err: unknown) => {
      console.error('[PortfolioMap] failed to load maplibre-gl:', err)
      if (!cancelled) setStatus('error')
    })

    return () => {
      cancelled = true
      if (loadTimer) clearTimeout(loadTimer)
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
          <>
            {/* Tile hosts blocked/unreachable → the tile-free pin map so the
                portfolio is never a black box. */}
            <SvgPinMap hotels={located} onHop={onHop} />
            <div className="absolute left-2 top-2 rounded bg-black/40 px-2 py-0.5 text-[10px] text-muted-foreground" title="Basemap tiles blocked or unreachable — showing a tile-free map. Set VITE_MAP_STYLE_URL to use a specific basemap.">
              offline map
            </div>
          </>
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

// Tile-free fallback: pins on a plain graticule, no external basemap. Keeps the
// portfolio map usable when every tile host is blocked (corporate proxy / CSP /
// offline). Equirectangular fit to the located properties' bounding box.
function SvgPinMap({ hotels, onHop }: { hotels: PortfolioHotelSignal[]; onHop: (hotelId: string) => void }) {
  const W = 1000, H = 500, PAD = 64
  const bounds = (vals: number[]): [number, number] => {
    const lo = Math.min(...vals), hi = Math.max(...vals)
    return hi - lo > 0.02 ? [lo, hi] : [(lo + hi) / 2 - 1, (lo + hi) / 2 + 1]
  }
  const [minLng, maxLng] = bounds(hotels.map((h) => h.lng as number))
  const [minLat, maxLat] = bounds(hotels.map((h) => h.lat as number))
  const project = (lng: number, lat: number): [number, number] => [
    PAD + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * PAD),
    PAD + ((maxLat - lat) / (maxLat - minLat)) * (H - 2 * PAD),
  ]
  return (
    <svg viewBox={`0 0 ${String(W)} ${String(H)}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full">
      {[0.25, 0.5, 0.75].map((f) => (
        <g key={f} stroke="#242a33" strokeWidth={1}>
          <line x1={f * W} y1={0} x2={f * W} y2={H} />
          <line x1={0} y1={f * H} x2={W} y2={f * H} />
        </g>
      ))}
      {hotels.map((h) => {
        const [x, y] = project(h.lng as number, h.lat as number)
        const load = signalLoad(h)
        const r = 9 + Math.min(9, load * 1.5)
        return (
          <g key={h.hotel_id} transform={`translate(${String(x)},${String(y)})`} className="cursor-pointer" onClick={() => { onHop(h.hotel_id) }}>
            <circle r={r} fill={pinColor(h)} stroke="#111418" strokeWidth={1.5} />
            {load > 0 && <text textAnchor="middle" dy="0.35em" fontSize={11} fontWeight={700} fill="#1C2127">{String(load)}</text>}
            <text textAnchor="middle" y={r + 14} fontSize={12} fontWeight={600} fill="#C5CBD3">{h.hotel_name}</text>
          </g>
        )
      })}
    </svg>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}
    </span>
  )
}
