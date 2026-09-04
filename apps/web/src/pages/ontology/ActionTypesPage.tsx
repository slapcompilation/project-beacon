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
// rather than hidden.
//
// A row expands into "Security & Submission Criteria", the tab the course names
// ("You can update it on the Security & Submission Criteria tab"), holding the
// card the screenshot titles Execution. The header used to say criteria were
// omitted because nothing evaluated them; apply_action has called
// submission_criteria_verdict all along — see readings/submission-criteria-surface.md §5.

import { useMemo, useState } from 'react'
import {
  Button, Card, Checkbox,
  HTMLSelect, Icon, InputGroup, Intent, Tag, TextArea,
} from '@blueprintjs/core'
import {
  PROPERTY_TYPES, STATUS_META, toCamel, toSlug,
  type ObjectTypeDef, type PropertyType,
} from '@beacon/ontology'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'
import { useInterfaces } from '@/features/interfaces/hooks'
import { rowToInterface } from '@/features/interfaces/api'
import { useLinkTypes } from '@/features/objectTypes/hooks'
import { rowToLinkType } from '@/features/objectTypes/api'
import {
  useActionTypes, useRuleKinds, useSaveActionType,
  VALUE_SOURCES, type ActionRuleRow, type ActionTypeRow, type ValueSource,
} from '@/features/actionTypes/api'
import { CriteriaEditor } from '@/features/actionTypes/CriteriaEditor'
import { useFunctions, useFunctionVersions } from '@/features/functions/api'
import { FormEditor } from '@/features/actionTypes/FormEditor'
import { RunActionDialog } from '@/features/explorer/ActionsMenu'
import { FrontendConsumers } from '@/features/actionTypes/FrontendConsumers'
import { SubmissionOptions } from '@/features/actionTypes/SubmissionOptions'

/** A parameter is filled by a form field, so the picker offers the base types a
 *  form field can produce. The CHECK accepts every property base type. */
const PARAM_TYPES: PropertyType[] = ['string', 'integer', 'double', 'boolean', 'date', 'timestamp']

/** kebab-case, which is what action_types.api_name's CHECK wants. */
const toKebab = (s: string) => toSlug(s).replace(/_/g, '-')


export default function ActionTypesPage() {
  const { ontology, isLoading } = useOmaOntology()
  const { types } = useOmaTypes()
  const { data: actions } = useActionTypes(ontology?.id ?? null)
  const [applying, setApplying] = useState<ActionTypeRow | null>(null)
  const [open, setOpen] = useState<string | null>(null)

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
                <li key={a.id} className="px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <Button variant="minimal" size="small" title="Security & Submission Criteria"
                    icon={open === a.id ? 'chevron-down' : 'chevron-right'}
                    onClick={() => { setOpen(open === a.id ? null : a.id) }} />
                  <Icon icon="take-action" size={12} className="text-violet-500 shrink-0" />
                  <span className="font-medium">{a.label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{a.api_name}</span>
                  <Tag minimal intent={STATUS_META[a.status].intent}
                    title={STATUS_META[a.status].help}>{STATUS_META[a.status].label}</Tag>
                  <span className="flex-1 truncate text-muted-foreground">
                    {a.action_type_rules.map(summarize).join(', ') || 'no rules'}
                  </span>
                  <Tag minimal>
                    {a.action_type_parameters.length} param{a.action_type_parameters.length === 1 ? '' : 's'}
                  </Tag>
                  <Button size="small" icon="play" onClick={() => { setApplying(a) }}>Apply</Button>
                </div>
                {open === a.id && (
                  <div className="pl-5 pt-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Security &amp; Submission Criteria
                    </span>
                    <CriteriaEditor actionTypeId={a.id} params={a.action_type_parameters.map((p) => ({
                      id: p.id, api_name: p.api_name, display_name: p.display_name,
                      base_type: p.base_type ?? 'string',
                    }))} />
                    <FormEditor actionTypeId={a.id} />
                    <FrontendConsumers actionTypeId={a.id} />
                    <SubmissionOptions actionTypeId={a.id} />
                  </div>
                )}
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

interface ParamDraft {
  label: string; baseType: PropertyType; required: boolean
  /** A parameter is a value of a base type, or a reference to an object —
   *  the two data kinds 418/592 store. Link rules take only the second. */
  kind: 'value' | 'object'
  objectTypeId: string
}
interface PropDraft { propertyId: string; source: ValueSource; parameter: string; staticValue: string }
interface RuleDraft {
  kind: string; objectTypeId: string; interfaceId: string; props: PropDraft[]
  /** The Run function card (538): which function, pinned to which version,
   *  whether the caret follows, and the input-to-parameter mapping. */
  functionName?: string
  functionVersionId?: string
  autoUpgrade?: boolean
  inputs?: { inputName: string; parameter: string }[]
  /** A link rule (755): the many-to-many link and its two sides — "objects
   *  that are passed via object reference parameters". */
  linkTypeId?: string
  sourceParameter?: string
  targetParameter?: string
}

const isLinkKind = (kind: string) => kind === 'create_link' || kind === 'delete_link'

/** Which target a kind takes, straight from `action_rule_kinds()`. */
const targetsInterface = (kinds: { kind: string; targets: string }[], kind: string) =>
  kinds.find((k) => k.kind === kind)?.targets === 'interface'

const newParam = (): ParamDraft => ({ label: '', baseType: 'string', required: true, kind: 'value', objectTypeId: '' })
const newRule = (): RuleDraft => ({ kind: 'create_object', objectTypeId: '', interfaceId: '', props: [] })

/** The Run function card (538/668): pick the edit function, pin its version,
 *  choose whether the caret follows, and map its inputs to the action's
 *  parameters — "Configure the inputs to match up to the action parameters".
 *  Only functions whose pinned version returns an edit list are offered,
 *  because an action runs a function FOR its edits. */
function FunctionRuleCard({ ontologyId, rule, parameters, onChange }: {
  ontologyId: string
  rule: RuleDraft
  parameters: { apiName: string; label: string }[]
  onChange: (patch: Partial<RuleDraft>) => void
}) {
  const { data: functions = [] } = useFunctions(ontologyId)
  const fn = functions.find((f) => f.api_name === rule.functionName)
  const { data: versions = [] } = useFunctionVersions(fn?.id ?? null)
  const editVersions = versions.filter((v) => v.signature.returns === 'OntologyEdit[]')
  const chosen = editVersions.find((v) => v.id === rule.functionVersionId)
  const inputNames = chosen?.signature.parameters.map((p) => p.name) ?? []
  const mappings = rule.inputs ?? []
  const mapped = (name: string) => mappings.find((m) => m.inputName === name)?.parameter ?? ''

  return (
    <div className="space-y-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <HTMLSelect value={rule.functionName ?? ''} onChange={(e) => {
          onChange({ functionName: e.currentTarget.value, functionVersionId: undefined, inputs: [] })
        }}>
          <option value="">Function…</option>
          {functions.map((f) => <option key={f.id} value={f.api_name}>{f.display_name}</option>)}
        </HTMLSelect>
        <HTMLSelect value={rule.functionVersionId ?? ''} disabled={!fn} onChange={(e) => {
          onChange({ functionVersionId: e.currentTarget.value, inputs: [] })
        }}>
          <option value="">Version…</option>
          {editVersions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.major}.{v.minor}.{v.patch}{v.prerelease ? `-${v.prerelease}` : ''}
            </option>
          ))}
        </HTMLSelect>
        <Checkbox checked={rule.autoUpgrade ?? false} label="Auto upgrade" className="mb-0"
          onChange={() => { onChange({ autoUpgrade: !(rule.autoUpgrade ?? false) }) }} />
      </div>
      {fn && editVersions.length === 0 && (
        <p className="text-muted-foreground">
          {fn.display_name} has no version returning an edit list — publish one whose
          Returns is Ontology edit first.
        </p>
      )}
      {(rule.autoUpgrade ?? false) && (
        // 538's caret: non-breaking upgrades follow; a major stays pinned.
        <p className="text-amber-600">
          This action will follow new non-breaking versions automatically. A major
          version change still requires editing this rule.
        </p>
      )}
      {inputNames.length > 0 && (
        <div className="space-y-1">
          <span className="text-muted-foreground">Inputs</span>
          {inputNames.map((name) => (
            <div key={name} className="flex items-center gap-2">
              <code>{name}</code>
              <span className="text-muted-foreground">←</span>
              <HTMLSelect value={mapped(name)} onChange={(e) => {
                const next = mappings.filter((m) => m.inputName !== name)
                if (e.currentTarget.value) next.push({ inputName: name, parameter: e.currentTarget.value })
                onChange({ inputs: next })
              }}>
                <option value="">Parameter…</option>
                {parameters.filter((p) => p.apiName).map((p) => (
                  <option key={p.apiName} value={p.apiName}>{p.label}</option>
                ))}
              </HTMLSelect>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ActionBuilder({ ontologyId, types }: { ontologyId: string; types: ObjectTypeDef[] }) {
  const save = useSaveActionType()
  const { data: kinds = [] } = useRuleKinds()
  const { data: interfaceRows } = useInterfaces()
  const interfaces = useMemo(() => interfaceRows.map(rowToInterface), [interfaceRows])
  // "Create link(s): ... a many-to-many link" — only join-table links are
  // offerable; an FK link is edited through Modify object.
  const { data: linkRows } = useLinkTypes()
  const m2mLinks = useMemo(() => linkRows.map(rowToLinkType)
    .filter((lt) => lt.cardinality === 'many_to_many'), [linkRows])
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
        api_name: toCamel(p.label), display_name: p.label.trim(),
        base_type: p.kind === 'object' ? null : p.baseType,
        data_kind: p.kind === 'object' ? 'object' : 'base_type',
        object_type_id: p.kind === 'object' ? p.objectTypeId : null,
        required: p.required, exposed: true, editable: true, position: i,
      })),
      // An interface rule names an interface and no object type; the parameter
      // it needs is generated by the save, not authored here. A function rule
      // names neither — for as long as this filter required a target, a
      // function rule was silently DROPPED and the action saved rule-less.
      // A link rule's target is its link.
      rules: rules.filter((r) => r.kind === 'function'
        || (isLinkKind(r.kind) ? r.linkTypeId : (r.objectTypeId || r.interfaceId))).map((r, i) => {
        if (isLinkKind(r.kind)) {
          return {
            kind: r.kind, position: i, object_type_id: null,
            link_type_id: r.linkTypeId ?? null,
            source_parameter_api_name: r.sourceParameter ?? null,
            target_parameter_api_name: r.targetParameter ?? null,
            properties: [],
          }
        }
        if (r.kind === 'function') {
          return {
            kind: r.kind, position: i, object_type_id: null,
            function_name: r.functionName ?? null,
            function_version_id: r.functionVersionId ?? null,
            auto_upgrade: r.autoUpgrade ?? false,
            inputs: (r.inputs ?? []).filter((m) => m.inputName && m.parameter)
              .map((m) => ({ input_name: m.inputName, parameter_api_name: m.parameter })),
            properties: [],
          }
        }
        const onInterface = targetsInterface(kinds, r.kind)
        return {
          kind: r.kind, position: i,
          object_type_id: onInterface ? null : r.objectTypeId,
          interface_id: onInterface ? r.interfaceId : null,
          properties: r.props.filter((p) => p.propertyId).map((p) => ({
            property_id: onInterface ? null : p.propertyId,
            interface_property_id: onInterface ? p.propertyId : null,
            value_source: p.source,
            parameter_api_name: p.source === 'parameter' ? p.parameter : null,
            static_value: p.source === 'static' ? p.staticValue : null,
          })),
        }
      }),
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
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Parameters</span>
        {params.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <InputGroup size="small" placeholder="Display name" value={p.label} className="flex-1 min-w-[160px]"
              onChange={(e) => { setParams(params.map((x, idx) => (idx === i ? { ...x, label: e.currentTarget.value } : x))) }} />
            <Tag minimal className="font-mono">{toCamel(p.label) || 'apiName'}</Tag>
            <HTMLSelect value={p.kind}
              onChange={(e) => { setParams(params.map((x, idx) => (idx === i ? { ...x, kind: e.currentTarget.value as 'value' | 'object' } : x))) }}>
              <option value="value">Value</option>
              <option value="object">Object reference</option>
            </HTMLSelect>
            {p.kind === 'object' ? (
              <HTMLSelect value={p.objectTypeId}
                onChange={(e) => { setParams(params.map((x, idx) => (idx === i ? { ...x, objectTypeId: e.currentTarget.value } : x))) }}>
                <option value="">Object type…</option>
                {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </HTMLSelect>
            ) : (
              <HTMLSelect value={p.baseType}
                onChange={(e) => { setParams(params.map((x, idx) => (idx === i ? { ...x, baseType: e.currentTarget.value as PropertyType } : x))) }}>
                {PARAM_TYPES.map((t) => {
                  const def = PROPERTY_TYPES.find((d) => d.value === t)
                  return <option key={t} value={t} title={def?.help}>{def?.label ?? t}</option>
                })}
              </HTMLSelect>
            )}
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
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rules</span>
        {rules.map((r, i) => {
          const onInterface = targetsInterface(kinds, r.kind)
          const iface = interfaces.find((x) => x.id === r.interfaceId)
          // The rule's properties come from whichever it targets. An interface
          // property is one row that each implementer resolves onto its own.
          const target = onInterface ? iface : types.find((t) => t.id === r.objectTypeId)
          return (
            <div key={i} className="space-y-1.5 border-l-2 border-border pl-2">
              <div className="flex flex-wrap items-center gap-2">
                <HTMLSelect value={r.kind}
                  onChange={(e) => { setRule(i, { kind: e.currentTarget.value, props: [] }) }}>
                  {kinds.map((k) => (
                    <option key={k.kind} value={k.kind} disabled={!k.executable}
                      title={k.note}>
                      {k.kind.replace(/_/g, ' ')}
                    </option>
                  ))}
                </HTMLSelect>
                {r.kind === 'function' ? null : isLinkKind(r.kind) ? (
                  <HTMLSelect value={r.linkTypeId ?? ''}
                    onChange={(e) => { setRule(i, { linkTypeId: e.currentTarget.value }) }}>
                    <option value="">Link type…</option>
                    {m2mLinks.map((lt) => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
                  </HTMLSelect>
                ) : onInterface ? (
                  <HTMLSelect value={r.interfaceId}
                    onChange={(e) => { setRule(i, { interfaceId: e.currentTarget.value, props: [] }) }}>
                    <option value="">Interface…</option>
                    {interfaces.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </HTMLSelect>
                ) : (
                  <HTMLSelect value={r.objectTypeId} onChange={(e) => { setRule(i, { objectTypeId: e.currentTarget.value, props: [] }) }}>
                    <option value="">Object type…</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </HTMLSelect>
                )}
                <Button variant="minimal" size="small" icon="cross"
                  onClick={() => { setRules(rules.filter((_, idx) => idx !== i)) }} />
              </div>

              {r.kind === 'function' && (
                <FunctionRuleCard ontologyId={ontologyId} rule={r}
                  parameters={named.map((np) => ({ apiName: toCamel(np.label), label: np.label }))}
                  onChange={(patch) => { setRule(i, patch) }} />
              )}
              {isLinkKind(r.kind) && (
                // "objects that are passed via object reference parameters" —
                // the two sides come from the object parameters above.
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {(['sourceParameter', 'targetParameter'] as const).map((side) => (
                    <HTMLSelect key={side} value={r[side] ?? ''}
                      onChange={(e) => { setRule(i, { [side]: e.currentTarget.value }) }}>
                      <option value="">{side === 'sourceParameter' ? 'Source parameter…' : 'Target parameter…'}</option>
                      {named.filter((np) => np.kind === 'object').map((np) => (
                        <option key={toCamel(np.label)} value={toCamel(np.label)}>{np.label}</option>
                      ))}
                    </HTMLSelect>
                  ))}
                  {named.every((np) => np.kind !== 'object') && (
                    <span className="text-muted-foreground">
                      Rules on links can only take object reference parameters — add two above.
                    </span>
                  )}
                </div>
              )}
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
              {onInterface && r.interfaceId !== '' && (
                <p className="text-xs text-muted-foreground">
                  A parameter naming {r.kind === 'create_object_of_interface'
                    ? 'the object type to create' : 'the object to edit'} is generated
                  with this rule — you do not add it.
                </p>
              )}
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
        <p className="text-xs text-muted-foreground mt-1">
          Creating stages it — the Save control in the header is what adds it to the ontology.
        </p>
      </div>
    </Card>
  )
}

/** "Every time you invoke this action from different contexts in Foundry, a
 *  common input form will collect the necessary input from a user." The form is
 *  the action's exposed parameters, and nothing else. */
// Since F6.5/F9 the OMA applies through the SAME dialog the Explorer uses —
// sections, defaults and override-driven visibility come from the one
// resolver, and the two apply surfaces can no longer disagree about what the
// form is. With nothing selected, the dialog collects the target key itself.
function ApplyDialog({ action, onClose }: { action: ActionTypeRow; onClose: () => void }) {
  return <RunActionDialog action={action} targets={[]} selectedRow={null} onClose={onClose} />
}
