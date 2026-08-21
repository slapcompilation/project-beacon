// "+ New automation" — the creation wizard, drawn as
// getting-started-add-condition.png draws it: a left rail of four steps
// (Condition, Effect, Settings, Summary) beside a pane, with Next bottom-right.
//
// The condition picker lists all EIGHT cards the image shows. Four are ours;
// the other four carry the reason they are not offered, which is the shape
// action_rule_kinds() set — hiding them makes the vocabulary look smaller than
// the page that enumerates it.
//
// The time step is one condition with two editing modes, because the advanced
// toggle DISABLES the builder rather than replacing it: the builder writes a
// cron and the cron is what is stored.
import { useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, NumericInput, Switch, Tag, TextArea,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useActionTypes } from '@/features/actionTypes/api'
import { useSavedSets } from '@/features/explorer/api'
import { useOmaOntology } from '@/features/ontologyManager/resources'
import { useProjects } from '@/features/projects/api'
import { useEffectKinds } from '@/features/automate/api'
import {
  CONDITION_CARDS, EMPTY_SCHEDULE, automateCronLooksValid, conditionOf,
  scheduleToCron, useCreateAutomation,
  type EffectDraft, type Frequency, type ScheduleDraft,
} from '@/features/automate/authoring'

const STEPS = ['Condition', 'Effect', 'Settings', 'Summary'] as const
type Step = typeof STEPS[number]

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function NewAutomationDialog({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('Condition')
  const [kind, setKind] = useState<string | null>(null)
  const [schedule, setSchedule] = useState<ScheduleDraft>(EMPTY_SCHEDULE)
  const [advanced, setAdvanced] = useState(false)
  const [cron, setCron] = useState('0 9 * * *')
  const [timezone, setTimezone] = useState('UTC')
  const [objectSetId, setObjectSetId] = useState<string | null>(null)
  const [effects, setEffects] = useState<EffectDraft[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [execution, setExecution] = useState<'sequential' | 'parallel'>('parallel')
  const [scope, setScope] = useState<'user' | 'project'>('project')
  const [expiresAt, setExpiresAt] = useState('')

  const { ontology } = useOmaOntology()
  const { data: actions } = useActionTypes(ontology?.id ?? null)
  const { data: sets = [] } = useSavedSets()
  const { data: kinds = [] } = useEffectKinds()
  const { data: projects = [] } = useProjects()
  const create = useCreateAutomation()

  const effective = advanced ? cron : scheduleToCron(schedule)
  const cronOk = automateCronLooksValid(effective)
  const conditionReady = kind === 'time' ? cronOk : kind !== null && objectSetId !== null && cronOk
  const canCreate = conditionReady && name.trim() !== '' && projects.length > 0

  const submit = () => {
    create.mutate({
      displayName: name.trim(), description: description.trim(),
      projectId: projects[0].id,
      condition: conditionOf(kind ?? 'time', schedule, advanced ? cron : null, timezone, objectSetId),
      execution, scope, expiresAt: expiresAt || null,
      effects,
    }, { onSuccess: onClose })
  }

  const at = STEPS.indexOf(step)
  return (
    <Dialog isOpen title="Create new automation" onClose={onClose} className="oma-session-dialog">
      <DialogBody className="!p-0">
        <div className="oma-session-split">
          <div className="oma-session-list p-2">
            {STEPS.map((s, i) => (
              <button key={s} type="button" disabled={i > at && !conditionReady}
                className={s === step ? 'oma-rail-item is-active' : 'oma-rail-item'}
                onClick={() => { setStep(s) }}>{s}</button>
            ))}
          </div>

          <div className="oma-session-detail">
            {step === 'Condition' && (kind === null ? (
              <>
                <h3 className="text-sm font-semibold">Add condition</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  No condition configured yet. Select a condition to define when this automation
                  should trigger.
                </p>
                {CONDITION_CARDS.map((c) => (
                  <Card key={c.kind} compact interactive={c.supported}
                    className={c.supported ? 'mb-2' : 'mb-2 oma-card-off'}
                    title={c.why}
                    onClick={() => { if (c.supported) setKind(c.kind) }}>
                    <div className="flex gap-2">
                      <Icon icon={c.icon as IconName} size={14} className="text-violet-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold flex items-center gap-1.5">
                          {c.label}
                          {c.exposes && <Tag minimal>{`(x) ${c.exposes}`}</Tag>}
                          {!c.supported && <Tag minimal intent={Intent.WARNING}>not offered</Tag>}
                        </div>
                        <div className="text-xs text-muted-foreground">{c.blurb}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </>
            ) : kind === 'time' ? (
              <TimeStep {...{ schedule, setSchedule, advanced, setAdvanced, cron, setCron,
                timezone, setTimezone, effective, cronOk }} onBack={() => { setKind(null) }}
                blurb="Define how frequently effects should be executed." />
            ) : (
              <>
                <h3 className="text-sm font-semibold">Object set</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  The set this condition watches. Effect inputs are not built, so the objects are
                  not handed to the effects.
                </p>
                <HTMLSelect fill value={objectSetId ?? ''}
                  onChange={(e) => { setObjectSetId(e.currentTarget.value || null) }}>
                  <option value="">Select a saved object set…</option>
                  {sets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </HTMLSelect>
                {sets.length === 0 && (
                  <Callout intent={Intent.WARNING} className="!text-xs mt-2">
                    No saved object sets. Save one in Object Explorer first.
                  </Callout>
                )}
                <div className="border-t mt-4 pt-4">
                  <TimeStep {...{ schedule, setSchedule, advanced, setAdvanced, cron, setCron,
                    timezone, setTimezone, effective, cronOk }} onBack={null}
                    blurb="Define how frequently the object set condition should be evaluated." />
                </div>
                <Button variant="minimal" size="small" icon="arrow-left" className="mt-2"
                  onClick={() => { setKind(null) }}>Choose another condition</Button>
              </>
            ))}

            {step === 'Effect' && (
              <>
                <h3 className="text-sm font-semibold">Effects</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-2">
                  What runs when the condition is met. Only action effects execute on this
                  runtime; the others are in the vocabulary and refuse by name.
                </p>
                {effects.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
                    <HTMLSelect value={e.actionTypeId ?? ''} className="flex-1"
                      onChange={(ev) => {
                        setEffects(effects.map((x, xi) =>
                          xi === i ? { ...x, actionTypeId: ev.currentTarget.value || null } : x))
                      }}>
                      <option value="">Action type…</option>
                      {/* "Not all actions are appropriate to use with Automate."
                          The picker offers only those that allow it (612). */}
                      {actions.filter((a) => a.automate_can_submit)
                        .map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </HTMLSelect>
                    <Button variant="minimal" size="small" icon="cross"
                      onClick={() => { setEffects(effects.filter((_, xi) => xi !== i)) }} />
                  </div>
                ))}
                <Button variant="minimal" size="small" icon="add"
                  onClick={() => { setEffects([...effects, { kind: 'action', actionTypeId: null }]) }}>
                  Add action effect
                </Button>
                <div className="mt-3 space-y-1">
                  {kinds.filter((k) => !k.executable).map((k) => (
                    <div key={k.kind} className="text-xs text-muted-foreground" title={k.note}>
                      <Tag minimal intent={Intent.WARNING} className="mr-1">{k.kind}</Tag>
                      not built
                    </div>
                  ))}
                </div>
              </>
            )}

            {step === 'Settings' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Settings</h3>
                <Switch checked={execution === 'sequential'} className="mb-0"
                  label="Execute effects sequentially"
                  onChange={(e) => { setExecution(e.currentTarget.checked ? 'sequential' : 'parallel') }} />
                <p className="text-xs text-muted-foreground -mt-1">
                  Needs at least two orderable effects. Otherwise effects execute in parallel, and
                  a failure does not stop the others.
                </p>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">Scope</span>
                  <HTMLSelect value={scope}
                    onChange={(e) => { setScope(e.currentTarget.value as 'user' | 'project') }}>
                    <option value="project">Project scoped — history visible to the team</option>
                    <option value="user">User scoped — history visible to the owner</option>
                  </HTMLSelect>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">
                    Expires <span className="text-muted-foreground font-normal">(optional)</span>
                  </span>
                  <InputGroup type="date" value={expiresAt} onValueChange={setExpiresAt} />
                </label>
                <p className="text-xs text-muted-foreground -mt-1">
                  Empty runs indefinitely. At most six months out; an expired automation blocks all
                  execution.
                </p>
              </div>
            )}

            {step === 'Summary' && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Summary</h3>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">Name</span>
                  <InputGroup value={name} onValueChange={setName} />
                </label>
                <TextArea placeholder="Description (optional)" value={description} fill rows={2}
                  onChange={(e) => { setDescription(e.currentTarget.value) }} />
                <Card compact className="text-xs space-y-1">
                  <div><span className="text-muted-foreground">Condition</span> ·{' '}
                    {kind === 'time' ? effective : CONDITION_CARDS.find((c) => c.kind === kind)?.label ?? '—'}</div>
                  <div><span className="text-muted-foreground">Effects</span> · {effects.length}</div>
                  <div><span className="text-muted-foreground">Execution</span> · {execution}</div>
                  <div><span className="text-muted-foreground">Scope</span> · {scope} scoped</div>
                  <div><span className="text-muted-foreground">Expires</span> ·{' '}
                    {expiresAt || 'Indefinitely'}</div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button variant="minimal" onClick={onClose}>Cancel</Button>
          {step === 'Summary' ? (
            <Button intent={Intent.PRIMARY} disabled={!canCreate} loading={create.isPending}
              onClick={submit}>Create automation</Button>
          ) : (
            <Button intent={Intent.PRIMARY} disabled={at === 0 && !conditionReady}
              onClick={() => { setStep(STEPS[at + 1]) }}>Next</Button>
          )}
        </>
      } />
    </Dialog>
  )
}

/** "Define how frequently effects should be executed." The builder above the
 *  divider, the advanced toggle below it, and the builder greys out when the
 *  toggle is on — which is how the screenshots draw the two states. */
function TimeStep({ schedule, setSchedule, advanced, setAdvanced, cron, setCron,
  timezone, setTimezone, effective, cronOk, onBack, blurb }: {
  schedule: ScheduleDraft; setSchedule: (s: ScheduleDraft) => void
  advanced: boolean; setAdvanced: (b: boolean) => void
  cron: string; setCron: (s: string) => void
  timezone: string; setTimezone: (s: string) => void
  effective: string; cronOk: boolean; onBack: (() => void) | null; blurb: string
}) {
  const set = (patch: Partial<ScheduleDraft>) => { setSchedule({ ...schedule, ...patch }) }
  return (
    <>
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Define schedule</h3>
        <Tag minimal icon="time" className="ml-auto">{effective}</Tag>
      </div>
      <p className="text-xs text-muted-foreground mt-1 mb-2">{blurb}</p>

      <div className={advanced ? 'oma-card-off space-y-2' : 'space-y-2'}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Frequency</span>
          <HTMLSelect value={schedule.frequency} disabled={advanced}
            onChange={(e) => { set({ frequency: e.currentTarget.value as Frequency }) }}>
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </HTMLSelect>
        </label>
        <div className="flex items-end gap-2">
          {schedule.frequency !== 'hourly' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Hour</span>
              <NumericInput min={0} max={23} value={schedule.hour} disabled={advanced}
                onValueChange={(v) => { set({ hour: v }) }} style={{ width: 64 }} />
            </label>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold">Minute</span>
            <NumericInput min={0} max={59} value={schedule.minute} disabled={advanced}
              onValueChange={(v) => { set({ minute: v }) }} style={{ width: 64 }} />
          </label>
          {schedule.frequency === 'weekly' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Day</span>
              <HTMLSelect value={schedule.weekday} disabled={advanced}
                onChange={(e) => { set({ weekday: Number(e.currentTarget.value) }) }}>
                {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </HTMLSelect>
            </label>
          )}
          {schedule.frequency === 'monthly' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold">Day of month</span>
              <NumericInput min={1} max={31} value={schedule.dayOfMonth} disabled={advanced}
                onValueChange={(v) => { set({ dayOfMonth: v }) }} style={{ width: 72 }} />
            </label>
          )}
        </div>
      </div>

      <div className="border-t mt-3 pt-3">
        <Switch checked={advanced} className="mb-0" label="Use Cron expression (advanced)"
          onChange={(e) => {
            if (e.currentTarget.checked) setCron(scheduleToCron(schedule))
            setAdvanced(e.currentTarget.checked)
          }} />
        {advanced && (
          <div className="mt-2 space-y-1">
            <InputGroup value={cron} onValueChange={setCron} className="font-mono"
              intent={cronOk ? Intent.NONE : Intent.DANGER} />
            {!cronOk && (
              <p className="text-xs text-red-600">
                Five fields, and the minute must be a plain number 0–59 — an Automate condition
                fires at most once an hour.
              </p>
            )}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 mt-3">
        <span className="text-xs font-semibold">Timezone</span>
        <InputGroup value={timezone} onValueChange={setTimezone} />
      </label>

      {onBack && (
        <Button variant="minimal" size="small" icon="arrow-left" className="mt-3"
          onClick={onBack}>Choose another condition</Button>
      )}
    </>
  )
}
