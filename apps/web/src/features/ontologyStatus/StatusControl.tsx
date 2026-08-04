// Developmental state, for anything that carries it.
//
// Object types, link types and interfaces all have `status`, `visibility`, the
// deprecation record and the guards (migration 321) — Foundry gives a status to
// "every object type, property, link type, action, or interface". Only object
// types had a control, so this is the one all three share rather than a second
// panel that drifts from the first.
//
// `promoted` is not here: it is a Compass resource status on its own axis, and
// lives in features/promotion.

import { useState } from 'react'
import { Button, Card, HTMLSelect, Intent, InputGroup, Tag } from '@blueprintjs/core'
import {
  ONTOLOGY_STATUSES, ONTOLOGY_VISIBILITIES, STATUS_META, VISIBILITY_META,
  statusChangeProblem, type Deprecation, type OntologyStatus, type OntologyStatusMeta,
  type OntologyVisibility,
} from '@beacon/reality-graph'

const INTENTS: Record<OntologyStatusMeta['intent'], Intent> = {
  success: Intent.SUCCESS, primary: Intent.PRIMARY, warning: Intent.WARNING,
  danger: Intent.DANGER, none: Intent.NONE,
}

export function StatusTag({ status }: { status: OntologyStatus }) {
  const m = STATUS_META[status]
  return (
    <Tag minimal intent={INTENTS[m.intent]} className="!text-[9px] uppercase tracking-wide" title={m.help}>
      {m.label}
    </Tag>
  )
}

export interface StatusValue {
  status: OntologyStatus
  visibility: OntologyVisibility
  deprecation: Deprecation | null
}

/** The editor. `replacements` are the api_names this resource could be replaced
 *  by — Foundry asks for the successor when deprecating, and a deprecation that
 *  names none leaves the next reader to guess. */
export function StatusControl({
  current, visibility: currentVisibility, deprecation: currentDeprecation,
  replacements, visibilityLocked, pending, onSave,
}: {
  current: OntologyStatus
  visibility: OntologyVisibility
  deprecation: Deprecation | null
  replacements: { apiName: string; label: string }[]
  /** True when a promotion owns the visibility — promoted implies prominent. */
  visibilityLocked?: boolean
  pending?: boolean
  onSave: (v: StatusValue) => void
}) {
  const [status, setStatus] = useState<OntologyStatus>(current)
  const [visibility, setVisibility] = useState<OntologyVisibility>(currentVisibility)
  const [reason, setReason] = useState(currentDeprecation?.reason ?? '')
  const [deadline, setDeadline] = useState(currentDeprecation?.deadline ?? '')
  const [replacedBy, setReplacedBy] = useState(currentDeprecation?.replacedBy ?? '')

  const deprecation = status === 'deprecated'
    ? { reason, deadline, replacedBy: replacedBy || null }
    : null
  const problem = statusChangeProblem(current, status, deprecation)

  return (
    <Card compact className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
          <HTMLSelect value={status} onChange={(e) => { setStatus(e.currentTarget.value as OntologyStatus) }}>
            {ONTOLOGY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </HTMLSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Visibility</span>
          <HTMLSelect value={visibility} disabled={visibilityLocked}
            title={visibilityLocked ? 'A promoted resource is prominent by definition.' : undefined}
            onChange={(e) => { setVisibility(e.currentTarget.value as OntologyVisibility) }}>
            {ONTOLOGY_VISIBILITIES.map((v) => <option key={v} value={v}>{VISIBILITY_META[v].label}</option>)}
          </HTMLSelect>
        </label>
        <p className="text-[11px] text-muted-foreground flex-1 min-w-48">{STATUS_META[status].help}</p>
      </div>

      {status === 'deprecated' && (
        <div className="flex flex-wrap items-end gap-3 border-t border-border/40 pt-3">
          <label className="flex flex-col gap-1 flex-1 min-w-56">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Why</span>
            <InputGroup size="small" value={reason} placeholder="Superseded by the maintenance ticket type"
              onChange={(e) => { setReason(e.currentTarget.value) }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Delete by</span>
            <InputGroup size="small" type="date" value={deadline}
              onChange={(e) => { setDeadline(e.currentTarget.value) }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Replaced by</span>
            <HTMLSelect value={replacedBy} onChange={(e) => { setReplacedBy(e.currentTarget.value) }}>
              <option value="">Nothing — it is simply going</option>
              {replacements.map((r) => <option key={r.apiName} value={r.apiName}>{r.label}</option>)}
            </HTMLSelect>
          </label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="small" intent={Intent.PRIMARY} icon="tick" disabled={!!problem} loading={pending}
          onClick={() => { onSave({ status, visibility, deprecation }) }}>
          Save
        </Button>
        {problem && <span className="text-[11px] text-muted-foreground">{problem}</span>}
      </div>
    </Card>
  )
}
