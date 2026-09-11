// One effect in the automation wizard.
//
// Two families, because Automate has two: an ACTION effect runs an action type
// and may be handed the objects that fired, and a NOTIFICATION effect carries
// its own payload and its own recipients. 517 registered the second kind with a
// description saying no notification system existed; 793 to 803 built one, so
// it is offered here rather than listed as not built.
//
// THE INPUT FAMILIES ARE MUTUALLY EXCLUSIVE, and the page says why: "object set
// and object list inputs cannot be combined with single object and property
// reference inputs, since the former includes multiple objects at a time and
// the latter includes one object at a time". So this is one picker with three
// answers, not two pickers — choosing a set clears the single-object binding
// and the other way round, and the database refuses the pair regardless.
//
// An execution mode appears only beside a SET, because a single-object input IS
// per-object execution and has no mode to choose. That is 630's reasoning and
// 800's column, mirrored here so the form cannot offer a choice that does not
// exist.

import {
  Button, Card, HTMLSelect, InputGroup, NumericInput, Tag, TextArea,
} from '@blueprintjs/core'
import {
  EXECUTION_MODES, MAX_BATCH_SIZE, type EffectDraft, type ExecutionMode,
} from '@/features/automate/authoring'

interface ParameterRow {
  id: string
  display_name: string
  data_kind: string
  object_type_id: string | null
}
interface ActionRow {
  id: string
  label: string
  automate_can_submit: boolean
  action_type_parameters?: ParameterRow[]
}
interface PropertyRow { api_name?: string; base_type?: string; array_element_type?: string | null }
interface ObjectTypeRow { id: string; properties?: PropertyRow[] }
interface UserRow { id: string; email: string }

export function EffectEditor({
  index, effect, actions, subjectTypeId, objectTypes, users, exposesInput, onChange, onRemove,
}: {
  index: number
  effect: EffectDraft
  actions: ActionRow[]
  subjectTypeId: string | null
  objectTypes: ObjectTypeRow[]
  users: UserRow[]
  exposesInput: boolean
  onChange: (next: EffectDraft) => void
  onRemove: () => void
}) {
  const set = (patch: Partial<EffectDraft>) => { onChange({ ...effect, ...patch }) }

  return (
    <Card compact className="mb-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
        <Tag minimal>{effect.kind === 'notification' ? 'Notification' : 'Action'}</Tag>
        <span className="flex-1" />
        <Button variant="minimal" size="small" icon="cross" onClick={onRemove} />
      </div>

      {effect.kind === 'notification'
        ? <NotificationFields effect={effect} users={users}
            properties={recipientProperties(objectTypes, subjectTypeId)}
            exposesInput={exposesInput} set={set} />
        : <ActionFields effect={effect} actions={actions} subjectTypeId={subjectTypeId}
            objectTypes={objectTypes} exposesInput={exposesInput} set={set} />}
    </Card>
  )
}

function ActionFields({ effect, actions, subjectTypeId, objectTypes, exposesInput, set }: {
  effect: EffectDraft
  actions: ActionRow[]
  subjectTypeId: string | null
  objectTypes: ObjectTypeRow[]
  exposesInput: boolean
  set: (patch: Partial<EffectDraft>) => void
}) {
  const act = actions.find((a) => a.id === effect.actionTypeId)
  const params = act?.action_type_parameters ?? []
  // "the type of the action parameter needs to align with the type of the
  //  exposed condition effect input" — over BOTH the container kind and the
  //  object type, except that an object-set parameter may be untyped, which
  //  the api allows and 797 therefore does not refuse.
  const singles = params.filter((p) => p.data_kind === 'object' && p.object_type_id === subjectTypeId)
  const sets = params.filter((p) => p.data_kind === 'objectSet'
    && (p.object_type_id === null || p.object_type_id === subjectTypeId))

  const binding = effect.objectSetParameterId !== null
    ? `set:${effect.objectSetParameterId}`
    : effect.objectInputParameterId !== null
      ? `one:${effect.objectInputParameterId}` : ''

  return (
    <>
      <HTMLSelect fill value={effect.actionTypeId ?? ''}
        onChange={(e) => { set({ actionTypeId: e.currentTarget.value || null }) }}>
        <option value="">Action type…</option>
        {/* "Not all actions are appropriate to use with Automate." */}
        {actions.filter((a) => a.automate_can_submit)
          .map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </HTMLSelect>

      {exposesInput && act && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Hand the objects that fired to</span>
          <HTMLSelect value={binding}
            onChange={(e) => {
              const v = e.currentTarget.value
              if (v.startsWith('set:')) {
                set({ objectSetParameterId: v.slice(4), objectInputParameterId: null,
                      executionMode: effect.executionMode ?? 'once_for_all' })
              } else if (v.startsWith('one:')) {
                set({ objectInputParameterId: v.slice(4), objectSetParameterId: null,
                      executionMode: null, batchSize: null, groupByProperties: [] })
              } else {
                set({ objectInputParameterId: null, objectSetParameterId: null,
                      executionMode: null, batchSize: null, groupByProperties: [] })
              }
            }}>
            <option value="">Nothing — run the action once</option>
            {singles.map((p) => (
              <option key={p.id} value={`one:${p.id}`}>{p.display_name} — one object at a time</option>
            ))}
            {sets.map((p) => (
              <option key={p.id} value={`set:${p.id}`}>{p.display_name} — all of them at once</option>
            ))}
          </HTMLSelect>
          {singles.length === 0 && sets.length === 0 && (
            <span className="text-xs text-muted-foreground">
              This action takes no parameter of the type the condition watches, so it can
              only run once for the whole firing.
            </span>
          )}
        </label>
      )}

      {effect.objectSetParameterId !== null && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Execution mode</span>
          <HTMLSelect value={effect.executionMode ?? 'once_for_all'}
            onChange={(e) => {
              const mode = e.currentTarget.value as ExecutionMode
              set({ executionMode: mode,
                    batchSize: mode === 'once_for_each_batch' ? (effect.batchSize ?? 100) : null,
                    groupByProperties: mode === 'once_for_each_group' ? effect.groupByProperties : [] })
            }}>
            {EXECUTION_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </HTMLSelect>
        </label>
      )}

      {effect.executionMode === 'once_for_each_batch' && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Batch size</span>
          <NumericInput fill min={1} max={MAX_BATCH_SIZE} value={effect.batchSize ?? 100}
            onValueChange={(n) => { set({ batchSize: n }) }} />
          <span className="text-xs text-muted-foreground">
            A maximum, not a minimum — the automation does not wait for more objects, so a
            batch may hold fewer. At most {MAX_BATCH_SIZE}.
          </span>
        </label>
      )}

      {effect.executionMode === 'once_for_each_group' && (
        <PropertyPicker label="Group the objects by"
          hint="Grouping is on exact matches. An array property must match in order, value for value."
          options={groupableProperties(objectTypes, subjectTypeId)}
          selected={effect.groupByProperties}
          onChange={(v) => { set({ groupByProperties: v }) }} />
      )}
    </>
  )
}

function NotificationFields({ effect, users, properties, exposesInput, set }: {
  effect: EffectDraft
  users: UserRow[]
  properties: string[]
  exposesInput: boolean
  set: (patch: Partial<EffectDraft>) => void
}) {
  return (
    <>
      <InputGroup placeholder="Heading" value={effect.heading}
        onChange={(e) => { set({ heading: e.currentTarget.value }) }} />
      <TextArea fill rows={2} placeholder="Message" value={effect.content}
        onChange={(e) => { set({ content: e.currentTarget.value }) }} />

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold">Static recipients</span>
        {/* Native, because Blueprint's HTMLSelect takes no `multiple`. */}
        <select multiple className="bp5-input" value={effect.recipients}
          onChange={(e) => {
            set({ recipients: Array.from(e.currentTarget.selectedOptions).map((o) => o.value) })
          }}>
          {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
        </select>
        <span className="text-xs text-muted-foreground">
          A recipient needs at least Viewer on the automation, or they will not receive it.
        </span>
      </label>

      {/* "This configuration option requires an object set condition that
          exposes effect inputs" — so the two pickers are absent otherwise. */}
      {exposesInput && (
        <>
          <PropertyPicker label="Users from a property of the objects that fired"
            hint="A String or an Array of String holding user ids."
            options={properties} selected={effect.recipientUserProperties}
            onChange={(v) => { set({ recipientUserProperties: v }) }} />
          <PropertyPicker label="Groups from a property of the objects that fired"
            hint="The same, for properties holding group ids."
            options={properties} selected={effect.recipientGroupProperties}
            onChange={(v) => { set({ recipientGroupProperties: v }) }} />
        </>
      )}
    </>
  )
}

function PropertyPicker({ label, hint, options, selected, onChange }: {
  label: string
  hint: string
  options: string[]
  selected: string[]
  onChange: (next: string[]) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold">{label}</span>
      <select multiple className="bp5-input" value={selected}
        onChange={(e) => {
          onChange(Array.from(e.currentTarget.selectedOptions).map((o) => o.value))
        }}>
        {options.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </label>
  )
}

/** "object property types must be either `String` or `Array of String`" — the
 *  picker offers exactly those, so the guard underneath never has to fire. */
function recipientProperties(objectTypes: ObjectTypeRow[], subjectTypeId: string | null): string[] {
  const t = objectTypes.find((o) => o.id === subjectTypeId)
  return (t?.properties ?? [])
    .filter((p) => p.base_type === 'string'
      || (p.base_type === 'array' && p.array_element_type === 'string'))
    .map((p) => p.api_name ?? '')
    .filter((n) => n !== '')
}

/** Grouping names properties of the condition's object type, and the page puts
 *  no type restriction on which. */
function groupableProperties(objectTypes: ObjectTypeRow[], subjectTypeId: string | null): string[] {
  const t = objectTypes.find((o) => o.id === subjectTypeId)
  return (t?.properties ?? []).map((p) => p.api_name ?? '').filter((n) => n !== '')
}
