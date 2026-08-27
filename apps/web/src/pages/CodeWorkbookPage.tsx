// Code Workbook — the workbook list, and one workbook as its transform list
// in topological order ("input datasets are at the top and the furthest
// downstream transforms are at the bottom", workbooks-overview), with the
// branch bar, the imports rail, and per-node Save-as-dataset toggles.
//
// Preview vs Run follows the PERSISTENCE toggle, not the node kind — the
// adversary pass's capture table: unsaved nodes Preview, saved nodes Run.

import { useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup,
  Intent, NonIdealState, Spinner, SpinnerSize, Switch, Tag, TextArea,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import { useDatasets } from '@/features/datasets/api'
import {
  useWorkbooks, useWorkbookContents, useTemplates, useCreateWorkbook,
  useAddImport, useAddTransform, useUpdateSource, useSaveTransform,
  useUnsaveTransform, usePreview, useBranchOps, useApplyTemplate,
  type Workbook, type WorkbookContents, type WbTransform, type WbBranch,
} from '@/features/workbook/api'

export default function CodeWorkbookPage() {
  const { data: workbooks = [], isLoading } = useWorkbooks()
  const [params, setParams] = useSearchParams()
  const openId = params.get('w')
  const open = workbooks.find((w) => w.id === openId) ?? null

  if (open !== null) return <WorkbookView workbook={open} onClose={() => { setParams({}) }} />

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">
              Code Workbook <Tag minimal className="!text-[9px]">Legacy</Tag>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              A graph of transforms whose persistence is a toggle: an unsaved transform is a
              logical block, a saved one is a dataset the build system recomputes. Every
              workbook is backed by a hidden code repository.
            </p>
          </div>
          <NewWorkbookButton />
        </header>
        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : workbooks.length === 0 ? (
          <NonIdealState icon="code-block" title="No workbooks yet"
            description="A workbook holds imports and transforms. SQL runs; Python and R are stored, with the substrate divergence recorded." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {workbooks.map((w) => (
              <Card key={w.id} interactive compact onClick={() => { setParams({ w: w.id }) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="code-block" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{w.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{w.rid}</p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewWorkbookButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [project, setProject] = useState('')
  const { data: projects = [] } = useProjects()
  const create = useCreateWorkbook()
  return (
    <>
      <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setOpen(true) }}>New workbook</Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New workbook">
        <DialogBody>
          <div className="space-y-3">
            <InputGroup placeholder="Workbook name" value={name}
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

function WorkbookView({ workbook, onClose }: { workbook: Workbook; onClose: () => void }) {
  const { data, isLoading } = useWorkbookContents(workbook.id)
  const [branchId, setBranchId] = useState<string | null>(null)
  const contents: WorkbookContents = data ?? {
    branches: [], imports: [], transforms: [], edges: [], permissions: [],
  }
  const branch = contents.branches.find((b) => b.id === branchId)
    ?? contents.branches.find((b) => b.name === 'master') ?? null

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="wk-topbar">
        <Button variant="minimal" size="small" icon="chevron-left" onClick={onClose} />
        <span className="text-sm font-semibold truncate">{workbook.name}</span>
        <Tag minimal className="!text-[9px]">Legacy</Tag>
        <div className="wk-spacer" />
        <BranchBar workbook={workbook} contents={contents} branch={branch}
          onPick={setBranchId} />
      </div>
      <div className="wk-body">
        <ImportsRail workbook={workbook} contents={contents} />
        {branch === null ? (
          <div className="wk-canvas"><NonIdealState icon="git-branch" title="No branch" /></div>
        ) : (
          <TransformList workbook={workbook} branch={branch} contents={contents} />
        )}
      </div>
    </div>
  )
}

function BranchBar({ workbook, contents, branch, onPick }: {
  workbook: Workbook; contents: WorkbookContents
  branch: WbBranch | null; onPick: (id: string) => void
}) {
  const ops = useBranchOps(workbook.id)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const canManage = contents.permissions.includes('manage')
  const canEdit = contents.permissions.includes('edit')
  return (
    <div className="wk-branchbar">
      <Icon icon="git-branch" size={12} />
      <HTMLSelect value={branch?.id ?? ''} onChange={(e) => { onPick(e.target.value) }}>
        {contents.branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}{b.protected ? ' (protected)' : ''}
          </option>
        ))}
      </HTMLSelect>
      <Button size="small" variant="minimal" icon="plus" title="Create branch — copies the logic, pins the data"
        disabled={!canEdit} onClick={() => { setCreating(true) }} />
      {branch !== null && branch.name !== 'master' && (
        <Button size="small" variant="minimal" icon="git-merge"
          title="Merge into the immediate parent" disabled={!canEdit}
          loading={ops.merge.isPending}
          onClick={() => { ops.merge.mutate(branch.id) }} />
      )}
      {branch !== null && (
        <Button size="small" variant="minimal"
          icon={branch.protected ? 'unlock' : 'lock'}
          title={branch.protected ? 'Unprotect' : 'Protect — running defaults off'}
          disabled={!canManage}
          onClick={() => { ops.protect.mutate({ branchId: branch.id, protected: !branch.protected }) }} />
      )}
      <Dialog isOpen={creating} onClose={() => { setCreating(false) }} title="Create branch">
        <DialogBody>
          <div className="space-y-3">
            <Callout compact>
              Creating a branch copies this branch&apos;s logic and pins the state of each
              dataset at the time of creation. At most 100 branches.
            </Callout>
            <InputGroup placeholder="Branch name" value={name}
              onChange={(e) => { setName(e.target.value) }} />
            <Button intent={Intent.PRIMARY} disabled={name === ''}
              loading={ops.create.isPending}
              onClick={() => {
                ops.create.mutate({ name, parentId: branch?.id ?? null },
                  { onSuccess: () => { setCreating(false); setName('') } })
              }}>Create</Button>
          </div>
        </DialogBody>
      </Dialog>
    </div>
  )
}

function ImportsRail({ workbook, contents }: {
  workbook: Workbook; contents: WorkbookContents
}) {
  const add = useAddImport(workbook.id)
  const { data: datasets = [] } = useDatasets()
  const [alias, setAlias] = useState('')
  const [dsId, setDsId] = useState('')
  return (
    <aside className="wk-rail">
      <div className="wk-rail-head">Contents</div>
      <p className="text-[11px] text-muted-foreground px-3">
        Imports carry a workbook-specific alias — the name code uses, freely editable
        without renaming the dataset.
      </p>
      <div className="wk-rail-list">
        {contents.imports.map((i) => (
          <div key={i.id} className="wk-import">
            <Icon icon={i.datasetId !== null ? 'th' : 'cube'} size={12} />
            <span className="wk-alias-plain">{i.alias}</span>
            {i.objectTypeId !== null && (
              <Tag minimal className="!text-[9px]" title="A workbook input — its documented use is time series access, which does not run here">
                workbook input
              </Tag>
            )}
          </div>
        ))}
      </div>
      <div className="wk-rail-foot">
        <InputGroup size="small" placeholder="Alias" value={alias}
          onChange={(e) => { setAlias(e.target.value) }} />
        <HTMLSelect value={dsId} onChange={(e) => { setDsId(e.target.value) }}>
          <option value="">Dataset…</option>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </HTMLSelect>
        <Button size="small" icon="plus" disabled={alias === '' || dsId === ''}
          loading={add.isPending}
          onClick={() => {
            add.mutate({ alias, datasetId: dsId },
              { onSuccess: () => { setAlias(''); setDsId('') } })
          }}>Import</Button>
      </div>
    </aside>
  )
}

function TransformList({ workbook, branch, contents }: {
  workbook: Workbook; branch: WbBranch; contents: WorkbookContents
}) {
  const transforms = contents.transforms.filter((t) => t.branchId === branch.id)
  const [adding, setAdding] = useState(false)
  const [applying, setApplying] = useState(false)
  return (
    <div className="wk-canvas">
      {branch.protected && (
        <Callout compact intent={Intent.WARNING} className="mb-3">
          This branch is protected — nobody can make edits directly; all changes must be
          merged in through another branch.
          {!branch.allowsRunning && ' Running is off: datasets on this branch build through Foundry builds.'}
        </Callout>
      )}
      <div className="wk-flow">
        {transforms.map((t) => (
          <TransformCard key={t.id} workbook={workbook} transform={t}
            readOnly={branch.protected} contents={contents} />
        ))}
        {transforms.length === 0 && (
          <NonIdealState icon="code-block" title="No transforms on this branch"
            description="A transform reads imports and other transforms by alias — in SQL, as table names." />
        )}
        <div className="wk-add">
          <Button icon="plus" onClick={() => { setAdding(true) }}
            disabled={branch.protected}>New transform</Button>
          <Button icon="duplicate" variant="minimal" onClick={() => { setApplying(true) }}
            disabled={branch.protected}>From template</Button>
        </div>
      </div>
      {adding && (
        <NewTransformDialog workbook={workbook} branch={branch} contents={contents}
          onClose={() => { setAdding(false) }} />
      )}
      {applying && (
        <ApplyTemplateDialog workbook={workbook} branch={branch}
          onClose={() => { setApplying(false) }} />
      )}
    </div>
  )
}

function TransformCard({ workbook, transform, readOnly, contents }: {
  workbook: Workbook; transform: WbTransform; readOnly: boolean
  contents: WorkbookContents
}) {
  const save = useSaveTransform(workbook.id)
  const unsave = useUnsaveTransform(workbook.id)
  const preview = usePreview()
  const update = useUpdateSource(workbook.id)
  const [editing, setEditing] = useState(false)
  const [src, setSrc] = useState(transform.source)
  const [previewSql, setPreviewSql] = useState<string | null>(null)
  const inputs = contents.edges.filter((e) => e.transformId === transform.id)

  return (
    <Card compact className="wk-node">
      <div className="wk-node-head">
        <span className="wk-alias">{transform.alias}</span>
        <Tag minimal className="!text-[9px]">{transform.language}</Tag>
        {transform.transformType !== 'code' && (
          <Tag minimal className="!text-[9px]">{transform.transformType.replace('_', ' ')}</Tag>
        )}
        {inputs.length > 0 && (
          <span className="text-[11px] text-muted-foreground">
            ← {inputs.map((e) => {
              const im = contents.imports.find((i) => i.id === e.inputImportId)
              const tr = contents.transforms.find((t) => t.id === e.inputTransformId)
              return im?.alias ?? tr?.alias ?? '?'
            }).join(', ')}
          </span>
        )}
        <div className="wk-spacer" />
        {/* the two names a persisted node shows; unsaved shows the alias only */}
        <span className="text-[11px] text-muted-foreground">Save as dataset</span>
        <Switch checked={transform.persisted} disabled={readOnly}
          className="wk-switch"
          onChange={() => {
            if (transform.persisted) unsave.mutate(transform.id)
            else save.mutate(transform.id)
          }} />
        {/* Preview for unsaved, Run for saved — persistence, not kind */}
        {transform.persisted ? (
          <Button size="small" icon="play" loading={save.isPending}
            onClick={() => { save.mutate(transform.id) }}>Run</Button>
        ) : (
          <Button size="small" icon="eye-open" loading={preview.isPending}
            onClick={() => {
              preview.mutate(transform.id,
                { onSuccess: (sql) => { setPreviewSql(sql) } })
            }}>Preview</Button>
        )}
        <Button size="small" variant="minimal" icon="edit" disabled={readOnly}
          onClick={() => { setSrc(transform.source); setEditing(true) }} />
      </div>
      <pre className="wk-src">{transform.transformType === 'manual_entry'
        ? JSON.stringify(transform.config, null, 1) : transform.source}</pre>
      {previewSql !== null && (
        <pre className="wk-preview" title="Unpersisted nodes compute only a preview">{previewSql}</pre>
      )}
      <Dialog isOpen={editing} onClose={() => { setEditing(false) }}
        title={`Edit ${transform.alias}`}>
        <DialogBody>
          <div className="space-y-3">
            <TextArea fill value={src} onChange={(e) => { setSrc(e.target.value) }} />
            <Button intent={Intent.PRIMARY} loading={update.isPending}
              onClick={() => {
                update.mutate({ transformId: transform.id, source: src },
                  { onSuccess: () => { setEditing(false) } })
              }}>Save code</Button>
          </div>
        </DialogBody>
      </Dialog>
    </Card>
  )
}

function NewTransformDialog({ workbook, branch, contents, onClose }: {
  workbook: Workbook; branch: WbBranch; contents: WorkbookContents; onClose: () => void
}) {
  const add = useAddTransform(workbook.id)
  const [alias, setAlias] = useState('')
  const [language, setLanguage] = useState('SQL')
  const [source, setSource] = useState('SELECT * FROM ')
  const [inputs, setInputs] = useState('')
  const n = contents.transforms.filter((t) => t.branchId === branch.id).length
  return (
    <Dialog isOpen onClose={onClose} title="New transform">
      <DialogBody>
        <div className="space-y-3">
          <InputGroup placeholder="Alias (the name code uses)" value={alias}
            onChange={(e) => { setAlias(e.target.value) }} />
          <HTMLSelect fill value={language} onChange={(e) => { setLanguage(e.target.value) }}>
            <option value="SQL">SQL</option>
            <option value="Python">Python — stored, does not run here</option>
            <option value="R">R — stored, does not run here</option>
          </HTMLSelect>
          <TextArea fill value={source} onChange={(e) => { setSource(e.target.value) }} />
          <InputGroup placeholder="Input aliases, comma-separated" value={inputs}
            onChange={(e) => { setInputs(e.target.value) }} />
          <Button intent={Intent.PRIMARY} disabled={alias === ''} loading={add.isPending}
            onClick={() => {
              add.mutate({
                branchId: branch.id, alias, language, source, position: n,
                inputAliases: inputs.split(',').map((s) => s.trim()).filter((s) => s !== ''),
                imports: contents.imports, transforms: contents.transforms,
              }, { onSuccess: onClose })
            }}>Add</Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}

function ApplyTemplateDialog({ workbook, branch, onClose }: {
  workbook: Workbook; branch: WbBranch; onClose: () => void
}) {
  const { data } = useTemplates()
  const apply = useApplyTemplate(workbook.id)
  const [versionId, setVersionId] = useState('')
  const [alias, setAlias] = useState('')
  const [values, setValues] = useState<Record<string, string>>({})
  const version = data?.versions.find((v) => v.id === versionId)
  return (
    <Dialog isOpen onClose={onClose} title="Apply a template">
      <DialogBody>
        <div className="space-y-3">
          <Callout compact>
            An instance pins the version it is applied from — edits to the template never
            update it automatically.
          </Callout>
          <HTMLSelect fill value={versionId} onChange={(e) => { setVersionId(e.target.value); setValues({}) }}>
            <option value="">Template version…</option>
            {(data?.versions ?? []).map((v) => {
              const t = data?.templates.find((x) => x.id === v.templateId)
              return (
                <option key={v.id} value={v.id}>
                  {t?.name ?? '?'} (v{v.version}){v.isDefault ? ' — default' : ''} · {v.status}
                </option>
              )
            })}
          </HTMLSelect>
          <InputGroup placeholder="Instance alias" value={alias}
            onChange={(e) => { setAlias(e.target.value) }} />
          {(version?.parameters ?? []).map((p) => (
            <InputGroup key={p.name}
              placeholder={`${p.name} (${p.type === 'variable' ? (p.variable_type ?? 'variable') : p.type})`}
              value={values[p.name] ?? ''}
              onChange={(e) => { setValues({ ...values, [p.name]: e.target.value }) }} />
          ))}
          <Button intent={Intent.PRIMARY} disabled={versionId === '' || alias === ''}
            loading={apply.isPending}
            onClick={() => {
              apply.mutate({ branchId: branch.id, alias, versionId, values },
                { onSuccess: onClose })
            }}>Apply</Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}
