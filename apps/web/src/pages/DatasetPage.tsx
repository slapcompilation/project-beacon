// The dataset view — Dataset Preview's screen, built to its annotated capture.
//
// dataset-preview/overview.md numbers five regions and explains each; the
// reading (readings/dataset-preview.md) walks them off dataset.png. Header with
// the breadcrumb and the branch chip; the information panel on the left with
// About | Columns | Schedules; the tab row with the action bar on its right;
// and the tab's content, which for Preview is the table.
//
// Tabs with no engine are not rendered — Compare, Time Travel, Snapshots,
// Maintenance — because a tab that renders an empty shell reads as a built
// feature. The same for SQL preview, Pin/Encrypt column, charts, Tags, the
// File/Help menus and the header's three-count pill (its meaning is question 1
// of the reading). Each is a named gap in docs/SURFACE-BUILD-MAP.md.

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Icon, InputGroup, Intent, Menu, MenuDivider, MenuItem, NonIdealState, Popover,
  Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import {
  describeField, TRANSACTION_TYPES, TRANSACTION_STATUSES,
  MARKING_KINDS, MARKING_KIND_META, MARKING_ORIGIN_META, ACCESS_LEVEL_META, accessLevel,
  type DatasetField, type TransactionStatus,
} from '@beacon/ontology'
import {
  datasetLocation, useBackingObjectTypes, useBranches, useBranchSchema, useColumnStats,
  useDataset, useDatasetJobs, useDatasetMarkings, usePreview, usePreviewCount,
  useSettleTransaction, useTransactions, useUploadFile, useView,
  type Branch, type Dataset, type DatasetJob, type PreviewQuery, type Transaction,
} from '@/features/datasets/api'
import {
  duration, filterLabel, formatCell, formatSeconds, isNumeric, medianDurationSeconds,
  summaryBucket, type Json, type PreviewFilter, type SummaryBucket,
} from '@/features/datasets/preview'
import { UploadCard } from '@/features/datasets/UploadCard'
import { relativeTime } from '@/features/notifications/format'
import { useJobSpec, useRunBuild, useSchedules } from '@/features/builds/api'
import { TransformCard } from '@/features/builds/TransformCard'
import { useUsers } from '@/features/users/api'
import { HealthPanel } from '@/features/dataHealth/HealthPanel'
import { CheckAccessPanel } from '@/features/security/CheckAccessPanel'
import { CreateRestrictedViewDialog } from '@/features/restrictedViews/CreateRestrictedViewDialog'

const TYPE_META = new Map(TRANSACTION_TYPES.map((t) => [t.value, t]))
const STATUS_META = new Map(TRANSACTION_STATUSES.map((t) => [t.value, t]))
const STATUS_INTENT: Record<TransactionStatus, Intent> = {
  OPEN: Intent.WARNING, COMMITTED: Intent.SUCCESS, ABORTED: Intent.DANGER,
}

type TabId = 'preview' | 'history' | 'details' | 'health'
const TABS: { id: TabId; label: string; beta?: boolean }[] = [
  { id: 'preview', label: 'Preview' }, { id: 'history', label: 'History' },
  { id: 'details', label: 'Details' }, { id: 'health', label: 'Health', beta: true },
]
type SideId = 'about' | 'columns' | 'schedules'

// "Jun 28, 2025, 11:49 PM" — the About panel's form.
const when = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function DatasetPage() {
  const { id } = useParams<{ id: string }>()
  const { data: dataset, isLoading } = useDataset(id ?? null)
  if (isLoading) {
    return <div className="flex items-center gap-2 px-8 py-6 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} />Loading…</div>
  }
  if (!dataset) {
    return <NonIdealState icon="th" title="No such dataset" description="It may live in a project you cannot see." />
  }
  return <DatasetView dataset={dataset} />
}

function DatasetView({ dataset }: { dataset: Dataset }) {
  const navigate = useNavigate()
  const { data: branches = [] } = useBranches(dataset.id)
  const [branchId, setBranchId] = useState<string | null>(null)
  const branch: Branch | null = branches.find((b) => b.id === branchId) ?? branches.at(0) ?? null
  const { data: fields } = useBranchSchema(branch?.id ?? null)
  const { data: files = [] } = useView(branch?.id ?? null)
  const { data: transactions = [] } = useTransactions(dataset.id)
  const { data: jobs = [] } = useDatasetJobs(dataset.id)
  const [tab, setTab] = useState<TabId>('preview')
  const [side, setSide] = useState<SideId>('about')
  const [statsColumn, setStatsColumn] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [creatingRv, setCreatingRv] = useState(false)
  const runBuild = useRunBuild()

  const columns = (fields ?? []).map((f) => f.name).filter((n): n is string => n !== undefined)
  const rows = files.reduce((n, f) => n + f.rowCount, 0)

  return (
    <div className="dsv">
      {/* 1. Dataset header: name, location, the selected branch. */}
      <header className="dsv-header">
        <Icon icon="th" size={16} className="text-violet-500" />
        <nav className="dsv-crumbs" aria-label="Location">
          <Link to="/projects" className="crumb">{dataset.spacePath || 'Spaces'}</Link>
          <span className="crumb-sep">›</span>
          <Link to="/projects" className="crumb">{dataset.projectName}</Link>
          <span className="crumb-sep">›</span>
          <span className="crumb-self">{dataset.name}</span>
        </nav>
        <span className="flex items-center gap-1 ml-auto text-xs">
          <Icon icon="git-branch" size={12} className="text-muted-foreground" />
          {/* Native, minimal: the chip reads `⑂ master ▾`. */}
          <select className="bp5-input" value={branch?.id ?? ''} onChange={(e) => { setBranchId(e.currentTarget.value) }}>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </span>
      </header>

      {/* 3. Tab views, and 5. Actions on the same row. */}
      <div className="dsv-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`dsv-tab${tab === t.id ? ' active' : ''}`} onClick={() => { setTab(t.id) }}>
            {t.label}{t.beta && <Tag minimal className="ml-1 !text-[9px]">Beta</Tag>}
          </button>
        ))}
        <div className="dsv-actions">
          {/* "Some actions, such as Analyze (in Contour) and Build, are surfaced
              outside the actions menu for quick access." */}
          <Button size="small" variant="outlined" icon="chart" onClick={() => { void navigate('/contour') }}>Analyze data</Button>
          <Button size="small" variant="outlined" icon="data-lineage"
            onClick={() => { void navigate(`/lineage/dataset/${dataset.id}`) }}>Explore pipeline</Button>
          <Popover placement="bottom-end" content={
            <Menu>
              <MenuItem icon="upload" text="Upload file…" onClick={() => { setTab('preview'); setUploading(true) }} />
              <MenuItem icon="eye-off" text="Create restricted view" onClick={() => { setCreatingRv(true) }} />
              <MenuItem icon="shield" text="Check access" onClick={() => { setTab('details') }} />
              <MenuDivider />
              <MenuItem icon="clipboard" text="Copy RID" onClick={() => { copy(dataset.rid) }} />
            </Menu>}>
            <Button size="small" variant="outlined" endIcon="caret-down">All actions</Button>
          </Popover>
          <Button size="small" variant="outlined" icon="build" loading={runBuild.isPending}
            onClick={() => { runBuild.mutate({ targets: [dataset.id] }) }}>Build</Button>
        </div>
      </div>

      <div className="dsv-body">
        {/* 2. Information panel: About | Columns | Schedules. */}
        <aside className="dsv-side">
          <div className="dsv-side-head"><Icon icon="th" size={13} className="text-violet-500" />{dataset.name}</div>
          <div className="dsv-segment">
            {(['about', 'columns', 'schedules'] as SideId[]).map((s) => (
              <button key={s} className={side === s ? 'active' : ''} onClick={() => { setSide(s) }}>
                {s === 'about' ? 'About' : s === 'columns' ? 'Columns' : 'Schedules'}
              </button>
            ))}
          </div>
          <div className="dsv-side-body">
            {side === 'about' && (
              <About dataset={dataset} branch={branch} columns={columns.length} rows={rows}
                files={files.length} transactions={transactions} jobs={jobs} />
            )}
            {side === 'columns' && (
              <Columns fields={fields ?? []} active={statsColumn}
                onPick={(c) => { setStatsColumn(c); setTab('preview') }} />
            )}
            {side === 'schedules' && <Schedules datasetId={dataset.id} />}
          </div>
        </aside>

        <main className="dsv-main">
          {tab === 'preview' && (
            <Preview dataset={dataset} branch={branch} fields={fields ?? null}
              statsColumn={statsColumn} setStatsColumn={setStatsColumn}
              uploading={uploading} setUploading={setUploading} />
          )}
          {tab === 'history' && <History dataset={dataset} transactions={transactions} jobs={jobs} />}
          {tab === 'details' && <Details dataset={dataset} fields={fields ?? null} files={files} />}
          {tab === 'health' && (
            <div className="dsv-details"><HealthPanel datasetId={dataset.id} columns={columns} /></div>
          )}
        </main>
      </div>

      {creatingRv && (
        <CreateRestrictedViewDialog datasetId={dataset.id} datasetName={dataset.name}
          onClose={() => { setCreatingRv(false) }} />
      )}
    </div>
  )
}

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(() => { toast.success('Copied') })
}

// ── 2. About ────────────────────────────────────────────────────────────────
// "the time the dataset was created and updated, the users who created and
//  last updated the dataset, the size of the table, any tools and input
//  datasets used to create the data, tags, and more" — in the capture's order.
function About({ dataset, branch, columns, rows, files, transactions, jobs }: {
  dataset: Dataset; branch: Branch | null; columns: number; rows: number; files: number
  transactions: Transaction[]; jobs: DatasetJob[]
}) {
  const { data: backing = [] } = useBackingObjectTypes(dataset.id)
  const { data: users = [] } = useUsers()
  const { data: spec } = useJobSpec(dataset.id)
  const creator = users.find((u) => u.id === dataset.createdByUserId)
  // Inference (reading §2): the row names what last wrote the dataset — the
  // job that opened the latest committed transaction, else an upload.
  const latest = transactions.find((t) => t.status === 'COMMITTED')
  const wroteIt = latest ? jobs.find((j) => j.transactionId === latest.id) : undefined

  return (
    <>
      {dataset.description && <p className="text-xs text-muted-foreground mb-2">{dataset.description}</p>}
      {backing.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {backing.map((b) => (
            <Link key={b.id} to="/ontology/object-types">
              <Tag minimal icon="cube" interactive>{b.displayName}</Tag>
            </Link>
          ))}
        </div>
      )}
      <dl className="dsv-about">
        <dt>Updated</dt><dd>{when(dataset.updatedAt)}</dd>
        <dt>Created</dt><dd>{when(dataset.createdAt)}{creator ? ` by ${creator.username}` : ''}</dd>
        <dt>Location</dt><dd className="font-mono truncate" title={datasetLocation(dataset)}>{datasetLocation(dataset)}</dd>
        <dt>Type</dt><dd>Dataset</dd>
        <dt>RID</dt>
        <dd className="flex items-center gap-1 min-w-0">
          <span className="font-mono truncate">{dataset.rid}</span>
          <Button variant="minimal" size="small" icon="clipboard" aria-label="Copy RID" onClick={() => { copy(dataset.rid) }} />
        </dd>
        <dt>Branch</dt><dd className="font-mono">{branch?.name ?? '—'}</dd>
        {/* The size row states the shape twice: logical, then physical. Bytes
            are not stored here, so that third figure is absent. */}
        <dt>Size</dt>
        <dd className="dsv-size">
          <span>{columns} columns</span><span>{rows} rows</span><span>{files} files</span>
        </dd>
        <dt>Updated via</dt>
        <dd>
          {wroteIt ? <Link to="/builds">{spec ? 'transform' : 'build'}</Link>
            : latest ? 'Upload' : '—'}
        </dd>
      </dl>
    </>
  )
}

// "Information on the different columns in the dataset, including the type of
//  data, description, and data stats" — a click opens the stats dock.
function Columns({ fields, active, onPick }: {
  fields: DatasetField[]; active: string | null; onPick: (column: string) => void
}) {
  if (fields.length === 0) {
    return <p className="text-xs text-muted-foreground">No schema yet. A schema arrives with a transaction, not on the dataset itself.</p>
  }
  return (
    <div>
      {fields.map((f) => f.name === undefined ? null : (
        <div key={f.name} className={`dsv-col-row${active === f.name ? ' active' : ''}`}
          onClick={() => { onPick(f.name as string) }}>
          <Icon icon="th-list" size={11} className="text-muted-foreground" />
          <span className="truncate">{f.name}</span>
          <span className="t">{describeField(f)}</span>
        </div>
      ))}
    </div>
  )
}

// "Information about any configured build schedules that will run to update
//  the dataset."
function Schedules({ datasetId }: { datasetId: string }) {
  const { data: schedules = [] } = useSchedules()
  const mine = schedules.filter((s) => s.targetDatasetIds.includes(datasetId))
  if (mine.length === 0) {
    return <p className="text-xs text-muted-foreground">No schedule targets this dataset. <Link to="/builds">Create one</Link> from the builds page.</p>
  }
  return (
    <div className="divide-y">
      {mine.map((s) => (
        <div key={s.id} className="py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <Icon icon="time" size={11} className="text-muted-foreground" />
            <Link to="/builds" className="font-semibold truncate">{s.name}</Link>
            {s.paused && <Tag minimal className="!text-[9px]">Paused</Tag>}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {s.trigger.type === 'time' ? `cron ${s.trigger.cron ?? ''}` : `on ${s.trigger.type}`}
            {s.lastRunAt ? ` · last ran ${relativeTime(s.lastRunAt)}` : ' · never ran'}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── 4. Preview table ────────────────────────────────────────────────────────
function Preview({ dataset, branch, fields, statsColumn, setStatsColumn, uploading, setUploading }: {
  dataset: Dataset; branch: Branch | null; fields: DatasetField[] | null
  statsColumn: string | null; setStatsColumn: (c: string | null) => void
  uploading: boolean; setUploading: (v: boolean) => void
}) {
  const [q, setQ] = useState<PreviewQuery>({ orderBy: null, desc: false, filters: [], limit: 300 })
  const [search, setSearch] = useState('')
  const [cell, setCell] = useState<{ row: number; column: string } | null>(null)
  const [over, setOver] = useState(false)
  const { data: rows = [], isFetching } = usePreview(branch?.id ?? null, q)
  const { data: total } = usePreviewCount(branch?.id ?? null, q.filters)
  const upload = useUploadFile(dataset.id, branch?.name ?? 'master')

  const named = (fields ?? []).filter((f): f is DatasetField & { name: string } => f.name !== undefined)
  const shown = search === '' ? named : named.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
  const addFilter = (f: PreviewFilter) => { setQ({ ...q, filters: [...q.filters, f] }); setCell(null) }

  // "Drag and drop the file into the dataset preview window." One transaction
  // per file, in sequence: a branch holds one open transaction at a time.
  const drop = (list: FileList) => {
    void Array.from(list).reduce(
      (chain, f) => chain.then(() => upload.mutateAsync(f).then(() => undefined)),
      Promise.resolve(),
    )
  }

  return (
    <>
      <div className="dsv-grid-strip">
        <span className="name"><Icon icon="th" size={12} className="text-violet-500" />{dataset.name}
          {isFetching && <Spinner size={12} />}</span>
        {/* "the exact number of rows is displayed in the preview table header" */}
        <span className="tabular-nums">
          {total !== undefined && rows.length < total
            ? `Showing ${String(rows.length)} of ${String(total)} rows`
            : `Showing ${String(rows.length)} rows`}
        </span>
        <span>{named.length} columns</span>
        <span>
          <InputGroup size="small" leftIcon="search" placeholder="Search columns…" value={search}
            onChange={(e) => { setSearch(e.currentTarget.value) }} />
        </span>
      </div>

      {q.filters.length > 0 && (
        <div className="dsv-chips">
          {q.filters.map((f, i) => (
            <Tag key={i} minimal icon="filter" onRemove={() => { setQ({ ...q, filters: q.filters.filter((_, j) => j !== i) }) }}>
              {filterLabel(f)}
            </Tag>
          ))}
        </div>
      )}

      {uploading && branch && (
        <div className="px-3 py-2 border-b border-border">
          <UploadCard datasetId={dataset.id} branchName={branch.name} />
          <Button variant="minimal" size="small" className="mt-1" onClick={() => { setUploading(false) }}>Done</Button>
        </div>
      )}

      <div className={`dsv-grid-wrap${over ? ' dsv-drop' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => { setOver(false) }}
        onDrop={(e) => { e.preventDefault(); setOver(false); drop(e.dataTransfer.files) }}>
        {branch === null || named.length === 0 ? (
          <div className="px-8 py-6 max-w-4xl">
            <NonIdealState icon="th" title="No data yet"
              description="Drag a .csv or .tsv into this window — its schema is inferred and it lands as a transaction on the branch." />
            {branch && <UploadCard datasetId={dataset.id} branchName={branch.name} />}
          </div>
        ) : (
          <table className="dsv-grid">
            <thead>
              <tr>
                <th className="rownum" />
                {shown.map((f) => (
                  <th key={f.name}>
                    <div className="col-name">
                      <span className="truncate">{f.name}</span>
                      <ColumnMenu column={f.name} sorted={q.orderBy === f.name ? (q.desc ? 'desc' : 'asc') : null}
                        onSort={(desc) => { setQ({ ...q, orderBy: f.name, desc }) }}
                        onStats={() => { setStatsColumn(f.name) }} />
                    </div>
                    <div className="col-type">{describeField(f)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="rownum">{i + 1}</td>
                  {shown.map((f) => {
                    const v = r[f.name]
                    const c = formatCell(v)
                    const open = cell !== null && cell.row === i && cell.column === f.name
                    return (
                      <td key={f.name}
                        className={`${isNumeric(v) ? 'num' : ''}${c.isNull ? ' null' : ''}${statsColumn === f.name ? ' hit' : ''}`}
                        onClick={() => { setCell({ row: i, column: f.name }) }}>
                        {open ? (
                          <Popover isOpen placement="bottom-start" onClose={() => { setCell(null) }}
                            content={<CellMenu column={f.name} value={v ?? null} text={c.text}
                              onFilter={addFilter} onStats={() => { setStatsColumn(f.name); setCell(null) }} />}>
                            <span>{c.text}</span>
                          </Popover>
                        ) : c.text}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {statsColumn !== null && branch && (
        <StatsDock branchId={branch.id} column={statsColumn}
          type={named.find((f) => f.name === statsColumn)}
          onClose={() => { setStatsColumn(null) }} />
      )}
    </>
  )
}

// The column menu, as dataset-preview.png shows it minus the items with no
// engine here (Pin, Encrypt, Filter ▸, View cell content, Expand).
function ColumnMenu({ column, sorted, onSort, onStats }: {
  column: string; sorted: 'asc' | 'desc' | null; onSort: (desc: boolean) => void; onStats: () => void
}) {
  return (
    <Popover placement="bottom-end" content={
      <Menu>
        <MenuItem icon="sort-asc" text="Sort ascending" active={sorted === 'asc'} onClick={() => { onSort(false) }} />
        <MenuItem icon="sort-desc" text="Sort descending" active={sorted === 'desc'} onClick={() => { onSort(true) }} />
        <MenuItem icon="timeline-bar-chart" text="View stats" onClick={onStats} />
        <MenuDivider />
        <MenuItem icon="clipboard" text="Copy column name" onClick={() => { copy(column) }} />
      </Menu>}>
      <Button variant="minimal" size="small" icon={sorted === null ? 'chevron-down' : sorted === 'asc' ? 'sort-asc' : 'sort-desc'}
        aria-label={`${column} menu`} />
    </Popover>
  )
}

// "Select an individual cell to exclude or include only the selected value."
function CellMenu({ column, value, text, onFilter, onStats }: {
  column: string; value: Json; text: string; onFilter: (f: PreviewFilter) => void; onStats: () => void
}) {
  const shown = value === null ? 'null' : `"${text}"`
  return (
    <Menu>
      <MenuItem icon="filter" text={`Include only ${shown}`} onClick={() => { onFilter({ column, op: 'include', value }) }} />
      <MenuItem icon="filter-remove" text={`Exclude ${shown}`} onClick={() => { onFilter({ column, op: 'exclude', value }) }} />
      <MenuItem icon="timeline-bar-chart" text="View stats" onClick={onStats} />
      <MenuDivider />
      <MenuItem icon="clipboard" text="Copy" onClick={() => { copy(text) }} />
    </Menu>
  )
}

// The stats panel, docked under the grid: the counts it names, then the
// values by descending count. Length histogram and the case/alpha counts are
// recorded gaps (reading, decision 3).
function StatsDock({ branchId, column, type, onClose }: {
  branchId: string; column: string; type: DatasetField | undefined; onClose: () => void
}) {
  const { data: s } = useColumnStats(branchId, column)
  const max = Math.max(1, ...(s?.values ?? []).map((v) => v.count))
  return (
    <div className="dsv-stats">
      <div className="dsv-stats-head">
        <span>{column}</span>
        {type && <Tag minimal>{describeField(type)}</Tag>}
        {s && <span className="text-muted-foreground tabular-nums">{s.rows} rows</span>}
        <Button variant="minimal" size="small" icon="cross" className="ml-auto" aria-label="Close stats" onClick={onClose} />
      </div>
      {s ? (
        <>
          <dl>
            <dt>Normal</dt><dd>{s.normal}</dd>
            <dt>Null</dt><dd>{s.null}</dd>
            <dt>Empty</dt><dd>{s.empty}</dd>
            <dt>Whitespace</dt><dd>{s.whitespace}</dd>
            <dt>Distinct</dt><dd>{s.distinct}</dd>
          </dl>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Value · by desc. count</div>
            <div className="dsv-values">
              {s.values.map((v, i) => {
                const c = formatCell(v.value)
                return (
                  <span key={i} className="contents">
                    <span className={`truncate font-mono${c.isNull ? ' italic' : ''}`}>{c.text}</span>
                    <span className="tabular-nums text-right">{v.count}</span>
                    <span className="bar" style={{ width: `${String((v.count / max) * 100)}%` }} />
                  </span>
                )
              })}
            </div>
          </div>
        </>
      ) : <span className="text-muted-foreground">Counting…</span>}
    </div>
  )
}

// ── History ─────────────────────────────────────────────────────────────────
// A row is a transaction and the job that opened it; the Summary counts jobs.
function History({ dataset, transactions, jobs }: {
  dataset: Dataset; transactions: Transaction[]; jobs: DatasetJob[]
}) {
  const [sel, setSel] = useState<string | null>(null)
  const jobByTxn = new Map(jobs.flatMap((j) => j.transactionId === null ? [] : [[j.transactionId, j] as const]))
  const selected = transactions.find((t) => t.id === sel) ?? null

  return (
    <div className="dsv-history">
      <div className="dsv-history-rail">
        <div className="dsv-side-head">History</div>
        {transactions.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">No transactions yet. A dataset changes by transaction — the atomic change version history is made of.</p>
        )}
        {transactions.map((t) => {
          const j = jobByTxn.get(t.id)
          return (
            <div key={t.id} className={`dsv-history-row${sel === t.id ? ' active' : ''}`} onClick={() => { setSel(t.id) }}>
              <Icon icon={t.status === 'OPEN' ? 'refresh' : t.status === 'COMMITTED' ? 'tick-circle' : 'ban-circle'}
                intent={STATUS_INTENT[t.status]} size={14} />
              <div className="min-w-0">
                <div className="when">{t.status === 'OPEN' ? 'Running' : relativeTime(t.committedAt ?? t.startedAt)}</div>
                <div className="sub">{t.status === 'OPEN' ? 'Open' : TYPE_META.get(t.txnType)?.label ?? t.txnType}</div>
                <div className="sub">{j ? `Part of build · ${summaryBucket(j.state).toLowerCase()}` : 'Upload'}</div>
              </div>
              <span className="dur">{j ? duration(j.startedAt, j.finishedAt) : ''}</span>
            </div>
          )
        })}
      </div>
      <div className="dsv-summary">
        {selected ? (
          <JobDetail dataset={dataset} transaction={selected} job={jobByTxn.get(selected.id)} onBack={() => { setSel(null) }} />
        ) : <Summary jobs={jobs} />}
      </div>
    </div>
  )
}

// "A Summary view on the right side of the page shows aggregated information
//  on job statuses over time." Five cards, as the capture labels them.
function Summary({ jobs }: { jobs: DatasetJob[] }) {
  const n: Record<SummaryBucket, number> = { Running: 0, Succeeded: 0, Failed: 0, Canceled: 0 }
  for (const j of jobs) n[summaryBucket(j.state)] += 1
  const median = medianDurationSeconds(jobs)
  return (
    <>
      <div className="text-sm font-semibold">Summary</div>
      <div className="dsv-cards">
        <div className="dsv-card"><div className="n">{jobs.length}</div><div className="l">Total jobs</div></div>
        <div className="dsv-card ok"><div className="n">{n.Succeeded}</div><div className="l">Succeeded</div></div>
        <div className="dsv-card bad"><div className="n">{n.Failed}</div><div className="l">Failed</div></div>
        <div className="dsv-card gray"><div className="n">{n.Canceled}</div><div className="l">Canceled</div></div>
        <div className="dsv-card run"><div className="n">{median === null ? '—' : formatSeconds(median)}</div><div className="l">Median duration</div></div>
      </div>
      {jobs.length === 0 && (
        <p className="text-xs text-muted-foreground">No build has written this dataset yet. Uploads land as transactions without a job.</p>
      )}
    </>
  )
}

function JobDetail({ dataset, transaction: t, job, onBack }: {
  dataset: Dataset; transaction: Transaction; job: DatasetJob | undefined; onBack: () => void
}) {
  const settle = useSettleTransaction(dataset.id)
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <Button variant="minimal" size="small" icon="arrow-left" onClick={onBack}>Overview</Button>
        <span className="text-xs text-muted-foreground">Details: {when(t.committedAt ?? t.startedAt)}</span>
      </div>
      <dl className="dsv-about">
        <dt>Transaction</dt>
        <dd className="flex items-center gap-1">
          <Tag minimal className="!text-[9px]" title={TYPE_META.get(t.txnType)?.help}>{TYPE_META.get(t.txnType)?.label ?? t.txnType}</Tag>
          <Tag minimal intent={STATUS_INTENT[t.status]} className="!text-[9px]" title={STATUS_META.get(t.status)?.help}>
            {STATUS_META.get(t.status)?.label ?? t.status}
          </Tag>
          {t.status === 'OPEN' && (
            // The two ways an open transaction ends: commit moves the branch
            // head; abort discards and leaves it.
            <>
              <Button variant="minimal" size="small" icon="tick" title="Commit" disabled={settle.isPending}
                onClick={() => { settle.mutate({ id: t.id, to: 'commit' }) }} />
              <Button variant="minimal" size="small" icon="cross" title="Abort" disabled={settle.isPending}
                onClick={() => { settle.mutate({ id: t.id, to: 'abort' }) }} />
            </>
          )}
        </dd>
        <dt>RID</dt><dd className="font-mono truncate">{t.rid}</dd>
        <dt>Started</dt><dd>{when(t.startedAt)}</dd>
        <dt>Committed</dt><dd>{t.committedAt ? when(t.committedAt) : '—'}</dd>
        {job ? (
          <>
            <dt>Job</dt>
            <dd><Link to="/builds">Part of build</Link> · {job.state} · {duration(job.startedAt, job.finishedAt)}</dd>
            {job.error && <><dt>Error</dt><dd className="text-amber-600">{job.error}</dd></>}
          </>
        ) : <><dt>Job</dt><dd>None — this transaction was an upload.</dd></>}
      </dl>
    </>
  )
}

// ── Details ─────────────────────────────────────────────────────────────────
// Schema, Files, Job spec — the three of the seven sub-sections with an engine
// here. Syncs, Custom metadata, Resource usage and Last run details are not.
function Details({ dataset, fields, files }: {
  dataset: Dataset; fields: DatasetField[] | null; files: { fileId: string; logicalPath: string; rowCount: number }[]
}) {
  return (
    <div className="dsv-details">
      <section>
        <div className="text-sm font-semibold mb-2">Schema</div>
        {!fields || fields.length === 0 ? (
          <p className="text-xs text-muted-foreground">No schema yet. A schema is metadata on a dataset view, so it arrives with a transaction.</p>
        ) : (
          <table className="dsv-schema">
            <thead><tr><th>Name</th><th>Type</th></tr></thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.name ?? ''}><td className="font-mono">{f.name}</td><td>{describeField(f)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <div className="text-sm font-semibold mb-2">Files</div>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground">The view is empty. It begins at the latest snapshot and replays every transaction after it.</p>
        ) : (
          <table className="dsv-schema">
            <thead><tr><th>Path</th><th>Rows</th></tr></thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.fileId}><td className="font-mono">{f.logicalPath}</td><td className="tabular-nums">{f.rowCount}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <section>
        <div className="text-sm font-semibold mb-2">Job spec</div>
        <TransformCard datasetId={dataset.id} />
      </section>
      <section>
        <div className="text-sm font-semibold mb-2">Access</div>
        <AccessRequirements datasetId={dataset.id} />
        {/* "On a Project, folder, or file … select Access > Check access." */}
        <div className="mt-2"><CheckAccessPanel kind="dataset" resourceId={dataset.id} /></div>
      </section>
    </div>
  )
}

/** Foundry's own access panel: one heading, then cards joined by AND. The
 *  split into File access and Data access is theirs — a data marking is a file
 *  marking that crossed a data dependency, and it gates rows, not existence. */
function AccessRequirements({ datasetId }: { datasetId: string }) {
  const { data: markings = [], isLoading } = useDatasetMarkings(datasetId)
  const level = accessLevel(markings)
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Users must meet <strong>all</strong> of the following requirements to access this dataset.
      </p>
      {isLoading ? <span className="text-xs text-muted-foreground">Loading…</span> : (
        <>
          {MARKING_KINDS.map((kind, i) => {
            const of = markings.filter((m) => m.kind === kind)
            return (
              <div key={kind}>
                {i > 0 && <div className="text-[10px] font-bold tracking-widest text-muted-foreground/70 py-1">AND</div>}
                <div className="rounded border border-border">
                  <div className="flex items-baseline gap-2 px-2 py-1.5 border-b border-border/60">
                    <span className="text-[11px] font-semibold">{MARKING_KIND_META[kind].label}</span>
                    {of.length > 0 && <span className="text-[10px] text-muted-foreground">· All of</span>}
                    <span className="text-[10px] text-muted-foreground/70 ml-auto truncate">{MARKING_KIND_META[kind].help}</span>
                  </div>
                  {of.length === 0 ? <p className="px-2 py-1.5 text-xs text-muted-foreground">None</p> : (
                    <ul className="px-2 py-1.5 flex flex-wrap gap-1.5">
                      {of.map((m) => (
                        <li key={m.markingId}>
                          <Tag minimal={m.satisfied} intent={m.satisfied ? Intent.NONE : Intent.DANGER} className="!text-[10px]"
                            title={`${MARKING_ORIGIN_META[m.origin].help}${m.satisfied ? '' : ' You are not a member of this marking.'}`}>
                            <Icon icon={MARKING_ORIGIN_META[m.origin].icon} size={10} className="mr-1" />
                            {m.category}: {m.name}
                          </Tag>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
          {level !== 'full' && (
            <p className="text-[11px] text-amber-600"><strong>{ACCESS_LEVEL_META[level].label}.</strong> {ACCESS_LEVEL_META[level].help}</p>
          )}
        </>
      )}
    </div>
  )
}
