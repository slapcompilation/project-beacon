// Object Types (Studio P2.1) — Foundry's Ontology Manager, starter. Author a new
// kind of thing with typed properties, then create records of it. Config-as-data:
// the type + its records are rows, no code deploy. Types are admin/owner-authored;
// records can be created by any org member (RLS enforces both).

import { useMemo, useState } from 'react'
import {
  Button, Card, Checkbox, HTMLSelect, Icon, InputGroup, Intent, NonIdealState,
  Spinner, SpinnerSize, Tag, TextArea,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import {
  PROPERTY_TYPES, COMPUTED_FNS, toSlug, validateObjectTypeDraft, validateLinkTypeDraft, validateComputedProperty, validateViewConfig,
  attachProblem, usedBy,
  type PropertyType, type PropertyDef, type ObjectTypeDef, type LinkTypeDef,
  type ComputedFn, type ComputedPropertyDef, type ViewConfigDef,
} from '@beacon/reality-graph'
import { useAuthStore } from '@/stores/auth.store'
import { rowToObjectType, rowToLinkType } from '@/features/objectTypes/api'
import {
  useObjectTypes, useOntologyTypes, useCreateObjectType, useUpdateObjectType,
  useCreateLinkType, useDeleteLinkType, useLinkTypes,
} from '@/features/objectTypes/hooks'
import {
  useSharedProperties, useSharedPropertyMap, useCreateSharedProperty, useDeleteSharedProperty,
} from '@/features/objectTypes/sharedProperties'
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
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {selected && <TypeDetail type={selected} allTypes={linkTargets} />}

        <SharedPropertiesSection types={types} />

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

function TypeBuilder() {
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
      { apiName, label: label.trim(), icon, description: description.trim(), properties, computedProperties },
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

// Edit the live schema. Existing property keys are preserved (records reference
// them); only newly added properties derive a key from their label. Saving bumps
// the version + snapshots via the DB triggers.
/** The selected type's own definition: its properties, and the link types that
 *  start from it. Both are the Ontology Manager's job — they used to hang off a
 *  records panel, which is why they went with it. */
function TypeDetail({ type, allTypes }: { type: ObjectTypeDef; allTypes: ObjectTypeDef[] }) {
  const { data: linkTypeRows = [] } = useLinkTypes()
  const linkTypes = useMemo(
    () => linkTypeRows.map(rowToLinkType).filter((lt) => lt.sourceTypeId === type.id),
    [linkTypeRows, type.id])
  const [editing, setEditing] = useState(false)

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center gap-2">
        <Icon icon={type.icon as IconName} size={15} className="text-violet-500" />
        <h2 className="text-sm font-semibold">{type.label}</h2>
        <Tag minimal className="!text-[10px] tabular-nums">v{type.version}</Tag>
        <Button variant="minimal" size="small" icon="edit" active={editing} className="ml-auto"
          onClick={() => { setEditing(!editing) }}>Edit properties</Button>
      </div>
      {editing && <SchemaEditor key={`${type.id}-v${String(type.version)}`} type={type} onDone={() => { setEditing(false) }} />}
      <LinkTypesSection type={type} allTypes={allTypes} linkTypes={linkTypes} />
    </section>
  )
}

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

function LinkTypesSection({ type, allTypes, linkTypes }: { type: ObjectTypeDef; allTypes: ObjectTypeDef[]; linkTypes: LinkTypeDef[] }) {
  const create = useCreateLinkType()
  const del = useDeleteLinkType()
  const [label, setLabel] = useState('')
  const [targetTypeId, setTargetTypeId] = useState(allTypes.find((t) => t.id !== type.id)?.id ?? type.id)
  const apiName = toSlug(label)
  const validation = validateLinkTypeDraft({ apiName, label, sourceTypeId: type.id, targetTypeId })
  const labelOf = (id: string) => allTypes.find((t) => t.id === id)?.label ?? '?'

  const submit = () => {
    if (!validation.ok) return
    create.mutate({ sourceTypeId: type.id, targetTypeId, apiName, label: label.trim() }, { onSuccess: () => { setLabel('') } })
  }

  return (
    <Card className="space-y-2">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Link types</span>
      {linkTypes.map((lt) => {
        return (
          <div key={lt.id} className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <Icon icon="link" size={12} className="text-violet-500" />
              <span className="font-medium">{lt.label}</span>
              <span className="text-muted-foreground">→ {labelOf(lt.targetTypeId)}</span>
              {/* An active link type cannot be deleted — the database says so,
                  and saying it here beats surfacing the exception as a toast. */}
              <Button variant="minimal" size="small" icon="cross" className="ml-auto"
                onClick={() => { del.mutate(lt.id) }} />
            </div>
          </div>
        )
      })}
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
