// Authoring an action type, and reading what it has done.
//
// Foundry's creation wizard, from action-types/getting-started: a display name,
// **Change object(s)** set to Create/Modify/Delete, the object type, and **Add
// property** — and the parameters follow from that, because "the Ticket and
// Priority parameter have already been created based by the Rule". So this picks
// properties, not parameters; nobody retypes a key or a type that the object
// type already declares.
//
// Submission criteria carry a **failure message**, also theirs: "add a failure
// message so users can see why an action has failed."

import { useMemo, useState } from 'react'
import {
  Button, Callout, Card, Checkbox, HTMLSelect, Icon, InputGroup, Intent, Tag,
} from '@blueprintjs/core'
import {
  parametersFromProperties, validateAuthoredAction, authoredActionDescriptor,
  type AuthoredActionOperation, type ObjectTypeDef,
  type SubmissionCriterion,
} from '@beacon/reality-graph'
import { formatDistanceToNow } from 'date-fns'
import {
  useAuthoredActions, useCreateActionType, useDeleteActionType, useActionLog,
} from './api'

const OPERATIONS: { value: AuthoredActionOperation; label: string; help: string }[] = [
  { value: 'create', label: 'Create', help: 'Adds a record of this type.' },
  { value: 'modify', label: 'Modify', help: 'Changes properties on an existing record.' },
  { value: 'delete', label: 'Delete', help: 'Removes a record. Takes no parameters — the record is context.' },
]

const OPERATORS: { value: SubmissionCriterion['operator']; label: string }[] = [
  { value: 'eq', label: 'is' }, { value: 'neq', label: 'is not' },
  { value: 'gt', label: 'is more than' }, { value: 'gte', label: 'is at least' },
  { value: 'lt', label: 'is less than' }, { value: 'lte', label: 'is at most' },
  { value: 'non_empty', label: 'is filled in' },
]

export function ActionTypesSection({ types }: { types: ObjectTypeDef[] }) {
  const { data: actions = [] } = useAuthoredActions()
  const [openLog, setOpenLog] = useState<string | null>(null)
  const del = useDeleteActionType()

  return (
    <section className="space-y-2 border-t pt-5">
      <div className="flex items-center gap-2">
        <Icon icon="take-action" size={14} className="text-violet-500" />
        <h2 className="text-sm font-semibold">Action types</h2>
        <Tag minimal className="!text-[10px]">{actions.length}</Tag>
      </div>
      <p className="text-[11px] text-muted-foreground max-w-2xl">
        A named change to records of one object type, with its own parameters, submission criteria
        and an append-only log. Stock, purchase orders and transfers are code-defined — those carry
        revert semantics a form cannot express.
      </p>

      <Composer types={types} />

      {actions.length > 0 && (
        <Card compact className="!p-0">
          <ul className="divide-y divide-border/30">
            {actions.map((a) => {
              const subject = types.find((t) => t.id === a.subjectTypeId)
              const fields = authoredActionDescriptor(a).fields.length
              return (
                <li key={a.id}>
                  <div className="flex items-center gap-2 px-3 py-2 text-xs">
                    <Tag minimal className="!text-[9px] uppercase">{a.operation}</Tag>
                    <span className="font-medium">{a.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{a.apiName}</span>
                    <span className="text-muted-foreground truncate flex-1">
                      on {subject?.label ?? 'a deleted type'} · {fields} field{fields === 1 ? '' : 's'}
                      {a.submissionCriteria.length > 0 && ` · ${String(a.submissionCriteria.length)} criteria`}
                    </span>
                    <Tag minimal className="!text-[9px]">{a.invocationMode}</Tag>
                    <Button variant="minimal" size="small" icon="history" title="Action log"
                      active={openLog === a.id}
                      onClick={() => { setOpenLog(openLog === a.id ? null : a.id) }} />
                    <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
                      onClick={() => { del.mutate(a.id) }} />
                  </div>
                  {openLog === a.id && <ActionLog actionTypeId={a.id} />}
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </section>
  )
}

function Composer({ types }: { types: ObjectTypeDef[] }) {
  const create = useCreateActionType()
  const [name, setName] = useState('')
  const [operation, setOperation] = useState<AuthoredActionOperation>('modify')
  const [subjectTypeId, setSubjectTypeId] = useState('')
  const [chosen, setChosen] = useState<string[]>([])
  const [criteria, setCriteria] = useState<SubmissionCriterion[]>([])

  // Annotated, because types[0] types as non-optional while the list can be
  // empty — the guard below is real even though the compiler cannot see it.
  const subject: ObjectTypeDef | undefined = types.find((t) => t.id === subjectTypeId) ?? types.at(0)
  // Foundry's api names are SHOUTING_SNAKE_CASE, like the code-defined ones.
  const apiName = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  const parameters = useMemo(
    () => (subject && operation !== 'delete' ? parametersFromProperties(subject.properties, chosen) : []),
    [subject, chosen, operation],
  )
  const errors = validateAuthoredAction({ name, apiName, operation, parameters, submissionCriteria: criteria })

  if (types.length === 0) {
    return (
      <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
        Author an object type first — an action type changes records of one.
      </Callout>
    )
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-44">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Display name</span>
          <InputGroup size="small" value={name} placeholder="Close ticket"
            onChange={(e) => { setName(e.currentTarget.value) }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Change objects</span>
          <HTMLSelect value={operation} onChange={(e) => { setOperation(e.currentTarget.value as AuthoredActionOperation) }}>
            {OPERATIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </HTMLSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Object type</span>
          <HTMLSelect value={subjectTypeId || subject?.id || ''}
            onChange={(e) => { setSubjectTypeId(e.currentTarget.value); setChosen([]); setCriteria([]) }}>
            {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </HTMLSelect>
        </label>
        {apiName && <span className="text-[11px] font-mono text-muted-foreground pb-1.5">{apiName}</span>}
      </div>

      <p className="text-[11px] text-muted-foreground">{OPERATIONS.find((o) => o.value === operation)?.help}</p>

      {operation !== 'delete' && subject && (
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Properties this action sets
          </span>
          {subject.properties.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">This type has no properties yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {subject.properties.map((p) => (
                <Checkbox key={p.key} className="!mb-0" checked={chosen.includes(p.key)}
                  label={`${p.label} (${p.type})`}
                  onChange={() => {
                    setChosen((c) => c.includes(p.key) ? c.filter((k) => k !== p.key) : [...c, p.key])
                    setCriteria((cs) => cs.filter((c) => c.parameter !== p.key || chosen.includes(p.key)))
                  }} />
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            The parameters follow from what you pick — the form is the rule.
          </p>
        </div>
      )}

      {parameters.length > 0 && (
        <div className="space-y-1.5 border-t border-border/40 pt-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Submission criteria — all must pass
          </span>
          {criteria.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <HTMLSelect value={c.parameter} className="!text-xs"
                onChange={(e) => { setCriteria(criteria.map((x, j) => j === i ? { ...x, parameter: e.currentTarget.value } : x)) }}>
                {parameters.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </HTMLSelect>
              <HTMLSelect value={c.operator} className="!text-xs"
                onChange={(e) => { setCriteria(criteria.map((x, j) => j === i ? { ...x, operator: e.currentTarget.value as SubmissionCriterion['operator'] } : x)) }}>
                {OPERATORS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </HTMLSelect>
              {c.operator !== 'non_empty' && (
                <InputGroup size="small" style={{ width: 110 }} placeholder="value"
                  value={String(c.value ?? '')}
                  onChange={(e) => { setCriteria(criteria.map((x, j) => j === i ? { ...x, value: e.currentTarget.value } : x)) }} />
              )}
              <InputGroup size="small" className="flex-1 min-w-40" placeholder="Failure message the operator sees"
                value={c.message ?? ''}
                onChange={(e) => { setCriteria(criteria.map((x, j) => j === i ? { ...x, message: e.currentTarget.value } : x)) }} />
              <Button variant="minimal" size="small" icon="cross"
                onClick={() => { setCriteria(criteria.filter((_, j) => j !== i)) }} />
            </div>
          ))}
          <Button variant="minimal" size="small" icon="add"
            onClick={() => { setCriteria([...criteria, { parameter: parameters[0].key, operator: 'non_empty' }]) }}>
            Add condition
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} size="small" icon="add" loading={create.isPending}
          disabled={errors.length > 0}
          onClick={() => {
            create.mutate({
              name: name.trim(), apiName, description: '',
              subjectTypeId: subject?.id ?? '', operation, parameters,
              submissionCriteria: criteria, invocationMode: 'open-form', approvalTier: 'self',
            }, { onSuccess: () => { setName(''); setChosen([]); setCriteria([]) } })
          }}>
          Create
        </Button>
        {name.trim() !== '' && errors.length > 0 && (
          <span className="text-[11px] text-amber-600">{errors[0]}</span>
        )}
      </div>
    </Card>
  )
}

function ActionLog({ actionTypeId }: { actionTypeId: string }) {
  const { data: entries = [], isLoading } = useActionLog(actionTypeId)

  if (isLoading) return <p className="px-3 pb-2 text-[11px] text-muted-foreground">Loading…</p>
  if (entries.length === 0) {
    return (
      <p className="px-3 pb-2 text-[11px] text-muted-foreground">
        Nothing submitted yet. Every submission writes one row here, and the row cannot be edited —
        a correction is another submission.
      </p>
    )
  }
  return (
    <ul className="border-t border-border/30 bg-muted/20 divide-y divide-border/20">
      {entries.map((e) => (
        <li key={e.id} className="flex items-center gap-2 px-4 py-1.5 text-[11px]">
          <Tag minimal className="!text-[9px] uppercase">{e.operation}</Tag>
          <span className="font-mono text-[10px] text-muted-foreground truncate flex-1">
            {Object.entries(e.parameters).map(([k, v]) => `${k}=${String(v)}`).join('  ')}
          </span>
          <Tag minimal className="!text-[9px]">{e.triggeredBy}</Tag>
          <span className="text-muted-foreground tabular-nums">
            {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
          </span>
        </li>
      ))}
    </ul>
  )
}
