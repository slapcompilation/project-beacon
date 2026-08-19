// Step 1 of the create wizard — "Object type backing".
//
// The screenshot draws two cards side by side: "Continue without datasource /
// Generate a dataset for permissions purposes" and "Use existing datasource /
// Select a preexisting Foundry datasource", the chosen one outlined and ticked
// (`create-object-type-datasource-step.png`). Choosing the first opens a
// "Create a new backing dataset" dialog with a File name and a Location
// (`create-object-type-choose-new-datasource-location.png`).
//
// Why this belongs at creation rather than in the Datasources tab, where the
// only route was until now: an object type with no datasource fails its own
// linter — "A backing datasource is required" — and a save that introduces a
// violation is refused. So every type created here was born unsaveable and had
// to be repaired in a second place. The wizard asks first for that reason.

import { useState } from 'react'
import { Button, Card, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon, InputGroup } from '@blueprintjs/core'
import { useDatasets, useBranches } from '@/features/datasets/api'
import { useFolders } from '@/features/compass/api'

/** What the caller has to do after the object type exists. */
export type Backing =
  | { kind: 'existing'; datasetId: string; branchId: string }
  | { kind: 'generate'; name: string; folderId: string | null }

export function BackingStep({ projectId, label, value, onChange }: {
  projectId: string | null
  /** The type's label, which seeds the generated dataset's name. */
  label: string
  value: Backing
  onChange: (b: Backing) => void
}) {
  const { data: datasets = [] } = useDatasets()
  const existing = value.kind === 'existing' ? value : null
  const { data: branches = [] } = useBranches(existing?.datasetId || null)
  const { data: folders = [] } = useFolders(projectId)
  const [naming, setNaming] = useState(false)

  const pick = (kind: Backing['kind']) => {
    if (kind === value.kind) return
    if (kind === 'existing') onChange({ kind: 'existing', datasetId: '', branchId: '' })
    else { onChange({ kind: 'generate', name: label.trim() || 'Backing dataset', folderId: null }); setNaming(true) }
  }

  const Choice = ({ kind, icon, title, sub }: {
    kind: Backing['kind']; icon: 'th-derived' | 'th'; title: string; sub: string
  }) => (
    <Card interactive compact onClick={() => { pick(kind) }}
      className={`flex flex-1 items-start gap-2 !p-3 ${value.kind === kind ? 'border-blue-500 !border-2' : ''}`}>
      <Icon icon={icon} size={16} className="mt-0.5 text-neutral-500" />
      <div className="flex-1">
        <p className={`text-xs font-semibold ${value.kind === kind ? 'text-blue-600' : ''}`}>{title}</p>
        <p className="text-[11px] text-muted-foreground">{sub}</p>
      </div>
      {value.kind === kind && <Icon icon="tick" size={14} className="text-blue-600" />}
    </Card>
  )

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Datasource
      </span>
      <div className="flex flex-wrap gap-2">
        <Choice kind="generate" icon="th-derived" title="Continue without datasource"
          sub="Generate a dataset for permissions purposes" />
        <Choice kind="existing" icon="th" title="Use existing datasource"
          sub="Select a preexisting Foundry datasource" />
      </div>

      {value.kind === 'existing' && (
        <div className="flex flex-wrap items-center gap-2">
          <HTMLSelect value={value.datasetId}
            onChange={(e) => { onChange({ kind: 'existing', datasetId: e.currentTarget.value, branchId: '' }) }}>
            <option value="">Select a datasource to back this object type…</option>
            {datasets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </HTMLSelect>
          <HTMLSelect value={value.branchId} disabled={!value.datasetId}
            onChange={(e) => { onChange({ ...value, branchId: e.currentTarget.value }) }}>
            <option value="">Branch…</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </HTMLSelect>
        </div>
      )}

      {value.kind === 'generate' && (
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Icon icon="th-derived" size={12} />
          <span className="font-medium text-neutral-700">{value.name}</span>
          <span>in {folders.find((f) => f.id === value.folderId)?.name ?? 'the project root'}</span>
          <Button variant="minimal" size="small" icon="edit" onClick={() => { setNaming(true) }} />
        </div>
      )}

      <Dialog isOpen={naming} onClose={() => { setNaming(false) }} title="Create a new backing dataset">
        <DialogBody>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold">File name</label>
            <InputGroup leftIcon="th" value={value.kind === 'generate' ? value.name : ''}
              onValueChange={(v) => { onChange({ kind: 'generate', name: v, folderId: value.kind === 'generate' ? value.folderId : null }) }} />
            <label className="text-[11px] font-semibold">Location</label>
            {/* "As permissions of the objects of a type are determined by the
                location of their backing datasources" — so this is not filing,
                it is the permission decision. */}
            <HTMLSelect fill value={value.kind === 'generate' ? value.folderId ?? '' : ''}
              onChange={(e) => { onChange({ kind: 'generate', name: value.kind === 'generate' ? value.name : '', folderId: e.currentTarget.value || null }) }}>
              <option value="">The project root</option>
              {folders.filter((f) => !f.trashedAt).map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </HTMLSelect>
          </div>
        </DialogBody>
        <DialogFooter actions={
          <Button intent="primary" onClick={() => { setNaming(false) }}
            disabled={value.kind === 'generate' && value.name.trim() === ''}>Save</Button>
        } />
      </Dialog>
    </div>
  )
}
