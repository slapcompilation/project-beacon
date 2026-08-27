// Machine Learning — models and modeling objectives, the lifecycle between
// them, and deployments that actually run.
//
// The objective page follows the submission capture (concepts_concept-review):
// a submissions list with checks and reviews, a Releases rail with BOTH tag
// badges and "Tagged production on", and a Deployments section grouped by
// environment with the capture's RELEASE / HEALTH / UPGRADE columns.

import { useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, HTMLSelect, Icon, InputGroup,
  Intent, Spinner, SpinnerSize, Tag, TextArea,
} from '@blueprintjs/core'
import { useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/projects/api'
import { useDatasets } from '@/features/datasets/api'
import {
  useModels, useModelContents, useObjectives, useObjectiveContents,
  useCheckStatus, useCreateModel, usePublishVersion, useCreateObjective,
  useSubmitModel, useReview, useCreateRelease, usePromote, useCreateDeployment,
  useStartDirectDeployment, useLiveRun, useBatchRun, useLatestTagged,
  useAdapterFunctions, useAdapterVersions,
  type Objective, type ObjectiveContents, type Submission,
  type Deployment, type Release,
} from '@/features/modeling/api'

export default function ModelingPage() {
  const [params, setParams] = useSearchParams()
  const objectiveId = params.get('o')
  const modelId = params.get('m')
  if (objectiveId !== null) {
    return <ObjectiveView id={objectiveId} onClose={() => { setParams({}) }} />
  }
  if (modelId !== null) {
    return <ModelView id={modelId} onClose={() => { setParams({}) }} />
  }
  return <Landing onOpen={(k, id) => { setParams(k === 'o' ? { o: id } : { m: id }) }} />
}

function Landing({ onOpen }: { onOpen: (kind: 'o' | 'm', id: string) => void }) {
  const { data: objectives = [], isLoading: lo } = useObjectives()
  const { data: models = [], isLoading: lm } = useModels()

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-5xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Machine Learning</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            A model is artifacts plus an adapter. An objective is the interface of a modeling
            problem — submissions implement it, releases tag the accepted ones, and deployments
            pick up the latest release carrying their tag.
          </p>
        </header>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Modeling objectives</h2>
            <NewObjectiveButton />
          </div>
          {lo ? <Spinner size={SpinnerSize.SMALL} /> : objectives.length === 0 ? (
            <Card compact className="text-sm text-muted-foreground">
              No objectives yet. An objective is the definition of a modeling problem — the
              interface the models submitted to it implement.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {objectives.map((o) => (
                <Card key={o.id} interactive compact onClick={() => { onOpen('o', o.id) }}>
                  <div className="flex items-center gap-2">
                    <Icon icon="locate" size={14} className="text-violet-500" />
                    <span className="text-sm font-semibold truncate">{o.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {o.description === '' ? o.rid : o.description}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Models</h2>
            <NewModelButton />
          </div>
          {lm ? <Spinner size={SpinnerSize.SMALL} /> : models.length === 0 ? (
            <Card compact className="text-sm text-muted-foreground">
              No models yet. A model version carries its artifacts and the exact adapter
              version they are read through.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {models.map((m) => (
                <Card key={m.id} interactive compact onClick={() => { onOpen('m', m.id) }}>
                  <div className="flex items-center gap-2">
                    <Icon icon="graph" size={14} className="text-violet-500" />
                    <span className="text-sm font-semibold truncate">{m.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5 truncate">{m.rid}</p>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function NewObjectiveButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [project, setProject] = useState('')
  const { data: projects = [] } = useProjects()
  const create = useCreateObjective()
  return (
    <>
      <Button size="small" icon="plus" onClick={() => { setOpen(true) }}>New objective</Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New modeling objective">
        <DialogBody>
          <div className="space-y-3">
            <InputGroup placeholder="Objective name" value={name}
              onChange={(e) => { setName(e.target.value) }} />
            <InputGroup placeholder="What problem does it define?" value={desc}
              onChange={(e) => { setDesc(e.target.value) }} />
            <HTMLSelect fill value={project} onChange={(e) => { setProject(e.target.value) }}>
              <option value="">Choose a project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </HTMLSelect>
            <Button intent={Intent.PRIMARY} disabled={name === '' || project === ''}
              loading={create.isPending}
              onClick={() => {
                create.mutate({ projectId: project, name, description: desc },
                  { onSuccess: () => { setOpen(false); setName('') } })
              }}>Create</Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

function NewModelButton() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [project, setProject] = useState('')
  const { data: projects = [] } = useProjects()
  const create = useCreateModel()
  return (
    <>
      <Button size="small" icon="plus" onClick={() => { setOpen(true) }}>New model</Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="New model">
        <DialogBody>
          <div className="space-y-3">
            <InputGroup placeholder="Model name" value={name}
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

// ── the model page: versions, publishing, the direct deployment ─────────────

function ModelView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: models = [] } = useModels()
  const model = models.find((m) => m.id === id)
  const { data, isLoading } = useModelContents(id)
  const start = useStartDirectDeployment(id)
  const live = useLiveRun()
  const [liveInput, setLiveInput] = useState('[{"sqft": 100}]')
  const [liveOut, setLiveOut] = useState<string | null>(null)

  if (isLoading || model === undefined) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  const versions = data?.versions ?? []
  const direct = data?.directDeploymentId ?? null

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start gap-3">
          <Button variant="minimal" icon="chevron-left" onClick={onClose} />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{model.name}</h1>
            <p className="text-[11px] text-muted-foreground font-mono">{model.rid}</p>
          </div>
          <PublishVersionButton modelId={id} />
          <SubmitToObjectiveButton modelVersions={versions.map((v) => ({ id: v.id, n: v.version }))} />
        </header>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Versions</h2>
          {versions.length === 0 ? (
            <Card compact className="text-sm text-muted-foreground">
              No versions yet. Publishing pairs artifacts with the exact adapter version that
              reads them.
            </Card>
          ) : versions.map((v) => (
            <Card key={v.id} compact className="ml-version">
              <Tag minimal className="!text-[9px]">v{v.version}</Tag>
              <span className="text-[11px] text-muted-foreground font-mono">{v.source}</span>
              <span className="text-[11px] text-muted-foreground font-mono truncate flex-1">
                {JSON.stringify(v.artifacts)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(v.createdAt).toLocaleDateString()}
              </span>
            </Card>
          ))}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Live inference — direct deployment</h2>
          {direct === null ? (
            <Card compact className="flex items-center gap-3">
              <p className="text-sm text-muted-foreground flex-1">
                A direct deployment follows this model&apos;s latest version — publishing a new
                version upgrades it automatically. One per model.
              </p>
              <Button icon="play" intent={Intent.PRIMARY} disabled={versions.length === 0}
                loading={start.isPending} onClick={() => { start.mutate() }}>
                Start Deployment
              </Button>
            </Card>
          ) : (
            <Card compact className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                Rows in, predictions out — one predict call in the function isolate, against the
                latest version&apos;s artifacts.
              </p>
              <TextArea fill value={liveInput}
                onChange={(e) => { setLiveInput(e.target.value) }} />
              <div className="flex items-center gap-2">
                <Button size="small" icon="play" intent={Intent.PRIMARY} loading={live.isPending}
                  onClick={() => {
                    let parsed: unknown
                    try { parsed = JSON.parse(liveInput) } catch { setLiveOut('That input is not valid JSON.'); return }
                    live.mutate({ kind: 'direct', deploymentId: direct, input: parsed },
                      { onSuccess: (out) => { setLiveOut(JSON.stringify(out, null, 1)) } })
                  }}>Run</Button>
                {liveOut !== null && (
                  <pre className="ml-output">{liveOut}</pre>
                )}
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  )
}

function PublishVersionButton({ modelId }: { modelId: string }) {
  const [open, setOpen] = useState(false)
  const [artifacts, setArtifacts] = useState('{"slope": 2.0, "intercept": 0}')
  const [fnId, setFnId] = useState('')
  const [versionId, setVersionId] = useState('')
  const { data: fns = [] } = useAdapterFunctions()
  const { data: fnVersions = [] } = useAdapterVersions(fnId === '' ? null : fnId)
  const publish = usePublishVersion(modelId)
  return (
    <>
      <Button size="small" icon="cube-add" onClick={() => { setOpen(true) }}>Publish version</Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="Publish a model version">
        <DialogBody>
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Artifacts are the weights; the adapter is a function version of the uniform shape
              predict(artifacts: string, input: string) → string.
            </p>
            <TextArea fill value={artifacts} onChange={(e) => { setArtifacts(e.target.value) }} />
            <HTMLSelect fill value={fnId} onChange={(e) => { setFnId(e.target.value); setVersionId('') }}>
              <option value="">Adapter function…</option>
              {fns.map((f) => <option key={f.id} value={f.id}>{f.displayName}</option>)}
            </HTMLSelect>
            <HTMLSelect fill value={versionId} disabled={fnId === ''}
              onChange={(e) => { setVersionId(e.target.value) }}>
              <option value="">Adapter version…</option>
              {fnVersions.map((v) => (
                <option key={v.id} value={v.id} disabled={!v.uniform}>
                  {v.semver}{v.uniform ? '' : ' — not the predict shape'}
                </option>
              ))}
            </HTMLSelect>
            <Button intent={Intent.PRIMARY} disabled={versionId === ''} loading={publish.isPending}
              onClick={() => {
                let parsed: unknown
                try { parsed = JSON.parse(artifacts) } catch { return }
                publish.mutate({ artifacts: parsed, adapterVersionId: versionId },
                  { onSuccess: () => { setOpen(false) } })
              }}>Publish</Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

function SubmitToObjectiveButton({ modelVersions }: {
  modelVersions: { id: string; n: number }[]
}) {
  const [open, setOpen] = useState(false)
  const [objectiveId, setObjectiveId] = useState('')
  const [versionId, setVersionId] = useState('')
  const { data: objectives = [] } = useObjectives()
  const submit = useSubmitModel(objectiveId)
  return (
    <>
      <Button size="small" icon="send-message" intent={Intent.PRIMARY}
        disabled={modelVersions.length === 0} onClick={() => { setOpen(true) }}>
        Submit model
      </Button>
      <Dialog isOpen={open} onClose={() => { setOpen(false) }} title="Submit to a modeling objective">
        <DialogBody>
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Submitting creates an immutable copy of the version — like a pull request, you are
              asking for a comprehensive review.
            </p>
            <HTMLSelect fill value={objectiveId} onChange={(e) => { setObjectiveId(e.target.value) }}>
              <option value="">Objective…</option>
              {objectives.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </HTMLSelect>
            <HTMLSelect fill value={versionId} onChange={(e) => { setVersionId(e.target.value) }}>
              <option value="">Model version…</option>
              {modelVersions.map((v) => <option key={v.id} value={v.id}>v{v.n}</option>)}
            </HTMLSelect>
            <Button intent={Intent.PRIMARY} disabled={objectiveId === '' || versionId === ''}
              loading={submit.isPending}
              onClick={() => {
                submit.mutate({ modelVersionId: versionId }, { onSuccess: () => { setOpen(false) } })
              }}>Submit</Button>
          </div>
        </DialogBody>
      </Dialog>
    </>
  )
}

// ── the objective page ──────────────────────────────────────────────────────

function ObjectiveView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: objectives = [] } = useObjectives()
  const objective = objectives.find((o) => o.id === id)
  const { data, isLoading } = useObjectiveContents(id)

  if (isLoading || objective === undefined) {
    return <div className="flex-1 flex items-center justify-center"><Spinner size={SpinnerSize.SMALL} /></div>
  }
  const c: ObjectiveContents = data ?? {
    submissions: [], checks: [], reviews: [], releases: [], deployments: [], runs: [],
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-5xl space-y-6">
        <header className="flex items-start gap-3">
          <Button variant="minimal" icon="chevron-left" onClick={onClose} />
          <div className="flex-1">
            <h1 className="text-xl font-semibold">{objective.name}</h1>
            <p className="text-sm text-muted-foreground">{objective.description}</p>
          </div>
        </header>

        <div className="ml-columns">
          <div className="space-y-6">
            <SubmissionsSection objective={objective} contents={c} />
            <DeploymentsSection objective={objective} contents={c} />
          </div>
          <ReleasesRail objective={objective} contents={c} />
        </div>
      </div>
    </div>
  )
}

function SubmissionsSection({ objective, contents }: {
  objective: Objective; contents: ObjectiveContents
}) {
  const review = useReview(objective.id)
  const release = useCreateRelease(objective.id)
  const [releasing, setReleasing] = useState<Submission | null>(null)
  const [label, setLabel] = useState('1.0')
  const [note, setNote] = useState('')

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Models</h2>
      {contents.submissions.length === 0 ? (
        <Card compact className="text-sm text-muted-foreground">
          Nothing submitted yet. A submission is a copy of a model version, asking for review.
        </Card>
      ) : contents.submissions.map((s) => {
        const reviews = contents.reviews.filter((r) => r.submissionId === s.id)
        const released = contents.releases.some((r) => r.submissionId === s.id)
        return (
          <Card key={s.id} compact className={s.archivedAt !== null ? 'ml-archived' : undefined}>
            <div className="flex items-center gap-2">
              <Icon icon="graph" size={12} className="text-violet-500" />
              <span className="text-sm font-semibold">
                {s.snapshot.model_name} v{s.snapshot.model_version}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">
                adapter {s.snapshot.adapter.version}
              </span>
              <div className="flex-1" />
              {s.archivedAt !== null && <Tag minimal className="!text-[9px]">archived</Tag>}
              {released && <Tag minimal intent={Intent.SUCCESS} className="!text-[9px]">released</Tag>}
              {!released && s.archivedAt === null && (
                <Button size="small" icon="tag" onClick={() => { setReleasing(s) }}>
                  Release to staging
                </Button>
              )}
            </div>
            <div className="ml-checkrow">
              {contents.checks.map((ch) => (
                <CheckChip key={ch.id} checkId={ch.id} submissionId={s.id} name={ch.name} />
              ))}
              {reviews.map((r) => (
                <Tag key={r.id} minimal className="!text-[9px]"
                  intent={r.decision === 'accept' ? Intent.SUCCESS
                    : r.decision === 'reject' ? Intent.DANGER : Intent.NONE}>
                  {r.decision === 'accept' ? 'Accepted' : r.decision === 'reject' ? 'Rejected' : 'Comment'}
                </Tag>
              ))}
              <div className="flex-1" />
              {/* the capture's three options, its own words in the titles */}
              <Button size="small" variant="minimal" icon="tick"
                title="Approve this model to be tagged as a release"
                onClick={() => { review.mutate({ submissionId: s.id, decision: 'accept', body: '' }) }} />
              <Button size="small" variant="minimal" icon="cross"
                title="Reject this model"
                onClick={() => { review.mutate({ submissionId: s.id, decision: 'reject', body: '' }) }} />
            </div>
          </Card>
        )
      })}

      <Dialog isOpen={releasing !== null} onClose={() => { setReleasing(null) }}
        title="Create release">
        <DialogBody>
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              A release is created staging; Mark as production promotes it. Checks advise and
              never block — it is not mandatory for all checks to be approved.
            </p>
            <InputGroup placeholder="Release number" value={label}
              onChange={(e) => { setLabel(e.target.value) }} />
            <InputGroup placeholder="Release note" value={note}
              onChange={(e) => { setNote(e.target.value) }} />
            <Button intent={Intent.PRIMARY} disabled={label === ''} loading={release.isPending}
              onClick={() => {
                if (releasing !== null) {
                  release.mutate({ submissionId: releasing.id, versionLabel: label, note },
                    { onSuccess: () => { setReleasing(null) } })
                }
              }}>Create release</Button>
          </div>
        </DialogBody>
      </Dialog>
    </section>
  )
}

function CheckChip({ checkId, submissionId, name }: {
  checkId: string; submissionId: string; name: string
}) {
  const { data: status } = useCheckStatus(checkId, submissionId)
  const s = status ?? 'PENDING'
  return (
    <Tag minimal className="!text-[9px]"
      intent={s === 'PASS' || s === 'APPROVED' ? Intent.SUCCESS
        : s === 'REJECT' ? Intent.DANGER : Intent.NONE}>
      {name}: {s}
    </Tag>
  )
}

function ReleasesRail({ objective, contents }: {
  objective: Objective; contents: ObjectiveContents
}) {
  const promote = usePromote(objective.id)
  return (
    <aside className="space-y-2">
      <h2 className="text-sm font-semibold">Releases</h2>
      {contents.releases.length === 0 ? (
        <Card compact className="text-sm text-muted-foreground">No releases</Card>
      ) : contents.releases.map((r: Release) => (
        <Card key={r.id} compact className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Icon icon="tag" size={11} />
            <span className="text-sm font-semibold">{r.versionLabel}</span>
            {/* both badges, the way the release history draws them */}
            <Tag minimal className="!text-[9px]">Staging</Tag>
            {r.promotedAt !== null && (
              <Tag minimal intent={Intent.SUCCESS} className="!text-[9px]">Production</Tag>
            )}
          </div>
          {r.releaseNote !== '' && (
            <p className="text-[11px] text-muted-foreground">{r.releaseNote}</p>
          )}
          {r.promotedAt !== null ? (
            <p className="text-[11px] text-muted-foreground">
              Tagged production on {new Date(r.promotedAt).toLocaleDateString()}
            </p>
          ) : (
            <Button size="small" icon="double-chevron-up" loading={promote.isPending}
              onClick={() => { promote.mutate(r.id) }}>
              Mark as production
            </Button>
          )}
        </Card>
      ))}
    </aside>
  )
}

function DeploymentsSection({ objective, contents }: {
  objective: Objective; contents: ObjectiveContents
}) {
  const [creating, setCreating] = useState(false)
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Icon icon="cloud-upload" size={13} />Deployments
        </h2>
        <Button size="small" icon="plus" onClick={() => { setCreating(true) }}>
          Create deployment
        </Button>
      </div>
      {/* grouped by environment, the way the deployments capture draws it */}
      {(['production', 'staging'] as const).map((env) => {
        const rows = contents.deployments.filter((d) => d.environment === env)
        if (rows.length === 0) return null
        return (
          <EnvironmentGroup key={env} env={env} objective={objective}
            deployments={rows} contents={contents} />
        )
      })}
      {contents.deployments.length === 0 && (
        <Card compact className="text-sm text-muted-foreground">
          No deployments. A deployment names an environment tag, never a release — it always
          picks up the latest release carrying its tag.
        </Card>
      )}
      {creating && (
        <NewDeploymentDialog objective={objective} onClose={() => { setCreating(false) }} />
      )}
    </section>
  )
}

function EnvironmentGroup({ env, objective, deployments, contents }: {
  env: 'staging' | 'production'; objective: Objective
  deployments: Deployment[]; contents: ObjectiveContents
}) {
  const { data: currentRelease } = useLatestTagged(objective.id, env)
  const batch = useBatchRun(objective.id)
  const live = useLiveRun()
  const [liveFor, setLiveFor] = useState<string | null>(null)
  const [liveInput, setLiveInput] = useState('[{"sqft": 100}]')
  const [liveOut, setLiveOut] = useState<string | null>(null)
  const current = contents.releases.find((r) => r.id === currentRelease)
  const allCurrent = deployments.every((d) => {
    const run = contents.runs.find((r) => r.deploymentId === d.id)
    return d.deploymentType === 'live' || run === undefined || run.releaseId === currentRelease
  })

  return (
    <div className="ml-envgroup">
      <div className="ml-envhead">
        <span className="text-sm font-semibold capitalize">{env}</span>
        <Tag minimal className="!text-[9px]">{deployments.length}</Tag>
        {current !== undefined && (
          <>
            {allCurrent && (
              <Tag minimal intent={Intent.SUCCESS} className="!text-[9px]">
                All deployments upgraded
              </Tag>
            )}
            <span className="text-[11px] text-muted-foreground">
              Release {current.versionLabel}
            </span>
          </>
        )}
      </div>
      <table className="ml-table">
        <thead>
          <tr><th>Deployment name</th><th>Type</th><th>Last updated</th><th>Release</th><th>Health</th><th>Upgrade</th><th /></tr>
        </thead>
        <tbody>
          {deployments.map((d) => {
            const run = contents.runs.find((r) => r.deploymentId === d.id)
            const ranRelease = contents.releases.find((r) => r.id === run?.releaseId)
            const upgraded = run === undefined || run.releaseId === currentRelease
            return (
              <tr key={d.id}>
                <td className="font-semibold">{d.name}</td>
                <td className="capitalize">{d.deploymentType}</td>
                <td>{run !== undefined ? new Date(run.ranAt).toLocaleString() : '—'}</td>
                <td>{ranRelease?.versionLabel ?? '—'}</td>
                <td>
                  {run !== undefined && (
                    <Icon icon={run.status === 'COMPLETED' ? 'tick-circle' : 'error'} size={13}
                      intent={run.status === 'COMPLETED' ? Intent.SUCCESS : Intent.DANGER} />
                  )}
                </td>
                <td>
                  <Icon icon={upgraded ? 'tick-circle' : 'refresh'} size={13}
                    intent={upgraded ? Intent.SUCCESS : Intent.WARNING} />
                </td>
                <td>
                  {d.deploymentType === 'batch' ? (
                    <Button size="small" icon="play" loading={batch.isPending}
                      onClick={() => { batch.mutate(d.id) }}>Run</Button>
                  ) : (
                    <Button size="small" icon="play" onClick={() => { setLiveFor(d.id); setLiveOut(null) }}>
                      Query
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Dialog isOpen={liveFor !== null} onClose={() => { setLiveFor(null) }} title="Live inference">
        <DialogBody>
          <div className="space-y-2">
            <TextArea fill value={liveInput} onChange={(e) => { setLiveInput(e.target.value) }} />
            <Button size="small" icon="play" intent={Intent.PRIMARY} loading={live.isPending}
              onClick={() => {
                let parsed: unknown
                try { parsed = JSON.parse(liveInput) } catch { setLiveOut('That input is not valid JSON.'); return }
                if (liveFor !== null) {
                  live.mutate({ kind: 'objective', deploymentId: liveFor, input: parsed },
                    { onSuccess: (out) => { setLiveOut(JSON.stringify(out, null, 1)) } })
                }
              }}>Run</Button>
            {liveOut !== null && <pre className="ml-output">{liveOut}</pre>}
          </div>
        </DialogBody>
      </Dialog>
    </div>
  )
}

function NewDeploymentDialog({ objective, onClose }: {
  objective: Objective; onClose: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'batch' | 'live'>('batch')
  const [env, setEnv] = useState<'staging' | 'production'>('staging')
  const [inputId, setInputId] = useState('')
  const [outputId, setOutputId] = useState('')
  const { data: datasets = [] } = useDatasets()
  const create = useCreateDeployment(objective.id)
  return (
    <Dialog isOpen onClose={onClose} title="Create new deployment">
      <DialogBody>
        <div className="space-y-3">
          <InputGroup placeholder="Deployment name" value={name}
            onChange={(e) => { setName(e.target.value) }} />
          {/* the form's own captions */}
          <HTMLSelect fill value={type}
            onChange={(e) => { setType(e.target.value as 'batch' | 'live') }}>
            <option value="batch">Batch — models will take in and output a dataset in one build</option>
            <option value="live">Live — near real-time inference, executed by API calls</option>
          </HTMLSelect>
          <HTMLSelect fill value={env}
            onChange={(e) => { setEnv(e.target.value as 'staging' | 'production') }}>
            <option value="staging">Release tag to deploy: Staging</option>
            <option value="production">Release tag to deploy: Production</option>
          </HTMLSelect>
          {type === 'batch' && (
            <>
              <HTMLSelect fill value={inputId} onChange={(e) => { setInputId(e.target.value) }}>
                <option value="">Input dataset…</option>
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </HTMLSelect>
              <HTMLSelect fill value={outputId} onChange={(e) => { setOutputId(e.target.value) }}>
                <option value="">Output dataset…</option>
                {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </HTMLSelect>
            </>
          )}
          <Callout compact>
            Each environment takes the corresponding release — a production environment takes
            the latest production tagged release.
          </Callout>
          <Button intent={Intent.PRIMARY} loading={create.isPending}
            disabled={name === '' || (type === 'batch' && (inputId === '' || outputId === ''))}
            onClick={() => {
              create.mutate({
                name, deploymentType: type, environment: env,
                inputDatasetId: type === 'batch' ? inputId : undefined,
                outputDatasetId: type === 'batch' ? outputId : undefined,
              }, { onSuccess: onClose })
            }}>Create deployment</Button>
        </div>
      </DialogBody>
    </Dialog>
  )
}
