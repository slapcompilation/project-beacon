// The live ontology as a graph: user-defined object types are nodes, link types
// are the edges between them. Unlike the code-surface lanes this is a general
// graph (cycles, self-links), so it lays out on a ring — deterministic, no
// stored coordinates to drift from the schema.
//
// It's authorable in place: pick a source type then a target type and name the
// relationship. That's the one thing a canvas does better than a form — you
// author the edge by drawing it.

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Dialog, DialogBody, DialogFooter, Icon, InputGroup, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { toSlug } from '@beacon/reality-graph'
import { useOntologyTypes, useLinkTypes, useCreateLinkType, useDeleteLinkType } from '@/features/objectTypes/hooks'

const R_NODE = 42        // node radius
const PAD    = 90        // ring padding so labels clear the edge

interface Placed { id: string; label: string; icon: string; builtin: boolean; x: number; y: number }

export default function OntologyCanvas() {
  const types = useOntologyTypes()
  const links = useLinkTypes()
  const createLink = useCreateLinkType()
  const deleteLink = useDeleteLinkType()

  const [source, setSource] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [label, setLabel] = useState('')

  const rows = useMemo(() => types.data ?? [], [types.data])
  const size = Math.max(320, Math.min(560, 120 + rows.length * 52))
  const cx = size / 2
  const cy = size / 2
  const ring = size / 2 - PAD

  const placed = useMemo<Placed[]>(() => rows.map((t, i) => {
    // Single type sits centred; otherwise spread evenly, starting at 12 o'clock.
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(1, rows.length)
    return {
      id: t.id, label: t.label, icon: t.icon, builtin: t.kind === 'builtin',
      x: rows.length === 1 ? cx : cx + ring * Math.cos(angle),
      y: rows.length === 1 ? cy : cy + ring * Math.sin(angle),
    }
  }), [rows, cx, cy, ring])

  const byId = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed])

  function onNodeClick(id: string) {
    if (source === null) { setSource(id); return }
    if (source === id && target === null) { setSource(null); return }   // click again to cancel
    setTarget(id)
  }

  function submit() {
    if (!source || !target || !label.trim()) return
    createLink.mutate(
      { hotelId: null, sourceTypeId: source, targetTypeId: target, apiName: toSlug(label), label: label.trim() },
      { onSuccess: () => { setSource(null); setTarget(null); setLabel('') } },
    )
  }

  if (types.isLoading) return null
  if (rows.length === 0) {
    return (
      <Card>
        <NonIdealState
          icon="graph"
          title="No object types yet"
          description="The ontology canvas draws the types you author and the relationships between them. Create a type to start the graph."
          action={<Link to="/mind?aip=object-types"><Button intent={Intent.PRIMARY} icon="add">New object type</Button></Link>}
        />
      </Card>
    )
  }

  const sourceName = source ? byId.get(source)?.label : null

  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2"><Icon icon="graph" size={14} /> Ontology</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {source
              ? <>Now pick the target type for <strong>{sourceName}</strong> — or click it again to cancel.</>
              : <>Your object types and how they relate. Click a type, then another, to author a relationship.</>}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Tag minimal className="!text-[10px]">{rows.length} types</Tag>
          <Tag minimal className="!text-[10px]">{(links.data ?? []).length} link types</Tag>
          <Link to="/mind?aip=object-types"><Button size="small" variant="minimal" icon="cog" text="Edit types" /></Link>
        </div>
      </div>

      <div className="overflow-auto">
        <svg width={size} height={size} className="mx-auto select-none">
          <defs>
            <marker id="onto-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" opacity={0.6} />
            </marker>
          </defs>
          {(links.data ?? []).map((l) => {
            const a = byId.get(l.source_object_type_id)
            const b = byId.get(l.target_object_type_id)
            if (!a || !b) return null
            return <LinkEdge key={l.id} a={a} b={b} label={l.label}
              onDelete={() => { deleteLink.mutate(l.id) }} />
          })}

          {placed.map((p) => {
            const isSource = p.id === source
            return (
              <g key={p.id} onClick={() => { onNodeClick(p.id) }} className="cursor-pointer">
                {/* Code-owned types are dashed — you can link them, not edit them. */}
                <circle cx={p.x} cy={p.y} r={R_NODE}
                  className={isSource ? 'fill-primary/20 stroke-primary' : 'fill-muted/40 stroke-border hover:stroke-primary'}
                  strokeWidth={isSource ? 2 : 1.25}
                  strokeDasharray={p.builtin ? '4 3' : undefined} />
                <foreignObject x={p.x - R_NODE} y={p.y - 20} width={R_NODE * 2} height={40}>
                  <div className="flex flex-col items-center justify-center h-full gap-0.5 pointer-events-none">
                    <Icon icon={(p.icon || 'cube') as IconName} size={12} />
                    <span className="text-[10px] font-medium text-center leading-tight px-1 truncate w-full">{p.label}</span>
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </svg>
      </div>

      <Dialog isOpen={!!source && !!target} onClose={() => { setTarget(null); setLabel('') }} title="New relationship" icon="link">
        <DialogBody>
          <p className="text-xs text-muted-foreground mb-2">
            <strong>{sourceName}</strong> → <strong>{target ? byId.get(target)?.label : ''}</strong>
          </p>
          <InputGroup value={label} autoFocus placeholder="belongs to room"
            onChange={(e) => { setLabel(e.target.value) }}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
          {label.trim() && <p className="text-[11px] text-muted-foreground mt-1.5">api name: <code>{toSlug(label)}</code></p>}
        </DialogBody>
        <DialogFooter actions={
          <Button intent={Intent.PRIMARY} disabled={!label.trim()} loading={createLink.isPending} onClick={submit}>
            Create relationship
          </Button>
        } />
      </Dialog>
    </Card>
  )
}

function LinkEdge({ a, b, label, onDelete }: {
  a: Placed; b: Placed; label: string; onDelete: () => void
}) {
  // Self-link: a loop above the node. Otherwise a straight run, trimmed to the
  // node edge so the arrow head lands on the circle, not inside it.
  if (a.id === b.id) {
    const d = `M ${String(a.x - 14)} ${String(a.y - R_NODE + 4)} C ${String(a.x - 46)} ${String(a.y - R_NODE - 48)}, ${String(a.x + 46)} ${String(a.y - R_NODE - 48)}, ${String(a.x + 14)} ${String(a.y - R_NODE + 4)}`
    return (
      <g className="text-muted-foreground">
        <path d={d} fill="none" stroke="currentColor" strokeWidth={1.25} strokeOpacity={0.6} markerEnd="url(#onto-arrow)" />
        <EdgeLabel x={a.x} y={a.y - R_NODE - 34} label={label} onDelete={onDelete} />
      </g>
    )
  }
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const x1 = a.x + (dx / len) * R_NODE
  const y1 = a.y + (dy / len) * R_NODE
  const x2 = b.x - (dx / len) * (R_NODE + 6)
  const y2 = b.y - (dy / len) * (R_NODE + 6)
  return (
    <g className="text-muted-foreground">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={1.25} strokeOpacity={0.6} markerEnd="url(#onto-arrow)" />
      <EdgeLabel x={(x1 + x2) / 2} y={(y1 + y2) / 2} label={label} onDelete={onDelete} />
    </g>
  )
}

function EdgeLabel({ x, y, label, onDelete }: { x: number; y: number; label: string; onDelete: () => void }) {
  return (
    <foreignObject x={x - 60} y={y - 10} width={120} height={20}>
      <div className="flex justify-center">
        <button
          onClick={onDelete}
          title="Delete this relationship"
          className="text-[9px] px-1 rounded bg-background border text-muted-foreground hover:text-red-500 hover:border-red-400 truncate max-w-full"
        >
          {label}
        </button>
      </div>
    </foreignObject>
  )
}
