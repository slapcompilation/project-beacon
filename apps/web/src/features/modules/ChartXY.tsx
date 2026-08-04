// Chart XY (G2). Foundry: "Display data as bar, line, and scatter charts."
//
// Drawn with SVG and CSS rather than a charting library — the UI rule is
// Blueprint primitives only, and one layer of bars/line/points is a few dozen
// lines. A library earns its place when stacked areas or a second axis do.

import { Card } from '@blueprintjs/core'
import type { ChartLayerType, ChartPoint } from './runtime'

const H = 140
const PAD = 4

export function ChartXY({
  title, points, layerType, caption,
}: {
  title?: string
  points: ChartPoint[]
  layerType: ChartLayerType
  caption: string
}) {
  const max = Math.max(...points.map((p) => p.value), 0)
  // A flat series still has to render — everything at zero would be an empty box.
  const scale = (v: number) => (max <= 0 ? 0 : (v / max) * (H - PAD * 2))
  const step = points.length > 1 ? 100 / (points.length - 1) : 0

  return (
    <Card className="space-y-2">
      {title && <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</div>}

      {layerType === 'bar' ? (
        <div className="flex items-end gap-1" style={{ height: H }}>
          {points.map((p) => (
            <div key={p.label} className="flex-1 min-w-0 flex flex-col justify-end" title={`${p.label}: ${String(p.value)}`}>
              <div className="bg-violet-500/70 rounded-t-[2px]" style={{ height: Math.max(scale(p.value), 1) }} />
            </div>
          ))}
        </div>
      ) : (
        <svg viewBox={`0 0 100 ${String(H)}`} preserveAspectRatio="none" style={{ height: H, width: '100%' }}>
          {layerType === 'line' && points.length > 1 && (
            <polyline
              fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke"
              className="text-violet-500"
              points={points.map((p, i) => `${String(i * step)},${String(H - PAD - scale(p.value))}`).join(' ')}
            />
          )}
          {points.map((p, i) => (
            <circle key={p.label} cx={points.length > 1 ? i * step : 50} cy={H - PAD - scale(p.value)}
              r={2} vectorEffect="non-scaling-stroke" className="fill-violet-500">
              <title>{`${p.label}: ${String(p.value)}`}</title>
            </circle>
          ))}
        </svg>
      )}

      {/* Labels thin out rather than overlap — a dozen dates on one axis is
          unreadable either way, and thinning keeps the ends anchored. */}
      <div className="flex gap-1 text-[9px] text-muted-foreground">
        {points.map((p, i) => (
          <div key={p.label} className="flex-1 min-w-0 truncate text-center">
            {points.length <= 8 || i === 0 || i === points.length - 1 ? p.label : ''}
          </div>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground">{caption}</div>
    </Card>
  )
}
