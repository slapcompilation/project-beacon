// Data Lineage — "a holistic view of how data flows through the platform",
// drawn the way the reading decided: an SVG layered DAG with no graph
// library, ancestors left, root centre, descendants right, chevrons widening
// the walk a level at a time, and a details panel for the selected node.
// Flow edges are solid; link-type relations are dashed, per their different
// nature (elements-reference.md).

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Callout, Checkbox, Drawer, Icon, InputGroup, NonIdealState, Spinner, Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useObjectTypes } from '@/features/objectTypes/hooks'
import {
  useAllMarkings, useDatasetPicks, useDirectMarkings, useLineageGraph, useSimulateMarkings,
  type LineageEdge, type LineageNode, type SimState,
} from './api'
import { SchedulesPanel } from '@/features/builds/SchedulesPanel'

const COL_W = 280
const NODE_W = 220
const NODE_H = 64
const GAP_Y = 24

export default function LineagePage() {
  const { kind, id } = useParams<{ kind?: 'dataset' | 'object_type'; id?: string }>()
  if (!kind || !id) return <RootPicker />
  return <LineageCanvas kind={kind} id={id} />
}

/** No root yet: pick a dataset or an object type to start from. */
function RootPicker() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { data: datasets = [] } = useDatasetPicks()
  const { data: types = [] } = useObjectTypes()
  const match = (s: string) => s.toLowerCase().includes(q.toLowerCase())
  return (
    <div className="explorer-page">
      <h1 className="explorer-headline">Data Lineage</h1>
      <p className="explorer-sub">Pick a dataset or an object type; the graph grows from there.</p>
      <InputGroup leftIcon="search" placeholder="Filter…" value={q}
        onChange={(e) => { setQ(e.currentTarget.value) }} className="explorer-search" />
      <section className="explorer-group">
        <h2 className="explorer-group-title">Datasets <Tag minimal round>{datasets.length}</Tag></h2>
        <div className="explorer-card-grid">
          {datasets.filter((d) => match(d.name)).map((d) => (
            <button key={d.id} type="button" className="explorer-card"
              onClick={() => { void navigate(`/lineage/dataset/${d.id}`) }}>
              <Icon icon="database" color="#2d72d2" />
              <span className="explorer-card-name">{d.name}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="explorer-group">
        <h2 className="explorer-group-title">Object types <Tag minimal round>{types.length}</Tag></h2>
        <div className="explorer-card-grid">
          {types.filter((t) => t.visibility !== 'hidden' && match(t.label)).map((t) => (
            <button key={t.id} type="button" className="explorer-card"
              onClick={() => { void navigate(`/lineage/object_type/${t.id}`) }}>
              <Icon icon={(t.icon || 'cube') as IconName} color="#7961db" />
              <span className="explorer-card-name">{t.label}</span>
            </button>
          ))}
        </div>
      </section>
      {/* "Schedules can be edited, managed, and updated in the schedule
          sidebar of the Data lineage application." */}
      <section className="explorer-group">
        <SchedulesPanel />
      </section>
    </div>
  )
}

function LineageCanvas({ kind, id }: { kind: 'dataset' | 'object_type'; id: string }) {
  const navigate = useNavigate()
  const [up, setUp] = useState(2)
  const [down, setDown] = useState(2)
  const [selected, setSelected] = useState<LineageNode | null>(null)
  // Simulation mode: hypothetical marking changes, drawn as the four states.
  const [simTarget, setSimTarget] = useState<LineageNode | null>(null)
  const [simStates, setSimStates] = useState<Map<string, SimState> | null>(null)
  const { data: graph, isLoading, error } = useLineageGraph(kind, id, up, down)

  // Depth columns: ancestors negative, root zero, descendants positive.
  const layout = useMemo(() => {
    if (!graph) return null
    const depths = [...new Set(graph.nodes.map((n) => n.depth))].sort((a, b) => a - b)
    const pos = new Map<string, { x: number; y: number }>()
    let maxRows = 1
    depths.forEach((d, col) => {
      const column = graph.nodes.filter((n) => n.depth === d)
      maxRows = Math.max(maxRows, column.length)
      column.forEach((n, row) => {
        pos.set(`${n.kind}:${n.id}`, { x: col * COL_W + 16, y: row * (NODE_H + GAP_Y) + 16 })
      })
    })
    return { pos, width: depths.length * COL_W + 32, height: maxRows * (NODE_H + GAP_Y) + 32 }
  }, [graph])

  if (isLoading) return <Spinner />
  if (error) return <NonIdealState icon="error" title="Cannot walk this lineage" description={error.message} />
  if (!graph || !layout) return null

  const path = (e: LineageEdge): string | null => {
    const a = layout.pos.get(`${e.from_kind}:${e.from_id}`)
    const b = layout.pos.get(`${e.to_kind}:${e.to_id}`)
    if (!a || !b) return null
    const x1 = a.x + NODE_W, y1 = a.y + NODE_H / 2
    const x2 = b.x, y2 = b.y + NODE_H / 2
    const mid = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
  }

  const simClass = (n: LineageNode): string => {
    if (!simStates || n.kind !== 'dataset') return ''
    const st = simStates.get(n.id)
    return st ? ` sim-${st}` : ''
  }

  return (
    <div className="explorer-page">
      {/* The fourth banner producer — a mode, not text (the reading's image). */}
      {simStates && (
        <div className="sim-banner">
          <Icon icon="shield" size={14} />
          <span>Security simulation active — marking changes are hypothetical</span>
          <span className="flex-1" />
          <Button size="small" variant="outlined" onClick={() => { setSimStates(null) }}>
            Clear changes
          </Button>
          <Button size="small" variant="outlined" onClick={() => {
            setSimStates(null); setSimTarget(null)
          }}>Exit simulation</Button>
        </div>
      )}
      <div className="exploration-header">
        <Button variant="minimal" icon="arrow-left" onClick={() => { void navigate('/lineage') }} />
        <Icon icon="data-lineage" size={18} color="#2d72d2" />
        <h1 className="exploration-title">Data Lineage</h1>
        <Tag minimal round>{graph.nodes.length} nodes</Tag>
        <span className="flex-1" />
        {/* "Click on the chevron button to define the number of levels" */}
        <Button icon="double-chevron-left" onClick={() => { setUp(Math.min(up + 1, 10)) }}>
          Ancestors: {up}
        </Button>
        <Button endIcon="double-chevron-right" onClick={() => { setDown(Math.min(down + 1, 10)) }}>
          Descendants: {down}
        </Button>
      </div>

      {graph.truncated && (
        <Callout intent="warning" className="!text-xs mb-2">
          The graph was truncated at 300 nodes — narrow the walk to see the rest.
        </Callout>
      )}

      <div className="lineage-scroll">
        <div className="lineage-canvas" style={{ width: layout.width, height: layout.height }}>
          <svg width={layout.width} height={layout.height} className="lineage-edges">
            {graph.edges.map((e, i) => {
              const d = path(e)
              return d && (
                <path key={i} d={d}
                  className={e.edge === 'link_type' ? 'lineage-edge-link' : 'lineage-edge-flow'} />
              )
            })}
          </svg>
          {graph.nodes.map((n) => {
            const p = layout.pos.get(`${n.kind}:${n.id}`)
            if (!p) return null
            return (
              <button key={`${n.kind}:${n.id}`} type="button"
                className={`lineage-node ${n.depth === 0 ? 'is-root' : ''}${simClass(n)}`}
                style={{ left: p.x, top: p.y, width: NODE_W, height: NODE_H }}
                onClick={() => { setSelected(n) }}>
                <Icon icon={n.kind === 'dataset' ? 'database' : (n.icon || 'cube') as IconName}
                  size={14} color={n.kind === 'dataset' ? '#2d72d2' : '#7961db'} />
                <span className="lineage-node-label">{n.label}</span>
                {n.out_of_date_with_parent && (
                  <Icon icon="outdated" size={12} color="#c87619" title="Out-of-date with parent" />
                )}
                {n.defines_object_type === true && (
                  <Icon icon="cube-add" size={12} color="#7961db" title="Defines an object type" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="lineage-legend">
        <span><Icon icon="database" size={12} color="#2d72d2" /> Dataset</span>
        <span><Icon icon="cube" size={12} color="#7961db" /> Object type</span>
        <span><span className="lineage-swatch-flow" /> data flow</span>
        <span><span className="lineage-swatch-link" /> link type</span>
        <span><Icon icon="outdated" size={12} color="#c87619" /> out-of-date with parent</span>
        {simStates && (
          <>
            <span><span className="sim-swatch sim-simulated_changes_applied" /> Simulated changes applied</span>
            <span><span className="sim-swatch sim-access_affected" /> Access affected</span>
            <span><span className="sim-swatch sim-access_unaffected" /> Access unaffected</span>
            <span><span className="sim-swatch sim-no_visible_transactions" /> No visible transactions</span>
          </>
        )}
      </div>

      <Drawer isOpen={selected !== null} onClose={() => { setSelected(null) }}
        size="360px" title={selected?.label}>
        {selected && <NodeDetails node={selected} onFocus={() => {
          setSelected(null)
          void navigate(`/lineage/${selected.kind}/${selected.id}`)
        }} onSimulate={selected.kind === 'dataset' ? () => {
          setSimTarget(selected); setSelected(null)
        } : undefined} />}
      </Drawer>

      <Drawer isOpen={simTarget !== null && simStates === null}
        onClose={() => { setSimTarget(null) }}
        size="360px" title={simTarget ? `Simulate markings — ${simTarget.label}` : ''}>
        {simTarget && (
          <SimulatePanel dataset={simTarget} onResult={(states) => { setSimStates(states) }} />
        )}
      </Drawer>
    </div>
  )
}

function NodeDetails({ node, onFocus, onSimulate }: {
  node: LineageNode; onFocus: () => void; onSimulate?: () => void
}) {
  const facts: [string, string | null][] = [
    ['Kind', node.kind === 'dataset' ? 'Dataset' : 'Object type'],
    ['API name', node.api_name],
    ['Status', node.status],
    ['Transaction type', node.txn_type],
    ['Rows', node.row_count === null ? null : String(node.row_count)],
    ['Last built', node.built_at === null ? 'never' : new Date(node.built_at).toLocaleString()],
  ]
  return (
    <div className="explorer-preview">
      {node.out_of_date_with_parent && (
        <Callout intent="warning" className="!text-xs">
          Out-of-date with parent — a direct parent has been updated and this resource has not.
        </Callout>
      )}
      {node.defines_object_type === true && (
        <Callout className="!text-xs">This dataset defines an Ontology object type.</Callout>
      )}
      {facts.filter(([, v]) => v !== null).map(([k, v]) => (
        <div key={k} className="explorer-preview-row">
          <span className="explorer-preview-label">{k}</span>
          <span className="text-sm">{v}</span>
        </div>
      ))}
      <Button intent="primary" fill icon="locate" onClick={onFocus}>Focus lineage here</Button>
      {onSimulate && (
        <Button fill icon="shield" onClick={onSimulate}>Simulate access requirements</Button>
      )}
    </div>
  )
}

/** "Markings that are already applied on a dataset will appear as selected.
 *  To simulate Marking removal, uncheck the box." Nothing is written. */
function SimulatePanel({ dataset, onResult }: {
  dataset: LineageNode
  onResult: (states: Map<string, SimState>) => void
}) {
  const { data: all = [] } = useAllMarkings()
  const { data: direct = [] } = useDirectMarkings(dataset.id)
  const simulate = useSimulateMarkings()
  const [checked, setChecked] = useState<Set<string> | null>(null)
  const current = checked ?? new Set(direct)

  const run = () => {
    const add = [...current].filter((m) => !direct.includes(m))
    const remove = direct.filter((m) => !current.has(m))
    simulate.mutate({ datasetId: dataset.id, add, remove }, {
      onSuccess: (rows) => {
        onResult(new Map(rows.map((r) => [r.dataset_id, r.state])))
      },
    })
  }

  return (
    <div className="explorer-preview">
      <p className="text-xs text-muted-foreground">
        Check a marking to simulate applying it; uncheck a selected one to simulate
        removal. Nothing is written — the graph shows what would change.
      </p>
      {all.map((m) => (
        <Checkbox key={m.id} checked={current.has(m.id)}
          labelElement={<span>{m.name} <Tag minimal className="!text-[10px]">{m.category}</Tag></span>}
          onChange={(e) => {
            const next = new Set(current)
            if (e.currentTarget.checked) next.add(m.id); else next.delete(m.id)
            setChecked(next)
          }} />
      ))}
      {all.length === 0 && <p className="text-xs text-muted-foreground">No markings exist yet.</p>}
      {simulate.error && <Callout intent="danger" className="!text-[11px]">{simulate.error.message}</Callout>}
      <Button intent="primary" fill icon="play" loading={simulate.isPending} onClick={run}>
        Simulate changes
      </Button>
    </div>
  )
}
