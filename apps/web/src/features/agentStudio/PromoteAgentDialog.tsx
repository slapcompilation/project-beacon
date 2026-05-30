// Admin-only modal for promoting (or demoting) an agent to a target stage.
// The DB enforces auth_role IN ('admin','owner') and eval_pass_rate >= 0.7 for
// production promotions; this form mirrors those rules client-side so the
// affordance is honest before the round-trip.

import { useState } from 'react'
import { Button, Dialog, DialogBody, DialogFooter, FormGroup, HTMLSelect, InputGroup, Intent, NumericInput, TextArea } from '@blueprintjs/core'
import { toast } from 'sonner'
import { usePromoteAgent, type AgentReleaseStage, type CurrentAgentRelease } from './hooks'

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
  const [notes, setNotes]                 = useState<string>('')
  const promote = usePromoteAgent()

  const productionRequiresPass =
    targetStage === 'production' && (evalPassRate == null || evalPassRate < PRODUCTION_MIN_PASS)

  const disabled = promote.isPending || version.trim().length === 0 || productionRequiresPass

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

        <FormGroup
          label={`Eval pass rate (0–1)${targetStage === 'production' ? ' — required, ≥ 0.7' : ' — optional'}`}
          labelFor="promote-pass-rate"
          intent={productionRequiresPass ? Intent.WARNING : Intent.NONE}
          helperText={
            productionRequiresPass
              ? `Production needs ≥ ${String(PRODUCTION_MIN_PASS)} (server enforces this).`
              : 'Snapshot of the eval suite at the moment of release.'
          }
        >
          <NumericInput
            id="promote-pass-rate"
            min={0}
            max={1}
            stepSize={0.05}
            minorStepSize={0.01}
            value={evalPassRate ?? ''}
            onValueChange={(n) => { setEvalPassRate(Number.isFinite(n) ? n : null) }}
            fill
          />
        </FormGroup>

        <FormGroup label="Eval case count (optional)" labelFor="promote-case-count">
          <NumericInput
            id="promote-case-count"
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
