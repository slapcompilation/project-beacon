// The Datasources and Materializations tabs of a type's detail.
// "Navigate to the Materializations tab by toggling the Edits configuration in
// the Datasources tab in Ontology Manager." (object-edits/materializations)

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Button, Callout, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, Radio, RadioGroup, Switch, Tag,
} from '@blueprintjs/core'
import type { ObjectTypeDef } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { useDatasets, useBranches } from '@/features/datasets/api'
import {
  useObjectTypeDatasources, useAddObjectTypeDatasource, useRemoveObjectTypeDatasource,
  useSetDatasourcePrimaryKeyColumn,
} from '@/features/objectTypes/hooks'
import {
  useMaterializations, useEditsEnabled, useSetEditsEnabled,
  useCreateMaterialization, useSetPropagation, useRebuildMaterialization,
} from '@/features/objectTypes/materializations'
import { useRestrictedViews } from '@/features/restrictedViews/api'
import { PolicyEditorDialog } from '@/features/restrictedViews/PolicyEditorDialog'

/** The Security tab: the two requirement cards the screenshot shows —
 *  "A user must meet all of the following requirements to view/edit the
 *  definition of this resource" — derived from the live model, never
 *  restated: placement (454), the space's organizations (441), and any
 *  markings on the resource. */
export function SecurityTab({ type }: { type: ObjectTypeDef }) {
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

  const Req = ({ title, lines }: { title: string; lines: React.ReactNode }) => (
    <div className="rounded border p-3 space-y-2 flex-1 min-w-[260px]">
      <h3 className="text-xs font-semibold text-center">{title}</h3>
      <p className="text-xs text-muted-foreground text-center">
        A user must meet <b>all</b> of the following requirements to {title === 'View object type' ? 'view' : 'edit'} the definition of this resource.
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
    <div className="flex flex-wrap gap-3">
      <Req title="View object type" lines={<>
        <Clause label={data.projectName ? `Project · ${data.projectName}` : 'Placement'}
          items={[data.projectName ? 'Viewer permissions — any role on the project' : 'Not placed in a project — visible to the ontology']} />
        <And />
        <Clause label="Organizations · Any of" items={data.orgs} />
        <And />
        <Clause label="Markings" items={data.markings} />
      </>} />
      <Req title="Edit object type" lines={<>
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
  const { data: editsEnabled = false } = useEditsEnabled(type.id)
  const setEdits = useSetEditsEnabled(type.id)
  const [editingRv, setEditingRv] = useState<string | null>(null)
  const editingView = restrictedViews.find((v) => v.id === editingRv) ?? null
  const setKey = useSetDatasourcePrimaryKeyColumn(type.id)
  const [addingMedia, setAddingMedia] = useState(false)
  const [mediaSet, setMediaSet] = useState('')
  const [mediaView, setMediaView] = useState('')
  const [keyDraft, setKeyDraft] = useState<Partial<Record<string, string>>>({})

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

      {/* The Edits configuration — the door to the Materializations tab. */}
      <div className="border-t pt-3">
        <Switch checked={editsEnabled} label="Edits"
          onChange={(e) => { setEdits.mutate(e.currentTarget.checked) }} />
        <p className="text-xs text-muted-foreground -mt-1">
          Enable user edits for this object type. Toggling this on opens the Materializations tab.
        </p>
      </div>
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
