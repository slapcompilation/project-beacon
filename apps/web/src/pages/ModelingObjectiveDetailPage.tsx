// Modeling Objective detail — mirrors AIP's objective page (folder 4 #1, #8, #14).
// Four sections: Submissions / Evaluation / Releases / Deployments.
// Promote an adapter to a stage; spin up a live deployment; run the eval suite.

import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, HTMLSelect, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { getObjectiveDescriptor } from '@/features/modelingObjectives/registry'
import {
  useDeployments,
  useEvalRuns,
  useReleases,
  usePromoteRelease,
  useCreateDeployment,
  useStopDeployment,
  useRunEvalForAdapter,
} from '@/features/modelingObjectives/hooks'
import type { ReleaseStage, ReleaseRow, EvalRunRow } from '@/features/modelingObjectives/api'
import type { EvalSuite, ModelAdapter } from '@beacon/reality-graph'
import { useState } from 'react'

const STAGES: ReleaseStage[] = ['sandbox', 'staging', 'production']

export default function ModelingObjectiveDetailPage() {
  const { objectiveName = '' } = useParams<{ objectiveName: string }>()
  const navigate   = useNavigate()
  const descriptor = getObjectiveDescriptor(objectiveName)

  const { data: releases = [],    isLoading: relLoading }   = useReleases(objectiveName)
  const { data: evalRuns = [],    isLoading: evalLoading }  = useEvalRuns(objectiveName)
  const { data: deployments = [], isLoading: depLoading }   = useDeployments()

  const releaseByStage = useMemo(() => {
    const m = new Map<ReleaseStage, ReleaseRow>()
    for (const r of releases) {
      const existing = m.get(r.stage)
      if (!existing || new Date(r.released_at).getTime() > new Date(existing.released_at).getTime()) {
        m.set(r.stage, r)
      }
    }
    return m
  }, [releases])

  const evalByAdapter = useMemo(() => {
    const m = new Map<string, EvalRunRow[]>()
    for (const r of evalRuns) {
      const key = `${r.adapter_name}@${r.adapter_version}`
      const arr = m.get(key) ?? []
      arr.push(r)
      m.set(key, arr)
    }
    return m
  }, [evalRuns])

  if (!descriptor) {
    return (
      <NonIdealState
        icon="search-template"
        title="Objective not found"
        description={`No descriptor registered for "${objectiveName}".`}
        action={<Button onClick={() => { void navigate('/modeling-objectives') }}>Back</Button>}
      />
    )
  }

  const deploymentsByRelease = new Map<string, typeof deployments>()
  for (const d of deployments) {
    const arr = deploymentsByRelease.get(d.release_id) ?? []
    arr.push(d)
    deploymentsByRelease.set(d.release_id, arr)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Link to="/modeling-objectives" className="text-xs text-muted-foreground hover:text-foreground">Modeling Objectives</Link>
          <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
          <Icon icon="predictive-analysis" intent={Intent.PRIMARY} size={14} />
          <h1 className="text-sm font-semibold">{descriptor.objective.name}</h1>
          <Tag minimal icon="flag">default → {descriptor.objective.defaultAdapter}</Tag>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{descriptor.objective.description}</p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <SubmissionsSection
          objectiveName={objectiveName}
          adapters={descriptor.adapters}
          releaseByStage={releaseByStage}
          evalByAdapter={evalByAdapter}
          evalSuite={descriptor.evalSuite}
        />

        <EvaluationSection
          evalRuns={evalRuns}
          loading={evalLoading}
          datasets={descriptor.evalSuite.datasets as string[]}
          metrics={descriptor.evalSuite.metrics as string[]}
          subsets={(descriptor.evalSuite.subsets ?? []) as string[]}
        />

        <ReleasesSection
          releases={releases}
          loading={relLoading}
          deployments={deploymentsByRelease}
        />

        <DeploymentsSection
          deployments={deployments}
          loading={depLoading}
          releaseLookup={releases}
        />
      </div>
    </div>
  )
}

// ─── Submissions ─────────────────────────────────────────────────────────────

function SubmissionsSection({
  objectiveName, adapters, releaseByStage, evalByAdapter, evalSuite,
}: {
  objectiveName:   string
  adapters:        ReadonlyArray<ModelAdapter>
  releaseByStage:  Map<ReleaseStage, ReleaseRow>
  evalByAdapter:   Map<string, EvalRunRow[]>
  evalSuite:       EvalSuite
}) {
  return (
    <Section title="Submissions" icon="layers" subtitle={`${String(adapters.length)} candidate adapter(s) registered in code`}>
      <div className="space-y-2">
        {adapters.map((adapter) => {
          const releaseTags = STAGES
            .filter((s) => {
              const r = releaseByStage.get(s)
              return r && r.adapter_name === adapter.name && r.adapter_version === adapter.version
            })
          const latestEvals = evalByAdapter.get(`${adapter.name}@${adapter.version}`) ?? []
          const latestMae   = latestEvals.find((r) => r.metric === 'mae')
          const latestRmse  = latestEvals.find((r) => r.metric === 'rmse')

          return (
            <AdapterCard
              key={`${adapter.name}@${adapter.version}`}
              adapter={adapter}
              objectiveName={objectiveName}
              evalSuite={evalSuite}
              releaseTags={releaseTags}
              latestMae={latestMae}
              latestRmse={latestRmse}
            />
          )
        })}
      </div>
    </Section>
  )
}

function AdapterCard({
  adapter, objectiveName, evalSuite, releaseTags, latestMae, latestRmse,
}: {
  adapter:         ModelAdapter
  objectiveName:   string
  evalSuite:       EvalSuite
  releaseTags:     ReleaseStage[]
  latestMae?:      EvalRunRow
  latestRmse?:     EvalRunRow
}) {
  const promote   = usePromoteRelease(objectiveName)
  const runEval   = useRunEvalForAdapter(objectiveName)
  const [stage, setStage] = useState<ReleaseStage>('staging')
  const hasEval   = !!latestMae
  const blockedByGate = stage === 'production' && !hasEval

  return (
    <Card className="space-y-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Icon icon="cube" size={12} className="text-muted-foreground" />
          <span className="text-sm font-semibold font-mono">{adapter.name}</span>
          <Tag minimal className="font-mono text-[10px]">@ {adapter.version}</Tag>
          {releaseTags.map((s) => (
            <Tag key={s} minimal intent={stageIntent(s)} icon="flag">{s}</Tag>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Tag minimal icon="confirm" intent={Intent.NONE}>
            MAE {latestMae ? String(latestMae.value) : '—'} · RMSE {latestRmse ? String(latestRmse.value) : '—'}
          </Tag>
        </div>
      </header>

      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button
          variant="minimal"
          icon="play"
          loading={runEval.isPending}
          onClick={() => { runEval.mutate({ adapter, suite: evalSuite }) }}
        >
          Run eval
        </Button>

        <HTMLSelect
          value={stage}
          onChange={(e) => { setStage(e.currentTarget.value as ReleaseStage) }}
          options={STAGES.map((s) => ({ label: s, value: s }))}
          minimal
        />
        <Button
          intent={Intent.PRIMARY}
          icon="flag"
          loading={promote.isPending}
          disabled={blockedByGate}
          title={blockedByGate ? 'Run an eval before promoting to production' : undefined}
          onClick={() => { promote.mutate({ adapterName: adapter.name, adapterVersion: adapter.version, stage }) }}
        >
          Promote to {stage}
        </Button>
      </div>
      {blockedByGate && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          <Icon icon="warning-sign" size={10} className="mr-1" />
          Production promotion gate: run an eval first so a baseline exists for comparison.
        </p>
      )}
    </Card>
  )
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

function EvaluationSection({
  evalRuns, loading, datasets, metrics, subsets,
}: {
  evalRuns: EvalRunRow[]
  loading:  boolean
  datasets: string[]
  metrics:  string[]
  subsets:  string[]
}) {
  return (
    <Section title="Evaluation" icon="confirm" subtitle={`${String(datasets.length)} dataset(s) · ${String(metrics.length)} metric(s)`}>
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Datasets:</span>
        {datasets.map((d) => <Tag key={d} minimal icon="database">{d}</Tag>)}
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold ml-3">Metrics:</span>
        {metrics.map((m) => <Tag key={m} minimal>{m}</Tag>)}
        {subsets.length > 0 && (
          <>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold ml-3">Cohorts:</span>
            {subsets.map((s) => <Tag key={s} minimal icon="people">{s}</Tag>)}
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6"><Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /></div>
      ) : evalRuns.length === 0 ? (
        <Card className="text-xs italic text-muted-foreground">
          No eval runs yet. Click <span className="font-medium">Run eval</span> on a Submissions card to populate the dashboard.
        </Card>
      ) : (
        <div className="space-y-1.5">
          {evalRuns.slice(0, 15).map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded border border-border/40 text-xs">
              <Tag minimal className="font-mono text-[10px]">{r.adapter_name}@{r.adapter_version}</Tag>
              <Tag minimal>{r.metric}</Tag>
              <span className="tabular-nums font-semibold">{r.value}</span>
              <span className="text-[10px] text-muted-foreground">({String(r.case_count)} cases)</span>
              <span className="flex-1" />
              <span className="text-[10px] text-muted-foreground">{r.dataset}</span>
              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(r.run_at), { addSuffix: true })}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─── Releases ────────────────────────────────────────────────────────────────

function ReleasesSection({
  releases, loading, deployments,
}: {
  releases:    ReleaseRow[]
  loading:     boolean
  deployments: Map<string, ReturnType<typeof useDeployments>['data']>
}) {
  const latestByStage = new Map<ReleaseStage, ReleaseRow>()
  for (const r of releases) {
    const existing = latestByStage.get(r.stage)
    if (!existing || new Date(r.released_at).getTime() > new Date(existing.released_at).getTime()) {
      latestByStage.set(r.stage, r)
    }
  }

  return (
    <Section title="Releases" icon="flag" subtitle="One pinned adapter per environment">
      {loading ? (
        <div className="flex items-center justify-center py-6"><Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {STAGES.map((s) => {
            const rel = latestByStage.get(s)
            const deploys = rel ? (deployments.get(rel.id) ?? []) : []
            return (
              <Card key={s} className={cn('flex flex-col gap-2', !rel && 'opacity-50')}>
                <div className="flex items-center gap-2">
                  <Tag minimal intent={stageIntent(s)} icon="flag">{s}</Tag>
                </div>
                {rel ? (
                  <>
                    <div className="text-xs font-mono">{rel.adapter_name}@{rel.adapter_version}</div>
                    <div className="text-[10px] text-muted-foreground">tag: {rel.tag}</div>
                    <div className="text-[10px] text-muted-foreground">
                      released {formatDistanceToNow(new Date(rel.released_at), { addSuffix: true })}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {deploys.length > 0
                        ? `${String(deploys.length)} active deployment${deploys.length === 1 ? '' : 's'}`
                        : 'no active deployments'}
                    </div>
                    {deploys.length === 0 && (
                      <DeployButton releaseId={rel.id} />
                    )}
                  </>
                ) : (
                  <span className="text-xs italic text-muted-foreground">No release at this stage</span>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </Section>
  )
}

function DeployButton({ releaseId }: { releaseId: string }) {
  const create = useCreateDeployment()
  return (
    <Button
      size="small"
      intent={Intent.PRIMARY}
      icon="cloud-upload"
      loading={create.isPending}
      onClick={() => { create.mutate({ releaseId, kind: 'live' }) }}
    >
      Deploy live
    </Button>
  )
}

// ─── Deployments ─────────────────────────────────────────────────────────────

function DeploymentsSection({
  deployments, loading, releaseLookup,
}: {
  deployments: NonNullable<ReturnType<typeof useDeployments>['data']>
  loading:     boolean
  releaseLookup: ReleaseRow[]
}) {
  const stop = useStopDeployment()
  const releaseById = new Map(releaseLookup.map((r) => [r.id, r] as const))

  return (
    <Section title="Deployments" icon="cloud" subtitle="Currently running endpoints. Stop a deployment to halt inference.">
      {loading ? (
        <div className="flex items-center justify-center py-6"><Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /></div>
      ) : deployments.length === 0 ? (
        <Card className="text-xs italic text-muted-foreground">
          No deployments yet. Promote an adapter to a stage, then click <span className="font-medium">Deploy live</span> on the release card.
        </Card>
      ) : (
        <div className="space-y-1.5">
          {deployments.map((d) => {
            const rel = releaseById.get(d.release_id)
            return (
              <Link key={d.id} to={`/deployments/${d.id}`}>
                <div className="flex items-center gap-3 px-2 py-1.5 rounded border border-border/40 text-xs hover:bg-surface-2 transition-colors">
                  <Tag minimal intent={statusIntent(d.status)}>{d.status}</Tag>
                  <Tag minimal icon="cloud">{d.kind}</Tag>
                  {rel && (
                    <>
                      <Tag minimal intent={stageIntent(rel.stage)}>{rel.stage}</Tag>
                      <span className="font-mono text-[11px]">{rel.adapter_name}@{rel.adapter_version}</span>
                    </>
                  )}
                  <span className="text-[10px] text-muted-foreground">{d.resource_profile}</span>
                  <span className="flex-1" />
                  <span className="text-[10px] text-muted-foreground">
                    started {formatDistanceToNow(new Date(d.started_at), { addSuffix: true })}
                  </span>
                  {d.status === 'running' && (
                    <Button
                      size="small"
                      variant="minimal"
                      intent={Intent.DANGER}
                      icon="stop"
                      loading={stop.isPending}
                      onClick={(e) => { e.preventDefault(); stop.mutate(d.id) }}
                    >
                      Stop
                    </Button>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </Section>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function Section({ title, icon, subtitle, children }: { title: string; icon: 'layers' | 'confirm' | 'flag' | 'cloud'; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1.5 ml-6">{subtitle}</p>
      {children}
    </section>
  )
}

function stageIntent(stage: ReleaseStage): Intent {
  switch (stage) {
    case 'production': return Intent.SUCCESS
    case 'staging':    return Intent.WARNING
    case 'sandbox':    return Intent.NONE
  }
}

function statusIntent(status: string): Intent {
  switch (status) {
    case 'running':   return Intent.SUCCESS
    case 'starting':  return Intent.WARNING
    case 'failed':    return Intent.DANGER
    case 'stopped':   return Intent.NONE
    default:          return Intent.NONE
  }
}

