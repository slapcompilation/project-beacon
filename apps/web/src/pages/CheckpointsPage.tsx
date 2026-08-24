// The Checkpoints application, drawn from the app captures
// (checkpoints/images/checkpoints-app.png): two tabs — Review, a filter rail
// over Time/Type/User/Justification/Recorded-item rows with a details panel
// of the record's static language, justification and item cards; and
// Configuration, the wizard's steps as one stepped form (Conditions, Prompt,
// Justification type, Name and description — Frequency is login-only and
// login is excluded). Everyone reviews their own records; the governance
// seat reviews the organization's.
import { useState } from 'react'
import {
  Button, Card, Checkbox, HTMLSelect, Icon, InputGroup, Intent, NonIdealState,
  Switch, Tab, Tabs, Tag, TextArea,
} from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import {
  checkpointTypeLabel, useCheckpointConfigs, useCheckpointRecords,
  useCheckpointTypes, useConditionCatalog, useConfigAdminNames, useCreateConfig,
  useDeleteConfig, type CheckpointRecord, type ConditionKind, type DropdownOption,
  type JustificationType, type NewCondition,
} from '@/features/checkpoints/api'

export default function CheckpointsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-5xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Checkpoints</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Justifications for sensitive interactions — recorded when a checkpoint interrupts
            an action, reviewable here.
          </p>
        </header>
        <Tabs id="checkpoints" renderActiveTabPanelOnly>
          <Tab id="review" title="Review" panel={<ReviewTab />} />
          <Tab id="config" title="Configuration" panel={<ConfigurationTab />} />
        </Tabs>
      </div>
    </div>
  )
}

function ReviewTab() {
  const { data: types = [] } = useCheckpointTypes()
  const [checkpointType, setCheckpointType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data: records = [], isLoading } = useCheckpointRecords({ checkpointType, from, to })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = records.find((r) => r.id === selectedId) ?? null

  return (
    <div className="ckpt-columns">
      <div className="space-y-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <HTMLSelect value={checkpointType} onChange={(e) => { setCheckpointType(e.currentTarget.value) }}>
            <option value="">All checkpoint types</option>
            {types.map((t) => <option key={t} value={t}>{checkpointTypeLabel(t)}</option>)}
          </HTMLSelect>
          <InputGroup type="date" value={from} onChange={(e) => { setFrom(e.currentTarget.value) }} />
          <span className="text-xs text-muted-foreground">to</span>
          <InputGroup type="date" value={to} onChange={(e) => { setTo(e.currentTarget.value) }} />
        </div>
        {isLoading ? null : records.length === 0 ? (
          <NonIdealState icon="flag" title="No checkpoint records"
            description="Records appear here when someone justifies a checkpointed interaction." />
        ) : (
          <Card compact className="!p-0">
            <div className="ckpt-row ckpt-head">
              <span>Time</span><span>Type</span><span>User</span><span>Justification</span><span>Recorded item</span>
            </div>
            <ul className="divide-y divide-border/30">
              {records.map((r) => (
                <li key={r.id}
                  className={`ckpt-row cursor-pointer ${selectedId === r.id ? 'ckpt-selected' : ''}`}
                  onClick={() => { setSelectedId(selectedId === r.id ? null : r.id) }}>
                  <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  <span className="text-xs font-medium truncate">{checkpointTypeLabel(r.checkpoint_type)}</span>
                  <span className="text-xs truncate">{r.userEmail}</span>
                  <JustificationCell record={r} />
                  <span className="flex items-center gap-1 min-w-0">
                    {r.items.slice(0, 2).map((i) => (
                      <Tag key={i.ref_id + i.kind} minimal className="!text-[9px]" icon={itemIcon(i.kind)}>
                        {i.name !== '' ? i.name : i.kind}
                      </Tag>
                    ))}
                    {r.items.length > 2 && <Tag minimal className="!text-[9px]">+{r.items.length - 2}</Tag>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {selected !== null && <RecordDetails record={selected} />}
    </div>
  )
}

function itemIcon(kind: string): 'people' | 'person' | 'shield' | 'projects' | 'calendar' | 'play' | 'th' {
  switch (kind) {
    case 'group': return 'people'
    case 'user': return 'person'
    case 'marking': return 'shield'
    case 'project': return 'projects'
    case 'schedule': return 'calendar'
    case 'build': return 'play'
    default: return 'th'
  }
}

function JustificationCell({ record }: { record: CheckpointRecord }) {
  const j = record.justification
  if (j.kind === 'acknowledgment') {
    return <span><Icon icon="tick" size={12} className="text-muted-foreground" title="Acknowledged" /></span>
  }
  if (j.kind === 'response') {
    return <span className="text-xs truncate" title={j.response}>{j.response}</span>
  }
  return (
    <span className="text-xs truncate">
      {(j.selections ?? []).map((s) => s.option).join(', ')}
    </span>
  )
}

function RecordDetails({ record }: { record: CheckpointRecord }) {
  return (
    <Card compact className="ckpt-details space-y-3">
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Checkpoint type</div>
        <div className="text-xs">{checkpointTypeLabel(record.checkpoint_type)}</div>
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Language</div>
        <div className="text-xs font-semibold">{record.title}</div>
        <div className="text-xs">{record.prompt}</div>
        {record.description !== '' && (
          <div className="text-[11px] text-muted-foreground">{record.description}</div>
        )}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Justification</div>
        <Tag minimal className="!text-[9px] capitalize">{record.justification.kind}</Tag>
        {record.justification.kind === 'response' && (
          <p className="text-xs mt-1">{record.justification.response}</p>
        )}
        {record.justification.kind === 'dropdown' && (
          <ul className="text-xs mt-1 space-y-0.5">
            {(record.justification.selections ?? []).map((s) => (
              <li key={s.option}>
                {s.option}
                {s.additional_response !== undefined && (
                  <span className="text-muted-foreground"> — {s.additional_response}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Checkpointed items</div>
        {record.items.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">None recorded.</p>
        ) : (
          <ul className="space-y-1 mt-1">
            {record.items.map((i) => (
              <li key={i.ref_id + i.kind} className="text-xs flex items-center gap-2">
                <Icon icon={itemIcon(i.kind)} size={12} className="text-muted-foreground" />
                <span>{i.name !== '' ? i.name : i.ref_id}</span>
                <Tag minimal className="!text-[9px] capitalize">{i.kind}</Tag>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Checkpoint RID</div>
        <div className="font-mono text-[10px] break-all">{record.rid}</div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">Configuration RID</div>
        <div className="font-mono text-[10px] break-all">{record.config_rid}</div>
      </div>
      {record.consumed_at !== null && (
        <p className="text-[11px] text-muted-foreground">
          Consumed {new Date(record.consumed_at).toLocaleString()}
        </p>
      )}
    </Card>
  )
}

// ── Configuration ────────────────────────────────────────────────────────────

function ConfigurationTab() {
  const role = useAuthStore((s) => s.role)
  const { data: configs = [] } = useCheckpointConfigs()
  const { data: names } = useConfigAdminNames()
  const del = useDeleteConfig()
  const [creating, setCreating] = useState(false)
  const isAdmin = role === 'owner' || role === 'admin'

  if (!isAdmin) {
    return <NonIdealState icon="lock" title="Not visible"
      description="Checkpoint configuration is for the organization's governance seat." />
  }
  return (
    <div className="space-y-3">
      <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setCreating(!creating) }}>
        Configure a new checkpoint
      </Button>
      {creating && <ConfigWizard onDone={() => { setCreating(false) }} />}
      {configs.length === 0 && !creating ? (
        <NonIdealState icon="flag" title="No checkpoint configurations"
          description="A configuration decides who sees a checkpoint, for which interactions, and how they justify." />
      ) : (
        <Card compact className="!p-0">
          <ul className="divide-y divide-border/30">
            {configs.map((c) => (
              <li key={c.id} className="px-3 py-2 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold">{names?.get(c.id)?.name ?? c.title}</span>
                <Tag minimal className="!text-[9px]">{c.space_id !== null ? 'Space' : 'Organization'}</Tag>
                {c.checkpoint_types.map((t) => (
                  <Tag key={t} minimal className="!text-[9px]">{checkpointTypeLabel(t)}</Tag>
                ))}
                <Tag minimal className="!text-[9px] capitalize">{c.justification_type}</Tag>
                <span className="ml-auto flex items-center gap-1">
                  <Button variant="minimal" size="small" icon="cross" aria-label="Delete configuration"
                    onClick={() => { del.mutate({ id: c.id }) }} />
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

const KIND_LABEL: Record<ConditionKind, string> = {
  location: 'Location',
  user_submitting: 'User submitting checkpoint',
  selected_principal: 'Selected user or group',
  marking: 'Marking',
}

function ConfigWizard({ onDone }: { onDone: () => void }) {
  const { data: allTypes = [] } = useCheckpointTypes()
  const { data: catalog } = useConditionCatalog()
  const organizationId = useAuthStore((s) => s.organizationId)
  const create = useCreateConfig()
  const [step, setStep] = useState(0)
  const [types, setTypes] = useState<string[]>([])
  const [scope, setScope] = useState<'organization' | 'space'>('organization')
  const [spaceId, setSpaceId] = useState('')
  const [conditions, setConditions] = useState<NewCondition[]>([])
  const [title, setTitle] = useState('')
  const [prompt, setPrompt] = useState('')
  const [checkpointDescription, setCheckpointDescription] = useState('')
  const [jt, setJt] = useState<JustificationType>('acknowledgment')
  const [checkboxText, setCheckboxText] = useState('')
  const [regex, setRegex] = useState('')
  const [placeholder, setPlaceholder] = useState('')
  const [displayRecent, setDisplayRecent] = useState(false)
  const [options, setOptions] = useState<DropdownOption[]>([])
  const [multiple, setMultiple] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // the published narrowing: only located interactions take a space scope
  const spaceScopable = ['role_grant_addition', 'role_grant_removal']
  const spaceOk = scope === 'organization' || types.every((t) => spaceScopable.includes(t))

  const STEPS = ['Conditions', 'Prompt', 'Justification type', 'Name and description']
  const stepValid = [
    types.length > 0 && (scope === 'organization' || spaceId !== '') && spaceOk,
    title.trim() !== '' && prompt.trim() !== '',
    jt === 'acknowledgment' ? checkboxText.trim() !== ''
      : jt === 'dropdown' ? options.length > 0 && options.every((o) => o.label.trim() !== '')
        : true,
    name.trim() !== '',
  ]

  const submit = () => {
    create.mutate({
      organizationId: scope === 'organization' ? organizationId : null,
      spaceId: scope === 'space' ? spaceId : null,
      name: name.trim(), description,
      title: title.trim(), prompt: prompt.trim(), checkpointDescription,
      justificationType: jt,
      justificationConfig: jt === 'acknowledgment' ? { checkbox_text: checkboxText }
        : jt === 'response' ? {
          ...(regex.trim() !== '' ? { regex: regex.trim() } : {}),
          ...(placeholder.trim() !== '' ? { placeholder: placeholder.trim() } : {}),
          ...(displayRecent ? { display_recent: true } : {}),
        } : { options, ...(multiple ? { multiple: true } : {}) },
      checkpointTypes: types,
      conditions,
    }, { onSuccess: onDone })
  }

  return (
    <Card className="space-y-3 !border-violet-400/50">
      <div className="flex items-center gap-2 flex-wrap">
        {STEPS.map((s, i) => (
          <Tag key={s} minimal={i !== step} intent={i === step ? Intent.PRIMARY : Intent.NONE}
            className="!text-[10px]">{i + 1}. {s}</Tag>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Checkpoint type (required)
            </div>
            <div className="ckpt-type-grid">
              {allTypes.map((t) => (
                <Checkbox key={t} checked={types.includes(t)} label={checkpointTypeLabel(t)}
                  className="!mb-0.5"
                  onChange={(e) => {
                    setTypes(e.currentTarget.checked
                      ? [...types, t] : types.filter((x) => x !== t))
                  }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scope</span>
            <HTMLSelect value={scope}
              options={[{ value: 'organization', label: 'Organization' }, { value: 'space', label: 'Space' }]}
              onChange={(e) => { setScope(e.currentTarget.value as 'organization' | 'space') }} />
            {scope === 'space' && (
              <HTMLSelect value={spaceId} onChange={(e) => { setSpaceId(e.currentTarget.value) }}>
                <option value="">Select space…</option>
                {(catalog?.spaces ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </HTMLSelect>
            )}
          </div>
          {!spaceOk && (
            <p className="text-[11px] text-amber-600">
              Only role-grant checkpoint types can be configured with a space scope here — the
              other interactions carry no filesystem location.
            </p>
          )}
          <ConditionRows conditions={conditions} setConditions={setConditions} catalog={catalog} />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-2">
          <InputGroup placeholder="Title (required) — under 45 characters renders fully" value={title}
            onChange={(e) => { setTitle(e.currentTarget.value) }} />
          <TextArea fill placeholder="Prompt (required) — what the user must justify" value={prompt}
            onChange={(e) => { setPrompt(e.currentTarget.value) }} />
          <TextArea fill placeholder="Description — appears in lighter text between prompt and justification"
            value={checkpointDescription}
            onChange={(e) => { setCheckpointDescription(e.currentTarget.value) }} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <HTMLSelect value={jt}
            options={[{ value: 'acknowledgment', label: 'Acknowledgment' },
              { value: 'response', label: 'Response' }, { value: 'dropdown', label: 'Dropdown' }]}
            onChange={(e) => { setJt(e.currentTarget.value as JustificationType) }} />
          {jt === 'acknowledgment' && (
            <InputGroup placeholder="Checkbox text (required)" value={checkboxText}
              onChange={(e) => { setCheckboxText(e.currentTarget.value) }} />
          )}
          {jt === 'response' && (
            <div className="space-y-2">
              <InputGroup placeholder="Response validation — a regular expression; empty accepts anything"
                value={regex} onChange={(e) => { setRegex(e.currentTarget.value) }} />
              <InputGroup placeholder="Placeholder text for the free response text box" value={placeholder}
                onChange={(e) => { setPlaceholder(e.currentTarget.value) }} />
              <Switch checked={displayRecent} label="Display recent justifications" className="!mb-0"
                onChange={(e) => { setDisplayRecent(e.currentTarget.checked) }} />
            </div>
          )}
          {jt === 'dropdown' && (
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <InputGroup placeholder="Enter a label for a dropdown item." value={o.label}
                    onChange={(e) => {
                      const next = [...options]
                      next[i] = { ...o, label: e.currentTarget.value }
                      setOptions(next)
                    }} />
                  <HTMLSelect value={o.free_response ?? 'disabled'}
                    options={[{ value: 'disabled', label: 'Free response: disabled' },
                      { value: 'optional', label: 'Free response: optional' },
                      { value: 'mandatory', label: 'Free response: mandatory' }]}
                    onChange={(e) => {
                      const next = [...options]
                      next[i] = { ...o, free_response: e.currentTarget.value as DropdownOption['free_response'] }
                      setOptions(next)
                    }} />
                  <Button variant="minimal" icon="remove" aria-label="Remove dropdown value"
                    onClick={() => { setOptions(options.filter((_, j) => j !== i)) }} />
                </div>
              ))}
              <Button icon="add" text="Add a dropdown value"
                onClick={() => { setOptions([...options, { label: '' }]) }} />
              <Switch checked={multiple} label="Allow selecting multiple items" className="!mb-0"
                onChange={(e) => { setMultiple(e.currentTarget.checked) }} />
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-2">
          <InputGroup placeholder="Configuration title (required) — visible to reviewers only" value={name}
            onChange={(e) => { setName(e.currentTarget.value) }} />
          <TextArea fill placeholder="Configuration description — visible to reviewers only"
            value={description} onChange={(e) => { setDescription(e.currentTarget.value) }} />
        </div>
      )}

      <div className="flex items-center gap-2">
        {step > 0 && <Button text="Back" onClick={() => { setStep(step - 1) }} />}
        {step < STEPS.length - 1 ? (
          <Button intent={Intent.PRIMARY} text="Next" disabled={!stepValid[step]}
            onClick={() => { setStep(step + 1) }} />
        ) : (
          <Button intent={Intent.PRIMARY} text="Create checkpoint configuration"
            disabled={!stepValid.every(Boolean) || create.isPending} onClick={submit} />
        )}
        <Button variant="minimal" text="Cancel" className="ml-auto" onClick={onDone} />
      </div>
    </Card>
  )
}

function ConditionRows({ conditions, setConditions, catalog }: {
  conditions: NewCondition[]
  setConditions: (c: NewCondition[]) => void
  catalog: ReturnType<typeof useConditionCatalog>['data']
}) {
  const setAt = (i: number, patch: Partial<NewCondition>) => {
    const next = [...conditions]
    next[i] = { ...next[i], ...patch }
    setConditions(next)
  }
  const principal = (c: NewCondition, i: number) => (
    <HTMLSelect value={c.user_id !== null && c.user_id !== undefined ? `u:${c.user_id}` : c.group_id !== null && c.group_id !== undefined ? `g:${c.group_id}` : ''}
      onChange={(e) => {
        const v = e.currentTarget.value
        setAt(i, {
          user_id: v.startsWith('u:') ? v.slice(2) : null,
          group_id: v.startsWith('g:') ? v.slice(2) : null,
        })
      }}>
      <option value="">User or group…</option>
      {(catalog?.users ?? []).map((u) => <option key={u.id} value={`u:${u.id}`}>{u.email}</option>)}
      {(catalog?.groups ?? []).map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name} (group)</option>)}
    </HTMLSelect>
  )
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Additional conditions
      </div>
      {conditions.map((c, i) => (
        <div key={i} className="flex items-center gap-2 flex-wrap">
          <HTMLSelect value={c.negated ? 'NOT' : 'AND'}
            options={['AND', 'NOT']}
            onChange={(e) => { setAt(i, { negated: e.currentTarget.value === 'NOT' }) }} />
          <HTMLSelect value={c.kind}
            options={(Object.keys(KIND_LABEL) as ConditionKind[])
              .map((k) => ({ value: k, label: KIND_LABEL[k] }))}
            onChange={(e) => {
              setConditions(conditions.map((x, j) => j === i
                ? { kind: e.currentTarget.value as ConditionKind, negated: x.negated } : x))
            }} />
          {(c.kind === 'user_submitting' || c.kind === 'selected_principal') && principal(c, i)}
          {c.kind === 'selected_principal' && c.group_id !== null && c.group_id !== undefined && (
            <Checkbox checked={c.include_member_groups === true} label="Include member groups"
              className="!mb-0"
              onChange={(e) => { setAt(i, { include_member_groups: e.currentTarget.checked }) }} />
          )}
          {c.kind === 'marking' && (
            <HTMLSelect value={c.marking_id ?? ''}
              onChange={(e) => { setAt(i, { marking_id: e.currentTarget.value || null }) }}>
              <option value="">Marking…</option>
              {(catalog?.markings ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </HTMLSelect>
          )}
          {c.kind === 'location' && (
            <HTMLSelect value={c.project_id !== null && c.project_id !== undefined ? `p:${c.project_id}` : c.space_id !== null && c.space_id !== undefined ? `s:${c.space_id}` : ''}
              onChange={(e) => {
                const v = e.currentTarget.value
                setAt(i, {
                  project_id: v.startsWith('p:') ? v.slice(2) : null,
                  space_id: v.startsWith('s:') ? v.slice(2) : null,
                })
              }}>
              <option value="">Project or space…</option>
              {(catalog?.projects ?? []).map((p) => <option key={p.id} value={`p:${p.id}`}>{p.name}</option>)}
              {(catalog?.spaces ?? []).map((s) => <option key={s.id} value={`s:${s.id}`}>{s.name} (space)</option>)}
            </HTMLSelect>
          )}
          <Button variant="minimal" icon="cross" aria-label="Remove condition"
            onClick={() => { setConditions(conditions.filter((_, j) => j !== i)) }} />
        </div>
      ))}
      <Button icon="add" text="Add new condition"
        onClick={() => { setConditions([...conditions, { kind: 'user_submitting', negated: false }]) }} />
    </div>
  )
}
