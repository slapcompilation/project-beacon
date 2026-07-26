// System Map (OAG) — what's wired, in two layers. The ontology canvas on top is
// live and authorable: your object types and the relationships between them,
// drawn by clicking two types. Below it the code surfaces — Agents × Tools ×
// Actions × Objectives × Adapters — with edges for "uses" (agent→tool), "emits"
// (agent→action), "delegates" (tool→objective), "candidate" (adapter→objective).
// Mirrors AIP's OAG Solution Designer (folder 3 #10–11).

import { useMemo, useRef, useState, useLayoutEffect } from 'react'
import { Link } from 'react-router-dom'
import { Card, Icon, Intent, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { buildSystemMap } from '@/features/systemMap/registry'
import OntologyCanvas from '@/features/systemMap/OntologyCanvas'

interface LaneSpec {
  id:        string
  title:     string
  icon:      IconName
  itemKeys:  ReadonlyArray<string>
  /** Optional href builder for each item, so nodes are clickable. */
  hrefFor?:  (key: string) => string | null
}

interface EdgeSpec {
  from: string
  to:   string
  label?: string
}

const NODE_HEIGHT = 38
const NODE_GAP    = 8
const LANE_WIDTH  = 200
const LANE_GAP    = 70

export default function SystemMapPage() {
  const data = useMemo(() => buildSystemMap(), [])

  const agentItems     = data.agents.map((a) => `agent:${a.name}`)
  const toolItems      = data.tools.map((t) => `tool:${t.name}`)
  const actionItems    = data.actions.map((a) => `action:${a.name}`)
  const objectiveItems = data.objectives.map((o) => `objective:${o.objective.name}`)
  const adapterItems   = data.adapters.map((a) => `adapter:${a.adapter.name}`)

  const lanes: LaneSpec[] = [
    {
      id: 'agents', title: 'Agents', icon: 'predictive-analysis',
      itemKeys: agentItems,
      hrefFor: (key) => `/agent-studio/${stripPrefix(key)}`,
    },
    {
      id: 'tools', title: 'Logic Tools', icon: 'function',
      itemKeys: toolItems,
      hrefFor: (key) => `/tools/${stripPrefix(key)}`,
    },
    {
      id: 'actions', title: 'Actions', icon: 'cog',
      itemKeys: actionItems,
      hrefFor: () => null,
    },
    {
      id: 'objectives', title: 'Objectives', icon: 'predictive-analysis',
      itemKeys: objectiveItems,
      hrefFor: (key) => `/modeling-objectives/${stripPrefix(key)}`,
    },
    {
      id: 'adapters', title: 'Adapters', icon: 'cube',
      itemKeys: adapterItems,
      hrefFor: () => null,
    },
  ]

  const edges: EdgeSpec[] = [
    ...data.agentUsesTool.map((e): EdgeSpec      => ({ from: `agent:${e.agent}`,  to: `tool:${e.tool}` })),
    ...data.agentEmitsAction.map((e): EdgeSpec   => ({ from: `agent:${e.agent}`,  to: `action:${e.action}` })),
    ...data.toolDelegatesToObjective.map((e): EdgeSpec => ({ from: `tool:${e.tool}`, to: `objective:${e.objective}` })),
    ...data.adapterBelongsToObjective.map((e): EdgeSpec => ({ from: `objective:${e.objective}`, to: `adapter:${e.adapter}` })),
  ]

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <h1 className="text-sm font-semibold">System Map</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every registered surface in the Reality Graph and how they connect — your object types and their
          relationships, then the compute wired on top: agents call tools, tools delegate to objectives,
          objectives own candidate adapters.
        </p>
      </header>

      <div className="flex-1 overflow-auto">
        <div className="p-6 pb-0"><OntologyCanvas /></div>
        <Legend />
        <MapCanvas data={data} lanes={lanes} edges={edges} />
      </div>
    </div>
  )
}

function stripPrefix(key: string): string {
  const idx = key.indexOf(':')
  return idx === -1 ? key : key.slice(idx + 1)
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="px-6 py-2 border-b shrink-0 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
      <span className="font-semibold uppercase tracking-wider text-[10px]">Edges:</span>
      <LegendKey color="text-blue-500"    label="agent → tool (uses)" />
      <LegendKey color="text-violet-500"  label="agent → action (emits)" />
      <LegendKey color="text-emerald-500" label="tool → objective (delegates)" />
      <LegendKey color="text-amber-500"   label="objective → adapter (candidate)" />
    </div>
  )
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" strokeWidth="2" className={color} stroke="currentColor" /></svg>
      <span>{label}</span>
    </div>
  )
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

function MapCanvas({ data, lanes, edges }: { data: ReturnType<typeof buildSystemMap>; lanes: LaneSpec[]; edges: EdgeSpec[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [positions, setPositions] = useState<Map<string, { x: number; y: number; w: number; h: number }>>(new Map())

  // Total canvas dimensions
  const maxItems = Math.max(...lanes.map((l) => l.itemKeys.length))
  const canvasW  = lanes.length * LANE_WIDTH + (lanes.length - 1) * LANE_GAP
  const canvasH  = 60 + maxItems * (NODE_HEIGHT + NODE_GAP)

  useLayoutEffect(() => {
    const m = new Map<string, { x: number; y: number; w: number; h: number }>()
    lanes.forEach((lane, li) => {
      const xLeft  = li * (LANE_WIDTH + LANE_GAP)
      const xRight = xLeft + LANE_WIDTH
      lane.itemKeys.forEach((key, i) => {
        const y = 60 + i * (NODE_HEIGHT + NODE_GAP) + NODE_HEIGHT / 2
        m.set(key, { x: (xLeft + xRight) / 2, y, w: LANE_WIDTH, h: NODE_HEIGHT })
      })
    })
    setPositions(m)
  }, [lanes])

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto p-6">
      <div className="relative" style={{ width: canvasW, height: canvasH }}>
        {/* Lane headers */}
        {lanes.map((lane, li) => (
          <div
            key={lane.id}
            className="absolute top-0 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
            style={{ left: li * (LANE_WIDTH + LANE_GAP), width: LANE_WIDTH }}
          >
            <Icon icon={lane.icon} size={12} />
            {lane.title}
            <Tag minimal className="text-[10px]">{lane.itemKeys.length}</Tag>
          </div>
        ))}

        {/* Edges (SVG, behind nodes) */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={canvasW}
          height={canvasH}
        >
          {edges.map((edge, i) => {
            const a = positions.get(edge.from)
            const b = positions.get(edge.to)
            if (!a || !b) return null
            const x1 = a.x + LANE_WIDTH / 2
            const y1 = a.y
            const x2 = b.x - LANE_WIDTH / 2
            const y2 = b.y
            const dx = Math.abs(x2 - x1)
            const cx1 = x1 + dx / 2
            const cx2 = x2 - dx / 2
            return (
              <path
                key={`${String(i)}-${edge.from}-${edge.to}`}
                d={`M ${String(x1)} ${String(y1)} C ${String(cx1)} ${String(y1)}, ${String(cx2)} ${String(y2)}, ${String(x2)} ${String(y2)}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.25}
                strokeOpacity={0.55}
                className={edgeColor(edge.from, edge.to)}
              />
            )
          })}
        </svg>

        {/* Nodes */}
        {lanes.map((lane, li) =>
          lane.itemKeys.map((key, i) => (
            <NodeCard
              key={key}
              keyId={key}
              data={data}
              x={li * (LANE_WIDTH + LANE_GAP)}
              y={60 + i * (NODE_HEIGHT + NODE_GAP)}
              href={lane.hrefFor?.(key) ?? null}
            />
          )),
        )}
      </div>
    </div>
  )
}

function edgeColor(fromKey: string, toKey: string): string {
  if (fromKey.startsWith('agent:') && toKey.startsWith('tool:'))         return 'text-blue-500'
  if (fromKey.startsWith('agent:') && toKey.startsWith('action:'))       return 'text-violet-500'
  if (fromKey.startsWith('tool:')  && toKey.startsWith('objective:'))    return 'text-emerald-500'
  if (fromKey.startsWith('objective:') && toKey.startsWith('adapter:'))  return 'text-amber-500'
  return 'text-muted-foreground'
}

// ─── Node card ───────────────────────────────────────────────────────────────

function NodeCard({
  keyId, data, x, y, href,
}: {
  keyId: string
  data:  ReturnType<typeof buildSystemMap>
  x:     number
  y:     number
  href:  string | null
}) {
  const meta = describeNode(keyId, data)
  const card = (
    <Card
      interactive={!!href}
      className={cn(
        'absolute flex items-center gap-2 px-2 py-1.5 !p-2',
        meta.borderClass,
      )}
      style={{ left: x, top: y, width: LANE_WIDTH, height: NODE_HEIGHT }}
    >
      <Icon icon={meta.icon} size={12} className="text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-mono font-semibold truncate">{meta.label}</div>
        {meta.subline && <div className="text-[9px] text-muted-foreground truncate">{meta.subline}</div>}
      </div>
      {meta.badge && (
        <Tag minimal intent={meta.badge.intent} className="text-[9px] shrink-0">{meta.badge.text}</Tag>
      )}
    </Card>
  )
  return href ? <Link to={href}>{card}</Link> : card
}

interface NodeMeta {
  label: string
  subline?: string
  icon: IconName
  borderClass: string
  badge?: { text: string; intent: Intent }
}

function describeNode(keyId: string, data: ReturnType<typeof buildSystemMap>): NodeMeta {
  const colonIdx = keyId.indexOf(':')
  const kind = colonIdx === -1 ? '' : keyId.slice(0, colonIdx)
  const name = colonIdx === -1 ? keyId : keyId.slice(colonIdx + 1)
  switch (kind) {
    case 'agent': {
      const a = data.agents.find((x) => x.name === name)
      return {
        label: name,
        subline: a ? a.releaseStage : '',
        icon: 'predictive-analysis',
        borderClass: 'border-l-2 border-l-blue-500',
        badge: a ? { text: a.releaseStage, intent: stageIntent(a.releaseStage) } : undefined,
      }
    }
    case 'tool': {
      const t = data.tools.find((x) => x.name === name)
      return {
        label: name,
        subline: t ? `${t.category} · @${t.version}` : '',
        icon: 'function',
        borderClass: 'border-l-2 border-l-emerald-500',
      }
    }
    case 'action': {
      return {
        label: name,
        icon: 'cog',
        borderClass: 'border-l-2 border-l-violet-500',
      }
    }
    case 'objective': {
      const o = data.objectives.find((x) => x.objective.name === name)
      return {
        label: name,
        subline: o ? `${String(o.adapters.length)} candidate(s)` : '',
        icon: 'predictive-analysis',
        borderClass: 'border-l-2 border-l-amber-500',
      }
    }
    case 'adapter': {
      const ad = data.adapters.find((x) => x.adapter.name === name)
      return {
        label: name,
        subline: ad ? `@ ${ad.adapter.version}` : '',
        icon: 'cube',
        borderClass: 'border-l-2 border-l-amber-500',
      }
    }
    default:
      return { label: keyId, icon: 'help', borderClass: '' }
  }
}

function stageIntent(stage: string): Intent {
  switch (stage) {
    case 'production': return Intent.SUCCESS
    case 'staging':    return Intent.WARNING
    case 'sandbox':    return Intent.NONE
    default:           return Intent.NONE
  }
}
