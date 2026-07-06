// Portfolio map — a pin per property on a real basemap (maplibre-gl), positioned
// by lat/lng, sized by open signal load, click to drill into that hotel. maplibre
// is dynamically imported so it's code-split out of the main bundle (only fetched
// when the org-scope portfolio renders).

import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, Icon } from '@blueprintjs/core'
import type { Map as MaplibreMap, Marker as MaplibreMarker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { PortfolioHotelSignal } from './portfolio'
// A real basemap comes from OUR OWN domain (Protomaps PMTiles on Supabase, see
// ./basemap) so no ad-blocker / Shields / CSP / proxy can block it. With no
// basemap configured, the map renders the dependency-free SVG pin map below —
// zero network, always renders, never black.
import { BASEMAP_MAX_ZOOM, MAP_TILES, PMTILES_URL, buildMapStyle } from './basemap'

// The pmtiles:// protocol is a global maplibre registration — do it once.
let pmtilesRegistered = false

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

export function PortfolioMap({ hotels, onHop, title }: { hotels: PortfolioHotelSignal[]; onHop: (hotelId: string) => void; title?: string }) {
  const located = useMemo(() => hotels.filter((h) => h.lat != null && h.lng != null), [hotels])
  const unlocated = hotels.length - located.length
  const containerRef = useRef<HTMLDivElement>(null)
  const onHopRef = useRef(onHop)
  onHopRef.current = onHop
  const locatedRef = useRef(located)
  locatedRef.current = located
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  // Rebuild the map only when the set of located properties or their positions
  // change — NOT on every new array identity. Callers hand us a fresh array each
  // render (react-query refetch, a `[{…}]` literal); keying the effect on the
  // array reference tore the map down and rebuilt it every render, so tiles were
  // perpetually canceled and it never painted (blank/black).
  const locatedKey = located.map((h) => `${h.hotel_id}:${String(h.lat)}:${String(h.lng)}`).join('|')

  useEffect(() => {
    const container = containerRef.current
    const located = locatedRef.current
    // No configured basemap → SVG-only mode, skip maplibre entirely.
    if (!MAP_TILES || located.length === 0 || !container) return
    let cancelled = false
    let loaded = false
    let map: MaplibreMap | undefined
    const markers: MaplibreMarker[] = []
    setStatus('loading')

    let loadTimer: ReturnType<typeof setTimeout> | undefined
    let tileCheck: ReturnType<typeof setTimeout> | undefined
    let tilePainted = false

    void import('maplibre-gl').then(async ({ default: maplibregl }) => {
      // Register the pmtiles:// protocol once, so the self-hosted single-file
      // basemap resolves via HTTP range requests.
      if (PMTILES_URL && !pmtilesRegistered) {
        const { Protocol } = await import('pmtiles')
        maplibregl.addProtocol('pmtiles', new Protocol().tile)
        pmtilesRegistered = true
      }
      const style = await buildMapStyle()
      // cancelled can flip during the awaits above (unmount) — guard before init.
      if (cancelled || !style) return

      map = new maplibregl.Map({ container, style, attributionControl: { compact: true } })
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      // Any real tile that paints flips this true. If the tile host is blocked
      // but the style loads, this stays false — see the post-load check.
      map.on('data', (e) => { if ((e as { tile?: unknown }).tile) tilePainted = true })
      const bounds = new maplibregl.LngLatBounds()
      for (const h of located) {
        const lngLat: [number, number] = [h.lng as number, h.lat as number]
        bounds.extend(lngLat)
        markers.push(
          new maplibregl.Marker({ element: buildMarker(h, () => { onHopRef.current(h.hotel_id) }), anchor: 'center' })
            .setLngLat(lngLat).addTo(map),
        )
      }
      // If nothing loads in time (host hangs without an error), fall back.
      loadTimer = setTimeout(() => {
        if (!loaded && !cancelled) { console.warn('[PortfolioMap] basemap did not load in time — using offline pin map'); setStatus('error') }
      }, 8000)
      map.on('load', () => {
        loaded = true
        if (loadTimer) clearTimeout(loadTimer)
        setStatus('ok')
        // Cap the camera at the data's max zoom — overzooming past it renders a
        // near-empty dark canvas that looks like a load failure.
        map?.fitBounds(bounds, { padding: 56, maxZoom: BASEMAP_MAX_ZOOM, duration: 0 })
        // Style loaded but the TILE host may be blocked (a different subdomain):
        // 'load' fires, no 'error', canvas stays black. If no tile actually
        // painted shortly after, fall through to the SVG pin map.
        tileCheck = setTimeout(() => {
          if (!cancelled && !tilePainted) {
            console.warn('[PortfolioMap] style loaded but no tiles rendered (blocked?) — using offline pin map')
            setStatus('error')
          }
        }, 5000)
      })
      // Pre-load failure (blocked / offline / bad style) → the SVG pin map.
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
      if (loadTimer) clearTimeout(loadTimer)
      if (tileCheck) clearTimeout(tileCheck)
      markers.forEach((m) => { m.remove() })
      map?.remove()
    }
  }, [locatedKey])

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
            {title ?? `Portfolio map · ${String(located.length)} propert${located.length === 1 ? 'y' : 'ies'}`}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <Legend color={CLEAR} label="clear" />
          <Legend color={OPEN_WORK} label="open work" />
          <Legend color={APPROVALS} label="approvals" />
        </div>
      </div>

      <div className="relative h-80 w-full" style={{ background: '#111418' }}>
        {/* Real basemap only when one is configured; otherwise the SVG renders
            straight away. When a configured basemap fails/gets blocked, status
            flips to 'error' and the SVG takes over — never a black box. The
            canvas unmounts on error so the SVG never sits over a live canvas
            eating its pointer events. */}
        {/* Inline position — maplibre-gl.css ships `.maplibregl-map{position:relative}`
            in the lazy chunk's stylesheet, which loads after ours and overrode the
            Tailwind `absolute`, collapsing the container to 0 height (invisible,
            uninteractive map). Inline style can't lose that fight. */}
        {MAP_TILES && status !== 'error' && <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />}
        {(!MAP_TILES || status === 'error') && <SvgPinMap hotels={located} onHop={onHop} />}
        {MAP_TILES && status === 'error' && (
          <div className="absolute left-2 top-2 rounded bg-black/40 px-2 py-0.5 text-[10px] text-muted-foreground" title="Basemap tiles blocked or unreachable — showing a tile-free map. Set VITE_MAP_STYLE_URL to a basemap you trust.">
            offline map
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
