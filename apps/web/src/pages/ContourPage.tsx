// Contour — the analysis workspace, to the capture's anatomy: a tab bar with
// one tab per path, the path as a vertical flow of boards joined by arrows,
// the six-category toolbar at the bottom, and the Parameters rail on the
// left (contour/images/overview.png, boards-category-mode.png).

import { useMemo, useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup,
  Intent, NonIdealState, Spinner, SpinnerSize, Switch, Tag,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import { useDatasets } from '@/features/datasets/api'
import {
  useAnalyses, useAnalysisContents, useBoardKinds, useCreateAnalysis,
  useAddPath, useAddBoard, useUpdateBoard, useRemoveBoard, useAddParameter,
  useRefreshPath, useSaveAsDataset,
  type Analysis, type AnalysisContents, type Board, type BoardKind, type Path,
} from '@/features/contour/api'

// the toolbar's six categories, in the capture's order — display grouping
// over the catalogue's five capability flags (boards-category-mode.png)
const TOOLBAR: { label: string; pick: (k: BoardKind) => boolean }[] = [
  { label: 'Suggested', pick: (k) => ['filter', 'expression', 'histogram', 'table'].includes(k.kind) },
  { label: 'Filter', pick: (k) => k.filter_rows },
  { label: 'Visualize', pick: (k) => k.visualize },
  { label: 'Join', pick: (k) => ['enrich', 'link', 'set_math', 'join'].includes(k.kind) },
  { label: 'Transform', pick: (k) => k.manipulate_columns },
  { label: 'Edit Columns', pick: (k) => ['edit_columns', 'column_editor', 'multi_column_editor', 'reorder_columns'].includes(k.kind) },
]

export default function ContourPage() {
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
            <h1 className="text-xl font-semibold">Contour</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              Point-and-click analysis on tables at scale. Boards flow down each path, and a
              saved path is a job specification the build system recomputes.
            </p>
          </div>
          <NewAnalysisButton />
        </header>
        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : analyses.length === 0 ? (
          <NonIdealState icon="route" title="No analyses yet"
            description="An analysis holds one or more analytical paths. Each path begins with a dataset and flows down through boards." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {analyses.map((a) => (
              <Card key={a.id} interactive compact onClick={() => { setParams({ a: a.id }) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="route" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{a.name}</span>
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
  const [project, setProject] = useState('')
  const { data: projects = [] } = useProjects()
  const create = useCreateAnalysis()
  return (
    <>
      <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setOpen(true) }}>New analysis</Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New analysis">
        <DialogBody>
          <div className="space-y-3">
            <InputGroup placeholder="Analysis name" value={name}
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
    </>
  )
}

function AnalysisView({ analysis, onClose }: { analysis: Analysis; onClose: () => void }) {
  const { data, isLoading } = useAnalysisContents(analysis.id)
  const { data: kinds = [] } = useBoardKinds()
  const [pathId, setPathId] = useState<string | null>(null)
  const [addingPath, setAddingPath] = useState(false)
  const contents: AnalysisContents = data ?? { paths: [], boards: [], parameters: [] }
  const path = contents.paths.find((p) => p.id === pathId) ?? contents.paths.at(0) ?? null

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="ct-topbar">
        <Button variant="minimal" size="small" icon="chevron-left" onClick={onClose} />
        <span className="text-sm font-semibold truncate">{analysis.name}</span>
        <div className="ct-spacer" />
        <Button size="small" icon="grid-view">Dashboard</Button>
      </div>

      {/* one tab per path, plus + (the capture's tab bar) */}
      <div className="ct-tabs">
        {contents.paths.map((p) => (
          <Button key={p.id} variant="minimal" size="small" active={p.id === path?.id}
            onClick={() => { setPathId(p.id) }}>{p.name}</Button>
        ))}
        <Button variant="minimal" size="small" icon="plus" onClick={() => { setAddingPath(true) }} />
      </div>

      <div className="ct-body">
        <ParametersRail analysis={analysis} parameters={contents.parameters} />
        {path === null ? (
          <div className="ct-canvas">
            <NonIdealState icon="route" title="Create a new path"
              description="Each path begins with a dataset. Add one with the + above."
              action={<Button icon="plus" intent={Intent.PRIMARY}
                onClick={() => { setAddingPath(true) }}>Create a new path</Button>} />
          </div>
        ) : (
          <PathView analysis={analysis} path={path} contents={contents} kinds={kinds} />
        )}
      </div>

      {addingPath && (
        <NewPathDialog analysis={analysis} paths={contents.paths}
          onClose={() => { setAddingPath(false) }} />
      )}
    </div>
  )
}

function ParametersRail({ analysis, parameters }: {
  analysis: Analysis; parameters: AnalysisContents['parameters']
}) {
  const add = useAddParameter(analysis.id)
  const [name, setName] = useState('')
  const [type, setType] = useState('String')
  const [dflt, setDflt] = useState('')
  return (
    <aside className="ct-params">
      <div className="ct-params-head">Parameters</div>
      <p className="text-[11px] text-muted-foreground px-3">
        Use parameters in filters and expressions by typing &quot;$&quot;. Filtering will be
        ignored when no value is set for a parameter.
      </p>
      <div className="ct-params-list">
        {parameters.map((p) => (
          <div key={p.id} className="ct-param">
            <Tag minimal className="!text-[9px]">{p.paramType === 'Number' ? '#' : p.paramType === 'Date' ? '📅' : 'ab'}</Tag>
            <span className="ct-param-name">${p.name}</span>
            <span className="text-[11px] text-muted-foreground truncate">
              {p.defaultValue === null ? 'no value' : JSON.stringify(p.defaultValue)}
            </span>
          </div>
        ))}
      </div>
      <div className="ct-params-foot">
        <InputGroup size="small" placeholder="Name" value={name}
          onChange={(e) => { setName(e.target.value) }} />
        <HTMLSelect value={type} onChange={(e) => { setType(e.target.value) }}>
          <option>String</option><option>Number</option><option>Date</option>
        </HTMLSelect>
        <InputGroup size="small" placeholder="Default (optional)" value={dflt}
          onChange={(e) => { setDflt(e.target.value) }} />
        <Button size="small" icon="plus" disabled={name === ''} loading={add.isPending}
          onClick={() => {
            const v = dflt === '' ? null
              : type === 'Number' ? Number(dflt) : dflt
            add.mutate({ name, paramType: type, multiValue: false, defaultValue: v },
              { onSuccess: () => { setName(''); setDflt('') } })
          }}>Create parameter</Button>
      </div>
    </aside>
  )
}

function PathView({ analysis, path, contents, kinds }: {
  analysis: Analysis; path: Path; contents: AnalysisContents; kinds: BoardKind[]
}) {
  const boards = useMemo(
    () => contents.boards.filter((b) => b.pathId === path.id),
    [contents.boards, path.id])
  const { data: datasets = [] } = useDatasets()
  const refresh = useRefreshPath(analysis.id)
  const save = useSaveAsDataset()
  const [saveOpen, setSaveOpen] = useState(false)
  const [outId, setOutId] = useState('')
  const headDataset = datasets.find((d) => d.id === path.headDatasetId)
  const headPath = contents.paths.find((p) => p.id === path.headPathId)

  return (
    <div className="ct-canvas">
      <div className="ct-flow">
        {/* the path head: input, branch chip, version pin, Change (capture) */}
        <Card compact className="ct-head">
          <Icon icon={path.headDatasetId !== null ? 'th' : 'route'} size={14} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">
              {headDataset?.name ?? headPath?.name ?? 'Restricted view'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {path.headDatasetId !== null ? 'dataset' : path.headPathId !== null ? 'result of a path' : 'restricted view — cannot be saved as a dataset'}
              {' · '}<Tag minimal className="!text-[9px]">master</Tag>
              {path.pinnedTransactionId !== null && <> · pinned</>}
            </p>
          </div>
          <Button size="small" variant="minimal" icon="refresh" loading={refresh.isPending}
            title="Refresh — there is no automatic update"
            onClick={() => { refresh.mutate(path.id) }} />
        </Card>

        {boards.map((b) => (
          <BoardCard key={b.id} analysis={analysis} board={b} kinds={kinds} />
        ))}

        <BoardToolbar analysis={analysis} path={path} kinds={kinds} nextPosition={boards.length} />

        <div className="ct-save">
          <Button icon="floppy-disk" intent={Intent.PRIMARY}
            disabled={path.headRestrictedViewId !== null}
            onClick={() => { setSaveOpen(true) }}>
            Save as Dataset
          </Button>
        </div>
      </div>

      <Dialog isOpen={saveOpen} onClose={() => { setSaveOpen(false) }} title="Save as Dataset">
        <DialogBody>
          <div className="space-y-3">
            <Callout compact>
              The path compiles to a dataset job specification, and the build runs it. All
              datasets built in Contour always use the latest versions of the input datasets.
            </Callout>
            <HTMLSelect fill value={outId} onChange={(e) => { setOutId(e.target.value) }}>
              <option value="">Output dataset…</option>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </HTMLSelect>
            <Button intent={Intent.PRIMARY} disabled={outId === ''} loading={save.isPending}
              onClick={() => {
                save.mutate({ pathId: path.id, outputDatasetId: outId },
                  { onSuccess: () => { setSaveOpen(false) } })
              }}>Save</Button>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  )
}

/** A configuration value as display text — jsonb fields arrive unknown. */
const cfgText = (v: unknown, fallback = ''): string =>
  v === undefined || v === null ? fallback
    : typeof v === 'string' ? v : JSON.stringify(v)

const BOARD_ICONS: Record<string, string> = {
  summary: 'numerical', filter: 'filter', expression: 'function',
  table: 'th', histogram: 'timeline-bar-chart',
}

function BoardCard({ analysis, board, kinds }: {
  analysis: Analysis; board: Board; kinds: BoardKind[]
}) {
  const update = useUpdateBoard(analysis.id)
  const remove = useRemoveBoard(analysis.id)
  const k = kinds.find((x) => x.kind === board.kind)
  const c = board.configuration
  const summary = board.kind === 'filter'
    ? `${cfgText(c.mode, 'keep')} rows where ${cfgText(c.column, '?')} ${cfgText(c.op, '=')} ${c.parameter !== undefined ? '$' + cfgText(c.parameter) : JSON.stringify(c.value)}`
    : board.kind === 'expression'
      ? `${c.new_column !== undefined ? cfgText(c.new_column) + ' = ' : 'where '}${cfgText(c.expression)}`
      : board.kind === 'histogram'
        ? `by ${cfgText(c.bucket_column, '?')}${board.pivoted ? ' — pivoted: boards below use the aggregate' : ''}`
        : (k?.description ?? '')

  return (
    <>
      <div className="ct-arrow"><Icon icon="arrow-down" size={12} /></div>
      <Card compact className={board.enabled ? 'ct-board' : 'ct-board ct-board-off'}>
        <div className="ct-board-head">
          <Icon icon={(BOARD_ICONS[board.kind] ?? 'widget') as never} size={13} />
          <span className="ct-board-kind">{board.title === '' ? board.kind.replace(/_/g, ' ').toUpperCase() : board.title}</span>
          <span className="text-[11px] text-muted-foreground truncate flex-1">{summary}</span>
          <Switch checked={board.enabled} className="ct-board-switch"
            title="Disabled boards stay visible but are not applied"
            onChange={() => { update.mutate({ boardId: board.id, patch: { enabled: !board.enabled } }) }} />
          <Button variant="minimal" size="small" icon="cross"
            onClick={() => { remove.mutate(board.id) }} />
        </div>
      </Card>
    </>
  )
}

/** The six-category toolbar at the bottom of the path (the capture's order).
 *  Unbuilt kinds stay listed and refuse by name. */
function BoardToolbar({ analysis, path, kinds, nextPosition }: {
  analysis: Analysis; path: Path; kinds: BoardKind[]; nextPosition: number
}) {
  const add = useAddBoard(analysis.id)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const [configuring, setConfiguring] = useState<BoardKind | null>(null)
  const [cfg, setCfg] = useState<Partial<Record<string, string>>>({})

  const startAdd = (k: BoardKind) => {
    setOpenCat(null)
    if (k.kind === 'summary' || k.kind === 'table') {
      add.mutate({ pathId: path.id, position: nextPosition, kind: k.kind, configuration: {} })
    } else {
      setCfg({}); setConfiguring(k)
    }
  }

  return (
    <>
      <div className="ct-arrow"><Icon icon="arrow-down" size={12} /></div>
      <div className="ct-toolbar">
        {TOOLBAR.map((cat) => (
          <div key={cat.label} className="ct-toolbar-cat">
            <Button variant="minimal" size="small" endIcon="caret-down"
              active={openCat === cat.label}
              onClick={() => { setOpenCat(openCat === cat.label ? null : cat.label) }}>
              {cat.label}
            </Button>
            {openCat === cat.label && (
              <div className="ct-toolbar-menu">
                {kinds.filter(cat.pick).map((k) => (
                  <button type="button" key={k.kind} disabled={!k.built}
                    className={k.built ? 'ct-menu-item' : 'ct-menu-item ct-menu-item-off'}
                    onClick={() => { startAdd(k) }}>
                    <span className="text-sm font-semibold">{k.kind.replace(/_/g, ' ')}</span>
                    <span className="text-[11px] text-muted-foreground">{k.description}</span>
                    {!k.built && <Tag minimal className="!text-[9px]">not built</Tag>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog isOpen={configuring !== null} onClose={() => { setConfiguring(null) }}
        title={`Add ${configuring?.kind.replace(/_/g, ' ') ?? ''} board`}>
        <DialogBody>
          <div className="space-y-3">
            {configuring?.kind === 'filter' && (
              <>
                <HTMLSelect fill value={cfg.mode ?? 'keep'}
                  onChange={(e) => { setCfg({ ...cfg, mode: e.target.value }) }}>
                  <option value="keep">Keep rows</option>
                  <option value="remove">Remove rows</option>
                </HTMLSelect>
                <InputGroup placeholder="Column" value={cfg.column ?? ''}
                  onChange={(e) => { setCfg({ ...cfg, column: e.target.value }) }} />
                <HTMLSelect fill value={cfg.op ?? '='}
                  onChange={(e) => { setCfg({ ...cfg, op: e.target.value }) }}>
                  {['=', '<>', '>', '>=', '<', '<='].map((o) => <option key={o}>{o}</option>)}
                </HTMLSelect>
                <InputGroup placeholder="Value, or $parameter" value={cfg.value ?? ''}
                  onChange={(e) => { setCfg({ ...cfg, value: e.target.value }) }} />
              </>
            )}
            {configuring?.kind === 'expression' && (
              <>
                <InputGroup placeholder="New column name (empty = filter)" value={cfg.new_column ?? ''}
                  onChange={(e) => { setCfg({ ...cfg, new_column: e.target.value }) }} />
                <InputGroup placeholder="Expression (Postgres SQL — the recorded divergence)"
                  value={cfg.expression ?? ''}
                  onChange={(e) => { setCfg({ ...cfg, expression: e.target.value }) }} />
              </>
            )}
            {configuring?.kind === 'histogram' && (
              <InputGroup placeholder="Bucket column" value={cfg.bucket_column ?? ''}
                onChange={(e) => { setCfg({ ...cfg, bucket_column: e.target.value }) }} />
            )}
            <Button intent={Intent.PRIMARY} loading={add.isPending}
              onClick={() => {
                const conf: Record<string, unknown> = {}
                if (configuring?.kind === 'filter') {
                  conf.mode = cfg.mode ?? 'keep'
                  conf.column = cfg.column ?? ''
                  conf.op = cfg.op ?? '='
                  const v = cfg.value ?? ''
                  if (v.startsWith('$')) conf.parameter = v.slice(1)
                  else conf.value = Number.isNaN(Number(v)) || v === '' ? v : Number(v)
                } else if (configuring?.kind === 'expression') {
                  conf.expression = cfg.expression ?? ''
                  if ((cfg.new_column ?? '') !== '') conf.new_column = cfg.new_column
                } else if (configuring?.kind === 'histogram') {
                  conf.bucket_column = cfg.bucket_column ?? ''
                }
                if (configuring !== null) {
                  add.mutate({ pathId: path.id, position: nextPosition,
                    kind: configuring.kind, configuration: conf },
                  { onSuccess: () => { setConfiguring(null) } })
                }
              }}>Add board</Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

function NewPathDialog({ analysis, paths, onClose }: {
  analysis: Analysis; paths: Path[]; onClose: () => void
}) {
  const add = useAddPath(analysis.id)
  const { data: datasets = [] } = useDatasets()
  const [name, setName] = useState('New path')
  const [headKind, setHeadKind] = useState<'dataset' | 'path'>('dataset')
  const [headId, setHeadId] = useState('')
  return (
    <Dialog isOpen onClose={onClose} title="Create a new path">
      <DialogBody>
        <div className="space-y-3">
          <InputGroup placeholder="Path name" value={name}
            onChange={(e) => { setName(e.target.value) }} />
          {/* the two documented starting points */}
          <HTMLSelect fill value={headKind}
            onChange={(e) => { setHeadKind(e.target.value as 'dataset' | 'path'); setHeadId('') }}>
            <option value="dataset">A dataset saved on the platform</option>
            <option value="path">Results from a path in this analysis</option>
          </HTMLSelect>
          <HTMLSelect fill value={headId} onChange={(e) => { setHeadId(e.target.value) }}>
            <option value="">Choose…</option>
            {headKind === 'dataset'
              ? datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)
              : paths.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </HTMLSelect>
          <Button intent={Intent.PRIMARY} disabled={headId === ''} loading={add.isPending}
            onClick={() => {
              add.mutate({
                name, position: paths.length,
                headDatasetId: headKind === 'dataset' ? headId : undefined,
                headPathId: headKind === 'path' ? headId : undefined,
              }, { onSuccess: onClose })
            }}>Create path</Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}
