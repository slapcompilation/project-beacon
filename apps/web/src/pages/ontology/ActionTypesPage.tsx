// Action types: what a user can DO to the ontology, and the only thing that
// writes the edit log.
//
// "Because we've only defined one action that touches only the Root Cause
// property, this is the only property that users can edit" — a rule's property
// list IS the permission, which is why the builder makes that table the centre
// of a rule rather than a detail behind it.
//
// The wizard's verbs are Create / Modify / Delete object(s); the other four
// kinds are in the vocabulary and refuse at apply, so they are shown disabled
// rather than hidden. Submission criteria are OMITTED BY NAME — the tree is
// stored (421) but nothing evaluates it, and a gate that never fires is worse
// than an absent one.

import { useState } from 'react'
import {
  Button, Callout, Card, Checkbox, Dialog, DialogBody, DialogFooter,
  HTMLSelect, Icon, InputGroup, Intent, Tag, TextArea,
} from '@blueprintjs/core'
import {
  PROPERTY_TYPES, STATUS_META, toCamel, toSlug,
  type ObjectTypeDef, type PropertyType,
} from '@beacon/ontology'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'
import {
  useActionTypes, useApplyAction, useRuleKinds, useSaveActionType,
  VALUE_SOURCES, type ActionRuleRow, type ActionTypeRow, type ValueSource,
} from '@/features/actionTypes/api'

/** A parameter is filled by a form field, so the picker offers the base types a
 *  form field can produce. The CHECK accepts every property base type. */
const PARAM_TYPES: PropertyType[] = ['string', 'integer', 'double', 'boolean', 'date', 'timestamp']

/** kebab-case, which is what action_types.api_name's CHECK wants. */
const toKebab = (s: string) => toSlug(s).replace(/_/g, '-')

const needsTarget = (rules: ActionRuleRow[]) =>
  rules.some((r) => r.kind === 'modify_object' || r.kind === 'delete_object')

const VALUE_INPUT: Partial<Record<PropertyType, string>> = {
  integer: 'number', double: 'number', date: 'date', timestamp: 'datetime-local',
}

export default function ActionTypesPage() {
  const { ontology, isLoading } = useOmaOntology()
  const { types } = useOmaTypes()
  const { data: actions = [] } = useActionTypes(ontology?.id ?? null)
  const [applying, setApplying] = useState<ActionTypeRow | null>(null)

  if (!ontology) {
    return <div className="oma-page max-w-2xl">{isLoading ? null : <NoOntologyCallout />}</div>
  }
  const labelOf = (id: string | null) => types.find((t) => t.id === id)?.label ?? '—'
  const summarize = (r: ActionRuleRow) =>
    `${r.kind.replace(/_object$/, '').replace(/_/g, ' ')} ${r.function_name ?? labelOf(r.object_type_id)}`

  return (
    <div className="oma-page">
      <SectionHead title="Action types" count={actions.length} />
      <p className="text-sm text-muted-foreground max-w-2xl mb-5">
        What a user can do to this ontology. Applying one writes the edit log; the properties a
        rule names are the only ones it may touch, and the next index build merges the result.
      </p>

      <div className="max-w-4xl space-y-6">
        <ActionBuilder ontologyId={ontology.id} types={types} />

        {actions.length === 0 ? (
          <Card compact className="text-xs text-muted-foreground">None yet — author one above.</Card>
        ) : (
          <Card compact className="!p-0">
            <ul className="divide-y divide-border/30">
              {actions.map((a) => (
                <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <Icon icon="take-action" size={12} className="text-violet-500 shrink-0" />
                  <span className="font-medium">{a.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{a.api_name}</span>
                  <Tag minimal intent={STATUS_META[a.status].intent} className="!text-[9px]"
                    title={STATUS_META[a.status].help}>{STATUS_META[a.status].label}</Tag>
                  <span className="flex-1 truncate text-muted-foreground">
                    {a.action_type_rules.map(summarize).join(', ') || 'no rules'}
                  </span>
                  <Tag minimal className="!text-[9px]">
                    {a.action_type_parameters.length} param{a.action_type_parameters.length === 1 ? '' : 's'}
                  </Tag>
                  <Button size="small" icon="play" onClick={() => { setApplying(a) }}>Apply</Button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {applying && <ApplyDialog action={applying} onClose={() => { setApplying(null) }} />}
    </div>
  )
}

interface ParamDraft { label: string; baseType: PropertyType; required: boolean }
interface PropDraft { propertyId: string; source: ValueSource; parameter: string; staticValue: string }
interface RuleDraft { kind: string; objectTypeId: string; props: PropDraft[] }

const newParam = (): ParamDraft => ({ label: '', baseType: 'string', required: true })
const newRule = (): RuleDraft => ({ kind: 'create_object', objectTypeId: '', props: [] })

function ActionBuilder({ ontologyId, types }: { ontologyId: string; types: ObjectTypeDef[] }) {
  const save = useSaveActionType()
  const { data: kinds = [] } = useRuleKinds()
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [params, setParams] = useState<ParamDraft[]>([newParam()])
  const [rules, setRules] = useState<RuleDraft[]>([newRule()])

  const apiName = toKebab(label)
  const named = params.filter((p) => p.label.trim())
  const setRule = (i: number, patch: Partial<RuleDraft>) =>
    { setRules(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r))) }

  const submit = () => {
    save.mutate({
      apiName, label: label.trim(), description: description.trim(), ontologyId,
      parameters: named.map((p, i) => ({
        api_name: toCamel(p.label), display_name: p.label.trim(), base_type: p.baseType,
        required: p.required, exposed: true, editable: true, position: i,
      })),
      rules: rules.filter((r) => r.objectTypeId).map((r, i) => ({
        kind: r.kind, position: i, object_type_id: r.objectTypeId,
        properties: r.props.filter((p) => p.propertyId).map((p) => ({
          property_id: p.propertyId, value_source: p.source,
          parameter_api_name: p.source === 'parameter' ? p.parameter : null,
          static_value: p.source === 'static' ? p.staticValue : null,
        })),
      })),
    }, { onSuccess: () => { setLabel(''); setDescription(''); setParams([newParam()]); setRules([newRule()]) } })
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">New action type</span>
        {label && <Tag minimal className="font-mono">{apiName}</Tag>}
      </div>
      <InputGroup placeholder="Label (e.g. Assign root cause)" value={label}
        onChange={(e) => { setLabel(e.currentTarget.value) }} />
      <TextArea placeholder="Description (optional)" value={description} fill rows={2}
        onChange={(e) => { setDescription(e.currentTarget.value) }} />

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Parameters</span>
        {params.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <InputGroup size="small" placeholder="Display name" value={p.label} className="flex-1 min-w-[160px]"
              onChange={(e) => { setParams(params.map((x, idx) => (idx === i ? { ...x, label: e.currentTarget.value } : x))) }} />
            <Tag minimal className="!text-[9px] font-mono">{toCamel(p.label) || 'apiName'}</Tag>
            <HTMLSelect value={p.baseType}
              onChange={(e) => { setParams(params.map((x, idx) => (idx === i ? { ...x, baseType: e.currentTarget.value as PropertyType } : x))) }}>
              {PARAM_TYPES.map((t) => {
                const def = PROPERTY_TYPES.find((d) => d.value === t)
                return <option key={t} value={t} title={def?.help}>{def?.label ?? t}</option>
              })}
            </HTMLSelect>
            <Checkbox checked={p.required} label="Required" className="mb-0"
              onChange={() => { setParams(params.map((x, idx) => (idx === i ? { ...x, required: !x.required } : x))) }} />
            <Button variant="minimal" size="small" icon="cross"
              onClick={() => { setParams(params.filter((_, idx) => idx !== i)) }} />
          </div>
        ))}
        <Button variant="minimal" size="small" icon="add"
          onClick={() => { setParams([...params, newParam()]) }}>Add parameter</Button>
      </div>

      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Rules</span>
        {rules.map((r, i) => {
          const target = types.find((t) => t.id === r.objectTypeId)
          return (
            <div key={i} className="space-y-1.5 border-l-2 border-violet-400/40 pl-2">
              <div className="flex flex-wrap items-center gap-2">
                <HTMLSelect value={r.kind} onChange={(e) => { setRule(i, { kind: e.currentTarget.value }) }}>
                  {kinds.map((k) => (
                    <option key={k.kind} value={k.kind} disabled={!k.executable}
                      title={k.note}>
                      {k.kind.replace(/_/g, ' ')}
                    </option>
                  ))}
                </HTMLSelect>
                <HTMLSelect value={r.objectTypeId} onChange={(e) => { setRule(i, { objectTypeId: e.currentTarget.value, props: [] }) }}>
                  <option value="">Object type…</option>
                  {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </HTMLSelect>
                <Button variant="minimal" size="small" icon="cross"
                  onClick={() => { setRules(rules.filter((_, idx) => idx !== i)) }} />
              </div>

              {target && r.props.map((p, pi) => {
                const set = (patch: Partial<PropDraft>) =>
                  { setRule(i, { props: r.props.map((x, xi) => (xi === pi ? { ...x, ...patch } : x)) }) }
                return (
                  <div key={pi} className="flex flex-wrap items-center gap-2">
                    <HTMLSelect value={p.propertyId} onChange={(e) => { set({ propertyId: e.currentTarget.value }) }}>
                      <option value="">Property…</option>
                      {target.properties.map((op) => <option key={op.id} value={op.id ?? ''}>{op.label}</option>)}
                    </HTMLSelect>
                    <HTMLSelect value={p.source} onChange={(e) => { set({ source: e.currentTarget.value as ValueSource }) }}>
                      {VALUE_SOURCES.map((v) => <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>)}
                    </HTMLSelect>
                    {p.source === 'parameter' && (
                      <HTMLSelect value={p.parameter} onChange={(e) => { set({ parameter: e.currentTarget.value }) }}>
                        <option value="">Parameter…</option>
                        {named.map((np) => <option key={toCamel(np.label)} value={toCamel(np.label)}>{np.label}</option>)}
                      </HTMLSelect>
                    )}
                    {p.source === 'static' && (
                      <InputGroup size="small" placeholder="Value" value={p.staticValue}
                        onChange={(e) => { set({ staticValue: e.currentTarget.value }) }} />
                    )}
                    <Button variant="minimal" size="small" icon="cross"
                      onClick={() => { setRule(i, { props: r.props.filter((_, xi) => xi !== pi) }) }} />
                  </div>
                )
              })}
              {target && (
                <Button variant="minimal" size="small" icon="add"
                  onClick={() => { setRule(i, { props: [...r.props, { propertyId: '', source: 'parameter', parameter: '', staticValue: '' }] }) }}>
                  Map a property
                </Button>
              )}
            </div>
          )
        })}
        <Button variant="minimal" size="small" icon="add"
          onClick={() => { setRules([...rules, newRule()]) }}>Add rule</Button>
      </div>

      <div>
        <Button intent={Intent.PRIMARY} icon="tick" disabled={!apiName} loading={save.isPending}
          onClick={submit}>Create action type</Button>
        <p className="text-[11px] text-muted-foreground mt-1">
          Creating stages it — the Save control in the header is what adds it to the ontology.
        </p>
      </div>
    </Card>
  )
}

/** "Every time you invoke this action from different contexts in Foundry, a
 *  common input form will collect the necessary input from a user." The form is
 *  the action's exposed parameters, and nothing else. */
function ApplyDialog({ action, onClose }: { action: ActionTypeRow; onClose: () => void }) {
  const apply = useApplyAction()
  const [values, setValues] = useState<Record<string, string>>({})
  const [primaryKey, setPrimaryKey] = useState('')
  const exposed = action.action_type_parameters
    .filter((p) => p.exposed).sort((a, b) => a.position - b.position)
  const target = needsTarget(action.action_type_rules)

  return (
    <Dialog isOpen title={action.label} icon="play" onClose={onClose}>
      <DialogBody>
        <div className="space-y-2">
          {exposed.length === 0 && <p className="text-xs text-muted-foreground">This action takes no input.</p>}
          {exposed.map((p) => (
            <label key={p.id} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {p.display_name}{p.required && <span className="text-red-600"> *</span>}
              </span>
              <InputGroup size="small" value={values[p.api_name] ?? ''} disabled={!p.editable}
                type={(p.base_type && VALUE_INPUT[p.base_type]) ?? 'text'}
                onChange={(e) => { setValues({ ...values, [p.api_name]: e.currentTarget.value }) }} />
            </label>
          ))}
          {target && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Target primary key<span className="text-red-600"> *</span>
              </span>
              <InputGroup size="small" value={primaryKey} className="font-mono"
                placeholder="The object this action edits"
                onChange={(e) => { setPrimaryKey(e.currentTarget.value) }} />
            </label>
          )}
          {apply.error && <Callout intent={Intent.DANGER} className="!text-[11px]">{apply.error.message}</Callout>}
        </div>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button variant="minimal" onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} icon="play" loading={apply.isPending}
            onClick={() => {
              apply.mutate({
                actionTypeId: action.id, parameters: values,
                primaryKey: primaryKey.trim() || undefined,
                objectTypeIds: action.action_type_rules
                  .map((r) => r.object_type_id).filter((id): id is string => id !== null),
              }, { onSuccess: onClose })
            }}>Apply</Button>
        </>
      } />
    </Dialog>
  )
}
