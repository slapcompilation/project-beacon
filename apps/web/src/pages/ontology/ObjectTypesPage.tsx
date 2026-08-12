// The Object types page: author a kind of thing with typed properties, backed by
// a datasource. One of Ontology Manager's resource pages (§6.9) — the ontology
// it belongs to, the save session and the search all live in the chrome above.

import { useMemo, useState } from 'react'
import {
  Button, Card, Checkbox, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, Spinner, SpinnerSize, Tab, Tabs, Tag, TextArea,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useSearchParams } from 'react-router-dom'
import {
  PROPERTY_TYPES, COMPUTED_FNS, toSlug, toCamel, toPascal, validateObjectTypeDraft, validateLinkTypeDraft,
  validateComputedProperty, validateViewConfig, attachProblem,
  acceptsInput, primaryKeyEligibility, primaryKeyAdvice, canBeTitleKey,
  STATUS_META, OBJECT_TYPE_STATUSES, ONTOLOGY_STATUSES,
  type PropertyType, type PropertyDef, type ObjectTypeDef, type LinkTypeDef,
  type ComputedFn, type ComputedPropertyDef, type ViewConfigDef, type SharedPropertyDef,
  type ObjectTypeStatus, type OntologyStatus,
} from '@beacon/ontology'
import { useAppStore } from '@/stores/app.store'
import { rowToLinkType } from '@/features/objectTypes/api'
import {
  useCreateObjectType, useUpdateObjectType, useSetObjectTypeStatus,
  useApplyActiveToProperties, useCreateLinkType, useDeleteLinkType, useLinkTypes,
} from '@/features/objectTypes/hooks'
import { useSharedPropertyMap } from '@/features/objectTypes/sharedProperties'
import { useEditsEnabled } from '@/features/objectTypes/materializations'
import { DatasourcesTab, MaterializationsTab } from '@/features/objectTypes/TypeConfigTabs'
import { InterfacesTab } from '@/features/interfaces/InterfacesTab'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'
import { useIndexStatuses, useReindex } from '@/features/objectTypes/indexing'

const ICONS: IconName[] = ['cube', 'wrench', 'clipboard', 'shop', 'people', 'warning-sign', 'document', 'calendar', 'clean', 'key']

interface ComputedRow { label: string; fn: ComputedFn; inputs: string[] }

/** A draft property. `key` is the property ID; it is stable once saved, so only
 *  new rows derive one from the label. */
type PropertyDraft = PropertyDef & { isNew?: boolean }

const newProperty = (): PropertyDraft => ({
  key: '', apiName: '', label: '', type: 'string', required: false,
  source: 'column', backingColumn: '', isNew: true,
})

const draftId = (p: PropertyDraft) => (p.isNew ? toSlug(p.label) : p.key)

/** Drafts to what the save takes. New rows get their ID and API name from the
 *  label; existing ones keep theirs, because "the property ID and API name...
 *  will remain unchanged so as to not break existing downstream workflows". */
function draftsToProperties(drafts: PropertyDraft[]): PropertyDef[] {
  return drafts.filter((p) => p.label.trim()).map((p) => ({
    ...p,
    key: draftId(p),
    apiName: p.apiName || toCamel(p.label),
    label: p.label.trim(),
    backingColumn: p.source === 'user_input' ? null : p.backingColumn || toSlug(p.label),
  }))
}

/** The Properties step: two pickers over a Source -> Property table, which is
 *  how the wizard screenshot lays it out. Both designations are unique per type,
 *  so they are pickers rather than per-row checkboxes. */
function PropertyRows({ drafts, onChange, sharedMap }: {
  drafts: PropertyDraft[]
  onChange: (next: PropertyDraft[]) => void
  sharedMap: Map<string, SharedPropertyDef>
}) {
  const named = drafts.filter((p) => p.label.trim())
  const setProp = (i: number, patch: Partial<PropertyDraft>) => {
    onChange(drafts.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }
  const designate = (field: 'isPrimaryKey' | 'isTitleKey', id: string) => {
    onChange(drafts.map((p) => ({ ...p, [field]: draftId(p) === id })))
  }
  const pk = named.find((p) => p.isPrimaryKey)
  const tk = named.find((p) => p.isTitleKey)
  const advice = pk ? primaryKeyAdvice(pk.type) : null

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Properties</span>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Primary key</span>
          <HTMLSelect value={pk ? draftId(pk) : ''} onChange={(e) => { designate('isPrimaryKey', e.currentTarget.value) }}>
            <option value="">Select...</option>
            {named.filter((p) => primaryKeyEligibility(p.type) !== 'no')
              .map((p) => <option key={draftId(p)} value={draftId(p)}>{p.label}</option>)}
          </HTMLSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Title</span>
          <HTMLSelect value={tk ? draftId(tk) : ''} onChange={(e) => { designate('isTitleKey', e.currentTarget.value) }}>
            <option value="">Select...</option>
            {named.filter((p) => canBeTitleKey(p.type === 'array' ? (p.arrayElementType ?? p.type) : p.type))
              .map((p) => <option key={draftId(p)} value={draftId(p)}>{p.label}</option>)}
          </HTMLSelect>
        </label>
      </div>
      {advice && <p className="text-[11px] text-amber-600 max-w-2xl">{advice}</p>}

      {drafts.map((p, i) => {
        const def = p.sharedPropertyId ? sharedMap.get(p.sharedPropertyId) : undefined
        // "Direct edits to property metadata that is inherited from the shared
        // property will be disabled." `required` stays the object type's to decide.
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {/* "Every… property… has a status." New rows start experimental in
                the database; the select appears once the row exists. */}
            {!p.isNew && p.status && (
              <>
                <HTMLSelect value={p.status} title={STATUS_META[p.status].help}
                  onChange={(e) => { setProp(i, { status: e.currentTarget.value as OntologyStatus }) }}>
                  {ONTOLOGY_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                </HTMLSelect>
                {p.status === 'deprecated' && (
                  <>
                    <InputGroup size="small" placeholder="Why it is being deprecated"
                      value={p.deprecationReason ?? ''}
                      onChange={(e) => { setProp(i, { deprecationReason: e.currentTarget.value }) }} />
                    <InputGroup size="small" type="date" title="When it is expected to be deleted"
                      value={p.deprecationDeadline ?? ''}
                      onChange={(e) => { setProp(i, { deprecationDeadline: e.currentTarget.value }) }} />
                  </>
                )}
              </>
            )}
            {def && <Icon icon="globe" size={12} className="text-violet-500 shrink-0" title={`Inherits from "${def.apiName}"`} />}
            {p.isPrimaryKey && <Icon icon="key" size={12} className="text-violet-500 shrink-0" title="Primary key" />}
            {p.isTitleKey && <Icon icon="bookmark" size={12} className="text-violet-500 shrink-0" title="Title key" />}
            <InputGroup size="small" placeholder="Property label" value={def?.label ?? p.label} disabled={!!def}
              onChange={(e) => { setProp(i, { label: e.currentTarget.value }) }} className="flex-1 min-w-[150px]" />
            <InputGroup size="small" placeholder={toCamel(p.label) || 'apiName'} value={p.apiName}
              title="camelCase, unique within this object type"
              onChange={(e) => { setProp(i, { apiName: e.currentTarget.value }) }} className="min-w-[110px] max-w-[130px] font-mono" />
            <HTMLSelect value={def?.baseType ?? p.type} disabled={!!def}
              onChange={(e) => { setProp(i, { type: e.currentTarget.value as PropertyType }) }}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value} title={t.help}>{t.label}</option>)}
            </HTMLSelect>
            {p.type === 'array' && !def && (
              // "All base types may be used in arrays… excluding the Vector and
              // Time series types" — and never another array.
              <HTMLSelect value={p.arrayElementType ?? ''} title="Element type"
                onChange={(e) => { setProp(i, { arrayElementType: e.currentTarget.value as PropertyType }) }}>
                <option value="">Element…</option>
                {PROPERTY_TYPES.filter((t) => !['array', 'vector', 'time_series'].includes(t.value))
                  .map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </HTMLSelect>
            )}
            {/* "A property's source can be User input / actions rather than a
                dataset column" - so not every property is backed by data. */}
            <HTMLSelect value={p.source ?? 'column'} title="Where the values come from"
              onChange={(e) => { setProp(i, { source: e.currentTarget.value as 'column' | 'user_input' }) }}>
              <option value="column">Datasource column</option>
              <option value="user_input">User input / actions</option>
            </HTMLSelect>
            {(p.source ?? 'column') === 'column' && (
              <InputGroup size="small" placeholder={toSlug(p.label) || 'column'} value={p.backingColumn ?? ''}
                title="The column in the backing datasource"
                onChange={(e) => { setProp(i, { backingColumn: e.currentTarget.value }) }} className="min-w-[100px] max-w-[130px] font-mono" />
            )}
            <HTMLSelect value={p.sharedPropertyId ?? ''} title="Inherit this property's metadata from a shared definition"
              onChange={(e) => { setProp(i, { sharedPropertyId: e.currentTarget.value || null }) }}>
              <option value="">Not shared</option>
              {[...sharedMap.values()].map((d) => (
                <option key={d.id} value={d.id}
                  disabled={!!attachProblem({ ...p, key: p.key || 'x' }, d)}>
                  {d.label} ({d.baseType})
                </option>
              ))}
            </HTMLSelect>
            <Checkbox checked={p.required} label="Required" disabled={p.isPrimaryKey}
              title={p.isPrimaryKey ? 'A nullable key is not a key' : undefined}
              onChange={() => { setProp(i, { required: !p.required }) }} className="mb-0" />
            <Button variant="minimal" size="small" icon="cross"
              onClick={() => { onChange(drafts.filter((_, idx) => idx !== i)) }} />
          </div>
        )
      })}
      <Button variant="minimal" size="small" icon="add"
        onClick={() => { onChange([...drafts, newProperty()]) }}>Add property</Button>
    </div>
  )
}

export default function ObjectTypesPage() {
  const { ontology, isLoading: loadingOntology } = useOmaOntology()
  const { types, isLoading } = useOmaTypes()
  // A saved type is not live until its index builds. The count is the moment.
  const { data: indexes } = useIndexStatuses()
  const reindex = useReindex()
  const pushRecent = useAppStore((s) => s.pushOmaRecentType)

  // The open type travels in the URL, so a Discover card, a search hit and a
  // shared link all land on the same thing.
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('type')
  const selected = types.find((t) => t.id === selectedId) ?? null
  const openType = (id: string) => {
    if (id === selectedId) { setParams({}); return }
    setParams({ type: id })
    pushRecent(id)
  }

  if (!ontology && !loadingOntology) {
    return <div className="oma-page max-w-2xl"><NoOntologyCallout /></div>
  }

  return (
    <div className="oma-page">
      <SectionHead title="Object types" count={types.length} />
      <p className="text-sm text-muted-foreground max-w-2xl mb-5">
        Define a kind of thing with typed properties, backed by a datasource. Every one belongs to
        this ontology, and its API name is unique within it.
      </p>

      <div className="max-w-4xl space-y-6">
        <TypeBuilder ontologyId={ontology?.id ?? null} />

        <section className="space-y-2">
          {isLoading ? (
            <Card compact className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} />Loading…</Card>
          ) : types.length === 0 ? (
            <Card compact className="text-xs text-muted-foreground">None yet — author one above.</Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {types.map((t) => (
                <Card key={t.id} interactive compact
                  className={selectedId === t.id ? '!border-violet-400' : ''}
                  onClick={() => { openType(t.id) }}>
                  <div className="flex items-center gap-2">
                    <Icon icon={t.icon as IconName} size={14} className="text-violet-500" />
                    <span className="text-sm font-semibold">{t.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{t.apiName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-[11px] text-muted-foreground">{t.properties.length} propert{t.properties.length === 1 ? 'y' : 'ies'}</p>
                    {(() => {
                      const ix = indexes?.get(t.id)
                      if (ix?.status === 'success') {
                        return <Tag minimal intent={Intent.SUCCESS} className="!text-[10px]">{ix.objectCount ?? 0} objects</Tag>
                      }
                      if (ix?.status === 'failed') {
                        return <Tag minimal intent={Intent.DANGER} className="!text-[10px]" title={ix.error ?? undefined}>index failed</Tag>
                      }
                      return <Tag minimal className="!text-[10px]" title="Only once the indexing pipeline completes will objects be visible">not indexed</Tag>
                    })()}
                    <Button variant="minimal" size="small" icon="refresh" title="Full reindex"
                      loading={reindex.isPending && reindex.variables === t.id}
                      onClick={(e) => { e.stopPropagation(); reindex.mutate(t.id) }} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Link endpoints are just object types, and a link stays in one ontology. */}
        {selected && <TypeDetail type={selected} allTypes={types} />}
      </div>
    </div>
  )
}

function TypeBuilder({ ontologyId }: { ontologyId: string | null }) {
  const projectId = useAppStore((s) => s.omaProjectId)
  const create = useCreateObjectType()
  const sharedMap = useSharedPropertyMap()
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState<IconName>('cube')
  const [description, setDescription] = useState('')
  const [props, setProps] = useState<PropertyDraft[]>([newProperty()])
  const [computed, setComputed] = useState<ComputedRow[]>([])

  const apiName = toPascal(label)
  const properties = draftsToProperties(props)
  const computedProperties: ComputedPropertyDef[] = computed
    .filter((c) => c.label.trim())
    .map((c) => ({ key: toSlug(c.label), label: c.label.trim(), fn: c.fn, inputs: c.inputs }))
  const validation = validateObjectTypeDraft({ apiName, label, properties })
  const computedErrors = computedProperties.flatMap((cp) => validateComputedProperty(cp, properties).errors)
  const canSave = validation.ok && computedErrors.length === 0

  const submit = () => {
    if (!canSave) return
    create.mutate(
      { apiName, label: label.trim(), icon, description: description.trim(), properties, ontologyId, projectId },
      { onSuccess: () => { setLabel(''); setDescription(''); setProps([newProperty()]); setComputed([]); setIcon('cube') } },
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

      <PropertyRows drafts={props} onChange={setProps} sharedMap={sharedMap} />

      <ComputedBuilder properties={properties} rows={computed} onChange={setComputed} />

      {label.trim() !== '' && !canSave && (
        <ul className="text-[11px] text-red-600 list-disc pl-4">{[...validation.errors, ...computedErrors].map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <Button intent={Intent.PRIMARY} icon="tick" disabled={!canSave || !ontologyId}
        title={ontologyId ? undefined : 'Create an ontology first — every object type belongs to one'}
        loading={create.isPending} onClick={submit}>Create object type</Button>
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
        const eligible = fnDef ? properties.filter((p) => acceptsInput(fnDef.inputType, p.type)) : []
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
  // "Navigate to the Materializations tab by toggling the Edits configuration
  // in the Datasources tab" — the tab exists only while the toggle is on.
  const { data: editsEnabled = false } = useEditsEnabled(type.id)

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center gap-2">
        <Icon icon={type.icon as IconName} size={15} className="text-violet-500" />
        <h2 className="text-sm font-semibold">{type.label}</h2>
        <Tag minimal className="!text-[10px] tabular-nums">v{type.version}</Tag>
        <StatusControl type={type} />
        <Button variant="minimal" size="small" icon="edit" active={editing} className="ml-auto"
          onClick={() => { setEditing(!editing) }}>Edit properties</Button>
      </div>
      <Tabs id={`type-${type.id}`} vertical animate={false} renderActiveTabPanelOnly>
        <Tab id="overview" title="Overview" icon="desktop" panel={
          <div className="space-y-3">
            {editing && <SchemaEditor key={`${type.id}-v${String(type.version)}`} type={type} onDone={() => { setEditing(false) }} />}
            <LinkTypesSection type={type} allTypes={allTypes} linkTypes={linkTypes} />
          </div>
        } />
        <Tab id="datasources" title="Datasources" icon="database" panel={<DatasourcesTab type={type} />} />
        <Tab id="interfaces" title="Interfaces" icon="layers" panel={<InterfacesTab type={type} />} />
        {editsEnabled &&
          <Tab id="materializations" title="Materializations" icon="export" panel={<MaterializationsTab type={type} />} />}
      </Tabs>
    </section>
  )
}

/** "Select the dropdown next to the current status. Select the new status."
 *  Deprecating prompts for the documentation; activating offers the
 *  apply-to-all-properties option — both from metadata-statuses. */
function StatusControl({ type }: { type: ObjectTypeDef }) {
  const set = useSetObjectTypeStatus()
  const bulkActive = useApplyActiveToProperties(type.id)
  const [pending, setPending] = useState<ObjectTypeStatus | null>(null)
  const [reason, setReason] = useState('')
  const [deadline, setDeadline] = useState('')
  const [replacedBy, setReplacedBy] = useState('')
  const [alsoProps, setAlsoProps] = useState(true)
  const current = type.status ?? 'experimental'
  const meta = STATUS_META[current]

  const apply = (status: ObjectTypeStatus, deprecation: ObjectTypeDef['deprecation'] | null) => {
    set.mutate({ id: type.id, status, visibility: type.visibility ?? 'normal', deprecation: deprecation ?? null }, {
      onSuccess: () => {
        if (status === 'active' && alsoProps) bulkActive.mutate()
        setPending(null)
      },
    })
  }

  return (
    <>
      <Tag minimal intent={meta.intent} className="!text-[10px]" title={meta.help}>{meta.label}</Tag>
      <HTMLSelect minimal value={current} onChange={(e) => {
        const s = e.currentTarget.value as ObjectTypeStatus
        if (s === current) return
        if (s === 'deprecated' || (s === 'active' && current === 'experimental')) { setPending(s); return }
        apply(s, null)
      }}>
        {OBJECT_TYPE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
      </HTMLSelect>

      <Dialog isOpen={pending === 'deprecated'} onClose={() => { setPending(null) }} title="Deprecate object type" style={{ width: 420 }}>
        <DialogBody>
          <div className="space-y-2">
            <TextArea fill placeholder="Why it is being deprecated" value={reason}
              onChange={(e) => { setReason(e.currentTarget.value) }} />
            <InputGroup type="date" value={deadline} title="When it is expected to be deleted from the system"
              onChange={(e) => { setDeadline(e.currentTarget.value) }} />
            <InputGroup placeholder="Replaced by (optional)" value={replacedBy}
              onChange={(e) => { setReplacedBy(e.currentTarget.value) }} />
          </div>
        </DialogBody>
        <DialogFooter actions={<>
          <Button onClick={() => { setPending(null) }}>Cancel</Button>
          <Button intent={Intent.PRIMARY} disabled={!reason.trim() || !deadline} loading={set.isPending}
            onClick={() => { apply('deprecated', { reason: reason.trim(), deadline, replacedBy: replacedBy.trim() || null }) }}>
            Deprecate
          </Button>
        </>} />
      </Dialog>

      <Dialog isOpen={pending === 'active'} onClose={() => { setPending(null) }} title="Set status to Active" style={{ width: 420 }}>
        <DialogBody>
          <Checkbox checked={alsoProps} onChange={(e) => { setAlsoProps(e.currentTarget.checked) }}
            label="Also apply the active status to all properties on the object type" />
        </DialogBody>
        <DialogFooter actions={<>
          <Button onClick={() => { setPending(null) }}>Cancel</Button>
          <Button intent={Intent.PRIMARY} loading={set.isPending} onClick={() => { apply('active', null) }}>Apply</Button>
        </>} />
      </Dialog>
    </>
  )
}

function SchemaEditor({ type, onDone }: { type: ObjectTypeDef; onDone: () => void }) {
  const update = useUpdateObjectType()
  const [label, setLabel] = useState(type.label)
  const [icon, setIcon] = useState<IconName>(type.icon as IconName)
  const [description, setDescription] = useState(type.description)
  const sharedMap = useSharedPropertyMap()
  const [props, setProps] = useState<PropertyDraft[]>(type.properties)
  const [computed, setComputed] = useState<ComputedRow[]>(
    type.computedProperties.map((c) => ({ label: c.label, fn: c.fn, inputs: c.inputs })),
  )
  const [viewConfig, setViewConfig] = useState<ViewConfigDef>(type.viewConfig)

  const properties = draftsToProperties(props)
  const computedProperties: ComputedPropertyDef[] = computed
    .filter((c) => c.label.trim())
    .map((c) => ({ key: toSlug(c.label), label: c.label.trim(), fn: c.fn, inputs: c.inputs }))
  const validation = validateObjectTypeDraft({ apiName: type.apiName, label, properties })
  const computedErrors = computedProperties.flatMap((cp) => validateComputedProperty(cp, properties).errors)
  // resolveViewConfig on save drops keys that were removed; only structural errors block.
  const viewErrors = validateViewConfig(viewConfig, { properties, computedProperties }).errors
    .filter((e) => e.includes('title') || e.includes('more than one'))
  const canSave = validation.ok && computedErrors.length === 0 && viewErrors.length === 0

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

      <PropertyRows drafts={props} onChange={setProps} sharedMap={sharedMap} />

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
  // A link never crosses an ontology, and every type here is in the open one.
  const { ontology } = useOmaOntology()
  const projectId = useAppStore((s) => s.omaProjectId)
  const [label, setLabel] = useState('')
  const [targetTypeId, setTargetTypeId] = useState(allTypes.find((t) => t.id !== type.id)?.id ?? type.id)
  const apiName = toSlug(label)
  const validation = validateLinkTypeDraft({ apiName, label, sourceTypeId: type.id, targetTypeId })
  const labelOf = (id: string) => allTypes.find((t) => t.id === id)?.label ?? '?'

  const submit = () => {
    if (!validation.ok || !ontology) return
    create.mutate(
      { sourceTypeId: type.id, targetTypeId, apiName, label: label.trim(), ontologyId: ontology.id, projectId },
      { onSuccess: () => { setLabel('') } })
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
