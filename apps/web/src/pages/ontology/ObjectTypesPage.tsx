// The Object types page: author a kind of thing with typed properties, backed by
// a datasource. One of Ontology Manager's resource pages (§6.9) — the ontology
// it belongs to, the save session and the search all live in the chrome above.

import { useMemo, useState } from 'react'
import {
  Button, Card, Checkbox, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, NumericInput, Spinner, SpinnerSize, Tab, Tabs, Tag, TextArea,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useSearchParams } from 'react-router-dom'
import {
  PROPERTY_TYPES, toSlug, toCamel, toPascal, validateObjectTypeDraft, validateLinkTypeDraft,
  attachProblem,
  primaryKeyEligibility, primaryKeyAdvice, canBeTitleKey,
  STATUS_META, OBJECT_TYPE_STATUSES, ONTOLOGY_STATUSES, pluralise,
  LINK_BACKINGS, BACKING_LABEL, LINK_CARDINALITIES, CARDINALITY_LABEL, canBack,
  type LinkBackingKind, type LinkCardinality,
  type PropertyType, type PropertyDef, type ObjectTypeDef, type LinkTypeDef,
  type SharedPropertyDef,
  type ObjectTypeStatus, type OntologyStatus,
} from '@beacon/ontology'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app.store'
import { rowToLinkType } from '@/features/objectTypes/api'
import {
  useCreateObjectType, useUpdateObjectType, useSetObjectTypeStatus,
  useApplyActiveToProperties, useCreateLinkType, useDeleteLinkType, useLinkTypes,
  useResolveBacking, useDatasetFields,
} from '@/features/objectTypes/hooks'
import { useDatasets, useBranches } from '@/features/datasets/api'
import { ObjectViewsTab } from '@/features/objectView/ObjectViewsTab'
import { BackingStep, type Backing } from '@/features/objectTypes/BackingStep'
import { PropertySourceDialog } from '@/features/objectTypes/PropertySource'
import { useSharedPropertyMap } from '@/features/objectTypes/sharedProperties'
import { StructFieldsCard } from '@/features/objectTypes/StructFieldsCard'
import { FormattingDialog } from '@/features/objectTypes/FormattingDialog'
import { VectorEmbeddingCard } from '@/features/objectTypes/VectorEmbeddingCard'
import { useEditsConfig } from '@/features/objectTypes/materializations'
import { DatasourcesTab, MaterializationsTab, SecurityTab } from '@/features/objectTypes/TypeConfigTabs'
import { DependentsTab } from '@/features/objectTypes/DependentsTab'
import { UsageTab } from '@/features/objectTypes/UsageTab'
import { CapabilitiesTab } from '@/features/objectTypes/CapabilitiesTab'
import { MetadataCard } from '@/features/objectTypes/MetadataCard'
import { InterfacesTab } from '@/features/interfaces/InterfacesTab'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { tileStyle, useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'
import { useValueTypes } from '@/features/valueTypes/api'
import { indexPhase, useIndexStatuses, useReindex } from '@/features/objectTypes/indexing'

/** The three sources, in the editor's own words. */
const SOURCE_LABEL: Record<string, string> = {
  column: 'Datasource', user_input: 'User edits', linked_objects: 'Linked objects',
}
const SOURCE_ICON: Record<string, IconName> = {
  column: 'th', user_input: 'edit', linked_objects: 'link',
}

const ICONS: IconName[] = ['cube', 'wrench', 'clipboard', 'shop', 'people', 'warning-sign', 'document', 'calendar', 'clean', 'key']


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
function PropertyRows({ drafts, onChange, sharedMap, objectTypeId }: {
  drafts: PropertyDraft[]
  onChange: (next: PropertyDraft[]) => void
  sharedMap: Map<string, SharedPropertyDef>
  /** Null while creating — the datasource list is empty until the type exists. */
  objectTypeId: string | null
}) {
  const [sourceOf, setSourceOf] = useState<number | null>(null)
  const [formattingOf, setFormattingOf] = useState<number | null>(null)
  const { data: linkTypeRows } = useLinkTypes()
  const linkTypes = useMemo(() => linkTypeRows.map(rowToLinkType), [linkTypeRows])
  const { types } = useOmaTypes()
  // Value types are space-owned; the ontology's space scopes the dropdown.
  const { ontology: omaOntology } = useOmaOntology()
  const { data: valueTypes = [] } = useValueTypes(omaOntology?.spaceId ?? null)
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
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Properties</span>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Primary key</span>
          <HTMLSelect value={pk ? draftId(pk) : ''} onChange={(e) => { designate('isPrimaryKey', e.currentTarget.value) }}>
            <option value="">Select...</option>
            {named.filter((p) => primaryKeyEligibility(p.type) !== 'no')
              .map((p) => <option key={draftId(p)} value={draftId(p)}>{p.label}</option>)}
          </HTMLSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Title</span>
          <HTMLSelect value={tk ? draftId(tk) : ''} onChange={(e) => { designate('isTitleKey', e.currentTarget.value) }}>
            <option value="">Select...</option>
            {named.filter((p) => canBeTitleKey(p.type === 'array' ? (p.arrayElementType ?? p.type) : p.type))
              .map((p) => <option key={draftId(p)} value={draftId(p)}>{p.label}</option>)}
          </HTMLSelect>
        </label>
      </div>
      {advice && <p className="text-xs text-amber-600 max-w-2xl">{advice}</p>}

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
              onChange={(e) => {
                const t = e.currentTarget.value as PropertyType
                // "Mandatory control properties must be required." — and they
                // "are set to `Hidden` by default"; picking marking presets both.
                // A formatter is typed by the base type (736), so a retyped
                // property drops it rather than carrying a shape the CHECK
                // refuses at save. Rules stay: their conditions are typed by
                // the property they READ, which need not be this one.
                setProp(i, t === 'marking'
                  ? { type: t, required: true, visibility: 'hidden', valueFormatting: null }
                  : { type: t, valueFormatting: null })
              }}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value} title={t.help}>{t.label}</option>)}
            </HTMLSelect>
            {p.type === 'array' && !def && (
              // "All base types may be used in arrays… excluding the Vector and
              // Time series types" — and never another array. The fourth is on
              // the media page, which is where 546 found it: "Media reference
              // lists are not supported as a property type on an object." The
              // list here was one short of the CHECK, so the picker could stage
              // what the save refuses (creation review, F11).
              <HTMLSelect value={p.arrayElementType ?? ''} title="Element type"
                onChange={(e) => { setProp(i, { arrayElementType: e.currentTarget.value as PropertyType }) }}>
                <option value="">Element…</option>
                {PROPERTY_TYPES.filter((t) => !['array', 'vector', 'time_series', 'media_reference'].includes(t.value))
                  .map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </HTMLSelect>
            )}
            {p.type === 'vector' && !def && (
              // "a query vector must be the same size as the one used for
              // indexing", so the size is declared rather than inferred. The
              // CHECK caps it at the published 2048.
              <NumericInput size="small" min={1} max={2048} placeholder="Dimension"
                value={p.vectorDimension ?? ''} style={{ width: 96 }}
                onValueChange={(v) => {
                  setProp(i, { vectorDimension: Number.isFinite(v) ? v : undefined })
                }} />
            )}
            {/* The three sources have published definitions and per-source
                configuration, so the row shows which one and opens the rest. */}
            <Button size="small" icon={SOURCE_ICON[p.source ?? 'column']}
              title="Where this property's values come from"
              onClick={() => { setSourceOf(i) }}>
              {SOURCE_LABEL[p.source ?? 'column']}
            </Button>
            {/* Value formatting and the conditional rule set, per property. A
                dot on the icon marks a property that carries either. */}
            <Button size="small" variant="minimal" icon="style"
              title="Value formatting and conditional formatting"
              intent={(p.formatRules?.length ?? 0) > 0 || p.valueFormatting ? Intent.PRIMARY : Intent.NONE}
              onClick={() => { setFormattingOf(i) }} />
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
            {/* "To assign a value type to a property, select the value type
                from the dropdown menu during property configuration" —
                use-value-type. Same-base-type only; index-time value_conforms
                enforces the constraint with the authored message. */}
            {valueTypes.some((v) => v.baseType === p.type) && (
              <HTMLSelect value={p.valueTypeId ?? ''} title="Constrain values to a value type"
                onChange={(e) => { setProp(i, { valueTypeId: e.currentTarget.value || null }) }}>
                <option value="">No value type</option>
                {valueTypes.filter((v) => v.baseType === p.type).map((v) => (
                  <option key={v.id} value={v.id}>{v.displayName}</option>
                ))}
              </HTMLSelect>
            )}
            {/* prominent | normal | hidden — the metadata page's visibility;
                hidden is excluded everywhere and Ontology:PropertyIsHidden
                refuses it at query time. */}
            <HTMLSelect value={p.visibility ?? 'normal'}
              title="Prominent properties are spotlighted; hidden ones never show"
              onChange={(e) => { setProp(i, { visibility: e.currentTarget.value as PropertyDef['visibility'] }) }}>
              <option value="prominent">Prominent</option>
              <option value="normal">Normal</option>
              <option value="hidden">Hidden</option>
            </HTMLSelect>
            <Checkbox checked={p.required} label="Required"
              disabled={p.isPrimaryKey || p.type === 'marking'}
              title={p.isPrimaryKey ? 'A nullable key is not a key'
                : p.type === 'marking' ? 'Mandatory control properties must be required' : undefined}
              onChange={() => { setProp(i, { required: !p.required }) }} className="mb-0" />
            <Button variant="minimal" size="small" icon="cross"
              onClick={() => { onChange(drafts.filter((_, idx) => idx !== i)) }} />
          </div>
        )
      })}
      <Button variant="minimal" size="small" icon="add"
        onClick={() => { onChange([...drafts, newProperty()]) }}>Add property</Button>

      {sourceOf !== null && drafts[sourceOf] && (
        <PropertySourceDialog isOpen onClose={() => { setSourceOf(null) }}
          objectTypeId={objectTypeId} property={drafts[sourceOf]}
          linkTypes={linkTypes} types={types}
          onChange={(patch) => { setProp(sourceOf, patch) }} />
      )}
      {formattingOf !== null && drafts[formattingOf] && (
        <FormattingDialog property={drafts[formattingOf]} properties={drafts}
          onChange={(patch) => { setProp(formattingOf, patch) }}
          onClose={() => { setFormattingOf(null) }} />
      )}
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
                  className={selectedId === t.id ? '!border-primary' : ''}
                  onClick={() => { openType(t.id) }}>
                  <div className="flex items-center gap-2">
                    <span className="oma-tile is-sm" style={tileStyle(t)}>
                      <Icon icon={t.icon as IconName} size={12} />
                    </span>
                    <span className="text-sm font-semibold">{t.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.apiName}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <p className="text-xs text-muted-foreground">{t.properties.length} propert{t.properties.length === 1 ? 'y' : 'ies'}</p>
                    {(() => {
                      const ix = indexes?.get(t.id)
                      switch (indexPhase(ix)) {
                        case 'ready':
                          return <Tag minimal intent={Intent.SUCCESS}>{ix?.objectCount ?? 0} objects</Tag>
                        // Ready-but-stale (720): the index serves while the
                        // next minute tick rebuilds it.
                        case 'refreshing':
                          return <Tag minimal intent={Intent.WARNING} title="Edits or datasource changes newer than the index; rebuilding on the next tick">{ix?.objectCount ?? 0} objects · refreshing</Tag>
                        case 'failed':
                          return <Tag minimal intent={Intent.DANGER} title={ix?.error ?? undefined}>index failed</Tag>
                        // The pipeline is mid-run; the states are the job's own.
                        case 'running':
                          return <Tag minimal intent={Intent.PRIMARY} title={ix?.state ?? undefined}>indexing</Tag>
                        default:
                          return <Tag minimal title="Only once the indexing pipeline completes will objects be visible">not indexed</Tag>
                      }
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
  // "plural auto-updates" as the name is typed, and Pipeline Builder says the
  // same of its own dialog — auto-populated FOR CONVENIENCE, so an operator
  // edit sticks and stops the derivation. 598 carries the value; this derives it.
  const [plural, setPlural] = useState('')
  const [pluralEdited, setPluralEdited] = useState(false)
  const [icon, setIcon] = useState<IconName>('cube')
  const [description, setDescription] = useState('')
  const [props, setProps] = useState<PropertyDraft[]>([newProperty()])
  const [backing, setBacking] = useState<Backing>({ kind: 'generate', name: '', folderId: null })
  const resolveBacking = useResolveBacking()

  const apiName = toPascal(label)
  const properties = draftsToProperties(props)
  const validation = validateObjectTypeDraft({ apiName, label, properties })
  const canSave = validation.ok

  const submit = async () => {
    if (!canSave) return
    // The backing resolves FIRST and travels inside the staged payload — the
    // attach-afterwards order deadlocked, because attachment needs the landed
    // row and the linter refuses landing without backing (creation review, F1).
    let backingRef: { datasetId: string; branchId: string }
    try {
      backingRef = await resolveBacking(backing, projectId, label)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e))
      return
    }
    create.mutate(
      { apiName, label: label.trim(), pluralLabel: plural.trim(),
        icon, description: description.trim(), properties, ontologyId, projectId,
        datasources: [backingRef] },
      {
        onSuccess: () => {
          setLabel(''); setPlural(''); setPluralEdited(false)
          setDescription(''); setProps([newProperty()]); setIcon('cube')
          setBacking({ kind: 'generate', name: '', folderId: null })
        },
      },
    )
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon icon="plus" size={14} className="text-violet-500" />
        <span className="text-sm font-semibold">New object type</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup placeholder="Label (e.g. Maintenance Request)" value={label}
          onChange={(e) => {
            const v = e.currentTarget.value
            setLabel(v)
            if (!pluralEdited) setPlural(pluralise(v))
          }} className="flex-1 min-w-[200px]" />
        <InputGroup placeholder="Plural name" value={plural} title="Auto-filled from the label; edit to override"
          onChange={(e) => { setPlural(e.currentTarget.value); setPluralEdited(true) }}
          className="flex-1 min-w-[160px]" />
        <HTMLSelect value={icon} onChange={(e) => { setIcon(e.currentTarget.value as IconName) }}>
          {ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
        </HTMLSelect>
        {label && <Tag minimal className="font-mono">{apiName}</Tag>}
      </div>
      <TextArea placeholder="Description (optional)" value={description} onChange={(e) => { setDescription(e.currentTarget.value) }} fill rows={2} />

      <BackingStep projectId={projectId} label={label} value={backing} onChange={setBacking} />

      <PropertyRows drafts={props} onChange={setProps} sharedMap={sharedMap}
        objectTypeId={null} />


      {label.trim() !== '' && !canSave && (
        <ul className="text-xs text-red-600 list-disc pl-4">{validation.errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <Button intent={Intent.PRIMARY} icon="tick" disabled={!canSave || !ontologyId}
        title={ontologyId ? undefined : 'Create an ontology first — every object type belongs to one'}
        loading={create.isPending} onClick={() => { void submit() }}>Create object type</Button>
    </Card>
  )
}

// Edit the live schema. Existing property keys are preserved (records reference
// them); only newly added properties derive a key from their label. Saving bumps
// the version + snapshots via the DB triggers.
/** The selected type's own definition: its properties, and the link types that
 *  start from it. Both are the Ontology Manager's job — they used to hang off a
 *  records panel, which is why they went with it. */
function TypeDetail({ type, allTypes }: { type: ObjectTypeDef; allTypes: ObjectTypeDef[] }) {
  const { ontology } = useOmaOntology()
  const { data: linkTypeRows } = useLinkTypes()
  const linkTypes = useMemo(
    () => linkTypeRows.map(rowToLinkType).filter((lt) => lt.sourceTypeId === type.id),
    [linkTypeRows, type.id])
  const [editing, setEditing] = useState(false)
  // "Navigate to the Materializations tab by toggling the Edits configuration
  // in the Datasources tab" — the tab exists only while the toggle is on.
  const { data: edits } = useEditsConfig(type.id)
  const editsEnabled = edits?.editsEnabled ?? false

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center gap-2">
        <Icon icon={type.icon as IconName} size={15} className="text-violet-500" />
        <h2 className="text-sm font-semibold">{type.label}</h2>
        <Tag minimal className="tabular-nums">v{type.version}</Tag>
        <Button variant="minimal" size="small" icon="edit" active={editing} className="ml-auto"
          onClick={() => { setEditing(!editing) }}>Edit properties</Button>
      </div>
      <Tabs id={`type-${type.id}`} vertical animate={false} renderActiveTabPanelOnly>
        <Tab id="overview" title="Overview" icon="desktop" panel={
          <div className="space-y-3">
            {/* Sections ① and ④ of Foundry's Overview. ②, ③ and ⑥ are unbuilt
                engines, and ⑤ and ⑦ stay as tabs — a scoped divergence, recorded
                in readings/object-type-overview.md Decision 7. */}
            <MetadataCard type={type} ontologyName={ontology?.label ?? 'Ontology'}
              status={<StatusControl type={type} />} />
            {/* Foundry edits struct fields inside the Property editor; ours is
                a card because the Properties step is draft-and-save and these
                rows are written immediately (633). Absent when the type has no
                struct property. */}
            <StructFieldsCard properties={type.properties} />
            {/* The embeddingModel union, guarded since 583/584 and never
                writable from a screen until now. Absent unless the type has
                a vector property. */}
            <VectorEmbeddingCard properties={type.properties} />
            {editing && <SchemaEditor key={`${type.id}-v${String(type.version)}`} type={type} onDone={() => { setEditing(false) }} />}
            <LinkTypesSection type={type} allTypes={allTypes} linkTypes={linkTypes} />
          </div>
        } />
        <Tab id="security" title="Security" icon="shield" panel={<SecurityTab type={type} />} />
        <Tab id="datasources" title="Datasources" icon="database" panel={<DatasourcesTab type={type} />} />
        <Tab id="interfaces" title="Interfaces" icon="layers" panel={<InterfacesTab type={type} />} />
        <Tab id="capabilities" title="Capabilities" icon="widget" panel={<CapabilitiesTab type={type} />} />
        {/* The capture places Object views between Capabilities and
            Interfaces (ontology-manager-object-view-edit.png). */}
        <Tab id="object-views" title="Object views" icon="grid-view" panel={<ObjectViewsTab type={type} />} />
        {/* Sections 5 and 7 of Foundry's object type Overview. Both engines
            shipped in 579/580 with nothing reading them until now. */}
        <Tab id="dependents" title="Dependents" icon="graph" panel={<DependentsTab type={type} />} />
        <Tab id="usage" title="Usage" icon="timeline-line-chart" panel={<UsageTab type={type} />} />
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
      <Tag minimal intent={meta.intent} title={meta.help}>{meta.label}</Tag>
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

  const properties = draftsToProperties(props)
  const validation = validateObjectTypeDraft({ apiName: type.apiName, label, properties })
  const canSave = validation.ok

  const save = () => {
    if (!canSave) return
    update.mutate(
      { id: type.id, label: label.trim(), icon, description: description.trim(), properties },
      { onSuccess: onDone },
    )
  }

  return (
    <Card className="space-y-3 !border-violet-400/50">
      <div className="flex items-center gap-2">
        <Icon icon="edit" size={14} className="text-violet-500" />
        <span className="text-sm font-semibold">Edit schema</span>
        <span className="text-xs text-muted-foreground">saving creates v{type.version + 1}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup value={label} onChange={(e) => { setLabel(e.currentTarget.value) }} className="flex-1 min-w-[200px]" />
        <HTMLSelect value={icon} onChange={(e) => { setIcon(e.currentTarget.value as IconName) }}>
          {[...new Set<IconName>([...ICONS, icon])].map((ic) => <option key={ic} value={ic}>{ic}</option>)}
        </HTMLSelect>
      </div>
      <TextArea value={description} onChange={(e) => { setDescription(e.currentTarget.value) }} fill rows={2} />

      <PropertyRows drafts={props} onChange={setProps} sharedMap={sharedMap}
        objectTypeId={type.id} />



      {!canSave && (
        <ul className="text-xs text-red-600 list-disc pl-4">{validation.errors.map((e) => <li key={e}>{e}</li>)}</ul>
      )}
      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} icon="floppy-disk" disabled={!canSave} loading={update.isPending} onClick={save}>Save as v{type.version + 1}</Button>
        <Button variant="minimal" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
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
  // The helper's FIRST choice: the relationship type, then a cardinality it
  // can express (create-link-type). Nothing defaults silently any more —
  // an undeclared relationship is a linter violation since 717.
  const [backingKind, setBackingKind] = useState<LinkBackingKind>('foreign_key')
  const [cardinality, setCardinality] = useState<LinkCardinality>('many_to_one')
  const [fkColumn, setFkColumn] = useState('')
  const [joinDatasetId, setJoinDatasetId] = useState('')
  const [joinBranchId, setJoinBranchId] = useState('')
  const [sourceKeyColumn, setSourceKeyColumn] = useState('')
  const [targetKeyColumn, setTargetKeyColumn] = useState('')
  const [backingObjectTypeId, setBackingObjectTypeId] = useState('')
  const [sourceSide, setSourceSide] = useState('')
  const [targetSide, setTargetSide] = useState('')
  const { data: datasets = [] } = useDatasets()
  const { data: joinBranches = [] } = useBranches(backingKind === 'join_table' && joinDatasetId ? joinDatasetId : null)
  const { data: joinFields = [] } = useDatasetFields(backingKind === 'join_table' && joinDatasetId ? joinDatasetId : null)
  const apiName = toSlug(label)
  const validation = validateLinkTypeDraft({ apiName, label, sourceTypeId: type.id, targetTypeId })
  const labelOf = (id: string) => allTypes.find((t) => t.id === id)?.label ?? '?'

  const cardinalityOptions = LINK_CARDINALITIES.filter((c) => canBack(c, backingKind))
  const pickKind = (k: LinkBackingKind) => {
    setBackingKind(k)
    const legal = LINK_CARDINALITIES.filter((c) => canBack(c, k))
    if (!legal.includes(cardinality)) setCardinality(legal[0])
  }
  const backingComplete =
    backingKind === 'foreign_key' ? fkColumn !== ''
    : backingKind === 'join_table'
      ? joinDatasetId !== '' && joinBranchId !== '' && sourceKeyColumn !== ''
        && targetKeyColumn !== '' && sourceKeyColumn !== targetKeyColumn
      : backingObjectTypeId !== ''

  const submit = () => {
    if (!validation.ok || !backingComplete || !ontology) return
    create.mutate(
      { sourceTypeId: type.id, targetTypeId, apiName, label: label.trim(),
        ontologyId: ontology.id, projectId,
        cardinality, backingKind,
        backingColumn: backingKind === 'foreign_key' ? fkColumn : null,
        datasetId: backingKind === 'join_table' ? joinDatasetId : null,
        branchId: backingKind === 'join_table' ? joinBranchId : null,
        sourceKeyColumn: backingKind === 'join_table' ? sourceKeyColumn : null,
        targetKeyColumn: backingKind === 'join_table' ? targetKeyColumn : null,
        backingObjectTypeId: backingKind === 'object_backed' ? backingObjectTypeId : null,
        sourceLabel: sourceSide.trim() || null,
        targetLabel: targetSide.trim() || null,
        sourceApiName: sourceSide.trim() ? toCamel(sourceSide) : null,
        targetApiName: targetSide.trim() ? toCamel(targetSide) : null },
      { onSuccess: () => {
        setLabel(''); setFkColumn(''); setJoinDatasetId(''); setJoinBranchId('')
        setSourceKeyColumn(''); setTargetKeyColumn(''); setBackingObjectTypeId('')
        setSourceSide(''); setTargetSide('')
      } })
  }

  return (
    <Card className="space-y-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link types</span>
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
      </div>
      {/* The helper's step 1: relationship type, then a cardinality it can
          express — a foreign key cannot carry many-to-many, a join table
          carries nothing else. */}
      <div className="flex flex-wrap items-center gap-2">
        <HTMLSelect value={backingKind}
          onChange={(e) => { pickKind(e.currentTarget.value as LinkBackingKind) }}>
          {LINK_BACKINGS.map((b) => <option key={b} value={b}>{BACKING_LABEL[b]}</option>)}
        </HTMLSelect>
        <HTMLSelect value={cardinality}
          onChange={(e) => { setCardinality(e.currentTarget.value as LinkCardinality) }}>
          {cardinalityOptions.map((c) => <option key={c} value={c}>{CARDINALITY_LABEL[c]}</option>)}
        </HTMLSelect>
        {backingKind === 'foreign_key' && (
          <HTMLSelect value={fkColumn} onChange={(e) => { setFkColumn(e.currentTarget.value) }}>
            <option value="">Foreign key property…</option>
            {type.properties.filter((p) => p.backingColumn).map((p) => (
              <option key={p.key} value={p.backingColumn as string}>{p.label}</option>
            ))}
          </HTMLSelect>
        )}
        {backingKind === 'object_backed' && (
          <HTMLSelect value={backingObjectTypeId} onChange={(e) => { setBackingObjectTypeId(e.currentTarget.value) }}>
            <option value="">Backing object type…</option>
            {allTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </HTMLSelect>
        )}
      </div>
      {backingKind === 'join_table' && (
        <div className="flex flex-wrap items-center gap-2">
          <HTMLSelect value={joinDatasetId}
            onChange={(e) => { setJoinDatasetId(e.currentTarget.value); setJoinBranchId(''); setSourceKeyColumn(''); setTargetKeyColumn('') }}>
            <option value="">Join table dataset…</option>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </HTMLSelect>
          <HTMLSelect value={joinBranchId} disabled={!joinDatasetId}
            onChange={(e) => { setJoinBranchId(e.currentTarget.value) }}>
            <option value="">Branch…</option>
            {joinBranches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </HTMLSelect>
          {/* "A column can only be mapped to one primary key." */}
          <HTMLSelect value={sourceKeyColumn} disabled={!joinDatasetId}
            onChange={(e) => { setSourceKeyColumn(e.currentTarget.value) }}>
            <option value="">{`${type.label} key column…`}</option>
            {joinFields.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
          </HTMLSelect>
          <HTMLSelect value={targetKeyColumn} disabled={!joinDatasetId}
            onChange={(e) => { setTargetKeyColumn(e.currentTarget.value) }}>
            <option value="">{`${labelOf(targetTypeId)} key column…`}</option>
            {joinFields.filter((f) => f.name !== sourceKeyColumn)
              .map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
          </HTMLSelect>
        </div>
      )}
      {/* "A link type has exactly two sides... Each side has its own display
          name and API name" — the API names derive from these. */}
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup size="small" placeholder={`${type.label} side (e.g. ${label.trim() || 'Docked at'})`}
          value={sourceSide} onChange={(e) => { setSourceSide(e.currentTarget.value) }} className="flex-1 min-w-[150px]" />
        <InputGroup size="small" placeholder={`${labelOf(targetTypeId)} side (the reverse sentence)`}
          value={targetSide} onChange={(e) => { setTargetSide(e.currentTarget.value) }} className="flex-1 min-w-[150px]" />
        <Button size="small" icon="add" disabled={!validation.ok || !backingComplete}
          loading={create.isPending} onClick={submit}>Add link type</Button>
      </div>
    </Card>
  )
}
