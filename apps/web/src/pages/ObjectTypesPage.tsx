// Object Types (Studio P2.1) — Foundry's Ontology Manager, starter. Author a new
// kind of thing with typed properties, then create records of it. Config-as-data:
// the type + its records are rows, no code deploy. Types are admin/owner-authored;
// records can be created by any org member (RLS enforces both).

import { useMemo, useState } from 'react'
import {
  Button, Card, Checkbox, HTMLSelect, Icon, InputGroup, Intent, NonIdealState,
  NumericInput, Spinner, SpinnerSize, Switch, Tag, TextArea,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import {
  PROPERTY_TYPES, COMPUTED_FNS, toSlug, validateObjectTypeDraft, validateRecord, coerceValue,
  validateLinkTypeDraft, evaluateComputed, validateComputedProperty, validateViewConfig,
  ONTOLOGY_STATUSES, ONTOLOGY_VISIBILITIES, STATUS_META, VISIBILITY_META, statusChangeProblem,
  attachProblem, usedBy,
  type PropertyType, type PropertyDef, type ObjectTypeDef, type LinkTypeDef,
  type ComputedFn, type ComputedPropertyDef, type ViewConfigDef,
  type OntologyStatus, type OntologyVisibility, type OntologyStatusMeta,
} from '@beacon/reality-graph'
import { useAuthStore } from '@/stores/auth.store'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { rowToObjectType, rowToLinkType } from '@/features/objectTypes/api'
import {
  useObjectTypes, useOntologyTypes, useCreateObjectType, useDeleteObjectType,
  useUpdateObjectType, useRevisions, useRestoreRevision,
  useObjectRecords, useCreateObjectRecord, useDeleteObjectRecord,
  useLinkTypes, useCreateLinkType, useDeleteLinkType,
  useRecordLinks, useCreateObjectLink, useDeleteObjectLink, useTypeImpact,
  useSetObjectTypeStatus,
} from '@/features/objectTypes/hooks'
import {
  useSharedProperties, useSharedPropertyMap, useCreateSharedProperty, useDeleteSharedProperty,
} from '@/features/objectTypes/sharedProperties'
import { PromoteToggle, usePromotions } from '@/features/promotion/api'
import { ActionTypesSection } from '@/features/actionTypes/ActionTypesSection'
import InterfacesSection from '@/features/interfaces/InterfacesSection'

const ICONS: IconName[] = ['cube', 'wrench', 'clipboard', 'shop', 'people', 'warning-sign', 'document', 'calendar', 'clean', 'key']

interface PropertyDraft { label: string; type: PropertyType; required: boolean }
interface ComputedRow { label: string; fn: ComputedFn; inputs: string[] }

export default function ObjectTypesPage() {
  const role = useAuthStore((s) => s.role)
  const { data: rows = [], isLoading } = useObjectTypes()
  const types = useMemo(() => rows.map(rowToObjectType), [rows])
  // Link endpoints span the WHOLE ontology (migration 223), so an authored type
  // can point at a built-in one — a Maintenance Request belongs to a Variant.
  const { data: ontologyRows = [] } = useOntologyTypes()
  const linkTargets = useMemo(() => ontologyRows.map(rowToObjectType), [ontologyRows])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = types.find((t) => t.id === selectedId) ?? null

  if (role !== 'owner' && role !== 'admin') {
    return <NonIdealState icon="shield" title="Object type authoring is available to admin and owner roles" />
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Object types</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Define a new kind of thing with typed properties — a Maintenance Request, a Guest Complaint,
            an Asset — then create records of it. No code deploy; the ontology grows as data.
          </p>
        </header>

        <TypeBuilder />

        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your object types</h2>
          {isLoading ? (
            <Card compact className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} />Loading…</Card>
          ) : types.length === 0 ? (
            <Card compact className="text-xs text-muted-foreground">None yet — author one above.</Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {types.map((t) => (
                <Card key={t.id} interactive compact
                  className={selectedId === t.id ? '!border-violet-400' : ''}
                  onClick={() => { setSelectedId(selectedId === t.id ? null : t.id) }}>
                  <div className="flex items-center gap-2">
                    <Icon icon={t.icon as IconName} size={14} className="text-violet-500" />
                    <span className="text-sm font-semibold">{t.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{t.apiName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-[11px] text-muted-foreground">{t.properties.length} propert{t.properties.length === 1 ? 'y' : 'ies'}</p>
                    <StatusTag status={t.status ?? 'experimental'} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {selected && <RecordsPanel type={selected} allTypes={linkTargets} />}

        <SharedPropertiesSection types={types} />

        <ActionTypesSection types={types} />

        <InterfacesSection types={types} />
      </div>
    </div>
  )
}

/** One definition of `cost`, used by several object types. Foundry: "update
 *  metadata in one place instead of on each object type" — so editing here moves
 *  every type that inherits it, which is the whole point and worth showing. */
function SharedPropertiesSection({ types }: { types: ObjectTypeDef[] }) {
  const { data: defs = [] } = useSharedProperties()
  const create = useCreateSharedProperty()
  const del = useDeleteSharedProperty()
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [baseType, setBaseType] = useState<PropertyType>('text')
  const apiName = toSlug(label)

  return (
    <section className="space-y-2 border-t pt-5">
      <div className="flex items-center gap-2">
        <Icon icon="globe" size={14} className="text-violet-500" />
        <h2 className="text-sm font-semibold">Shared properties</h2>
        <Tag minimal className="!text-[10px]">{defs.length}</Tag>
      </div>
      <p className="text-[11px] text-muted-foreground max-w-2xl">
        One definition used by several object types. The metadata is shared — the data is not;
        each type still stores its own values. Editing a definition moves every property that
        inherits from it.
      </p>

      <Card compact className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 flex-1 min-w-40">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
          <InputGroup size="small" value={label} placeholder="Cost"
            onChange={(e) => { setLabel(e.currentTarget.value) }} />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-56">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</span>
          <InputGroup size="small" value={description} placeholder="What it cost us, in the property currency"
            onChange={(e) => { setDescription(e.currentTarget.value) }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Base type</span>
          <HTMLSelect value={baseType} onChange={(e) => { setBaseType(e.currentTarget.value as PropertyType) }}>
            {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </HTMLSelect>
        </label>
        <Button size="small" icon="add" intent={Intent.PRIMARY} loading={create.isPending}
          disabled={!apiName || defs.some((d) => d.apiName === apiName)}
          onClick={() => {
            create.mutate({ apiName, label: label.trim(), description: description.trim(), baseType },
              { onSuccess: () => { setLabel(''); setDescription('') } })
          }}>
          Create
        </Button>
      </Card>

      {defs.length > 0 && (
        <Card compact className="!p-0">
          <ul className="divide-y divide-border/30">
            {defs.map((d) => {
              const consumers = usedBy(d.apiName, types)
              return (
                <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                  <Icon icon="globe" size={11} className="text-violet-500 shrink-0" />
                  <span className="font-medium">{d.label}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{d.apiName}</span>
                  <Tag minimal className="!text-[9px]">{d.baseType}</Tag>
                  <span className="flex-1 truncate text-muted-foreground">{d.description}</span>
                  <Tag minimal intent={consumers.length > 0 ? Intent.PRIMARY : Intent.NONE} className="!text-[9px]"
                    title={consumers.map((t) => t.label).join(', ') || 'Not used by any object type yet'}>
                    {consumers.length} type{consumers.length === 1 ? '' : 's'}
                  </Tag>
                  <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
                    disabled={consumers.length > 0}
                    title={consumers.length > 0 ? `Used by ${consumers.map((t) => t.label).join(', ')} — detach it there first.` : undefined}
                    onClick={() => { del.mutate(d.id) }} />
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </section>
  )
}

function StatusTag({ status }: { status: OntologyStatus }) {
  const m = STATUS_META[status]
  return <Tag minimal intent={INTENTS[m.intent]} className="!text-[9px] uppercase tracking-wide" title={m.help}>{m.label}</Tag>
}

const INTENTS: Record<OntologyStatusMeta['intent'], Intent> = {
  success: Intent.SUCCESS, primary: Intent.PRIMARY, warning: Intent.WARNING,
  danger: Intent.DANGER, none: Intent.NONE,
}

/** Retiring a type rather than deleting it. Foundry's status vocabulary, and
 *  the deprecation record it asks for: a reason, a deadline, and what replaces
 *  this. Without the last one the next reader has to guess. */
function StatusPanel({ type, allTypes }: { type: ObjectTypeDef; allTypes: ObjectTypeDef[] }) {
  const set = useSetObjectTypeStatus()
  const { data: promotions } = usePromotions()
  const isPromoted = promotions?.has(`object_type:${type.id}`) ?? false
  const current = type.status ?? 'experimental'
  const [status, setStatus] = useState<OntologyStatus>(current)
  const [visibility, setVisibility] = useState<OntologyVisibility>(type.visibility ?? 'normal')
  const [reason, setReason] = useState(type.deprecation?.reason ?? '')
  const [deadline, setDeadline] = useState(type.deprecation?.deadline ?? '')
  const [replacedBy, setReplacedBy] = useState(type.deprecation?.replacedBy ?? '')

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
          <HTMLSelect value={visibility} disabled={isPromoted}
            title={isPromoted ? 'A promoted resource is prominent by definition.' : undefined}
            onChange={(e) => { setVisibility(e.currentTarget.value as OntologyVisibility) }}>
            {ONTOLOGY_VISIBILITIES.map((v) => <option key={v} value={v}>{VISIBILITY_META[v].label}</option>)}
          </HTMLSelect>
        </label>
        <p className="text-[11px] text-muted-foreground flex-1 min-w-48">{STATUS_META[status].help}</p>
      </div>

      {/* Promotion is a different axis from status — a type is active AND
          promoted, never one instead of the other. */}
      <div className="border-t border-border/40 pt-3">
        <PromoteToggle kind="object_type" id={type.id} withEffects />
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
            <InputGroup size="small" type="date" value={deadline} onChange={(e) => { setDeadline(e.currentTarget.value) }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Replaced by</span>
            <HTMLSelect value={replacedBy} onChange={(e) => { setReplacedBy(e.currentTarget.value) }}>
              <option value="">Nothing — it is simply going</option>
              {allTypes.filter((t) => t.id !== type.id).map((t) => (
                <option key={t.id} value={t.apiName}>{t.label}</option>
              ))}
            </HTMLSelect>
          </label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button size="small" intent={Intent.PRIMARY} icon="tick" disabled={!!problem} loading={set.isPending}
          onClick={() => { set.mutate({ id: type.id, status, visibility, deprecation }) }}>
          Save
        </Button>
        {problem && <span className="text-[11px] text-muted-foreground">{problem}</span>}
      </div>
    </Card>
  )
}

function TypeBuilder() {
  const hotelId = useActiveHotelId()
  const create = useCreateObjectType()
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState<IconName>('cube')
  const [description, setDescription] = useState('')
  const [props, setProps] = useState<PropertyDraft[]>([{ label: '', type: 'text', required: false }])
  const [computed, setComputed] = useState<ComputedRow[]>([])

  const apiName = toSlug(label)
  const properties: PropertyDef[] = props
    .filter((p) => p.label.trim())
    .map((p) => ({ key: toSlug(p.label), label: p.label.trim(), type: p.type, required: p.required }))
  const computedProperties: ComputedPropertyDef[] = computed
    .filter((c) => c.label.trim())
    .map((c) => ({ key: toSlug(c.label), label: c.label.trim(), fn: c.fn, inputs: c.inputs }))
  const validation = validateObjectTypeDraft({ apiName, label, properties })
  const computedErrors = computedProperties.flatMap((cp) => validateComputedProperty(cp, properties).errors)
  const canSave = validation.ok && computedErrors.length === 0

  const setProp = (i: number, patch: Partial<PropertyDraft>) =>
    { setProps((cur) => cur.map((p, idx) => (idx === i ? { ...p, ...patch } : p))) }

  const submit = () => {
    if (!canSave) return
    create.mutate(
      { hotelId, apiName, label: label.trim(), icon, description: description.trim(), properties, computedProperties },
      { onSuccess: () => { setLabel(''); setDescription(''); setProps([{ label: '', type: 'text', required: false }]); setComputed([]); setIcon('cube') } },
    )
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="plus" size={14} className="text-violet-500" />
        <span className="text-sm font-semibold">New object type</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup placeholder="Label (e.g. Maintenance Request)" value={label} onChange={(e) => { setLabel(e.currentTarget.value) }} className="flex-1 min-w-[200px]" />
        <HTMLSelect value={icon} onChange={(e) => { setIcon(e.currentTarget.value as IconName) }}>
          {ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
        </HTMLSelect>
        {label && <Tag minimal className="font-mono">{apiName}</Tag>}
      </div>
      <TextArea placeholder="Description (optional)" value={description} onChange={(e) => { setDescription(e.currentTarget.value) }} fill rows={2} />

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Properties</span>
        {props.map((p, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <InputGroup size="small" placeholder="Property label" value={p.label} onChange={(e) => { setProp(i, { label: e.currentTarget.value }) }} className="flex-1 min-w-[160px]" />
            <HTMLSelect value={p.type} onChange={(e) => { setProp(i, { type: e.currentTarget.value as PropertyType }) }}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </HTMLSelect>
            <Checkbox checked={p.required} label="Required" onChange={() => { setProp(i, { required: !p.required }) }} className="mb-0" />
            <Button variant="minimal" size="small" icon="cross" onClick={() => { setProps((cur) => cur.filter((_, idx) => idx !== i)) }} />
          </div>
        ))}
        <Button variant="minimal" size="small" icon="add" onClick={() => { setProps((cur) => [...cur, { label: '', type: 'text', required: false }]) }}>Add property</Button>
      </div>

      <ComputedBuilder properties={properties} rows={computed} onChange={setComputed} />

      {label.trim() !== '' && !canSave && (
        <ul className="text-[11px] text-red-600 list-disc pl-4">{[...validation.errors, ...computedErrors].map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <Button intent={Intent.PRIMARY} icon="tick" disabled={!canSave} loading={create.isPending} onClick={submit}>Create object type</Button>
    </Card>
  )
}

function ComputedBuilder({ properties, rows, onChange }: { properties: PropertyDef[]; rows: ComputedRow[]; onChange: (r: ComputedRow[]) => void }) {
  const set = (i: number, patch: Partial<ComputedRow>) => { onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r))) }
  const setFn = (i: number, fn: ComputedFn) => { set(i, { fn, inputs: [] }) } // input type changes → reset inputs

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Computed properties</span>
      {rows.map((row, i) => {
        const fnDef = COMPUTED_FNS.find((f) => f.value === row.fn)
        const eligible = fnDef ? properties.filter((p) => p.type === fnDef.inputType) : []
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <InputGroup size="small" placeholder="Computed label (e.g. Days open)" value={row.label} onChange={(e) => { set(i, { label: e.currentTarget.value }) }} className="min-w-[150px]" />
            <HTMLSelect value={row.fn} onChange={(e) => { setFn(i, e.currentTarget.value as ComputedFn) }}>
              {COMPUTED_FNS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </HTMLSelect>
            {fnDef?.arity === 'many' ? (
              <div className="flex flex-wrap items-center gap-2">
                {eligible.map((p) => (
                  <Checkbox key={p.key} checked={row.inputs.includes(p.key)} label={p.label} className="mb-0"
                    onChange={() => { set(i, { inputs: row.inputs.includes(p.key) ? row.inputs.filter((k) => k !== p.key) : [...row.inputs, p.key] }) }} />
                ))}
              </div>
            ) : (
              Array.from({ length: fnDef?.arity === 'two' ? 2 : 1 }).map((_, si) => (
                <HTMLSelect key={si} value={row.inputs[si] ?? ''} onChange={(e) => { const next = [...row.inputs]; next[si] = e.currentTarget.value; set(i, { inputs: next }) }}>
                  <option value="">Select…</option>
                  {eligible.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                </HTMLSelect>
              ))
            )}
            <Button variant="minimal" size="small" icon="cross" onClick={() => { onChange(rows.filter((_, idx) => idx !== i)) }} />
          </div>
        )
      })}
      <Button variant="minimal" size="small" icon="add" disabled={properties.length === 0}
        onClick={() => { onChange([...rows, { label: '', fn: 'sum', inputs: [] }]) }}>
        Add computed property
      </Button>
    </div>
  )
}

function RecordsPanel({ type, allTypes }: { type: ObjectTypeDef; allTypes: ObjectTypeDef[] }) {
  const hotelId = useActiveHotelId()
  const { data: records = [], isLoading } = useObjectRecords(type.id)
  const { data: linkTypeRows = [] } = useLinkTypes()
  const linkTypes = useMemo(() => linkTypeRows.map(rowToLinkType).filter((lt) => lt.sourceTypeId === type.id), [linkTypeRows, type.id])
  const create = useCreateObjectRecord()
  const del = useDeleteObjectType()
  const impact = useTypeImpact(type.id)
  const delRecord = useDeleteObjectRecord(type.id)

  const [title, setTitle] = useState('')
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [panel, setPanel] = useState<'none' | 'edit' | 'history' | 'status'>('none')
  const status = type.status ?? 'experimental'
  const meta = STATUS_META[status]

  const data = useMemo(() => {
    const out: Record<string, unknown> = {}
    for (const p of type.properties) out[p.key] = coerceValue(p.type, values[p.key])
    return out
  }, [type.properties, values])
  const validation = validateRecord(type.properties, { title, data })

  const submit = () => {
    if (!validation.ok) return
    create.mutate({ objectTypeId: type.id, hotelId, title: title.trim(), data },
      { onSuccess: () => { setTitle(''); setValues({}) } })
  }

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon icon={type.icon as IconName} size={15} className="text-violet-500" />
          <h2 className="text-sm font-semibold">{type.label} records</h2>
          <Tag minimal className="!text-[10px] tabular-nums">v{type.version}</Tag>
          <StatusTag status={status} />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="minimal" size="small" icon="edit" active={panel === 'edit'}
            onClick={() => { setPanel(panel === 'edit' ? 'none' : 'edit') }}>Edit schema</Button>
          <Button variant="minimal" size="small" icon="history" active={panel === 'history'}
            onClick={() => { setPanel(panel === 'history' ? 'none' : 'history') }}>History</Button>
          <Button variant="minimal" size="small" icon="lifesaver" active={panel === 'status'}
            onClick={() => { setPanel(panel === 'status' ? 'none' : 'status') }}>Status</Button>
          <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
            // The database refuses this outright; say so before the click rather
            // than surfacing a raised exception as a toast.
            disabled={!meta.deletable}
            title={meta.deletable ? undefined : `${meta.label} — deprecate it first, with a reason and a deadline.`}
            onClick={() => {
              // Impact analysis before the edit, not a stack trace after it.
              const breaks = impact.data ?? []
              const detail = breaks.length === 0
                ? ''
                : [
                    '',
                    `This will break ${String(breaks.length)} thing(s):`,
                    ...breaks.map((b) => `  • ${b.artifactKind} "${b.artifactName}" — ${b.detail}`),
                  ].join(String.fromCharCode(10))
              if (window.confirm(`Delete the "${type.label}" type and all its records?${detail}`)) del.mutate(type.id)
            }}>
            Delete type
          </Button>
        </div>
      </div>

      {panel === 'edit' && <SchemaEditor key={`${type.id}-v${String(type.version)}`} type={type} onDone={() => { setPanel('none') }} />}
      {panel === 'history' && <HistoryPanel type={type} />}
      {panel === 'status' && <StatusPanel type={type} allTypes={allTypes} />}

      <Card className="space-y-2">
        <InputGroup placeholder={`${type.label} title`} value={title} onChange={(e) => { setTitle(e.currentTarget.value) }} />
        {type.properties.map((p) => (
          <div key={p.key} className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground w-32 shrink-0">{p.label}{p.required && ' *'}</label>
            <PropertyInput p={p} value={values[p.key]} onChange={(v) => { setValues((cur) => ({ ...cur, [p.key]: v })) }} />
          </div>
        ))}
        <Button intent={Intent.PRIMARY} size="small" icon="add" disabled={!validation.ok} loading={create.isPending} onClick={submit}>Add record</Button>
      </Card>

      <LinkTypesSection type={type} allTypes={allTypes} linkTypes={linkTypes} />

      {isLoading ? (
        <Card compact className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} />Loading records…</Card>
      ) : records.length === 0 ? (
        <Card compact className="text-xs text-muted-foreground">No records yet.</Card>
      ) : (
        <Card compact className="!p-0 overflow-hidden divide-y divide-border">
          {records.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {type.properties.map((p) => `${p.label}: ${formatVal(r.data[p.key])}`).join(' · ') || '—'}
                </p>
                {type.computedProperties.length > 0 && (
                  <p className="text-[11px] text-violet-600/80 truncate">
                    {type.computedProperties.map((cp) => `${cp.label}: ${formatVal(evaluateComputed(cp, r.data))}`).join(' · ')}
                  </p>
                )}
                {linkTypes.length > 0 && <RecordLinks recordId={r.id} linkTypes={linkTypes} hotelId={hotelId} />}
              </div>
              <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER} onClick={() => { delRecord.mutate(r.id) }} />
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}

// Edit the live schema. Existing property keys are preserved (records reference
// them); only newly added properties derive a key from their label. Saving bumps
// the version + snapshots via the DB triggers.
function SchemaEditor({ type, onDone }: { type: ObjectTypeDef; onDone: () => void }) {
  const update = useUpdateObjectType()
  const [label, setLabel] = useState(type.label)
  const [icon, setIcon] = useState<IconName>(type.icon as IconName)
  const [description, setDescription] = useState(type.description)
  const sharedMap = useSharedPropertyMap()
  const [props, setProps] = useState<(PropertyDef & { isNew?: boolean })[]>(type.properties)
  const [computed, setComputed] = useState<ComputedRow[]>(
    type.computedProperties.map((c) => ({ label: c.label, fn: c.fn, inputs: c.inputs })),
  )
  const [viewConfig, setViewConfig] = useState<ViewConfigDef>(type.viewConfig)

  // `shared` travels with the property — dropping it here would silently detach
  // every inheriting property on the next save.
  const properties: PropertyDef[] = props
    .filter((p) => p.label.trim())
    .map((p) => ({
      key: p.isNew ? toSlug(p.label) : p.key, label: p.label.trim(),
      type: p.type, required: p.required, shared: p.shared ?? null,
    }))
  const computedProperties: ComputedPropertyDef[] = computed
    .filter((c) => c.label.trim())
    .map((c) => ({ key: toSlug(c.label), label: c.label.trim(), fn: c.fn, inputs: c.inputs }))
  const validation = validateObjectTypeDraft({ apiName: type.apiName, label, properties })
  const computedErrors = computedProperties.flatMap((cp) => validateComputedProperty(cp, properties).errors)
  // resolveViewConfig on save drops keys that were removed; only structural errors block.
  const viewErrors = validateViewConfig(viewConfig, { properties, computedProperties }).errors
    .filter((e) => e.includes('title') || e.includes('more than one'))
  const canSave = validation.ok && computedErrors.length === 0 && viewErrors.length === 0

  const setProp = (i: number, patch: Partial<PropertyDef>) =>
    { setProps((cur) => cur.map((p, idx) => (idx === i ? { ...p, ...patch } : p))) }

  const save = () => {
    if (!canSave) return
    // Persist only the authored config, filtered to keys that still exist — the
    // render-time resolver sweeps unplaced keys, so nothing is ever hidden.
    const all = new Set([...properties.map((p) => p.key), ...computedProperties.map((c) => c.key)])
    const cleaned: ViewConfigDef = {
      prominent: viewConfig.prominent.filter((k) => all.has(k)),
      sections: viewConfig.sections
        .map((s) => ({ title: s.title, keys: s.keys.filter((k) => all.has(k)) }))
        .filter((s) => s.title.trim() !== '' && s.keys.length > 0),
    }
    update.mutate(
      { id: type.id, label: label.trim(), icon, description: description.trim(), properties, computedProperties, viewConfig: cleaned },
      { onSuccess: onDone },
    )
  }

  return (
    <Card className="space-y-3 !border-violet-400/50">
      <div className="flex items-center gap-2">
        <Icon icon="edit" size={14} className="text-violet-500" />
        <span className="text-sm font-semibold">Edit schema</span>
        <span className="text-[11px] text-muted-foreground">saving creates v{type.version + 1}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup value={label} onChange={(e) => { setLabel(e.currentTarget.value) }} className="flex-1 min-w-[200px]" />
        <HTMLSelect value={icon} onChange={(e) => { setIcon(e.currentTarget.value as IconName) }}>
          {[...new Set<IconName>([...ICONS, icon])].map((ic) => <option key={ic} value={ic}>{ic}</option>)}
        </HTMLSelect>
      </div>
      <TextArea value={description} onChange={(e) => { setDescription(e.currentTarget.value) }} fill rows={2} />

      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Properties</span>
        {props.map((p, i) => {
          const def = p.shared ? sharedMap.get(p.shared) : undefined
          // "Direct edits to property metadata that is inherited from the shared
          // property will be disabled." An editable copy is the drift this exists
          // to remove. `required` stays the object type's to decide.
          return (
            <div key={i} className="flex flex-wrap items-center gap-2">
              {def && <Icon icon="globe" size={12} className="text-violet-500 shrink-0" title={`Inherits from "${def.apiName}"`} />}
              <InputGroup size="small" value={def?.label ?? p.label} disabled={!!def}
                onChange={(e) => { setProp(i, { label: e.currentTarget.value }) }} className="flex-1 min-w-[160px]" />
              <HTMLSelect value={def?.baseType ?? p.type} disabled={!!def}
                onChange={(e) => { setProp(i, { type: e.currentTarget.value as PropertyType }) }}>
                {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </HTMLSelect>
              <HTMLSelect value={p.shared ?? ''} title="Inherit this property's metadata from a shared definition"
                onChange={(e) => { setProp(i, { shared: e.currentTarget.value || null }) }}>
                <option value="">Not shared</option>
                {[...sharedMap.values()].map((d) => (
                  <option key={d.apiName} value={d.apiName}
                    disabled={!!attachProblem({ ...p, key: p.key || 'x' }, d)}>
                    {d.label} ({d.baseType})
                  </option>
                ))}
              </HTMLSelect>
              <Checkbox checked={p.required} label="Required" onChange={() => { setProp(i, { required: !p.required }) }} className="mb-0" />
              <Button variant="minimal" size="small" icon="cross" onClick={() => { setProps((cur) => cur.filter((_, idx) => idx !== i)) }} />
            </div>
          )
        })}
        <Button variant="minimal" size="small" icon="add"
          onClick={() => { setProps((cur) => [...cur, { key: '', label: '', type: 'text', required: false, isNew: true }]) }}>
          Add property
        </Button>
      </div>

      <ComputedBuilder properties={properties} rows={computed} onChange={setComputed} />

      <ViewBuilder properties={properties} computedProperties={computedProperties} config={viewConfig} onChange={setViewConfig} />

      {!canSave && (
        <ul className="text-[11px] text-red-600 list-disc pl-4">{[...validation.errors, ...computedErrors, ...viewErrors].map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} icon="floppy-disk" disabled={!canSave} loading={update.isPending} onClick={save}>Save as v{type.version + 1}</Button>
        <Button variant="minimal" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  )
}

// Configure how records of this type PRESENT: prominent keys (metric strip) +
// grouped sections. Unplaced keys are swept into a Details section at render
// time, so config never hides data.
function ViewBuilder({ properties, computedProperties, config, onChange }: {
  properties: PropertyDef[]
  computedProperties: ComputedPropertyDef[]
  config: ViewConfigDef
  onChange: (c: ViewConfigDef) => void
}) {
  const all = [
    ...properties.map((p) => ({ key: p.key, label: p.label })),
    ...computedProperties.map((c) => ({ key: c.key, label: c.label })),
  ]
  const toggleProminent = (key: string) => {
    onChange({
      ...config,
      prominent: config.prominent.includes(key) ? config.prominent.filter((k) => k !== key) : [...config.prominent, key],
    })
  }
  const setSection = (i: number, patch: Partial<{ title: string; keys: string[] }>) =>
    { onChange({ ...config, sections: config.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)) }) }
  const toggleSectionKey = (i: number, key: string) => {
    const s = config.sections[i]
    setSection(i, { keys: s.keys.includes(key) ? s.keys.filter((k) => k !== key) : [...s.keys, key] })
  }

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Object view</span>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Metric strip:</span>
        {all.map((k) => (
          <Checkbox key={k.key} checked={config.prominent.includes(k.key)} label={k.label} className="mb-0"
            onChange={() => { toggleProminent(k.key) }} />
        ))}
        {all.length === 0 && <span className="text-[11px] text-muted-foreground">add properties first</span>}
      </div>
      {config.sections.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <InputGroup size="small" placeholder="Section title" value={s.title} onChange={(e) => { setSection(i, { title: e.currentTarget.value }) }} className="min-w-[140px]" />
          {all.map((k) => (
            <Checkbox key={k.key} checked={s.keys.includes(k.key)} label={k.label} className="mb-0"
              onChange={() => { toggleSectionKey(i, k.key) }} />
          ))}
          <Button variant="minimal" size="small" icon="cross" onClick={() => { onChange({ ...config, sections: config.sections.filter((_, idx) => idx !== i) }) }} />
        </div>
      ))}
      <Button variant="minimal" size="small" icon="add" disabled={all.length === 0}
        onClick={() => { onChange({ ...config, sections: [...config.sections, { title: '', keys: [] }] }) }}>
        Add section
      </Button>
    </div>
  )
}

function HistoryPanel({ type }: { type: ObjectTypeDef }) {
  const { data: revisions = [], isLoading } = useRevisions(type.id)
  const restore = useRestoreRevision()

  return (
    <Card compact className="!p-0 overflow-hidden divide-y divide-border">
      {isLoading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} />Loading history…</div>
      ) : revisions.map((rev) => (
        <div key={rev.id} className="flex items-center gap-3 px-4 py-2.5">
          <Tag minimal intent={rev.version === type.version ? Intent.SUCCESS : Intent.NONE} className="tabular-nums shrink-0">v{rev.version}</Tag>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{rev.label}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {rev.properties.map((p) => p.label).join(', ') || 'no properties'}
              {rev.computed_properties.length > 0 && ` · computed: ${rev.computed_properties.map((c) => c.label).join(', ')}`}
            </p>
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{new Date(rev.created_at).toLocaleDateString()}</span>
          {rev.version !== type.version && (
            <Button variant="minimal" size="small" icon="undo" loading={restore.isPending}
              onClick={() => { restore.mutate(rev) }}>
              Restore
            </Button>
          )}
        </div>
      ))}
    </Card>
  )
}

function LinkTypesSection({ type, allTypes, linkTypes }: { type: ObjectTypeDef; allTypes: ObjectTypeDef[]; linkTypes: LinkTypeDef[] }) {
  const hotelId = useActiveHotelId()
  const create = useCreateLinkType()
  const del = useDeleteLinkType()
  const [label, setLabel] = useState('')
  const [targetTypeId, setTargetTypeId] = useState(allTypes.find((t) => t.id !== type.id)?.id ?? type.id)
  const apiName = toSlug(label)
  const validation = validateLinkTypeDraft({ apiName, label, sourceTypeId: type.id, targetTypeId })
  const labelOf = (id: string) => allTypes.find((t) => t.id === id)?.label ?? '?'

  const submit = () => {
    if (!validation.ok) return
    create.mutate({ hotelId, sourceTypeId: type.id, targetTypeId, apiName, label: label.trim() }, { onSuccess: () => { setLabel('') } })
  }

  return (
    <Card className="space-y-2">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Link types</span>
      {linkTypes.map((lt) => (
        <div key={lt.id} className="flex items-center gap-2 text-xs">
          <Icon icon="link" size={12} className="text-violet-500" />
          <span className="font-medium">{lt.label}</span>
          <span className="text-muted-foreground">→ {labelOf(lt.targetTypeId)}</span>
          <Button variant="minimal" size="small" icon="cross" onClick={() => { del.mutate(lt.id) }} className="ml-auto" />
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{type.label} →</span>
        <InputGroup size="small" placeholder="Relationship (e.g. Belongs to room)" value={label} onChange={(e) => { setLabel(e.currentTarget.value) }} className="flex-1 min-w-[180px]" />
        <HTMLSelect value={targetTypeId} onChange={(e) => { setTargetTypeId(e.currentTarget.value) }}>
          {allTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </HTMLSelect>
        <Button size="small" icon="add" disabled={!validation.ok} loading={create.isPending} onClick={submit}>Add link type</Button>
      </div>
    </Card>
  )
}

function RecordLinks({ recordId, linkTypes, hotelId }: { recordId: string; linkTypes: LinkTypeDef[]; hotelId: string | null }) {
  const { data: links = [] } = useRecordLinks(recordId)
  const create = useCreateObjectLink(recordId)
  const del = useDeleteObjectLink(recordId)
  const [open, setOpen] = useState(false)
  const [ltId, setLtId] = useState(linkTypes[0]?.id ?? '')
  // RecordLinks only renders when the type has link types, so [0] is defined.
  const selectedLt = linkTypes.find((lt) => lt.id === ltId) ?? linkTypes[0]
  const { data: targetRecords = [] } = useObjectRecords(open ? selectedLt.targetTypeId : null)
  const [targetId, setTargetId] = useState('')

  const addLink = () => {
    if (!targetId) return
    create.mutate({ linkTypeId: selectedLt.id, hotelId, sourceRecordId: recordId, targetRecordId: targetId }, { onSuccess: () => { setTargetId('') } })
  }

  return (
    <div className="mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1">
        {links.map((l) => (
          <Tag key={l.id} minimal onRemove={() => { del.mutate(l.id) }} className="!text-[10px]">
            {l.linkTypeLabel}: {l.targetTitle}
          </Tag>
        ))}
        <Button variant="minimal" size="small" icon="link" onClick={() => { setOpen((o) => !o) }} className="!text-[10px]">Link</Button>
      </div>
      {open && (
        <div className="flex flex-wrap items-center gap-1">
          <HTMLSelect value={ltId} onChange={(e) => { setLtId(e.currentTarget.value) }}>
            {linkTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.label}</option>)}
          </HTMLSelect>
          <HTMLSelect value={targetId} onChange={(e) => { setTargetId(e.currentTarget.value) }}>
            <option value="">Select a record…</option>
            {targetRecords.map((rec) => <option key={rec.id} value={rec.id}>{rec.title}</option>)}
          </HTMLSelect>
          <Button size="small" icon="add" disabled={!targetId} loading={create.isPending} onClick={addLink}>Add</Button>
        </div>
      )}
    </div>
  )
}

function PropertyInput({ p, value, onChange }: { p: PropertyDef; value: unknown; onChange: (v: unknown) => void }) {
  if (p.type === 'boolean') return <Switch checked={value === true} onChange={() => { onChange(value !== true) }} className="mb-0" />
  if (p.type === 'number') return <NumericInput value={typeof value === 'number' ? value : ''} onValueChange={(v) => { onChange(Number.isFinite(v) ? v : null) }} buttonPosition="none" style={{ width: 140 }} />
  if (p.type === 'date') return <InputGroup type="date" value={typeof value === 'string' ? value : ''} onChange={(e) => { onChange(e.currentTarget.value) }} />
  return <InputGroup value={typeof value === 'string' ? value : ''} onChange={(e) => { onChange(e.currentTarget.value) }} className="flex-1" />
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return v
  return '—'
}
