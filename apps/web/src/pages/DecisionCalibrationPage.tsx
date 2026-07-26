// Decision Calibration — does a stated confidence match reality? When an agent
// says 0.85, is it right 85% of the time? Operator disposition is the ground
// truth (approved = hit, rejected/refined = miss). The math is reality-graph's
// computeCalibration; this page slices the resolved population and renders the
// reliability picture, honestly flagging when there isn't enough to judge.
//
// It's also where the operator owns *how* decisions are scored: the edit penalty
// and recency half-life are policy, previewed here before saving, and every
// consumer (both gates, the copilot, the Flywheel) reads the same values.

import { Link } from 'react-router-dom'
import {
  Button, Card, HTMLSelect, Icon, Intent, NonIdealState, NumericInput, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import type { CalibrationBin, CalibrationReport, CalibrationVerdict, OrgPolicy } from '@beacon/reality-graph'
import { orgPolicyToCalibrationOptions } from '@beacon/reality-graph'
import {
  useDecisionCalibration,
  deriveCalibration,
  type CalibrationSlice,
  type CalibrationWindow,
} from '@/features/calibration/hooks'
import { useOrgPolicy, useSetOrgPolicy } from '@/features/mind/policy'
import type { ResolvedSample } from '@/features/calibration/api'
import { useMemo, useState } from 'react'

const WINDOWS: { value: CalibrationWindow; label: string }[] = [
  { value: 30, label: 'Last 30 days' },
  { value: 90, label: 'Last 90 days' },
  { value: 0,  label: 'All time' },
]

export default function DecisionCalibrationPage() {
  const [window, setWindow] = useState<CalibrationWindow>(90)
  const { calibration, samples, isLoading, isError, refetch, isFetching } = useDecisionCalibration(window)
  const { data: policyData } = useOrgPolicy()
  const setPolicy = useSetOrgPolicy()

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (isError || !calibration) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to load calibration"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  const { overall, byAgent, byActionType, totalResolved } = calibration

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold">Decision Calibration</h1>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            When an agent says it's 85% sure, is it right 85% of the time? Your decisions are the
            ground truth — approved counts as a hit, rejected or refined as a miss, and a call you
            edited before approving as a partial hit. Recent outcomes weigh more; you set how much
            below.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HTMLSelect
            value={window}
            onChange={(e) => { setWindow(Number(e.currentTarget.value) as CalibrationWindow) }}
            options={WINDOWS.map((w) => ({ value: w.value, label: w.label }))}
            minimal
          />
          <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {policyData && (
          <ScoringPolicyCard
            policy={policyData.merged}
            samples={samples ?? []}
            saving={setPolicy.isPending}
            onSave={(calibration) => { setPolicy.mutate({ ...policyData.merged, calibration }) }}
          />
        )}
        {overall.resolved === 0 ? (
          <EmptyState totalResolved={totalResolved} />
        ) : (
          <>
            <OverallCard report={overall} />
            <SliceTable title="By agent"  rows={byAgent} />
            <SliceTable title="By action type" rows={byActionType} />
          </>
        )}
        {setPolicy.isError && <p className="text-xs text-red-500">{setPolicy.error.message}</p>}
      </div>
    </div>
  )
}

// The scoring knobs are policy, not code — and the effect is previewed against
// the real resolved population before it's saved, so the operator sees what the
// change does to ECE and the verdict rather than guessing.
function ScoringPolicyCard({ policy, samples, onSave, saving }: {
  policy: OrgPolicy
  samples: ResolvedSample[]
  onSave: (calibration: OrgPolicy['calibration']) => void
  saving: boolean
}) {
  const saved = policy.calibration
  const [penalty, setPenalty] = useState(Math.round(saved.edit_penalty * 100))
  const [halfLife, setHalfLife] = useState(saved.half_life_days)
  const dirty = penalty !== Math.round(saved.edit_penalty * 100) || halfLife !== saved.half_life_days

  const savedOpts = orgPolicyToCalibrationOptions(policy)
  const draft = useMemo(() => {
    if (!dirty || samples.length === 0) return null
    const next = deriveCalibration(samples, { ...savedOpts, editPenalty: penalty / 100, halfLifeDays: halfLife })
    return { current: deriveCalibration(samples, savedOpts).overall, next: next.overall }
  }, [dirty, samples, penalty, halfLife, savedOpts.editPenalty, savedOpts.halfLifeDays, savedOpts.minSamples])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scoring policy</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            How a decision is scored. Both auto-execution gates, the copilot and the Flywheel read these.
          </p>
        </div>
        <Button size="small" intent={Intent.PRIMARY} icon="floppy-disk" disabled={!dirty} loading={saving}
          onClick={() => { onSave({ edit_penalty: penalty / 100, half_life_days: halfLife }) }}>
          Save scoring
        </Button>
      </div>

      <div className="flex flex-wrap gap-6">
        <Knob label="Edit penalty" suffix="%" value={penalty} min={0} max={100} onChange={setPenalty}
          hint={penalty === 0 ? 'an edited approval counts as a full hit' : penalty === 100 ? 'an edited approval counts as a miss' : `an edited approval scores ${String(100 - penalty)}% of a hit`} />
        <Knob label="Recency half-life" suffix="days" value={halfLife} min={0} max={3650} onChange={setHalfLife}
          hint={halfLife === 0 ? 'no decay — all history weighs equally' : `a decision ${String(halfLife)}d old counts half as much`} />
      </div>

      {draft && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] flex items-center gap-3 flex-wrap">
          <Icon icon="eye-open" size={12} className="text-primary shrink-0" />
          <span className="text-muted-foreground">Unsaved preview on {String(draft.current.resolved)} scored decisions:</span>
          <span className="tabular-nums">ECE {draft.current.ece.toFixed(3)} → <strong>{draft.next.ece.toFixed(3)}</strong></span>
          {draft.current.verdict !== draft.next.verdict && (
            <span className="flex items-center gap-1"><VerdictTag verdict={draft.current.verdict} small /> → <VerdictTag verdict={draft.next.verdict} small /></span>
          )}
        </div>
      )}
    </Card>
  )
}

function Knob({ label, value, min, max, suffix, hint, onChange }: {
  label: string; value: number; min: number; max: number; suffix: string; hint: string
  onChange: (n: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <NumericInput value={value} min={min} max={max} stepSize={suffix === '%' ? 5 : 15} style={{ width: 80 }} buttonPosition="none"
          onValueChange={(v) => { onChange(Math.round(Math.min(max, Math.max(min, Number.isFinite(v) ? v : min)))) }} />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
      <span className="text-[10px] text-muted-foreground/70 leading-tight max-w-[220px]">{hint}</span>
    </div>
  )
}

function EmptyState({ totalResolved }: { totalResolved: number }) {
  return (
    <NonIdealState
      icon={<Icon icon="timeline-line-chart" size={32} className="text-muted-foreground/40" />}
      title="No resolved decisions to score yet"
      description={
        `Calibration needs proposals you've acted on — approved or rejected. ` +
        `Once you've worked through some of the review queue, the reliability of each agent's ` +
        `confidence shows up here. ${totalResolved === 0 ? '' : `(${String(totalResolved)} resolved so far, none scoreable.)`}`
      }
      action={<Link to="/mind?aip=queue"><Button intent={Intent.PRIMARY} icon="predictive-analysis">Go to Review Queue</Button></Link>}
    />
  )
}

function OverallCard({ report }: { report: CalibrationReport }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <VerdictTag verdict={report.verdict} />
          <span className="text-[11px] text-muted-foreground">
            {String(report.resolved)} resolved decision{report.resolved === 1 ? '' : 's'} scored
          </span>
        </div>
        <EstimateStrength confidence={report.confidence} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric label="Stated avg" value={pct(report.meanConfidence)} hint="What the agents claimed" />
        <Metric label="Observed"   value={pct(report.accuracy)}       hint="How often they were right" />
        <Metric label="ECE" value={report.ece.toFixed(3)} hint="Expected Calibration Error — 0 is perfect" />
        <Metric label="Brier" value={report.brier.toFixed(3)} hint="Brier score — lower is better" />
      </div>

      {!report.sufficientData && <InsufficientNote report={report} />}

      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
          Reliability by confidence band
        </p>
        <div className="space-y-1.5">
          {report.bins.map((b) => <BinRow key={b.lower} bin={b} />)}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/40" /> claimed
          <span className="inline-block h-2 w-2 rounded-full bg-primary ml-2" /> observed — aligned bars mean honest confidence.
        </p>
      </div>
    </Card>
  )
}

function BinRow({ bin }: { bin: CalibrationBin }) {
  const observedPct = Math.round(bin.accuracy * 100)
  const claimedPct  = Math.round(bin.meanConfidence * 100)
  const intent = gapIntent(bin.gap)
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
        {Math.round(bin.lower * 100)}–{Math.round(bin.upper * 100)}%
      </span>
      <div className="relative flex-1 h-4 rounded-sm bg-muted/40 overflow-hidden">
        <div
          className={barClass(intent)}
          style={{ width: `${String(observedPct)}%` }}
        />
        {/* claimed marker — where the agent thought it would land */}
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/70"
          style={{ left: `${String(claimedPct)}%` }}
          title={`claimed ${String(claimedPct)}%`}
        />
      </div>
      <span className="w-24 shrink-0 text-right tabular-nums">
        {observedPct}% obs · {String(bin.count)}n
      </span>
      <GapTag gap={bin.gap} />
    </div>
  )
}

function SliceTable({ title, rows }: { title: string; rows: CalibrationSlice[] }) {
  if (rows.length === 0) return null
  return (
    <Card className="flex flex-col gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      <div className="divide-y divide-border/40">
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Name</span>
          <span className="text-right w-14">Stated</span>
          <span className="text-right w-14">Observed</span>
          <span className="text-right w-12">n</span>
          <span className="text-right w-28">Verdict</span>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-3 py-1.5 items-center text-xs">
            <span className="font-mono truncate">{r.key}</span>
            <span className="text-right w-14 tabular-nums text-muted-foreground">{pct(r.report.meanConfidence)}</span>
            <span className="text-right w-14 tabular-nums">{pct(r.report.accuracy)}</span>
            <span className="text-right w-12 tabular-nums text-muted-foreground">{String(r.report.resolved)}</span>
            <span className="text-right w-28"><VerdictTag verdict={r.report.verdict} small /></span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function InsufficientNote({ report }: { report: CalibrationReport }) {
  const oneClass = report.resolved > 0 && (report.accuracy === 0 || report.accuracy === 1)
  return (
    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
      <Icon icon="info-sign" size={12} className="mt-0.5 text-amber-500 shrink-0" />
      <span>
        {oneClass
          ? `Every resolved decision so far landed the same way (all ${report.accuracy === 1 ? 'approved' : 'rejected'}). Calibration needs both hits and misses — keep working the queue.`
          : `Only ${String(report.resolved)} resolved decision${report.resolved === 1 ? '' : 's'} — too few to trust the estimate. The picture firms up as the queue clears.`}
      </span>
    </div>
  )
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold tabular-nums leading-none">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</span>
      <span className="text-[10px] text-muted-foreground/70 leading-tight">{hint}</span>
    </div>
  )
}

function EstimateStrength({ confidence }: { confidence: number }) {
  return (
    <span className="text-[10px] text-muted-foreground flex items-center gap-1.5" title="How much to trust this estimate, driven by sample size + outcome balance">
      <Icon icon="confirm" size={11} />
      estimate strength {pct(confidence)}
    </span>
  )
}

function VerdictTag({ verdict, small }: { verdict: CalibrationVerdict; small?: boolean }) {
  const map: Record<CalibrationVerdict, { intent: Intent; label: string }> = {
    'well-calibrated':   { intent: Intent.SUCCESS, label: 'Well calibrated' },
    'overconfident':     { intent: Intent.DANGER,  label: 'Overconfident' },
    'underconfident':    { intent: Intent.WARNING, label: 'Underconfident' },
    'insufficient-data': { intent: Intent.NONE,    label: 'Not enough data' },
  }
  const v = map[verdict]
  return <Tag minimal intent={v.intent} className={small ? '!text-[10px]' : undefined}>{v.label}</Tag>
}

function GapTag({ gap }: { gap: number }) {
  if (Math.abs(gap) <= 0.05) return <Tag minimal intent={Intent.SUCCESS} className="!text-[10px] w-14 text-center">on target</Tag>
  const sign = gap < 0 ? '−' : '+'
  return (
    <Tag minimal intent={gap < 0 ? Intent.DANGER : Intent.WARNING} className="!text-[10px] w-14 text-center tabular-nums">
      {sign}{Math.round(Math.abs(gap) * 100)}%
    </Tag>
  )
}

function gapIntent(gap: number): Intent {
  if (Math.abs(gap) <= 0.05) return Intent.SUCCESS
  return gap < 0 ? Intent.DANGER : Intent.WARNING
}

function barClass(intent: Intent): string {
  const base = 'absolute top-0 bottom-0 left-0 rounded-sm '
  if (intent === Intent.SUCCESS) return base + 'bg-emerald-500/70'
  if (intent === Intent.DANGER)  return base + 'bg-red-500/60'
  return base + 'bg-amber-400/70'
}

function pct(x: number): string {
  return `${String(Math.round(x * 100))}%`
}
