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
} from '@/features/objectTypes/hooks'
import {
  useMaterializations, useEditsEnabled, useSetEditsEnabled,
  useCreateMaterialization, useSetPropagation, useRebuildMaterialization,
} from '@/features/objectTypes/materializations'

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
      <p className="text-[11px] text-muted-foreground text-center">
        A user must meet <b>all</b> of the following requirements to {title === 'View object type' ? 'view' : 'edit'} the definition of this resource.
      </p>
      {lines}
    </div>
  )
  const Clause = ({ label, items }: { label: string; items: string[] }) => (
    <div className="rounded border px-2 py-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      {items.length === 0
        ? <p className="text-[11px]">None</p>
        : items.map((x) => <p key={x} className="text-[11px]">{x}</p>)}
    </div>
  )
  const And = () => <p className="text-[10px] text-muted-foreground text-center">AND</p>

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
// you must add a backing datasource." A datasource is a dataset on a branch.
export function DatasourcesTab({ type }: { type: ObjectTypeDef }) {
  const { data: sources = [] } = useObjectTypeDatasources(type.id)
  const add = useAddObjectTypeDatasource(type.id)
  const remove = useRemoveObjectTypeDatasource(type.id)
  const { data: datasets = [] } = useDatasets()
  const [datasetId, setDatasetId] = useState('')
  const { data: branches = [] } = useBranches(datasetId || null)
  const [branchId, setBranchId] = useState('')
  const { data: editsEnabled = false } = useEditsEnabled(type.id)
  const setEdits = useSetEditsEnabled(type.id)

  return (
    <div className="space-y-3">
      {sources.map((s) => (
        <div key={s.id} className="flex items-center gap-2 text-xs">
          <Icon icon="database" size={12} className="text-violet-500" />
          <span className="font-medium">{s.datasetName}</span>
          <Tag minimal className="!text-[10px]">{s.branchName}</Tag>
          <Button variant="minimal" size="small" icon="cross" className="ml-auto"
            onClick={() => { remove.mutate(s.id) }} />
        </div>
      ))}
      {sources.length === 0 && (
        <p className="text-xs text-muted-foreground">
          In order to populate property values for objects of this type with data, you must add a backing datasource.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <HTMLSelect value={datasetId} onChange={(e) => { setDatasetId(e.currentTarget.value); setBranchId('') }}>
          <option value="">Dataset…</option>
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </HTMLSelect>
        <HTMLSelect value={branchId} disabled={!datasetId} onChange={(e) => { setBranchId(e.currentTarget.value) }}>
          <option value="">Branch…</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </HTMLSelect>
        <Button size="small" icon="add" disabled={!datasetId || !branchId}
          onClick={() => { add.mutate({ datasetId, branchId }); setDatasetId(''); setBranchId('') }}>
          Add datasource
        </Button>
      </div>

      {/* The Edits configuration — the door to the Materializations tab. */}
      <div className="border-t pt-3">
        <Switch checked={editsEnabled} label="Edits"
          onChange={(e) => { setEdits.mutate(e.currentTarget.checked) }} />
        <p className="text-[11px] text-muted-foreground -mt-1">
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
          <span className="text-[11px] text-muted-foreground">Object datasets</span>
          {rows.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-2 border rounded px-3 py-2">
              <Icon icon="th" size={13} className="text-violet-500" />
              <span className="text-xs font-medium">{m.datasetName}</span>
              <span className="ml-auto text-[11px] text-muted-foreground">Status:</span>
              <Tag minimal intent={m.upToDate ? Intent.SUCCESS : Intent.WARNING} className="!text-[10px]">
                {m.builtAt === null ? 'Not built' : m.upToDate ? 'Up to date' : 'Stale'}
              </Tag>
              <span className="text-[11px] text-muted-foreground">Build interval:</span>
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
              <Tag minimal intent={Intent.SUCCESS} className="!text-[10px]">Automatic</Tag>
              <p className="text-xs text-muted-foreground ml-6 mb-0">
                Object datasets are built whenever updates to objects are detected.
                As builds may happen more frequently this can increase costs.
              </p>
            </Radio>
            <Radio value="periodic">
              <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">Periodic</Tag>
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
