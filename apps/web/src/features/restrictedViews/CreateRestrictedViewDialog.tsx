// The restricted view creation dialog, with the four documented steps:
// "1. Save as … 2. Compose a granular policy … 3. Review access
// requirements … 4. Summary." (security/restricted-views.md)
//
// Reached from a dataset, the way Foundry's right-click contextual action is.
// The database refuses what the grammar refuses; refusals surface as toasts.

import { useState } from 'react'
import {
  Button, Callout, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, Tag,
} from '@blueprintjs/core'
import { toSlug } from '@beacon/ontology'
import { useProjects } from '@/features/projects/api'
import { PolicyComposer } from './PolicyComposer'
import { useCreateRestrictedView, useDatasetFields, useInputMarkings, type Policy } from './api'

const STEPS = ['Save as', 'Compose a granular policy', 'Review access requirements', 'Summary'] as const

export function CreateRestrictedViewDialog({ datasetId, datasetName, onClose }: {
  datasetId: string
  datasetName: string
  onClose: () => void
}) {
  const create = useCreateRestrictedView()
  const { data: projects = [] } = useProjects()
  const { data: columns = [] } = useDatasetFields(datasetId)
  const { data: inputMarkings = [] } = useInputMarkings(datasetId)

  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [policy, setPolicy] = useState<Policy>({ match: 'all', rules: [] })
  const [severed, setSevered] = useState<string[]>([])

  const apiName = toSlug(name)
  const stepDone = [
    apiName !== '' && projectId !== '',
    policy.rules.length > 0,
    true,
    true,
  ][step]

  const submit = () => {
    create.mutate(
      { apiName, name: name.trim(), projectId, inputDatasetId: datasetId, policy, severedMarkingIds: severed },
      { onSuccess: onClose })
  }

  return (
    <Dialog isOpen onClose={onClose} title={`Create restricted view from ${datasetName}`}
      style={{ width: 640 }}>
      <DialogBody>
        <div className="flex items-center gap-1 mb-4 flex-wrap">
          {STEPS.map((s, i) => (
            <Tag key={s} minimal intent={i === step ? Intent.PRIMARY : undefined} className="!text-[10px]">
              {i + 1}. {s}
            </Tag>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
              <InputGroup value={name} placeholder="Sales by owner" autoFocus
                onChange={(e) => { setName(e.currentTarget.value) }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Location</span>
              <HTMLSelect value={projectId} onChange={(e) => { setProjectId(e.currentTarget.value) }}>
                <option value="">Pick a project…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </HTMLSelect>
            </label>
            {/* "Typically, you will want to save your restricted view in a
                different Project from the input dataset. This ensures users
                consuming the restricted view can have View permissions on the
                downstream Project." */}
            <p className="text-[11px] text-muted-foreground">
              Typically, save the restricted view in a different project from the input dataset,
              so its consumers can hold View permissions downstream without seeing the input.
            </p>
          </div>
        )}

        {step === 1 && (
          columns.length === 0 ? (
            <Callout intent={Intent.WARNING} className="!text-xs">
              The backing dataset has no committed schema yet, so there are no columns to write rules against.
            </Callout>
          ) : (
            <PolicyComposer policy={policy} columns={columns} onChange={setPolicy} />
          )
        )}

        {step === 2 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              The view inherits the input dataset's markings. With the remove permission on a
              marking, you can un-mark it here — the policy already controls which rows a user sees.
            </p>
            {inputMarkings.length === 0 ? (
              <p className="text-xs text-muted-foreground">The input dataset carries no markings.</p>
            ) : inputMarkings.map((m) => (
              <label key={m.id} className="flex items-center gap-2 text-xs border border-border rounded px-2 py-1.5">
                <Icon icon="shield" size={12} className="text-muted-foreground" />
                <span className="flex-1">{m.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {severed.includes(m.id) ? 'removed from the view' : 'inherited'}
                </span>
                <input type="checkbox" checked={severed.includes(m.id)}
                  onChange={(e) => {
                    setSevered(e.currentTarget.checked
                      ? [...severed, m.id]
                      : severed.filter((x) => x !== m.id))
                  }} />
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-xs">
            <p><b>{name || apiName}</b> in <b>{projects.find((p) => p.id === projectId)?.name ?? '—'}</b>,
              built on <b>{datasetName}</b>.</p>
            <p>Policy: match <b>{policy.match}</b> of {policy.rules.length} rule{policy.rules.length === 1 ? '' : 's'}.</p>
            <p>{severed.length === 0
              ? 'All inherited markings stay on the view.'
              : `${String(severed.length)} marking(s) removed from the view.`}</p>
            <Callout className="!text-[11px]">
              The view is read-only and evaluated per caller at read time; it can back an object
              type, and each user then sees only the objects their attributes allow.
            </Callout>
          </div>
        )}
      </DialogBody>
      <DialogFooter actions={<>
        {step > 0 && <Button onClick={() => { setStep(step - 1) }}>Back</Button>}
        {step < 3
          ? <Button intent={Intent.PRIMARY} disabled={!stepDone} onClick={() => { setStep(step + 1) }}>Next</Button>
          : <Button intent={Intent.PRIMARY} icon="tick" loading={create.isPending} onClick={submit}>Create</Button>}
      </>} />
    </Dialog>
  )
}
