// Search Around (Foundry Vertex parity): an interactive radial graph over the
// Reality Graph. A focus node sits at the centre with its typed neighbours in a
// ring; clicking a neighbour "searches around" to it (re-focus), building a
// breadcrumb trail. Node labels are resolved to real names, edges carry their
// typed relationship. Dependency-free SVG — no graph library.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Dialog, DialogBody, Icon } from '@blueprintjs/core'
import { otherSide } from '@beacon/reality-graph'
import type { NodeType } from '@beacon/reality-graph'
import { useNodeEdges, type EdgeRow } from '@/hooks/useNodeEdges'
import { useResolveNodeLabels, type NodeRef } from '@/hooks/useResolveNodeLabels'
import { NODE_LABELS, EDGE_LABELS, objectPath } from '@/lib/objectPresentation'

const W = 900, H = 600, CX = W / 2, CY = H / 2, MAX_NEIGHBORS = 22

// Node colour by type — a stable palette so the same type reads the same across
// hops. Falls back to slate.
const TYPE_COLOR: Partial<Record<NodeType, string>> = {
  supplier: '#0ea5e9', variant: '#8b5cf6', product: '#7c3aed', document: '#f59e0b',
  entity: '#10b981', chunk: '#d97706', purchase_order: '#6366f1', case: '#ec4899',
  restock_request: '#a855f7', proposal: '#9333ea', alert: '#ef4444',
  stock_log: '#64748b', po_invoice: '#6366f1', stock_transfer: '#a855f7',
}
const colorFor = (t: NodeType) => TYPE_COLOR[t] ?? '#64748b'

interface Neighbor {
  ref:       NodeRef
  edgeType:  EdgeRow['edge_type']
  role:      'source' | 'target'
}

function SearchAroundCanvas({ root }: { root: NodeRef }) {
  const navigate = useNavigate()
  const [focus, setFocus] = useState<NodeRef>(root)
  const [path, setPath]   = useState<NodeRef[]>([root])

  const { data: edges = [], isLoading } = useNodeEdges(focus.type, focus.id)

  // Distinct neighbours (a node reachable by several edges shows once, first edge wins).
  const neighbors = useMemo<Neighbor[]>(() => {
    const seen = new Set<string>()
    const out: Neighbor[] = []
    for (const e of edges) {
      const o = otherSide(e as unknown as Parameters<typeof otherSide>[0], focus.id)
      const k = `${o.type}:${o.id}`
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ ref: { type: o.type, id: o.id }, edgeType: e.edge_type, role: o.role })
    }
    return out
  }, [edges, focus.id])

  const shown  = neighbors.slice(0, MAX_NEIGHBORS)
  const hidden = neighbors.length - shown.length

  const refs = useMemo<NodeRef[]>(() => [focus, ...shown.map((n) => n.ref)], [focus, shown])
  const { data: labels } = useResolveNodeLabels(refs)
  const labelOf = (r: NodeRef) =>
    labels?.get(`${r.type}:${r.id}`) ?? `${NODE_LABELS[r.type]} ${r.id.slice(0, 6)}`
  const truncate = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

  const hopTo = (ref: NodeRef) => {
    setFocus(ref)
    setPath((p) => [...p, ref])
  }
  const backTo = (i: number) => {
    setPath((p) => p.slice(0, i + 1))
    setFocus(path[i])
  }

  const radius = shown.length > 12 ? 250 : 200
  const positions = shown.map((_, i) => {
    const angle = (i / Math.max(shown.length, 1)) * 2 * Math.PI - Math.PI / 2
    return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle), cos: Math.cos(angle) }
  })

  const typesPresent = [...new Set([focus.type, ...shown.map((n) => n.ref.type)])]

  return (
    <div className="flex flex-col gap-2">
      {/* Breadcrumb trail */}
      <div className="flex items-center gap-1 flex-wrap text-xs">
        {path.map((p, i) => (
          <span key={`${p.type}:${p.id}:${i}`} className="flex items-center gap-1">
            {i > 0 && <Icon icon="chevron-right" size={10} className="text-muted-foreground/50" />}
            <button
              className={`hover:underline ${i === path.length - 1 ? 'font-semibold' : 'text-muted-foreground'}`}
              onClick={() => { backTo(i) }}
            >
              {truncate(labelOf(p), 22)}
            </button>
          </span>
        ))}
        <span className="ml-auto">
          {objectPath(focus.type, focus.id) && (
            <Button variant="minimal" size="small" icon="share"
              onClick={() => { void navigate(objectPath(focus.type, focus.id) as string) }}>
              Open {NODE_LABELS[focus.type]}
            </Button>
          )}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[60vh] select-none" role="img" aria-label="Search around graph">
        {/* Edges */}
        {shown.map((n, i) => (
          <g key={`edge-${n.ref.type}:${n.ref.id}`}>
            <line x1={CX} y1={CY} x2={positions[i].x} y2={positions[i].y}
              stroke="#cbd5e1" strokeWidth={1.5}>
              <title>{EDGE_LABELS[n.edgeType]}</title>
            </line>
          </g>
        ))}

        {/* Neighbour nodes */}
        {shown.map((n, i) => {
          const p = positions[i]
          const anchor = p.cos < -0.3 ? 'end' : p.cos > 0.3 ? 'start' : 'middle'
          const dx = anchor === 'end' ? -14 : anchor === 'start' ? 14 : 0
          return (
            <g key={`node-${n.ref.type}:${n.ref.id}`} className="cursor-pointer" onClick={() => { hopTo(n.ref) }}>
              <circle cx={p.x} cy={p.y} r={9} fill={colorFor(n.ref.type)} stroke="#fff" strokeWidth={1.5} />
              <text x={p.x + dx} y={p.y + 4} textAnchor={anchor} fontSize={12} fill="currentColor">
                {truncate(labelOf(n.ref))}
              </text>
              <title>{`${NODE_LABELS[n.ref.type]} · ${EDGE_LABELS[n.edgeType]}`}</title>
            </g>
          )
        })}

        {/* Focus node */}
        <g>
          <circle cx={CX} cy={CY} r={16} fill={colorFor(focus.type)} stroke="#fff" strokeWidth={3} />
          <text x={CX} y={CY + 34} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor">
            {truncate(labelOf(focus), 34)}
          </text>
        </g>
      </svg>

      {/* Legend + status */}
      <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
        {typesPresent.map((t) => (
          <span key={t} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: colorFor(t) }} />
            {NODE_LABELS[t]}
          </span>
        ))}
        <span className="ml-auto">
          {isLoading ? 'Loading…'
            : neighbors.length === 0 ? 'No connections yet.'
            : `${neighbors.length} connection${neighbors.length === 1 ? '' : 's'}${hidden > 0 ? ` · showing ${shown.length}` : ''}`}
        </span>
      </div>
    </div>
  )
}

/** Button + dialog that opens Search Around focused on the given node. */
export function SearchAroundButton({
  nodeType,
  nodeId,
  minimal = true,
}: {
  nodeType: NodeType
  nodeId:   string
  minimal?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button icon="graph" variant={minimal ? 'minimal' : 'solid'} size="small" onClick={() => { setOpen(true) }}>
        Search Around
      </Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="Search Around"
        style={{ width: '80vw', maxWidth: 1000 }}>
        <DialogBody>
          {open && <SearchAroundCanvas root={{ type: nodeType, id: nodeId }} />}
        </DialogBody>
      </Dialog>
    </>
  )
}
