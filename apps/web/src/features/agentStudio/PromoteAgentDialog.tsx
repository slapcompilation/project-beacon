// Admin-only modal for promoting (or demoting) an agent to a target stage.
// G2: the eval pass rate + case count auto-fill from the latest model_eval_runs
// row for the requested (objective, version). Production submit is blocked when
// no row exists — the operator has to land a CI run first.
//
// The DB still enforces auth_role IN ('admin','owner') and the policy-driven
// production_pass_rate_floor; this form mirrors those rules client-side so the
// affordance is honest before the round-trip.

import { useEffect, useState } from 'react'
import { Button, Callout, Dialog, DialogBody, DialogFooter, FormGroup, HTMLSelect, InputGroup, Intent, NumericInput, Tag, TextArea } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { usePromoteAgent, useLatestEvalRun, useCurrentAgentReleases, type AgentReleaseStage, type CurrentAgentRelease } from './hooks'

interface PromoteAgentDialogProps {
  open:           boolean
  agentName:      string
  currentVersion: string
  currentStage:   AgentReleaseStage
  onClose:        () => void
}

const STAGES: AgentReleaseStage[] = ['sandbox', 'staging', 'production']
const PRODUCTION_MIN_PASS = 0.7

export function PromoteAgentDialog({ open, agentName, currentVersion, currentStage, onClose }: PromoteAgentDialogProps) {
  const [targetStage, setTargetStage]     = useState<AgentReleaseStage>(currentStage)
  const [version, setVersion]             = useState<string>(currentVersion)
  const [evalPassRate, setEvalPassRate]   = useState<number | null>(null)
  const [evalCaseCount, setEvalCaseCount] = useState<number | null>(null)
  const [overrideEvals, setOverrideEvals] = useState<boolean>(false)
  const [notes, setNotes]                 = useState<string>('')
  const promote = usePromoteAgent()

  const latestRun = useLatestEvalRun(agentName, version.trim())
  const currentReleases = useCurrentAgentReleases()

  // Auto-fill pass rate + case count from the latest persisted run. Operator
  // can flip overrideEvals to type their own numbers (e.g. for a sandbox
  // promotion of a version that hasn't run CI yet).
  useEffect(() => {
    if (overrideEvals) return
    if (latestRun.data) {
      setEvalPassRate(latestRun.data.value)
      setEvalCaseCount(latestRun.data.case_count)
    } else {
      setEvalPassRate(null)
      setEvalCaseCount(null)
    }
  }, [latestRun.data, overrideEvals])

  // Production is verified SERVER-side against the latest recorded eval run
  // (migration 175) — the typed/override value is ignored for production, so the
  // affordance gates on the recorded run, and override can't bypass it.
  const productionRequiresRun =
    targetStage === 'production' && !latestRun.isLoading && latestRun.data == null
  const productionRequiresPass =
    targetStage === 'production' && latestRun.data != null && latestRun.data.value < PRODUCTION_MIN_PASS
  // Gap D: production requires the exact version to have passed through staging.
  const hasStagingForVersion = (currentReleases.data ?? []).some(
    (r) => r.agent_name === agentName && r.stage === 'staging' && r.version === version.trim(),
  )
  const productionRequiresStaging =
    targetStage === 'production' && !currentReleases.isLoading && !hasStagingForVersion

  const disabled = promote.isPending || version.trim().length === 0
    || productionRequiresPass || productionRequiresRun || productionRequiresStaging

  function submit() {
    promote.mutate(
      {
        agentName,
        version: version.trim(),
        targetStage,
        evalPassRate:  evalPassRate ?? undefined,
        evalCaseCount: evalCaseCount ?? undefined,
        notes:         notes.trim() || undefined,
      },
      {
        onSuccess: (row: CurrentAgentRelease) => {
          toast.success(`${agentName} v${row.version} → ${row.stage}`)
          onClose()
        },
        onError: (err: Error) => { toast.error(err.message) },
      },
    )
  }

  return (
    <Dialog isOpen={open} onClose={onClose} title={`Promote ${agentName}`} icon="flag">
      <DialogBody>
        <FormGroup label="Target stage" labelFor="promote-stage">
          <HTMLSelect
            id="promote-stage"
            fill
            value={targetStage}
            onChange={(e) => { setTargetStage(e.currentTarget.value as AgentReleaseStage) }}
          >
            {STAGES.map((s) => <option key={s} value={s}>{s}{s === currentStage ? ' (current)' : ''}</option>)}
          </HTMLSelect>
        </FormGroup>

        <FormGroup label="Version" labelFor="promote-version">
          <InputGroup
            id="promote-version"
            value={version}
            onChange={(e) => { setVersion(e.currentTarget.value) }}
            placeholder="e.g. 1.0.0"
          />
        </FormGroup>

        <FormGroup label="Eval suite (from model_eval_runs)">
          <LatestRunBanner
            objectiveName={agentName}
            version={version.trim()}
            isLoading={latestRun.isLoading}
            run={latestRun.data ?? null}
            overrideEvals={overrideEvals}
            onToggleOverride={() => { setOverrideEvals(!overrideEvals) }}
          />
        </FormGroup>

        {productionRequiresRun && (
          <Callout intent={Intent.WARNING} icon="warning-sign" title="No eval run recorded for this version">
            Production promotion is blocked until a CI eval posts a result for <code>@ {version.trim() || '?'}</code>.
            The server verifies production against the recorded run — <em>override can't bypass it</em>. Land a PR to record one.
          </Callout>
        )}

        {productionRequiresStaging && (
          <Callout intent={Intent.WARNING} icon="warning-sign" title="No staging release for this version">
            Production requires <code>{agentName}</code> @ <code>{version.trim() || '?'}</code> to pass through staging first.
            Promote it to <strong>staging</strong>, then to production. The server enforces this.
          </Callout>
        )}

        <FormGroup
          label={`Eval pass rate (0–1)${targetStage === 'production' ? ' — required, ≥ 0.7' : ' — optional'}`}
          labelFor="promote-pass-rate"
          intent={productionRequiresPass ? Intent.WARNING : Intent.NONE}
          helperText={
            targetStage === 'production'
              ? 'Production is verified server-side against the latest recorded eval run — this value is informational; override does not apply.'
              : productionRequiresPass
                ? `Production needs ≥ ${String(PRODUCTION_MIN_PASS)} (server enforces this).`
                : overrideEvals
                  ? 'Override mode: typing supersedes the auto-filled value from model_eval_runs.'
                  : 'Auto-filled from the latest model_eval_runs row for this version.'
          }
        >
          <NumericInput
            id="promote-pass-rate"
            disabled={!overrideEvals && latestRun.data != null}
            min={0}
            max={1}
            stepSize={0.05}
            minorStepSize={0.01}
            value={evalPassRate ?? ''}
            onValueChange={(n) => { setEvalPassRate(Number.isFinite(n) ? n : null) }}
            fill
          />
        </FormGroup>

        <FormGroup label="Eval case count" labelFor="promote-case-count">
          <NumericInput
            id="promote-case-count"
            disabled={!overrideEvals && latestRun.data != null}
            min={0}
            value={evalCaseCount ?? ''}
            onValueChange={(n) => { setEvalCaseCount(Number.isFinite(n) ? Math.round(n) : null) }}
            fill
          />
        </FormGroup>

        <FormGroup label="Notes (optional)" labelFor="promote-notes">
          <TextArea
            id="promote-notes"
            fill
            value={notes}
            onChange={(e) => { setNotes(e.currentTarget.value) }}
            placeholder="What changed since the previous release at this stage?"
          />
        </FormGroup>
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose} disabled={promote.isPending}>Cancel</Button>
            <Button intent={Intent.PRIMARY} onClick={submit} disabled={disabled} loading={promote.isPending}>
              Promote
            </Button>
          </>
        }
      />
    </Dialog>
  )
}

function LatestRunBanner({
  objectiveName, version, isLoading, run, overrideEvals, onToggleOverride,
}: {
  objectiveName: string
  version:       string
  isLoading:     boolean
  run:           import('./hooks').EvalRunRow | null
  overrideEvals: boolean
  onToggleOverride: () => void
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      {isLoading
        ? <Tag minimal>looking up @ {version || '?'}</Tag>
        : run != null
          ? <>
              <Tag minimal intent={Intent.SUCCESS} icon="confirm">
                {Math.round(run.value * 100)}% pass
              </Tag>
              <span className="text-muted-foreground">{run.case_count} cases</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(run.run_at), { addSuffix: true })}
              </span>
            </>
          : <Tag minimal intent={Intent.WARNING} icon="warning-sign">no run for @ {version || '?'}</Tag>}
      <Button
        size="small" variant="minimal"
        intent={overrideEvals ? Intent.PRIMARY : Intent.NONE}
        icon={overrideEvals ? 'tick-circle' : 'edit'}
        onClick={onToggleOverride}
        className="ml-auto"
      >
        {overrideEvals ? 'Using override' : 'Override'}
      </Button>
      <span className="basis-full text-[11px] text-muted-foreground">
        Auto-filled from <code>model_eval_runs</code> for{' '}
        <code>{objectiveName}</code> @ <code>{version || '—'}</code>.
      </span>
    </div>
  )
}
