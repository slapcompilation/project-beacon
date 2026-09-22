// The Datasources and Materializations tabs of a type's detail.
// "Navigate to the Materializations tab by toggling the Edits configuration in
// the Datasources tab in Ontology Manager." (object-edits/materializations)

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Callout, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, Radio, RadioGroup, Switch, Tag,
} from '@blueprintjs/core'
import type { ObjectTypeDef, PropertyDef } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { useDatasets, useBranches } from '@/features/datasets/api'
import {
  useObjectTypeDatasources, useAddObjectTypeDatasource, useRemoveObjectTypeDatasource,
  useSetDatasourcePrimaryKeyColumn, useSetDatasourceControls, useAllMarkings, useAllOrganizations,
  useSetDatasourceConflictResolution,
} from '@/features/objectTypes/hooks'
import type { ObjectTypeDatasource } from '@/features/objectTypes/api'
import { useMarkings, useResourceMarkings, useSetResourceMarking } from '@/features/markings/api'
import {
  useMaterializations, useEditsConfig, useSetEditsConfig,
  useCreateMaterialization, useSetPropagation, useRebuildMaterialization,
} from '@/features/objectTypes/materializations'
import { useRestrictedViews } from '@/features/restrictedViews/api'
import { PolicyEditorDialog } from '@/features/restrictedViews/PolicyEditorDialog'
import { SecurityPoliciesCard } from '@/features/objectTypes/SecurityPoliciesCard'
import { useSecurityPolicies } from '@/features/objectTypes/securityPolicies'
import { CheckAccessPanel } from '@/features/security/CheckAccessPanel'

/** The Security tab: the requirement cards the page enumerates —
 *  "A user must meet all of the following requirements to view/edit the
 *  definition of this resource" — derived from the live model, never
 *  restated: placement (454), the space's organizations (441), and any
 *  markings on the resource. */
export function SecurityTab({ type }: { type: ObjectTypeDef }) {
  // The same read the policies card below makes; it already carries both the
  // datasource labels and whether either policy kind exists, which is exactly
  // the either/or the See instances card renders.
  const { data: policies } = useSecurityPolicies(type.id)
  const hasPolicy = !!policies && (!!policies.objectPolicy || policies.propertyPolicies.length > 0)
  const { data } = useQuery({
    queryKey: ['type-security', type.id],
    queryFn: async () => {
      const [proj, ont, marks] = await Promise.all([
        supabase.from('object_types').select('project_id, protected, projects(name)').eq('id', type.id).single(),
        supabase.from('ontologies').select('space_id, spaces(name, space_organizations(organizations(name)))')
          .eq('id', type.ontologyId ?? '').single(),
        supabase.from('resource_markings').select('markings(name)')
          .eq('resource_kind', 'object_type').eq('resource_id', type.id),
      ])
      const p = proj.data as unknown as { project_id: string | null; protected: boolean; projects: { name: string } | null } | null
      const o = ont.data as unknown as { spaces: { name: string; space_organizations: { organizations: { name: string } | null }[] } | null } | null
      const m = (marks.data ?? []) as unknown as { markings: { name: string } | null }[]
      return {
        projectName: p?.projects?.name ?? null,
        isProtected: p?.protected ?? false,
        orgs: (o?.spaces?.space_organizations ?? []).map((x) => x.organizations?.name ?? '?'),
        markings: m.map((x) => x.markings?.name ?? '?'),
      }
    },
  })

  const Req = ({ title, what, lines }: { title: string; what: React.ReactNode; lines: React.ReactNode }) => (
    <div className="rounded border p-3 space-y-2 flex-1 min-w-[260px]">
      <h3 className="text-xs font-semibold text-center">{title}</h3>
      <p className="text-xs text-muted-foreground text-center">
        A user must meet <b>all</b> of the following requirements to {what}.
      </p>
      {lines}
    </div>
  )
  const Clause = ({ label, items }: { label: string; items: string[] }) => (
    <div className="rounded border px-2 py-1.5">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {items.length === 0
        ? <p className="text-xs">None</p>
        : items.map((x) => <p key={x} className="text-xs">{x}</p>)}
    </div>
  )
  const And = () => <p className="text-xs text-muted-foreground text-center">AND</p>

  if (!data) return null
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
      <Req title="View object type" what="view the definition of this resource" lines={<>
        <Clause label={data.projectName ? `Project · ${data.projectName}` : 'Placement'}
          items={[data.projectName ? 'Viewer permissions — any role on the project' : 'Not placed in a project — visible to the ontology']} />
        <And />
        <Clause label="Organizations · Any of" items={data.orgs} />
        <And />
        <Clause label="Markings" items={data.markings} />
      </>} />
      {/* The third card the page names: "The Security tab displays the required
          permissions to view and edit an object type, and the required
          permissions to see instances or run actions." We had the first two.
          The prose enumerates the last clause's two mutually exclusive shapes
          and 833 is what makes them true of this platform:
            · "Object and property security policies: Object visibility is
               governed by policies configured directly on the object type,
               independent of the backing datasource permissions."
            · "Data source policies: Object visibility is governed by the
               permissions on the backing data source."
          No capture of this card exists — osp-navigate-security-tab.png is the
          sidebar, 604x716 — so the clause shape is the one its two siblings
          already established, not an invented layout. Run actions stays
          unbuilt; it reasons over action types, not this. */}
      <Req title="See instances" what="see instances of this object type" lines={<>
        <Clause label={data.projectName ? `Project · ${data.projectName}` : 'Placement'}
          items={[data.projectName ? 'Viewer permissions — any role on the project' : 'Not placed in a project — visible to the ontology']} />
        <And />
        <Clause label="Organizations · Any of" items={data.orgs} />
        <And />
        <Clause label="Markings" items={data.markings} />
        <And />
        {policies && (hasPolicy
          ? <Clause label="Object and property security policies"
              items={['Governed by the policies on this object type, independent of the backing datasource permissions']} />
          : <Clause label="Data source policies · Any of"
              items={policies.datasources.length === 0
                ? ['No backing datasource']
                : policies.datasources.map((d) => `View permissions on ${d.label}`)} />)}
      </>} />
      <Req title="Edit object type" what="edit the definition of this resource" lines={<>
        <Clause label={data.projectName ? `Project · ${data.projectName}` : 'Placement'}
          items={[data.projectName ? 'Editor permissions on the project, or an organization administrator' : 'An organization administrator']} />
        <And />
        <Clause label="Organizations · Any of" items={data.orgs} />
        <And />
        <Clause label="Markings" items={data.markings} />
        {data.isProtected && <>
          <And />
          <Clause label="Branch protection"
            items={['Protected — changes must be made on a branch and approved before merging']} />
        </>}
      </>} />
      <MarkingEditor typeId={type.id} />
      </div>

      {/* The other half of this tab, and a different question. The cards above
          govern the DEFINITION — "to view/edit the definition of this resource".
          Security policies govern the DATA: which instances a caller sees and
          which property values come back. The page reaches it from here, in
          step 1: "Navigate to the Security tab of the object type." */}
      <SecurityPoliciesCard type={type} />

      {/* "You can check someone's permissions on a Project, folder, or file by
          using the Check access panel in the workspace sidebar or the Data
          Lineage tool." An object type is a file, and 834 taught check_access
          the kind — until then it refused with Compass:UnknownResourceKind, so
          the panel existed and only DatasetPage could reach it. */}
      <CheckAccessPanel kind="object_type" resourceId={type.id} />
    </div>
  )
}

/** The other half of the Markings clause above. Until 819 the Security tab
 *  asked resource_markings for `resource_kind = 'object_type'` and the CHECK
 *  forbade the kind, so the clause could only ever read "None" — a dead read.
 *  The kind is admissible now and the read policy honours it, so this is what
 *  puts a marking there.
 *
 *  Conjunctive, which is worth knowing before you click: applying a marking you
 *  are not a member of hides the object type from YOU. The database refuses the
 *  apply unless you hold the marking's `apply` permission and Owner on the
 *  resource, and its refusal is what the toast shows. */
function MarkingEditor({ typeId }: { typeId: string }) {
  const applied = useResourceMarkings('object_type', typeId)
  const all = useMarkings()
  const set = useSetResourceMarking()
  const [picking, setPicking] = useState(false)
  const held = new Set((applied.data ?? []).map((m) => m.markingId))

  return (
    <div className="rounded border p-3 space-y-2 flex-1 min-w-[260px]">
      <h3 className="text-xs font-semibold text-center">Markings on this object type</h3>
      <p className="text-xs text-muted-foreground text-center">
        A marking hides the object type from anyone who is not a member of it.
      </p>
      {(applied.data ?? []).length === 0 && (
        <p className="text-xs text-muted-foreground">None applied.</p>
      )}
      {(applied.data ?? []).map((m) => (
        <div key={m.markingId} className="flex items-center justify-between gap-2">
          <Tag minimal icon="shield">
            {m.categoryName ? `${m.categoryName}: ${m.name}` : m.name}
          </Tag>
          <Button variant="minimal" size="small" icon="cross" title="Remove this marking"
            onClick={() => {
              set.mutate({ kind: 'object_type', resourceId: typeId, markingId: m.markingId, applied: true })
            }} />
        </div>
      ))}
      {picking ? (
        <HTMLSelect fill value="" onChange={(e) => {
          const v = e.currentTarget.value
          if (v) {
            set.mutate({ kind: 'object_type', resourceId: typeId, markingId: v, applied: false },
              { onSuccess: () => { setPicking(false) } })
          }
        }}>
          <option value="">Choose a marking…</option>
          {(all.data ?? []).filter((m) => !held.has(m.id)).map((m) => (
            <option key={m.id} value={m.id}>{m.categoryName}: {m.name}</option>
          ))}
        </HTMLSelect>
      ) : (
        <Button size="small" variant="minimal" icon="add"
          onClick={() => { setPicking(true) }}>Apply a marking</Button>
      )}
    </div>
  )
}

// "In order to populate property values for objects of this type with data,
// you must add a backing datasource." A datasource is a dataset on a branch —
// or a restricted view: "set a restricted view as the backing dataset in the
// Ontology Manager" (manage-restricted-views).
export function DatasourcesTab({ type }: { type: ObjectTypeDef }) {
  const { data: sources = [] } = useObjectTypeDatasources(type.id)
  const add = useAddObjectTypeDatasource(type.id)
  const remove = useRemoveObjectTypeDatasource(type.id)
  const { data: datasets = [] } = useDatasets()
  const { data: restrictedViews = [] } = useRestrictedViews()
  const [datasetId, setDatasetId] = useState('')
  const isRv = datasetId.startsWith('rv:')
  const { data: branches = [] } = useBranches(!datasetId || isRv ? null : datasetId)
  const [branchId, setBranchId] = useState('')
  const { data: edits } = useEditsConfig(type.id)
  const editsEnabled = edits?.editsEnabled ?? false
  const setEdits = useSetEditsConfig(type.id)
  const [editingRv, setEditingRv] = useState<string | null>(null)
  const editingView = restrictedViews.find((v) => v.id === editingRv) ?? null
  const setKey = useSetDatasourcePrimaryKeyColumn(type.id)
  const [addingMedia, setAddingMedia] = useState(false)
  const [mediaSet, setMediaSet] = useState('')
  const [mediaView, setMediaView] = useState('')
  const [keyDraft, setKeyDraft] = useState<Partial<Record<string, string>>>({})
  const hasMarking = type.properties.some((p) => p.type === 'marking')

  return (
    <div className="space-y-3">
      {sources.map((s) => (
        <div key={s.id} className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            <Icon size={12} className="text-violet-500"
              icon={s.mediaSetViewRid ? 'media' : s.restrictedViewId ? 'eye-off' : 'database'} />
            <span className="font-medium">
              {s.mediaSetViewRid ?? (s.restrictedViewId ? s.restrictedViewName : s.datasetName)}
            </span>
            {s.mediaSetViewRid
              ? <Tag minimal
                  title="A media set view backs media reference properties directly, and does not count toward the 70-datasource limit.">media set view</Tag>
              : s.restrictedViewId
                ? <Tag minimal intent={Intent.WARNING}
                    title="Each user sees only the objects the view's policy allows.">restricted view</Tag>
                : <Tag minimal>{s.branchName}</Tag>}
            {s.restrictedViewId && (
              <Button variant="minimal" size="small" icon="edit" title="Edit policy / View JSON / Test policy"
                onClick={() => { setEditingRv(s.restrictedViewId) }} />
            )}
            <Button variant="minimal" size="small" icon="cross" className="ml-auto"
              onClick={() => { remove.mutate(s.id) }} />
          </div>
          {/* "The Map primary key helper will appear and prompt you for a column
              with values matching the primary key of the object type." Only for
              the joined kinds; a media set view has nothing to join. Empty means
              the key property's own column, which is the usual case. */}
          {!s.mediaSetViewRid && (
            <div className="flex items-center gap-2 pl-5 text-xs text-muted-foreground">
              <span>Primary key column</span>
              <InputGroup size="small" value={keyDraft[s.id] ?? s.primaryKeyColumn ?? ''}
                placeholder={type.properties.find((p) => p.isPrimaryKey)?.backingColumn ?? 'same as the key property'}
                onValueChange={(v) => { setKeyDraft({ ...keyDraft, [s.id]: v }) }}
                onBlur={() => {
                  const next = keyDraft[s.id]
                  if (next !== undefined && next !== (s.primaryKeyColumn ?? '')) {
                    setKey.mutate({ id: s.id, column: next })
                  }
                }} />
            </div>
          )}
          {/* "Resolution happens on a property-by-property basis." A media set
              view backs media properties directly and receives no user edits,
              so it has no conflict to resolve. */}
          {!s.mediaSetViewRid && (
            <ConflictResolutionRow source={s} typeId={type.id} properties={type.properties} />
          )}
          {/* "Every datasource that contains a mandatory control property must
              define a constraint on what values can be added" — shown once the
              type carries a marking property. */}
          {hasMarking && !s.mediaSetViewRid && (
            <MandatoryControlsRow source={s} typeId={type.id} />
          )}
        </div>
      ))}
      {editingView && (
        <PolicyEditorDialog view={editingView} onClose={() => { setEditingRv(null) }} />
      )}
      {sources.length === 0 && (
        <p className="text-xs text-muted-foreground">
          In order to populate property values for objects of this type with data, you must add a backing datasource.
        </p>
      )}
      {/* A media set view is not a dataset and is not picked from one: it is an
          external resource named by its RIDs, the pair the API publishes as
          mediaSetRid and mediaSetViewRid. Nothing in the platform holds media
          sets, so naming them is the honest control. */}
      {addingMedia ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Media set RID</span>
            <InputGroup size="small" value={mediaSet} className="font-mono min-w-[280px]"
              placeholder="ri.mio.main.media-set.…" onValueChange={setMediaSet} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">View RID</span>
            <InputGroup size="small" value={mediaView} className="font-mono min-w-[280px]"
              placeholder="ri.mio.main.view.…" onValueChange={setMediaView} />
          </label>
          <Button size="small" icon="add" intent={Intent.PRIMARY}
            disabled={!mediaSet.trim() || !mediaView.trim()}
            onClick={() => {
              add.mutate({ mediaSetRid: mediaSet.trim(), mediaSetViewRid: mediaView.trim() })
              setMediaSet(''); setMediaView(''); setAddingMedia(false)
            }}>Add media source</Button>
          <Button variant="minimal" size="small" onClick={() => { setAddingMedia(false) }}>Cancel</Button>
        </div>
      ) : (
      <div className="flex flex-wrap items-center gap-2">
        <HTMLSelect value={datasetId} onChange={(e) => { setDatasetId(e.currentTarget.value); setBranchId('') }}>
          <option value="">Dataset…</option>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          {restrictedViews.length > 0 && (
            <optgroup label="Restricted views">
              {restrictedViews.map((v) => <option key={v.id} value={`rv:${v.id}`}>{v.name}</option>)}
            </optgroup>
          )}
        </HTMLSelect>
        {!isRv && (
          <HTMLSelect value={branchId} disabled={!datasetId} onChange={(e) => { setBranchId(e.currentTarget.value) }}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </HTMLSelect>
        )}
        <Button size="small" icon="add" disabled={!datasetId || (!isRv && !branchId)}
          onClick={() => {
            add.mutate(isRv ? { restrictedViewId: datasetId.slice(3) } : { datasetId, branchId })
            setDatasetId(''); setBranchId('')
          }}>
          Add datasource
        </Button>
        <Button variant="minimal" size="small" icon="media"
          onClick={() => { setAddingMedia(true) }}>Add media source</Button>
      </div>
      )}

      {/* The Edits configuration — the door to the Materializations tab, and
          the writeback setting beside it. "by default, new object types only
          allow edits via actions"; the other mode is the discouraged one. */}
      <div className="border-t pt-3">
        <Switch checked={editsEnabled} label="Edits"
          onChange={(e) => { setEdits.mutate({ edits_enabled: e.currentTarget.checked }) }} />
        <p className="text-xs text-muted-foreground -mt-1">
          Enable user edits for this object type. Toggling this on opens the Materializations tab.
        </p>
        {editsEnabled && (
          <div className="mt-3">
            <Switch checked={edits?.onlyViaActions ?? true} label="Only allow edits via actions"
              onChange={(e) => { setEdits.mutate({ only_edits_via_actions: e.currentTarget.checked }) }} />
            <p className="text-xs text-muted-foreground -mt-1">
              {edits?.onlyViaActions ?? true
                ? 'An applier needs only Read on the objects being edited — the action is the permission. Direct writes are refused with Actions:PermissionDenied.'
                : 'Edits are also allowed from forms, direct edits and API calls. Discouraged: it needs Edit on the writeback dataset, which exposes all of its data.'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Turning this on does not remove historical, non-action edits; it prevents further ones.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** The datasource's mandatory-control constraint: allowed markings and/or
 *  allowed organizations. Null is undeclared — the linter reports it; an
 *  empty set is a real declaration that admits every user. */
/** "Users can configure this option in the Ontology Manager, under the
 *  Datasources section. Each datasource of the object type can have different
 *  resolution strategies." Laid out as the capture does it
 *  (object-edits/images/edits-conflict-resolution-configuration.png): the
 *  strategy on one row with `Default` on the first option, the timestamp
 *  property on the next. */
function ConflictResolutionRow({ source, typeId, properties }: {
  source: ObjectTypeDatasource; typeId: string; properties: PropertyDef[]
}) {
  const set = useSetDatasourceConflictResolution(typeId)
  const conditional = source.conflictResolution === 'apply_most_recent_value'
  // "requires that the datasource contains a property with the timestamp type;
  //  the date property type will not work for this option"
  const stamps = properties.filter(
    (p) => p.type === 'timestamp' && (p.datasourceId === source.id || p.datasourceId === null))

  return (
    <div className="space-y-1 pl-5 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground w-40">Conflict resolution strategy</span>
        <Button size="small" variant={conditional ? 'minimal' : 'outlined'}
          intent={conditional ? Intent.NONE : Intent.PRIMARY}
          onClick={() => { set.mutate({ id: source.id, strategy: 'apply_user_edits', timestampPropertyId: null }) }}>
          Apply user edits
        </Button>
        <Tag minimal>Default</Tag>
        <Button size="small" variant={conditional ? 'outlined' : 'minimal'}
          intent={conditional ? Intent.PRIMARY : Intent.NONE}
          disabled={stamps.length === 0}
          title={stamps.length === 0
            ? 'This option requires that the datasource contains a property with the timestamp type; the date property type will not work for this option.'
            : 'User edits are only applied if the timestamp of the user edit is more recent than the timestamp value coming from the datasource.'}
          onClick={() => {
            set.mutate({ id: source.id, strategy: 'apply_most_recent_value',
                         timestampPropertyId: source.timestampPropertyId ?? stamps[0].id ?? null })
          }}>
          Apply most recent value
        </Button>
      </div>
      {conditional && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground w-40">Timestamp property</span>
          <HTMLSelect value={source.timestampPropertyId ?? ''}
            title="The timestamp property must be in Coordinated Universal Time (UTC)."
            onChange={(e) => {
              set.mutate({ id: source.id, strategy: 'apply_most_recent_value',
                           timestampPropertyId: e.currentTarget.value })
            }}>
            {stamps.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </HTMLSelect>
        </div>
      )}
    </div>
  )
}

function MandatoryControlsRow({ source, typeId }: {
  source: ObjectTypeDatasource; typeId: string
}) {
  const set = useSetDatasourceControls(typeId)
  const { data: markings = [] } = useAllMarkings()
  const { data: organizations = [] } = useAllOrganizations()
  const declared = source.allowedMarkings !== null || source.allowedOrganizations !== null

  if (!declared) {
    return (
      <div className="flex items-center gap-2 pl-5 text-xs">
        <Tag minimal intent={Intent.WARNING}>Mandatory controls undeclared</Tag>
        <Button size="small" variant="minimal"
          onClick={() => { set.mutate({ id: source.id, markings: [], organizations: [] }) }}>
          Declare
        </Button>
      </div>
    )
  }

  const pickerLine = (
    label: string, ids: string[], all: { id: string; name: string }[],
    save: (next: string[]) => void,
  ) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-muted-foreground w-40">{label}</span>
      {ids.map((id) => (
        <Tag key={id} minimal onRemove={() => { save(ids.filter((x) => x !== id)) }}>
          {all.find((m) => m.id === id)?.name ?? id}
        </Tag>
      ))}
      {ids.length === 0 && (
        <span className="text-muted-foreground italic"
          title="markings and organization values can be set to an empty array. In such cases, all users will meet the marking requirements">
          empty — admits every user
        </span>
      )}
      <HTMLSelect value="" onChange={(e) => {
        const v = e.currentTarget.value
        if (v) save([...ids, v])
      }}>
        <option value="">Add…</option>
        {all.filter((m) => !ids.includes(m.id))
          .map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </HTMLSelect>
    </div>
  )

  const mk = source.allowedMarkings ?? []
  const org = source.allowedOrganizations ?? []
  return (
    <div className="space-y-1 pl-5 text-xs">
      {pickerLine('Allowed markings', mk, markings,
        (next) => { set.mutate({ id: source.id, markings: next, organizations: source.allowedOrganizations }) })}
      {pickerLine('Allowed organizations', org, organizations,
        (next) => { set.mutate({ id: source.id, markings: source.allowedMarkings, organizations: next }) })}
    </div>
  )
}

export function MaterializationsTab({ type }: { type: ObjectTypeDef }) {
  const { data: rows = [] } = useMaterializations(type.id)
  const setPropagation = useSetPropagation(type.id)
  const rebuild = useRebuildMaterialization(type.id)
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold">Output datasets</h3>
        <p className="text-xs text-muted-foreground">
          You can copy data contained in objects of this type into derived datasources.
        </p>
      </div>

      {rows.length === 0 ? (
        <Callout className="text-center">
          <p className="text-sm font-semibold">No object datasets created</p>
          <p className="text-xs text-muted-foreground mb-2">
            No object datasets have been created. Click the button below to create a new object dataset.
          </p>
          <Button icon="add" variant="outlined" intent={Intent.PRIMARY}
            onClick={() => { setCreating(true) }}>Create new object dataset</Button>
        </Callout>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">Object datasets</span>
          {rows.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 border rounded px-3 py-2">
              <Icon icon="th" size={13} className="text-violet-500" />
              <span className="text-xs font-medium">{m.datasetName}</span>
              <span className="ml-auto text-xs text-muted-foreground">Status:</span>
              <Tag minimal intent={m.upToDate ? Intent.SUCCESS : Intent.WARNING}>
                {m.builtAt === null ? 'Not built' : m.upToDate ? 'Up to date' : 'Stale'}
              </Tag>
              <span className="text-xs text-muted-foreground">Build interval:</span>
              <HTMLSelect minimal value={m.propagation}
                onChange={(e) => { setPropagation.mutate({ id: m.id, propagation: e.currentTarget.value as 'automatic' | 'periodic' }) }}>
                <option value="automatic">Automatic</option>
                <option value="periodic">Periodic</option>
              </HTMLSelect>
              {/* Stands in for the propagation worker we do not have yet. */}
              <Button variant="minimal" size="small" icon="refresh" title="Rebuild now"
                loading={rebuild.isPending} onClick={() => { rebuild.mutate(m.id) }} />
            </div>
          ))}
          <Button icon="add" variant="outlined" size="small" onClick={() => { setCreating(true) }}>
            Create new object dataset
          </Button>
        </>
      )}

      <CreateObjectDatasetDialog type={type} isOpen={creating} onClose={() => { setCreating(false) }} />
    </div>
  )
}

function CreateObjectDatasetDialog({ type, isOpen, onClose }: {
  type: ObjectTypeDef; isOpen: boolean; onClose: () => void
}) {
  const create = useCreateMaterialization(type.id)
  // The screenshot's first row is named `…_export`; the dialog itself chooses
  // only the rebuild interval, so the name is prefilled and editable.
  const [name, setName] = useState(`${type.apiName}_export`)
  const [propagation, setPropagation] = useState<'automatic' | 'periodic'>('periodic')

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create new object dataset" style={{ width: 430 }}>
      <DialogBody>
        <div className="space-y-3">
          <InputGroup value={name} onChange={(e) => { setName(e.currentTarget.value) }} placeholder="Dataset name" />
          <p className="text-xs">Choose how often you want the object dataset to be rebuilt.</p>
          <RadioGroup selectedValue={propagation}
            onChange={(e) => { setPropagation(e.currentTarget.value as 'automatic' | 'periodic') }}>
            <Radio value="automatic">
              <Tag minimal intent={Intent.SUCCESS}>Automatic</Tag>
              <p className="text-xs text-muted-foreground ml-6 mb-0">
                Object datasets are built whenever updates to objects are detected.
                As builds may happen more frequently this can increase costs.
              </p>
            </Radio>
            <Radio value="periodic">
              <Tag minimal intent={Intent.PRIMARY}>Periodic</Tag>
              <p className="text-xs text-muted-foreground ml-6 mb-0">
                Object datasets are built when input datasources update or every 6 hours.
              </p>
            </Radio>
          </RadioGroup>
        </div>
      </DialogBody>
      <DialogFooter actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button intent={Intent.PRIMARY} icon="add" disabled={!name.trim()} loading={create.isPending}
          onClick={() => { create.mutate({ name: name.trim(), propagation }, { onSuccess: onClose }) }}>
          Save dataset
        </Button>
      </>} />
    </Dialog>
  )
}
