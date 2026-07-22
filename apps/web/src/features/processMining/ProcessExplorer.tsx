// Process explorer (Foundry Machinery parity): the mined state machine as a
// left→right directed graph. Nodes are states (current count + avg duration),
// edges are transitions (count + avg lead time). Bottlenecks — non-terminal
// states where far more entered than exited — are flagged. Dependency-free SVG,
// same lean approach as SearchAroundGraph.

import { useMemo } from 'react'
import { Icon } from '@blueprintjs/core'
import type { LifecycleNode } from '@beacon/reality-graph'
import type { MinedProcess, ProcessState } from './api'
import { stateDepths, isTerminal, formatDuration } from './analysis'

const NODE_W = 150, NODE_H = 68, COL_GAP = 230, ROW_GAP = 104, MARGIN = 28

interface Positioned extends ProcessState { x: number; y: number }

const AMBER = '#d9822b'

export function ProcessExplorer({ nodeType, data, bottlenecks }: {
  nodeType: LifecycleNode
  data: MinedProcess
  /** State names the tunable bottleneck monitor fired on. */
  bottlenecks: ReadonlySet<string>
}) {
  const { nodes, width, height, byState } = useMemo(() => {
    const depths = stateDepths(nodeType)
    const observed = data.states.filter((s) => s.entered_count > 0)

    const byDepth = new Map<number, ProcessState[]>()
    for (const s of observed) {
      const d = depths.get(s.state) ?? 0
      const arr = byDepth.get(d) ?? []
      arr.push(s)
      byDepth.set(d, arr)
    }
    const positioned: Positioned[] = []
    let maxRows = 0
    for (const [d, arr] of byDepth) {
      arr.forEach((s, i) => { positioned.push({ ...s, x: MARGIN + d * COL_GAP, y: MARGIN + i * ROW_GAP }) })
      maxRows = Math.max(maxRows, arr.length)
    }
    const maxDepth = observed.reduce((m, s) => Math.max(m, depths.get(s.state) ?? 0), 0)
    const map = new Map(positioned.map((n) => [n.state, n]))
    return {
      nodes: positioned,
      byState: map,
      width:  MARGIN * 2 + maxDepth * COL_GAP + NODE_W,
      height: MARGIN * 2 + Math.max(0, maxRows - 1) * ROW_GAP + NODE_H,
    }
  }, [nodeType, data.states])

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Icon icon="flows" size={28} className="mb-3 opacity-40" />
        <p className="text-sm font-medium">No transitions recorded yet</p>
        <p className="mt-1 max-w-sm text-xs">
          As {LABEL[nodeType]} change status, each move is logged and the process map fills in here.
        </p>
      </div>
    )
  }

  const maxCount = data.transitions.reduce((m, t) => Math.max(m, t.count), 1)

  return (
    <div className="overflow-x-auto rounded border bg-background">
      <svg width={width} height={height} className="text-foreground" role="img" aria-label="Process map">
        <defs>
          <marker id="pm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
          </marker>
          <marker id="pm-arrow-amber" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={AMBER} />
          </marker>
        </defs>

        {/* edges first, under the nodes */}
        {data.transitions.map((t) => {
          const a = byState.get(t.from), b = byState.get(t.to)
          if (!a || !b) return null
          const forward = b.x >= a.x
          const x1 = forward ? a.x + NODE_W : a.x
          const y1 = a.y + NODE_H / 2
          const x2 = forward ? b.x : b.x + NODE_W
          const y2 = b.y + NODE_H / 2
          const midX = (x1 + x2) / 2
          const bend = forward ? 0 : 46 // back-edges arc downward to stay legible
          const path = `M ${x1} ${y1} C ${midX} ${y1 + bend}, ${midX} ${y2 + bend}, ${x2} ${y2}`
          const w = 1 + Math.round((t.count / maxCount) * 4)
          return (
            <g key={`${t.from}->${t.to}`}>
              <path d={path} fill="none" stroke="#94a3b8" strokeWidth={w} markerEnd="url(#pm-arrow)" opacity={0.7} />
              <text x={midX} y={(y1 + y2) / 2 + bend / 2 - 4} textAnchor="middle" fontSize={10} fill="currentColor" className="opacity-70">
                {t.count}× · {formatDuration(t.avg_lead_time_s)}
              </text>
            </g>
          )
        })}

        {/* state nodes */}
        {nodes.map((n) => {
          const bottleneck = bottlenecks.has(n.state)
          const terminal = isTerminal(nodeType, n.state)
          return (
            <g key={n.state} transform={`translate(${n.x} ${n.y})`}>
              <rect
                width={NODE_W} height={NODE_H} rx={4}
                fill={terminal ? 'rgba(100,116,139,0.12)' : 'rgba(100,116,139,0.04)'}
                stroke={bottleneck ? AMBER : 'rgba(148,163,184,0.6)'}
                strokeWidth={bottleneck ? 2 : 1}
              />
              <text x={10} y={18} fontSize={12} fontWeight={600} fill="currentColor" className="capitalize">
                {n.state.replace(/_/g, ' ')}
              </text>
              <text x={10} y={42} fontSize={19} fontWeight={700} fill="currentColor" className="tabular-nums">
                {n.current_count}
              </text>
              <text x={NODE_W - 10} y={42} textAnchor="end" fontSize={10} fill="currentColor" className="opacity-60">
                in state
              </text>
              <text x={10} y={59} fontSize={10} fill="currentColor" className="opacity-60 tabular-nums">
                {n.entered_count} entered · Ø {formatDuration(n.avg_duration_s)}
              </text>
              {bottleneck && <circle cx={NODE_W - 12} cy={14} r={5} fill={AMBER} />}
            </g>
          )
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: AMBER }} /> Bottleneck (entered ≫ exited)</span>
        <span>Node number = objects currently in state · edge = transitions × avg lead time</span>
      </div>
    </div>
  )
}

const LABEL: Record<LifecycleNode, string> = {
  restock_request: 'restock requests',
  purchase_order:  'purchase orders',
  case:            'cases',
  proposal:        'proposals',
}
