// Datasets — the Dataset Layer.
//
// Layout copied from Dataset Preview rather than invented
// (mirror/dataset-preview/overview.md and its annotated screenshot): a header
// naming the dataset with its location and a branch selector, an **About** panel
// carrying the fields their sidebar shows, a **Columns** section listing each
// column with its type underneath, and **History** listing the transactions.
//
// Two things are deliberately absent because the pages that define them are
// unread: upload (`compass/manually-upload-data`) and the Health, Compare and
// Details tabs. A tab that renders an empty shell reads as a built feature.

import { useState } from 'react'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, Intent, NonIdealState,
  Spinner, SpinnerSize, Tag, TextArea,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import {
  describeField, toSlug, TRANSACTION_TYPES, TRANSACTION_STATUSES,
  MARKING_KINDS, MARKING_KIND_META, MARKING_ORIGIN_META, ACCESS_LEVEL_META, accessLevel,
  type TransactionStatus, type TransactionType,
} from '@beacon/ontology'
import { useAuthStore } from '@/stores/auth.store'
import { useProjects } from '@/features/projects/api'
import {
  datasetLocation, useBranches, useCreateDataset, useDatasetMarkings, useDatasets,
  useSchema, useTransactions, useView, type Branch, type Dataset,
} from '@/features/datasets/api'

const TYPE_META = new Map(TRANSACTION_TYPES.map((t) => [t.value, t]))
const STATUS_META = new Map(TRANSACTION_STATUSES.map((t) => [t.value, t]))

const STATUS_INTENT: Record<TransactionStatus, Intent> = {
  OPEN: Intent.WARNING, COMMITTED: Intent.SUCCESS, ABORTED: Intent.DANGER,
}

export default function DatasetsPage() {
  const { data: datasets = [], isLoading } = useDatasets()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const selected = datasets.find((d) => d.id === selectedId) ?? null

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Datasets</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              A dataset is a wrapper around a collection of files, with a schema, a version
              history and a place in the filesystem. It is what an object type is backed by.
            </p>
          </div>
          <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setCreating(!creating) }}>
            New dataset
          </Button>
        </header>

        {creating && <CreatePane onDone={() => { setCreating(false) }} />}

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : datasets.length === 0 ? (
          <NonIdealState icon="th" title="No datasets yet"
            description="A dataset lands data in the platform and carries it through to the Ontology. Create one to give an object type something to be backed by." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {datasets.map((d) => (
              <Card key={d.id} interactive compact
                className={selectedId === d.id ? '!border-violet-400' : ''}
                onClick={() => { setSelectedId(selectedId === d.id ? null : d.id) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="th" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{d.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{datasetLocation(d)}</p>
                {d.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{d.description}</p>}
              </Card>
            ))}
          </div>
        )}

        {selected && <DatasetDetails dataset={selected} />}
      </div>
    </div>
  )
}

function CreatePane({ onDone }: { onDone: () => void }) {
  const create = useCreateDataset()
  const { data: projects = [] } = useProjects()
  const organizationId = useAuthStore((s) => s.organizationId ?? '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const apiName = toSlug(name)
  const project = projectId || (projects.at(0)?.id ?? '')
  // Previewed the same way the detail panel renders it, so the two cannot drift.
  const chosen = projects.find((p) => p.id === project)
  const location = chosen ? `${chosen.spacePath}/${chosen.apiName}/${apiName}` : ''

  return (
    <Card className="space-y-3 !border-violet-400/50">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-48">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
          <InputGroup value={name} placeholder="Airlines" onChange={(e) => { setName(e.currentTarget.value) }} />
        </label>
        <label className="flex flex-col gap-1">
          {/* Foundry prompts for a location because permissions derive from it. */}
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</span>
          <HTMLSelect value={project} onChange={(e) => { setProjectId(e.currentTarget.value) }}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </HTMLSelect>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</span>
        <TextArea fill rows={2} value={description} placeholder="Optional — what this data is."
          onChange={(e) => { setDescription(e.currentTarget.value) }} />
      </label>
      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} size="small" icon="tick" loading={create.isPending}
          disabled={!apiName || !project}
          onClick={() => {
            create.mutate({ apiName, name: name.trim(), description: description.trim(), projectId: project, organizationId },
              { onSuccess: onDone })
          }}>
          Create
        </Button>
        <Button variant="minimal" size="small" onClick={onDone}>Cancel</Button>
        {apiName && project && (
          <span className="text-[11px] text-muted-foreground font-mono">
            {location}
          </span>
        )}
        {projects.length === 0 && (
          <span className="text-[11px] text-amber-600">A dataset needs a project to live in — create one first.</span>
        )}
      </div>
    </Card>
  )
}

function DatasetDetails({ dataset }: { dataset: Dataset }) {
  const { data: branches = [] } = useBranches(dataset.id)
  const { data: transactions = [] } = useTransactions(dataset.id)
  const { data: schema } = useSchema(dataset.id)
  const [branchId, setBranchId] = useState<string | null>(null)
  // .at() rather than [0]: the index signature lies about emptiness, and every
  // `branch?.` below then reads as dead code to the linter.
  const branch: Branch | null = branches.find((b) => b.id === branchId) ?? branches.at(0) ?? null
  const { data: files = [] } = useView(branch?.id ?? null)

  const rows = files.reduce((n, f) => n + f.rowCount, 0)

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon icon="th" size={15} className="text-violet-500" />
        <h2 className="text-sm font-semibold">{dataset.name}</h2>
        <span className="text-[11px] text-muted-foreground font-mono">{datasetLocation(dataset)}</span>
        {branches.length > 0 && (
          <span className="flex items-center gap-1 ml-auto">
            <Icon icon="git-branch" size={12} className="text-muted-foreground" />
            <HTMLSelect minimal value={branch?.id ?? ''} onChange={(e) => { setBranchId(e.currentTarget.value) }}>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </HTMLSelect>
          </span>
        )}
      </div>

      {/* About — the fields Foundry's own sidebar shows, in their order. */}
      <Card compact className="!p-0">
        <PanelHeader icon="info-sign" label="About" />
        <dl className="px-3 py-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5 text-xs">
          <Field label="Location" value={datasetLocation(dataset)} mono />
          <Field label="Type" value="Dataset" />
          {/* Their sidebar states size twice: the logical shape and the physical one. */}
          <Field label="Table size"
            value={`${String(schema?.length ?? 0)} columns · ${String(rows)} rows`} />
          <Field label="Size" value={`${String(files.length)} files`} />
          <Rid rid={dataset.rid} />
          <Field label="Branch" value={branch?.name ?? '—'} mono />
          <Field label="Created" value={new Date(dataset.createdAt).toLocaleString()} />
          <Field label="Updated" value={new Date(dataset.updatedAt).toLocaleString()} />
          <Field label="Backed by"
            value={dataset.physicalTable ? `datasets.${dataset.physicalTable}` : 'Not materialized — no schema yet'}
            mono={dataset.physicalTable !== null} />
        </dl>
      </Card>

      <AccessRequirements datasetId={dataset.id} />

      {/* Columns — name on top, type underneath, as the preview table renders. */}
      <Card compact className="!p-0">
        <PanelHeader icon="th-list" label="Columns" count={schema?.length ?? 0} />
        {!schema || schema.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No schema yet. A schema is metadata on a dataset view, so it arrives with a transaction —
            not on the dataset itself.
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {schema.map((f) => (
              <li key={f.name} className="px-3 py-1.5">
                <div className="text-xs font-medium">{f.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">{describeField(f)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* History — the transactions, which are what a view is a replay of. */}
      <Card compact className="!p-0">
        <PanelHeader icon="history" label="History" count={transactions.length} />
        {transactions.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No transactions yet. A dataset changes by transaction — the atomic change that
            version history is made of.
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <Tag minimal className="!text-[9px]" title={TYPE_META.get(t.txnType)?.help}>
                  {TYPE_META.get(t.txnType)?.label ?? t.txnType}
                </Tag>
                <Tag minimal intent={STATUS_INTENT[t.status]} className="!text-[9px]"
                  title={STATUS_META.get(t.status)?.help}>
                  {STATUS_META.get(t.status)?.label ?? t.status}
                </Tag>
                <span className="text-muted-foreground">
                  {new Date(t.committedAt ?? t.startedAt).toLocaleString()}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/70 truncate ml-auto">{t.rid}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* The view — what a reader actually sees, which is the replay's result. */}
      <Card compact className="!p-0">
        <PanelHeader icon="document" label="Files in this view" count={files.length} />
        {files.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            The view is empty. A view begins at the latest snapshot and replays every transaction
            after it, so nothing is here until one is committed.
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {files.map((f) => (
              <li key={f.fileId} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <Icon icon="document" size={11} className="text-muted-foreground" />
                <span className="font-mono">{f.logicalPath}</span>
                <span className="text-muted-foreground ml-auto">{f.rowCount} rows</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

/** The access panel, shaped from Foundry's own: one heading, then cards joined
 *  by AND. The split into File access and Data access is theirs — the second card
 *  is headed "Additional data markings" because a data marking is a file marking
 *  that crossed a data dependency, and it gates rows rather than existence. */
function AccessRequirements({ datasetId }: { datasetId: string }) {
  const { data: markings = [], isLoading } = useDatasetMarkings(datasetId)
  const level = accessLevel(markings)

  return (
    <Card compact className="!p-0">
      <PanelHeader icon="lock" label="Access requirements" />
      <div className="px-3 py-2 space-y-2">
        <p className="text-xs text-muted-foreground">
          Users must meet <strong>all</strong> of the following requirements to access this dataset.
        </p>
        {isLoading ? (
          <span className="text-xs text-muted-foreground">Loading…</span>
        ) : (
          <>
            {MARKING_KINDS.map((kind, i) => {
              const of = markings.filter((m) => m.kind === kind)
              return (
                <div key={kind}>
                  {i > 0 && <div className="text-[10px] font-bold tracking-widest text-muted-foreground/60 py-1">AND</div>}
                  <div className="rounded border border-border">
                    <div className="flex items-baseline gap-2 px-2 py-1.5 border-b border-border/60">
                      <span className="text-[11px] font-semibold">{MARKING_KIND_META[kind].label}</span>
                      {of.length > 0 && <span className="text-[10px] text-muted-foreground">· All of</span>}
                      <span className="text-[10px] text-muted-foreground/70 ml-auto truncate">
                        {MARKING_KIND_META[kind].help}
                      </span>
                    </div>
                    {of.length === 0 ? (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground">None</p>
                    ) : (
                      <ul className="px-2 py-1.5 flex flex-wrap gap-1.5">
                        {of.map((m) => (
                          <li key={m.markingId}>
                            <Tag minimal={m.satisfied} intent={m.satisfied ? Intent.NONE : Intent.DANGER}
                              className="!text-[10px]"
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
              <p className="text-[11px] text-amber-600">
                <strong>{ACCESS_LEVEL_META[level].label}.</strong> {ACCESS_LEVEL_META[level].help}
              </p>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

function PanelHeader({ icon, label, count }: { icon: 'info-sign' | 'th-list' | 'history' | 'document' | 'lock'; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
      <Icon icon={icon} size={12} className="text-muted-foreground" />
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {count !== undefined && <Tag minimal className="!text-[10px]">{count}</Tag>}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono text-[11px] truncate' : 'truncate'}>{value}</dd>
    </>
  )
}

/** Foundry's sidebar gives the RID a copy button, because it is the identifier
 *  you paste into everything else. */
function Rid({ rid }: { rid: string }) {
  return (
    <>
      <dt className="text-muted-foreground">RID</dt>
      <dd className="flex items-center gap-1 min-w-0">
        <span className="font-mono text-[11px] truncate">{rid}</span>
        <Button variant="minimal" size="small" icon="clipboard" aria-label="Copy RID"
          onClick={() => {
            void navigator.clipboard.writeText(rid).then(() => { toast.success('RID copied') })
          }} />
      </dd>
    </>
  )
}

export type { TransactionType }
