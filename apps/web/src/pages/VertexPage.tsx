// Vertex — system graphs of ontology objects, templates that generate them,
// and the scenario sandbox on the NON-sunset path: actions applied into an
// ontology scenario, then merged.

import { useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup,
  Intent, NonIdealState, Spinner, SpinnerSize, Tag, Tab, Tabs,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import {
  useVxGraphs, useVxGraphContents, useVxTemplates, useVxScenarios,
  useVxObjectTypes, useVxActionTypes,
  useCreateVxGraph, useAddNode, useAddEdge, useAddSubgraph, useSaveVxGraph,
  useInstantiateTemplate, useScenarioOps, useScenarioState,
  type VxGraphContents, type VxScenario,
} from '@/features/vertex/api'

export default function VertexPage() {
  const [params, setParams] = useSearchParams()
  const graphId = params.get('g')
  const tab = params.get('t') ?? 'graphs'

  if (graphId !== null) {
    return <GraphView id={graphId} onClose={() => { setParams({ t: 'graphs' }) }} />
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-5xl space-y-4">
        <header>
          <h1 className="text-xl font-semibold">Vertex</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            System graphs over the digital twin: objects as nodes, link types as edges,
            templates that generate graphs from parameters, and scenarios — sandboxes of
            action-applied edits on top of the ontology.
          </p>
        </header>
        <Tabs selectedTabId={tab} onChange={(t) => { setParams({ t: String(t) }) }}>
          <Tab id="graphs" title="Graphs" panel={<GraphsList onOpen={(id) => { setParams({ g: id }) }} />} />
          <Tab id="templates" title="Templates" panel={<TemplatesPanel />} />
          <Tab id="scenarios" title="Scenarios" panel={<ScenariosPanel />} />
        </Tabs>
      </div>
    </div>
  )
}

function GraphsList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: graphs = [], isLoading } = useVxGraphs()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [project, setProject] = useState('')
  const { data: projects = [] } = useProjects()
  const create = useCreateVxGraph()
  return (
    <div className="space-y-3">
      <Button size="small" icon="plus" onClick={() => { setOpen(true) }}>New graph</Button>
      {isLoading ? <Spinner size={SpinnerSize.SMALL} /> : graphs.length === 0 ? (
        <NonIdealState icon="graph" title="No graphs yet"
          description="A graph holds specific objects in sub-graphs. Sharing shares its shape; the data behind each node stays behind its own permissions." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {graphs.map((g) => (
            <Card key={g.id} interactive compact onClick={() => { onOpen(g.id) }}>
              <div className="flex items-center gap-2">
                <Icon icon="graph" size={14} className="text-violet-500" />
                <span className="text-sm font-semibold truncate">{g.name}</span>
                {g.readOnly && <Tag minimal className="!text-[9px]">read-only</Tag>}
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{g.rid}</p>
            </Card>
          ))}
        </div>
      )}
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New graph">
        <DialogBody>
          <div className="space-y-3">
            <InputGroup placeholder="Graph name" value={name}
              onChange={(e) => { setName(e.target.value) }} />
            <HTMLSelect fill value={project} onChange={(e) => { setProject(e.target.value) }}>
              <option value="">Choose a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </HTMLSelect>
            <Button intent={Intent.PRIMARY} disabled={name === '' || project === ''}
              loading={create.isPending}
              onClick={() => {
                create.mutate({ projectId: project, name },
                  { onSuccess: () => { setOpen(false); setName('') } })
              }}>Create</Button>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  )
}

function GraphView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: graphs = [] } = useVxGraphs()
  const graph = graphs.find((g) => g.id === id)
  const { data, isLoading } = useVxGraphContents(id)
  const { data: objectTypes = [] } = useVxObjectTypes()
  const addNode = useAddNode(id)
  const addEdge = useAddEdge(id)
  const addSubgraph = useAddSubgraph(id)
  const save = useSaveVxGraph(id)
  const [sgId, setSgId] = useState<string | null>(null)
  const [otId, setOtId] = useState('')
  const [pk, setPk] = useState('')
  const [edgeFrom, setEdgeFrom] = useState('')
  const [edgeTo, setEdgeTo] = useState('')

  if (isLoading || graph === undefined) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  const c: VxGraphContents = data ?? { subgraphs: [], nodes: [], edges: [] }
  const sg = c.subgraphs.find((s) => s.id === sgId) ?? c.subgraphs.at(0) ?? null
  const nodes = c.nodes.filter((n) => n.subgraphId === sg?.id)
  const edges = c.edges.filter((e) => e.subgraphId === sg?.id)
  const otLabel = (tid: string) => objectTypes.find((o) => o.id === tid)?.label ?? '?'

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="vx-topbar">
        <Button variant="minimal" size="small" icon="chevron-left" onClick={onClose} />
        <span className="text-sm font-semibold truncate">{graph.name}</span>
        {graph.readOnly && <Tag minimal className="!text-[9px]">read-only</Tag>}
        <div className="vx-spacer" />
        {/* subgraph navigation — the embed's menu, always shown when many */}
        {c.subgraphs.map((s) => (
          <Button key={s.id} variant="minimal" size="small" active={s.id === sg?.id}
            onClick={() => { setSgId(s.id) }}>{s.name}</Button>
        ))}
        <Button variant="minimal" size="small" icon="plus" title="New subgraph"
          onClick={() => {
            addSubgraph.mutate({ name: `Subgraph ${String(c.subgraphs.length + 1)}`,
              position: c.subgraphs.length })
          }} />
        <Button size="small" icon="floppy-disk" intent={Intent.PRIMARY} loading={save.isPending}
          onClick={() => { save.mutate('') }}>Save</Button>
      </div>
      <div className="vx-canvas">
        {nodes.length === 0 ? (
          <NonIdealState icon="graph" title="An empty subgraph"
            description="Add an object below — a node is a specific object of a type, placed on the canvas." />
        ) : (
          <div className="vx-board">
            {nodes.map((n) => (
              <div key={n.id} className="vx-node" style={{ left: n.x, top: n.y }}>
                <Icon icon="cube" size={12} />
                <div>
                  <p className="vx-node-title">{n.primaryKey}</p>
                  <p className="vx-node-type">{otLabel(n.objectTypeId)}</p>
                </div>
              </div>
            ))}
            {edges.length > 0 && (
              <div className="vx-edges-list">
                {edges.map((e) => {
                  const f = c.nodes.find((n) => n.id === e.fromNodeId)
                  const t = c.nodes.find((n) => n.id === e.toNodeId)
                  return (
                    <Tag key={e.id} minimal className="!text-[9px]">
                      {f?.primaryKey ?? '?'} → {t?.primaryKey ?? '?'}
                    </Tag>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {!graph.readOnly && sg !== null && (
        <div className="vx-footer">
          <HTMLSelect value={otId} onChange={(e) => { setOtId(e.target.value) }}>
            <option value="">Object type…</option>
            {objectTypes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </HTMLSelect>
          <InputGroup size="small" placeholder="Primary key" value={pk}
            onChange={(e) => { setPk(e.target.value) }} />
          <Button size="small" icon="plus" disabled={otId === '' || pk === ''}
            loading={addNode.isPending}
            onClick={() => {
              addNode.mutate({ subgraphId: sg.id, objectTypeId: otId, primaryKey: pk,
                x: 40 + (nodes.length % 4) * 200, y: 40 + Math.floor(nodes.length / 4) * 90 },
              { onSuccess: () => { setPk('') } })
            }}>Add object</Button>
          <div className="vx-spacer" />
          <HTMLSelect value={edgeFrom} onChange={(e) => { setEdgeFrom(e.target.value) }}>
            <option value="">From…</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.primaryKey}</option>)}
          </HTMLSelect>
          <HTMLSelect value={edgeTo} onChange={(e) => { setEdgeTo(e.target.value) }}>
            <option value="">To…</option>
            {nodes.map((n) => <option key={n.id} value={n.id}>{n.primaryKey}</option>)}
          </HTMLSelect>
          <Button size="small" icon="new-link" disabled={edgeFrom === '' || edgeTo === ''}
            loading={addEdge.isPending}
            onClick={() => {
              addEdge.mutate({ subgraphId: sg.id, fromNodeId: edgeFrom,
                toNodeId: edgeTo, linkTypeId: null })
            }}>Link</Button>
        </div>
      )}
    </div>
  )
}

function TemplatesPanel() {
  const { data } = useVxTemplates()
  const { data: projects = [] } = useProjects()
  const instantiate = useInstantiateTemplate()
  const [using, setUsing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [project, setProject] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const tpl = data?.templates.find((t) => t.id === using)
  const params = data?.params.filter((p) => p.templateId === using) ?? []
  return (
    <div className="space-y-3">
      {(data?.templates ?? []).length === 0 ? (
        <Card compact className="text-sm text-muted-foreground">
          No templates yet. A template generates graphs with a defined styling based on
          parameters — build one from a graph in a coming pass.
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(data?.templates ?? []).map((t) => (
            <Card key={t.id} compact className="flex items-center gap-2">
              <Icon icon="duplicate" size={13} className="text-violet-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{t.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{t.description}</p>
              </div>
              <Button size="small" onClick={() => { setUsing(t.id); setValues({}) }}>Use</Button>
            </Card>
          ))}
        </div>
      )}
      <Dialog isOpen={using !== null} onClose={() => { setUsing(null) }}
        title={`Use ${tpl?.name ?? 'template'}`}>
        <DialogBody>
          <div className="space-y-3">
            <InputGroup placeholder="New graph name" value={name}
              onChange={(e) => { setName(e.target.value) }} />
            <HTMLSelect fill value={project} onChange={(e) => { setProject(e.target.value) }}>
              <option value="">Project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </HTMLSelect>
            {params.map((p) => (
              <InputGroup key={p.id}
                placeholder={`${p.name}${p.required ? ' *' : ''}${p.singleObject ? ' (single object pk)' : ' (pks, comma-separated)'}`}
                value={values[p.name] ?? ''}
                onChange={(e) => { setValues({ ...values, [p.name]: e.target.value }) }} />
            ))}
            <Button intent={Intent.PRIMARY} disabled={name === '' || project === ''}
              loading={instantiate.isPending}
              onClick={() => {
                const objects: Record<string, string[]> = {}
                for (const p of params) {
                  const v = values[p.name] ?? ''
                  if (v !== '') objects[p.name] = v.split(',').map((s) => s.trim())
                }
                if (using !== null) {
                  instantiate.mutate({ templateId: using, projectId: project, name, objects },
                    { onSuccess: () => { setUsing(null) } })
                }
              }}>Generate graph</Button>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  )
}

function ScenariosPanel() {
  const { data } = useVxScenarios()
  const { data: projects = [] } = useProjects()
  const { data: actionTypes = [] } = useVxActionTypes()
  const { data: objectTypes = [] } = useVxObjectTypes()
  const ops = useScenarioOps()
  const peek = useScenarioState()
  const [csName, setCsName] = useState('')
  const [csProject, setCsProject] = useState('')
  const [scName, setScName] = useState('')
  const [scCase, setScCase] = useState('')
  const [applying, setApplying] = useState<VxScenario | null>(null)
  const [atId, setAtId] = useState('')
  const [paramsText, setParamsText] = useState('{}')
  const [peekOt, setPeekOt] = useState('')
  const [peekPk, setPeekPk] = useState('')
  const [peeked, setPeeked] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Callout compact icon="lab-test">
        A scenario is a sandbox to apply edits on top of the ontology, generated by applying
        one or more actions. Nothing reaches the base ontology until the merge commits the
        staged edits as one transaction.
      </Callout>

      <div className="vx-two-col">
        <Card compact className="space-y-2">
          <p className="text-sm font-semibold">New case study</p>
          <InputGroup size="small" placeholder="Name" value={csName}
            onChange={(e) => { setCsName(e.target.value) }} />
          <HTMLSelect fill value={csProject} onChange={(e) => { setCsProject(e.target.value) }}>
            <option value="">Project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </HTMLSelect>
          <Button size="small" icon="plus" disabled={csName === '' || csProject === ''}
            loading={ops.createCaseStudy.isPending}
            onClick={() => {
              ops.createCaseStudy.mutate({ projectId: csProject, name: csName, graphId: null },
                { onSuccess: () => { setCsName('') } })
            }}>Create</Button>
        </Card>
        <Card compact className="space-y-2">
          <p className="text-sm font-semibold">New scenario</p>
          <InputGroup size="small" placeholder="Name" value={scName}
            onChange={(e) => { setScName(e.target.value) }} />
          <HTMLSelect fill value={scCase} onChange={(e) => { setScCase(e.target.value) }}>
            <option value="">Case study (optional)…</option>
            {(data?.caseStudies ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </HTMLSelect>
          <Button size="small" icon="plus" disabled={scName === ''}
            loading={ops.createScenario.isPending}
            onClick={() => {
              ops.createScenario.mutate({ name: scName, caseStudyId: scCase === '' ? null : scCase },
                { onSuccess: () => { setScName('') } })
            }}>Create</Button>
        </Card>
      </div>

      {(data?.scenarios ?? []).map((s) => {
        const acts = (data?.actions ?? []).filter((a) => a.scenarioId === s.id)
        const cs = data?.caseStudies.find((c) => c.id === s.caseStudyId)
        return (
          <Card key={s.id} compact className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon icon="lab-test" size={13} className="text-violet-500" />
              <span className="text-sm font-semibold">{s.name}</span>
              {cs !== undefined && <Tag minimal className="!text-[9px]">{cs.name}</Tag>}
              <Tag minimal className="!text-[9px]">{acts.length} action(s)</Tag>
              <div className="flex-1" />
              {s.mergedAt !== null ? (
                <Tag minimal intent={Intent.SUCCESS} className="!text-[9px]">merged</Tag>
              ) : (
                <>
                  <Button size="small" icon="take-action" onClick={() => { setApplying(s) }}>
                    Add Action
                  </Button>
                  <Button size="small" icon="git-merge" loading={ops.merge.isPending}
                    onClick={() => { ops.merge.mutate(s.id) }}>Merge</Button>
                </>
              )}
            </div>
            {acts.map((a) => (
              <p key={a.id} className="text-[11px] text-muted-foreground font-mono">
                {actionTypes.find((t) => t.id === a.actionTypeId)?.label ?? a.actionTypeId}
                {' '}{JSON.stringify(a.parameters)}
              </p>
            ))}
            <div className="vx-peek">
              <HTMLSelect value={peekOt} onChange={(e) => { setPeekOt(e.target.value) }}>
                <option value="">Peek at type…</option>
                {objectTypes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </HTMLSelect>
              <InputGroup size="small" placeholder="pk" value={peekPk}
                onChange={(e) => { setPeekPk(e.target.value) }} />
              <Button size="small" variant="minimal" icon="eye-open"
                disabled={peekOt === '' || peekPk === ''} loading={peek.isPending}
                title="The object as this scenario sees it"
                onClick={() => {
                  peek.mutate({ scenarioId: s.id, objectTypeId: peekOt, primaryKey: peekPk },
                    { onSuccess: (v) => { setPeeked(JSON.stringify(v, null, 1)) } })
                }} />
              {peeked !== null && <pre className="vx-peeked">{peeked}</pre>}
            </div>
          </Card>
        )
      })}

      <Dialog isOpen={applying !== null} onClose={() => { setApplying(null) }}
        title={`Add Action to ${applying?.name ?? ''}`}>
        <DialogBody>
          <div className="space-y-3">
            <HTMLSelect fill value={atId} onChange={(e) => { setAtId(e.target.value) }}>
              <option value="">Action type…</option>
              {actionTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </HTMLSelect>
            <InputGroup placeholder='Parameters JSON, e.g. {"status": "diverted"}'
              value={paramsText} onChange={(e) => { setParamsText(e.target.value) }} />
            <Button intent={Intent.PRIMARY} disabled={atId === ''}
              loading={ops.applyAction.isPending}
              onClick={() => {
                let parsed: Record<string, unknown>
                try { parsed = JSON.parse(paramsText) as Record<string, unknown> } catch { return }
                if (applying !== null) {
                  ops.applyAction.mutate({
                    scenarioId: applying.id, actionTypeId: atId,
                    parameters: parsed, primaryKey: null,
                  }, { onSuccess: () => { setApplying(null) } })
                }
              }}>Submit</Button>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  )
}
