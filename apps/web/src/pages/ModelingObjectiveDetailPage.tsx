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
  useForecastAccuracy,
  useDecisionQuality,
  usePromoteRelease,
  useCreateDeployment,
  useStopDeployment,
  useRunEvalForAdapter,
  useRunRealEval,
} from '@/features/modelingObjectives/hooks'
import type { ReleaseStage, ReleaseRow, EvalRunRow } from '@/features/modelingObjectives/api'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { recommendAdapterPromotion, type PromotionRecommendation } from '@beacon/reality-graph'
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

  const recommendation = useMemo<PromotionRecommendation>(() => {
    // Latest MAE per adapter@version → the eval winner vs the production release.
    const latestMae = new Map<string, EvalRunRow>()
    for (const r of evalRuns) {
      if (r.metric !== 'mae') continue
      const key = `${r.adapter_name}@${r.adapter_version}`
      const ex = latestMae.get(key)
      if (!ex || new Date(r.run_at).getTime() > new Date(ex.run_at).getTime()) latestMae.set(key, r)
    }
    const evals = [...latestMae.values()].map((r) => ({ name: r.adapter_name, version: r.adapter_version, value: r.value }))
    const prod = releaseByStage.get('production')
    return recommendAdapterPromotion(evals, prod ? { name: prod.adapter_name, version: prod.adapter_version } : null)
  }, [evalRuns, releaseByStage])

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
        <PromotionBanner objectiveName={objectiveName} rec={recommendation} />

        <SubmissionsSection
          objectiveName={objectiveName}
          adapters={descriptor.adapters}
          releaseByStage={releaseByStage}
          evalByAdapter={evalByAdapter}
          evalSuite={descriptor.evalSuite}
        />

        {objectiveName === 'consumption_forecast' && <DecisionQualitySection />}
        {objectiveName === 'consumption_forecast' && <AccuracySection />}

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

// ─── Promotion recommendation (closes the modeling loop) ─────────────────────

function PromotionBanner({ objectiveName, rec }: { objectiveName: string; rec: PromotionRecommendation }) {
  const promote = usePromoteRelease(objectiveName)
  if (rec.action !== 'promote' || !rec.winner) return null
  const winner = rec.winner
  return (
    <Card className="flex items-center gap-3 border border-primary/40 bg-primary/5">
      <Icon icon="lightbulb" intent={Intent.PRIMARY} size={16} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">
          Recommended: promote <span className="font-mono">{winner.name}</span> to production
        </div>
        <div className="text-[11px] text-muted-foreground">{rec.reason}</div>
      </div>
      <Button
        intent={Intent.PRIMARY}
        icon="flag"
        loading={promote.isPending}
        onClick={() => { promote.mutate({ adapterName: winner.name, adapterVersion: winner.version, stage: 'production' }) }}
      >
        Promote to production
      </Button>
    </Card>
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
  const runReal = useRunRealEval(objectiveName)
  return (
    <Section title="Submissions" icon="layers" subtitle={`${String(adapters.length)} candidate adapter(s) registered in code`}>
      {/* Q5: the per-adapter "Run eval" below grades against the SYNTHETIC suite,
          whose expected value is the flat 30-day mean — it scores conformity to
          the baseline, not accuracy. This grades every candidate on real held-out
          demand instead, and that's what the promotion banner should read. */}
      <Card className="flex items-center gap-3 mb-2 border border-primary/30 bg-primary/5">
        <Icon icon="pulse" size={14} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium">Grade on real demand</p>
          <p className="text-[11px] text-muted-foreground">
            Holds out the last 7 days of this hotel's real stock logs and scores every adapter against what actually got consumed, per category cohort.
          </p>
        </div>
        <Button
          size="small" intent={Intent.PRIMARY} icon="play"
          loading={runReal.isPending}
          onClick={() => { runReal.mutate({ adapters, holdoutDays: 7 }) }}
        >
          Run real backtest
        </Button>
      </Card>
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

// ─── Decision quality (live) — the north-star (roadmap Q0) ───────────────────
// The outcome a forecast is ultimately judged by. Under-forecast → stock-out
// days; over-forecast → waste. Accuracy (below) is the model; this is the result.

function DecisionQualitySection() {
  const hotelId = useActiveHotelId()
  const { data: rows = [], isLoading } = useDecisionQuality(hotelId)

  const summary = useMemo(() => {
    if (rows.length === 0) return null
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    return {
      variants:     rows.length,
      stockoutDays: rows.reduce((s, r) => s + r.stockout_days, 0),
      availability: mean(rows.map((r) => r.availability_rate)),
      wasteUnits:   rows.reduce((s, r) => s + r.waste_units, 0),
      wasteRate:    mean(rows.map((r) => r.waste_rate)),
    }
  }, [rows])

  return (
    <Section
      title="Decision quality (live)"
      icon="shield"
      subtitle="The outcome the forecast is judged by, over the last 30 days: stock-out days (the cost of under-ordering) and waste (the cost of over-ordering). This is what later phases must move — not just MAPE below."
    >
      {!hotelId ? (
        <Card className="text-xs italic text-muted-foreground">Select a hotel to grade its decisions.</Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-6"><Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /></div>
      ) : !summary ? (
        <Card className="text-xs italic text-muted-foreground">
          No variant has recorded outcomes to grade yet. Stock-out days need on-hand balances on the logs; waste is read from write-offs.
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MetricTag label="Stock-out days" value={String(summary.stockoutDays)} intent={summary.stockoutDays > 0 ? Intent.WARNING : Intent.SUCCESS} hint="variant-days on-hand hit zero — the cost of forecasting low" />
            <MetricTag label="Availability" value={pct(summary.availability)} intent={summary.availability >= 0.98 ? Intent.SUCCESS : summary.availability >= 0.9 ? Intent.WARNING : Intent.DANGER} hint="mean share of the window stock was on hand" />
            <MetricTag label="Waste" value={pct(summary.wasteRate)} intent={summary.wasteRate <= 0.02 ? Intent.SUCCESS : summary.wasteRate <= 0.05 ? Intent.WARNING : Intent.DANGER} hint={`${String(summary.wasteUnits)} units lost to spoilage/damage — the cost of forecasting high`} />
            <Tag minimal icon="cube">{summary.variants} variants</Tag>
          </div>

          <div className="space-y-1">
            {rows.filter((r) => r.stockout_days > 0 || r.waste_units > 0).slice(0, 12).map((r) => (
              <div key={r.variant_id} className="flex items-center gap-3 px-2 py-1.5 rounded border border-border/40 text-xs">
                <span className="font-medium truncate max-w-[180px]" title={r.variant_name}>{r.variant_name}</span>
                <span className="flex-1" />
                {r.stockout_days > 0 && (
                  <Tag minimal intent={Intent.WARNING} className="tabular-nums" title="days on-hand hit zero">{r.stockout_days} stockout d</Tag>
                )}
                {r.waste_units > 0 && (
                  <Tag minimal intent={r.waste_rate > 0.05 ? Intent.DANGER : Intent.NONE} className="tabular-nums" title="units lost to waste">{r.waste_units}u waste</Tag>
                )}
                <span className="text-[10px] text-muted-foreground tabular-nums">{pct(r.availability_rate)} avail</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

// ─── Accuracy (live) ─────────────────────────────────────────────────────────

function AccuracySection() {
  const hotelId = useActiveHotelId()
  const { data: rows = [], isLoading } = useForecastAccuracy(hotelId)

  const summary = useMemo(() => {
    if (rows.length === 0) return null
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
    return {
      variants: rows.length,
      mape:     mean(rows.map((r) => r.mape)),
      bias:     mean(rows.map((r) => r.bias_pct)),
    }
  }, [rows])

  return (
    <Section
      title="Accuracy (live)"
      icon="pulse"
      subtitle="Each variant's recent forecasts — from the model auto-select actually chose for it — scored against what got consumed, over 4 rolling 7-day windows. Distinct from the eval suite below (synthetic cases)."
    >
      {!hotelId ? (
        <Card className="text-xs italic text-muted-foreground">Select a hotel to score its forecasts.</Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-6"><Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /></div>
      ) : !summary ? (
        <Card className="text-xs italic text-muted-foreground">
          No variant has enough history to score yet (needs ≥7 training days and consumption in a closed 7-day window).
          Scoring runs over the last ~10 weeks of stock logs and fills in as consumption accrues.
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <MetricTag label="Avg MAPE" value={pct(summary.mape)} intent={mapeIntent(summary.mape)} hint="mean absolute % error across scored variants — lower is better" />
            <MetricTag
              label={summary.bias < 0 ? 'Under-forecast' : 'Over-forecast'}
              value={pct(Math.abs(summary.bias))}
              intent={biasIntent(summary.bias)}
              hint={summary.bias < 0
                ? 'projects less than gets consumed → stockout risk'
                : 'projects more than gets consumed → overstock / waste risk'}
            />
            <Tag minimal icon="cube">{summary.variants} variants scored</Tag>
          </div>

          <div className="space-y-1">
            {rows.map((r) => (
              <div key={r.variant_id} className="flex items-center gap-3 px-2 py-1.5 rounded border border-border/40 text-xs">
                <span className="font-medium truncate max-w-[180px]" title={r.variant_name}>{r.variant_name}</span>
                <Tag minimal icon="predictive-analysis" className="text-[10px]" title="model auto-select chose for this variant">{adapterLabel(r.basis)}</Tag>
                <span className="flex-1" />
                <Tag minimal className="tabular-nums">MAPE {pct(r.mape)}</Tag>
                <Tag minimal intent={biasIntent(r.bias_pct)} className="tabular-nums">
                  {r.bias_pct < 0 ? '−' : '+'}{pct(Math.abs(r.bias_pct))}
                </Tag>
                <span className="text-[10px] text-muted-foreground tabular-nums">{r.n} win</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  )
}

function MetricTag({ label, value, intent, hint }: { label: string; value: string; intent: Intent; hint: string }) {
  return (
    <div className="flex flex-col px-2.5 py-1.5 rounded border border-border/50 min-w-[110px]" title={hint}>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <span className={cn('text-sm font-semibold tabular-nums', intentText(intent))}>{value}</span>
    </div>
  )
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`

/** 'auto:holt-linear-v1' → 'Holt' — the model auto-select picked for the variant. */
function adapterLabel(basis: string): string {
  const b = basis.replace(/^auto:/, '')
  if (b.startsWith('holt')) return 'Holt'
  if (b.startsWith('ewma')) return 'EWMA'
  if (b.startsWith('seasonal')) return 'Seasonal'
  if (b.startsWith('baseline')) return 'Baseline'
  return b
}

function mapeIntent(mape: number): Intent {
  if (mape <= 0.2) return Intent.SUCCESS
  if (mape <= 0.5) return Intent.WARNING
  return Intent.DANGER
}
function biasIntent(bias: number): Intent {
  const a = Math.abs(bias)
  if (a <= 0.15) return Intent.SUCCESS
  if (a <= 0.4)  return Intent.WARNING
  return Intent.DANGER
}
function intentText(i: Intent): string {
  switch (i) {
    case Intent.SUCCESS: return 'text-emerald-600 dark:text-emerald-400'
    case Intent.WARNING: return 'text-amber-600 dark:text-amber-400'
    case Intent.DANGER:  return 'text-red-600 dark:text-red-400'
    default:             return ''
  }
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

const ALL_COHORTS = '__all__'

function EvaluationSection({
  evalRuns, loading, datasets, metrics, subsets,
}: {
  evalRuns: EvalRunRow[]
  loading:  boolean
  datasets: string[]
  metrics:  string[]
  subsets:  string[]
}) {
  const [cohort, setCohort] = useState<string>(ALL_COHORTS)

  // Subsets present in the data right now (in addition to 'overall').
  const knownSubsets = ['overall', ...new Set(evalRuns.map((r) => r.subset).filter((s) => s !== 'overall'))]
  const filtered = cohort === ALL_COHORTS ? evalRuns : evalRuns.filter((r) => r.subset === cohort)

  // Latest run per (adapter_version, metric, subset)
  const latestByAdapterMetric = new Map<string, EvalRunRow>()
  for (const r of filtered) {
    const key = `${r.adapter_name}@${r.adapter_version}::${r.metric}`
    const existing = latestByAdapterMetric.get(key)
    if (!existing || new Date(r.run_at).getTime() > new Date(existing.run_at).getTime()) {
      latestByAdapterMetric.set(key, r)
    }
  }
  const latestRuns = [...latestByAdapterMetric.values()]
  const adapterKeys = [...new Set(latestRuns.map((r) => `${r.adapter_name}@${r.adapter_version}`))].sort()
  const metricNames = [...new Set(latestRuns.map((r) => r.metric))]

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

        {knownSubsets.length > 1 && (
          <>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold ml-3">View:</span>
            <HTMLSelect
              minimal
              value={cohort}
              onChange={(e) => { setCohort(e.currentTarget.value) }}
              options={[
                { label: 'All cohorts', value: ALL_COHORTS },
                ...knownSubsets.map((s) => ({ label: s, value: s })),
              ]}
            />
          </>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6"><Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} /></div>
      ) : filtered.length === 0 ? (
        <Card className="text-xs italic text-muted-foreground">
          {evalRuns.length === 0
            ? <>No eval runs yet. Click <span className="font-medium">Run eval</span> on a Submissions card to populate the dashboard.</>
            : <>No eval runs for cohort <span className="font-mono">{cohort}</span>.</>}
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Diff matrix: latest score per (metric, adapter), winner highlighted */}
          {adapterKeys.length >= 1 && (
            <DiffMatrix
              adapterKeys={adapterKeys}
              metrics={metricNames}
              latest={latestByAdapterMetric}
              runs={filtered}
            />
          )}

          {/* Recent runs log */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Recent runs</h4>
            <div className="space-y-1.5">
              {filtered.slice(0, 15).map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded border border-border/40 text-xs">
                  <Tag minimal className="font-mono text-[10px]">{r.adapter_name}@{r.adapter_version}</Tag>
                  <Tag minimal>{r.metric}</Tag>
                  <Tag minimal className="text-[10px]">{r.subset}</Tag>
                  <span className="tabular-nums font-semibold">{r.value}</span>
                  <span className="text-[10px] text-muted-foreground">({String(r.case_count)} cases)</span>
                  <span className="flex-1" />
                  <span className="text-[10px] text-muted-foreground">{r.dataset}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(r.run_at), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Section>
  )
}

// ─── Eval diff matrix ────────────────────────────────────────────────────────

/** For each metric, render one row per adapter with its latest value + delta
 *  from the best (lowest, since MAE/RMSE are loss metrics) adapter. */
function DiffMatrix({
  adapterKeys, metrics, latest, runs,
}: {
  adapterKeys: string[]
  metrics:     string[]
  latest:      Map<string, EvalRunRow>
  runs:        EvalRunRow[]
}) {
  return (
    <div className="space-y-3">
      {metrics.map((metric) => {
        const rows = adapterKeys
          .map((key) => ({ key, row: latest.get(`${key}::${metric}`) }))
          .filter((r) => !!r.row) as Array<{ key: string; row: EvalRunRow }>
        if (rows.length === 0) return null
        const best = rows.reduce((a, b) => (a.row.value <= b.row.value ? a : b))

        return (
          <Card key={metric} className="space-y-2">
            <div className="flex items-center gap-2">
              <Tag minimal intent={Intent.PRIMARY}>{metric}</Tag>
              <span className="text-[11px] text-muted-foreground">lower is better</span>
            </div>
            <div className="space-y-1">
              {rows.map(({ key, row }) => {
                const isBest = key === best.key
                const delta  = row.value - best.row.value
                const sparkline = sparkRuns(runs, row.adapter_name, row.adapter_version, metric)
                return (
                  <div
                    key={key}
                    className={cn(
                      'flex items-center gap-3 px-2 py-1.5 rounded text-xs',
                      isBest ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/40' : 'border border-border/40',
                    )}
                  >
                    <Tag minimal className="font-mono text-[10px]">{key}</Tag>
                    <span className="tabular-nums font-semibold">{row.value}</span>
                    {isBest ? (
                      <Tag minimal intent={Intent.SUCCESS} icon="tick">best</Tag>
                    ) : (
                      <Tag minimal intent={Intent.WARNING} icon="arrow-up">+{delta.toFixed(4)}</Tag>
                    )}
                    <span className="text-[10px] text-muted-foreground">({String(row.case_count)} cases)</span>
                    <span className="flex-1" />
                    {sparkline.length > 1 && <Sparkline values={sparkline} />}
                    <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(row.run_at), { addSuffix: true })}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function sparkRuns(runs: EvalRunRow[], adapterName: string, adapterVersion: string, metric: string): number[] {
  const matching = runs
    .filter((r) => r.adapter_name === adapterName && r.adapter_version === adapterVersion && r.metric === metric)
    .sort((a, b) => new Date(a.run_at).getTime() - new Date(b.run_at).getTime())
    .map((r) => r.value)
  return matching.slice(-10)
}

function Sparkline({ values }: { values: number[] }) {
  const w = 60
  const h = 16
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} className="text-muted-foreground/70">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1} />
    </svg>
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

function Section({ title, icon, subtitle, children }: { title: string; icon: 'layers' | 'confirm' | 'flag' | 'cloud' | 'pulse' | 'shield'; subtitle: string; children: React.ReactNode }) {
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

