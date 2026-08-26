// Quiver — the analysis list, and one analysis in canvas or graph mode.
//
// The type system is the interface here, not a validation afterthought:
// "It only shows cards that are able to take your current card's output type
// as input" (quiver/analysis-data-model), so the next actions menu below is
// a filter over the catalogue rather than a fixed list. Unbuilt kinds stay
// visible and refuse by name — 191 of the 203 are unbuilt, and hiding them
// would make the catalogue a lie.

import { useMemo, useState } from 'react'
import {
  Button, ButtonGroup, Callout, Card, Dialog, DialogBody, HTMLSelect, Icon,
  InputGroup, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import {
  useAnalyses, useAnalysisContents, useCardKinds, useUnusedCards, useCreateAnalysis,
  useAddCard, useAddCanvas, usePlaceCard, useDeleteCard, useSaveAnalysis,
  outputTypeOf, kindsAccepting,
  type Analysis, type AnalysisContents, type CardKind, type QCard,
} from '@/features/quiver/api'

export default function QuiverPage() {
  const { data: analyses = [], isLoading } = useAnalyses()
  const [params, setParams] = useSearchParams()
  const openId = params.get('a')
  const open = analyses.find((a) => a.id === openId) ?? null

  if (open !== null) return <AnalysisView analysis={open} onClose={() => { setParams({}) }} />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Quiver</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              Point-and-click analysis over the ontology. Every card takes typed inputs and
              produces one typed output, so the cards that can follow a card are the ones
              whose input type it satisfies.
            </p>
          </div>
          <NewAnalysisButton />
        </header>

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : analyses.length === 0 ? (
          <NonIdealState icon="chart" title="No analyses yet"
            description="An analysis lives in a project and inherits its access. Start one, add an object set, and chain cards off it." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {analyses.map((a) => (
              <Card key={a.id} interactive compact onClick={() => { setParams({ a: a.id }) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="chart" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{a.name}</span>
                  {a.analysisType !== 'quiver' && (
                    <Tag minimal className="!text-[9px]">{a.analysisType.replace(/_/g, ' ')}</Tag>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{a.rid}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewAnalysisButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState('quiver')
  const [project, setProject] = useState('')
  const { data: projects = [] } = useProjects()
  const create = useCreateAnalysis()

  return (
    <>
      <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setOpen(true) }}>
        New analysis
      </Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New analysis">
        <DialogBody>
          <div className="space-y-3">
            <InputGroup placeholder="Analysis name" value={name}
              onChange={(e) => { setName(e.target.value) }} />
            <HTMLSelect fill value={project} onChange={(e) => { setProject(e.target.value) }}>
              <option value="">Choose a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </HTMLSelect>
            {/* the three quiver/analysis-types names, in that page's order */}
            <HTMLSelect fill value={type} onChange={(e) => { setType(e.target.value) }}>
              <option value="quiver">Quiver analysis — all data, dashboards</option>
              <option value="time_series">Time series analysis — time series only</option>
              <option value="object_set_path">Object set path analysis — objects only</option>
            </HTMLSelect>
            <Button intent={Intent.PRIMARY} disabled={name === '' || project === ''}
              loading={create.isPending}
              onClick={() => {
                create.mutate({ projectId: project, name, analysisType: type },
                  { onSuccess: () => { setOpen(false); setName('') } })
              }}>
              Create
            </Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

function AnalysisView({ analysis, onClose }: { analysis: Analysis; onClose: () => void }) {
  const { data, isLoading } = useAnalysisContents(analysis.id)
  const { data: kinds = [] } = useCardKinds()
  const { data: unused = [] } = useUnusedCards(analysis.id)
  const [mode, setMode] = useState<'canvas' | 'graph'>('canvas')
  const [canvasId, setCanvasId] = useState<string | null>(null)
  const [addFrom, setAddFrom] = useState<QCard | null | undefined>(undefined)
  const [selected, setSelected] = useState<QCard | null>(null)
  const save = useSaveAnalysis(analysis.id)
  const addCanvas = useAddCanvas(analysis.id)

  const contents: AnalysisContents = data ?? { canvases: [], cards: [], inputs: [], placements: [] }
  const canvas = contents.canvases.find((c) => c.id === canvasId) ?? contents.canvases.at(0) ?? null

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner size={SpinnerSize.SMALL} />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* the capture's top bar: breadcrumb, add data / add card, view toggle */}
      <div className="qv-topbar">
        <Button variant="minimal" size="small" icon="chevron-left" onClick={onClose} />
        <span className="text-sm font-semibold truncate">{analysis.name}</span>
        <Tag minimal className="!text-[9px]">{contents.cards.length} cards</Tag>
        <div className="qv-topbar-sep" />
        <span className="qv-eyebrow">Add card</span>
        <Button variant="minimal" size="small" icon="search" onClick={() => { setAddFrom(null) }}>
          Search cards
        </Button>
        <div className="qv-spacer" />
        <ButtonGroup>
          <Button size="small" active={mode === 'canvas'} icon="control"
            onClick={() => { setMode('canvas') }}>Canvas</Button>
          <Button size="small" active={mode === 'graph'} icon="graph"
            onClick={() => { setMode('graph') }}>Graph</Button>
        </ButtonGroup>
        <Button size="small" icon="floppy-disk" intent={Intent.PRIMARY} loading={save.isPending}
          onClick={() => { save.mutate() }}>Save</Button>
      </div>

      <div className="qv-body">
        <ContentsPanel contents={contents} kinds={kinds} unused={unused.length}
          selected={selected} onSelect={setSelected}
          onNewCanvas={() => {
            addCanvas.mutate({ name: `Canvas ${String(contents.canvases.length + 1)}`,
              position: contents.canvases.length })
          }} />

        <div className="qv-main">
          {mode === 'canvas' ? (
            <CanvasView analysis={analysis} contents={contents} kinds={kinds}
              canvasId={canvas?.id ?? null} onNext={setAddFrom} />
          ) : (
            <GraphView contents={contents} kinds={kinds}
              selected={selected} onSelect={setSelected} />
          )}
          {mode === 'canvas' && contents.canvases.length > 0 && (
            <div className="qv-tabs">
              {contents.canvases.map((c) => (
                <Button key={c.id} variant="minimal" size="small" active={c.id === canvas?.id}
                  onClick={() => { setCanvasId(c.id) }}>{c.name}</Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {addFrom !== undefined && (
        <CardSearch analysis={analysis} from={addFrom} kinds={kinds}
          canvasId={canvas?.id ?? null} onClose={() => { setAddFrom(undefined) }} />
      )}
    </div>
  )
}

/** ANALYSIS CONTENTS: cards grouped by canvas, then the ones on none —
 *  "The card will appear in the Not in canvas section of the Analysis
 *  Contents panel" (quiver/analysis-canvas). */
function ContentsPanel({ contents, kinds, unused, selected, onSelect, onNewCanvas }: {
  contents: AnalysisContents; kinds: CardKind[]; unused: number
  selected: QCard | null; onSelect: (c: QCard) => void; onNewCanvas: () => void
}) {
  const placedIn = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const p of contents.placements) {
      const list = m.get(p.canvasId) ?? []
      list.push(p.cardId)
      m.set(p.canvasId, list)
    }
    return m
  }, [contents.placements])
  const placedAnywhere = new Set(contents.placements.map((p) => p.cardId))
  const loose = contents.cards.filter((c) => !placedAnywhere.has(c.id))

  return (
    <div className="qv-contents">
      <div className="qv-contents-head">
        <span className="qv-eyebrow">Analysis contents</span>
        <Button variant="minimal" size="small" icon="plus" onClick={onNewCanvas} title="New canvas" />
      </div>
      <div className="qv-contents-list">
        {contents.canvases.map((cv) => (
          <div key={cv.id}>
            <div className="qv-group">{cv.name}</div>
            {(placedIn.get(cv.id) ?? []).map((id) => {
              const card = contents.cards.find((c) => c.id === id)
              return card === undefined ? null : (
                <CardRow key={id} card={card} kinds={kinds}
                  active={selected?.id === id} onClick={() => { onSelect(card) }} />
              )
            })}
          </div>
        ))}
        {loose.length > 0 && (
          <div>
            <div className="qv-group">Not in canvas</div>
            {loose.map((c) => (
              <CardRow key={c.id} card={c} kinds={kinds}
                active={selected?.id === c.id} onClick={() => { onSelect(c) }} />
            ))}
          </div>
        )}
      </div>
      {unused > 0 && (
        <div className="qv-contents-foot">
          {/* the page's button, and its exact three-part meaning */}
          <Tag minimal intent={Intent.WARNING} className="!text-[9px]">{unused} unused card(s)</Tag>
          <p className="text-[11px] text-muted-foreground mt-1">
            On no canvas, depended on by nothing on a canvas, and referenced by no dashboard.
          </p>
        </div>
      )}
    </div>
  )
}

function CardRow({ card, kinds, active, onClick }: {
  card: QCard; kinds: CardKind[]; active: boolean; onClick: () => void
}) {
  const out = outputTypeOf(card, kinds)
  const k = kinds.find((x) => x.kind === card.kind)
  return (
    <button type="button" className={active ? 'qv-row qv-row-active' : 'qv-row'} onClick={onClick}>
      <span className="qv-id">{card.globalId}</span>
      <span className="qv-row-title">{card.title === '' ? (k?.title ?? card.kind) : card.title}</span>
      {out !== null && <span className="qv-type">{out}</span>}
    </button>
  )
}

function CanvasView({ analysis, contents, kinds, canvasId, onNext }: {
  analysis: Analysis; contents: AnalysisContents; kinds: CardKind[]
  canvasId: string | null; onNext: (c: QCard) => void
}) {
  const del = useDeleteCard(analysis.id)
  const place = usePlaceCard(analysis.id)
  const [confirm, setConfirm] = useState<QCard | null>(null)
  const ids = new Set(contents.placements.filter((p) => p.canvasId === canvasId).map((p) => p.cardId))
  const shown = contents.cards.filter((c) => ids.has(c.id))
  const loose = contents.cards.filter((c) => !contents.placements.some((p) => p.cardId === c.id))

  if (shown.length === 0) {
    return (
      <div className="qv-canvas">
        <NonIdealState icon="chart" title="Visualize, Analyze, & Transform Data"
          description="Perform high-scale objects analysis, including dynamic visualizations, time series analyses, and interactive investigations. Get started by adding data."
          action={<Button icon="plus" intent={Intent.PRIMARY}
            onClick={() => { onNext({ id: '', globalId: '', kind: '', title: '', outputType: null }) }}>
            Add data to analysis
          </Button>} />
        {loose.length > 0 && (
          <Callout compact intent={Intent.NONE} className="mt-4">
            {loose.length} card(s) are in this analysis but on no canvas.
            {' '}
            {canvasId !== null && (
              <Button variant="minimal" size="small" onClick={() => {
                for (const c of loose) place.mutate({ canvasId, cardId: c.id })
              }}>Add them to this canvas</Button>
            )}
          </Callout>
        )}
      </div>
    )
  }

  return (
    <div className="qv-canvas">
      <div className="qv-cards">
        {shown.map((card) => {
          const out = outputTypeOf(card, kinds)
          const k = kinds.find((x) => x.kind === card.kind)
          const feeds = contents.inputs.filter((i) => i.cardId === card.id)
          return (
            <Card key={card.id} compact className="qv-card">
              <div className="qv-card-head">
                <span className="qv-id">{card.globalId}</span>
                <span className="text-sm font-semibold truncate">
                  {card.title === '' ? (k?.title ?? card.kind) : card.title}
                </span>
                {out !== null && <span className="qv-type">{out}</span>}
                <div className="qv-spacer" />
                <Button variant="minimal" size="small" icon="arrow-right" title="Next actions"
                  onClick={() => { onNext(card) }} />
                <Button variant="minimal" size="small" icon="cross" title="Delete"
                  onClick={() => { setConfirm(card) }} />
              </div>
              <div className="qv-card-body">
                <span className="text-[11px] text-muted-foreground font-mono">{card.kind}</span>
                {feeds.length > 0 && (
                  <div className="qv-inputs">
                    {feeds.map((f) => {
                      const src = contents.cards.find((c) => c.id === f.inputCardId)
                      return <span key={f.id} className="qv-id">{src?.globalId ?? '?'}</span>
                    })}
                    <span className="text-[11px] text-muted-foreground">in</span>
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* the page's two options, in its own words */}
      <Dialog isOpen={confirm !== null} onClose={() => { setConfirm(null) }} title="Delete card">
        <DialogBody>
          <div className="space-y-2">
            <Button fill alignText="left" icon="trash" intent={Intent.DANGER}
              onClick={() => {
                if (confirm !== null) del.mutate({ cardId: confirm.id, mode: 'delete' })
                setConfirm(null)
              }}>
              Delete and remove from downstream cards
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Removes the card from the analysis entirely. Any cards that use it as an input
              will have that input configuration set to empty.
            </p>
            <Button fill alignText="left" icon="eye-off"
              onClick={() => {
                if (confirm !== null) del.mutate({ cardId: confirm.id, mode: 'remove_from_canvas' })
                setConfirm(null)
              }}>
              Remove from canvas
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Keeps the card in the analysis and keeps dependent cards unchanged.
            </p>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  )
}

/** Graph mode: "cards are represented as nodes on a graph, and inputs and
 *  outputs are represented by links. The graph uses a left-to-right layout"
 *  (quiver/analysis-graph). Depth is the longest path from a root. */
function GraphView({ contents, kinds, selected, onSelect }: {
  contents: AnalysisContents; kinds: CardKind[]
  selected: QCard | null; onSelect: (c: QCard) => void
}) {
  const columns = useMemo(() => {
    const depth = new Map<string, number>()
    const inputsOf = (id: string) => contents.inputs.filter((i) => i.cardId === id)
    const walk = (id: string, seen: Set<string>): number => {
      const known = depth.get(id)
      if (known !== undefined) return known
      if (seen.has(id)) return 0
      seen.add(id)
      const ins = inputsOf(id)
      const d = ins.length === 0 ? 0 : Math.max(...ins.map((i) => walk(i.inputCardId, seen) + 1))
      depth.set(id, d)
      return d
    }
    for (const c of contents.cards) walk(c.id, new Set())
    const cols: QCard[][] = []
    for (const c of contents.cards) {
      const d = depth.get(c.id) ?? 0
      while (cols.length <= d) cols.push([])
      cols[d].push(c)
    }
    return cols
  }, [contents])

  if (contents.cards.length === 0) {
    return <div className="qv-canvas"><NonIdealState icon="graph" title="Nothing to draw yet" /></div>
  }

  return (
    <div className="qv-graph">
      {columns.map((col, i) => (
        <div key={i} className="qv-graph-col">
          {col.map((card) => {
            const out = outputTypeOf(card, kinds)
            const k = kinds.find((x) => x.kind === card.kind)
            const feeds = contents.inputs.filter((x) => x.cardId === card.id)
            return (
              <button type="button" key={card.id}
                className={selected?.id === card.id ? 'qv-node qv-node-active' : 'qv-node'}
                onClick={() => { onSelect(card) }}>
                <span className="qv-id qv-id-lg">{card.globalId}</span>
                <span className="qv-node-body">
                  <span className="text-sm font-semibold truncate">
                    {card.title === '' ? (k?.title ?? card.kind) : card.title}
                  </span>
                  <span className="qv-node-meta">
                    {out !== null && <span className="qv-type">{out}</span>}
                    {feeds.length > 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        ← {feeds.map((f) => contents.cards
                          .find((c) => c.id === f.inputCardId)?.globalId ?? '?').join(' ')}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** The next actions menu and the cards search window are the same list with
 *  a different filter: from a card, only kinds that accept its output type;
 *  from the toolbar, every kind. */
function CardSearch({ analysis, from, kinds, canvasId, onClose }: {
  analysis: Analysis; from: QCard | null; kinds: CardKind[]
  canvasId: string | null; onClose: () => void
}) {
  const [q, setQ] = useState('')
  const add = useAddCard(analysis.id)
  const fromType = from !== null && from.id !== '' ? outputTypeOf(from, kinds) : null
  const scoped = from !== null && from.id !== ''

  const list = useMemo(() => {
    const base = scoped ? kindsAccepting(fromType, kinds) : kinds
    const needle = q.trim().toLowerCase()
    const matched = needle === '' ? base
      : base.filter((k) => k.title.toLowerCase().includes(needle)
        || k.kind.toLowerCase().includes(needle))
    // built first, then alphabetical — an unbuilt kind is still listed
    return [...matched].sort((a, b) =>
      a.built === b.built ? a.title.localeCompare(b.title) : (a.built ? -1 : 1))
  }, [kinds, q, scoped, fromType])

  return (
    <Dialog isOpen onClose={onClose} title={scoped ? 'Next actions' : 'Search cards'}
      className="qv-search">
      <DialogBody>
        {scoped && (
          <Callout compact icon="flow-linear" className="mb-2">
            Showing cards that accept <strong>{fromType ?? 'no input'}</strong> — the output
            type of {from.globalId}. A card can only be added as an input if
            the types match.
          </Callout>
        )}
        <InputGroup autoFocus leftIcon="search" placeholder="Search cards by title or functionality"
          value={q} onChange={(e) => { setQ(e.target.value) }} />
        <div className="qv-search-list">
          {list.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">No card takes that type as input.</p>
          )}
          {list.map((k) => (
            <button type="button" key={k.kind}
              className={k.built ? 'qv-kind' : 'qv-kind qv-kind-off'}
              disabled={!k.built}
              onClick={() => {
                add.mutate({
                  kind: k.kind,
                  title: k.title,
                  outputType: k.output_types.length === 1 ? null : (k.output_types.at(0) ?? null),
                  inputCardId: scoped ? from.id : undefined,
                  canvasId: canvasId ?? undefined,
                }, { onSuccess: onClose })
              }}>
              <span className="qv-kind-title">{k.title}</span>
              <span className="qv-sig">
                {k.input_types.join(', ') || '—'}
                <Icon icon="arrow-right" size={10} />
                {k.output_types.join(', ') || '—'}
              </span>
              {!k.built && <Tag minimal className="!text-[9px]">not built</Tag>}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {kinds.filter((k) => k.built).length} of {kinds.length} documented cards are built here.
          The rest are listed so they refuse by name rather than being missing.
        </p>
      </DialogBody>
    </Dialog>
  )
}
