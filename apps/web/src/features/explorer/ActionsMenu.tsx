// Apply Actions from an exploration (apply-actions.md): "The current set of
// selected objects in your exploration (or all objects, if none are selected)
// is passed directly to the form, so only other parameters must be
// configured. Note that Actions are unavailable if the number of selected
// objects exceeds 1000." Relevance is the rules: an action belongs here when
// one of its rules touches this object type.

import { useState } from 'react'
import {
  Button, Callout, Dialog, DialogBody, DialogFooter, InputGroup, Intent,
  Menu, MenuDivider, MenuItem, Popover, Tag,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import { useActionTypes, useApplyAction, type ActionTypeRow } from '@/features/actionTypes/api'

const ACTION_CAP = 1000

const needsTarget = (a: ActionTypeRow) =>
  a.action_type_rules.some((r) => r.kind === 'modify_object' || r.kind === 'delete_object')

export function ActionsMenu({ ontologyId, objectTypeId, targets }: {
  ontologyId: string
  objectTypeId: string
  /** Selected primary keys — or every loaded one when nothing is selected. */
  targets: string[]
}) {
  const { data: actions } = useActionTypes(ontologyId)
  const [running, setRunning] = useState<ActionTypeRow | null>(null)
  const relevant = actions.filter((a) =>
    a.status !== 'deprecated'
    && a.action_type_rules.some((r) => r.object_type_id === objectTypeId))
  const overCap = targets.length > ACTION_CAP

  if (relevant.length === 0) return null
  return (
    <>
      <Popover content={
        <Menu>
          {overCap && (
            <>
              <MenuItem disabled text={`Actions are unavailable when more than ${ACTION_CAP} objects are selected`} />
              <MenuDivider />
            </>
          )}
          {relevant.map((a) => (
            <MenuItem key={a.id} icon="take-action" text={a.label} disabled={overCap}
              onClick={() => { setRunning(a) }} />
          ))}
        </Menu>
      }>
        <Button icon="take-action" endIcon="caret-down">Actions</Button>
      </Popover>
      {running && (
        <RunActionDialog action={running} targets={targets}
          onClose={() => { setRunning(null) }} />
      )}
    </>
  )
}

function RunActionDialog({ action, targets, onClose }: {
  action: ActionTypeRow
  targets: string[]
  onClose: () => void
}) {
  const apply = useApplyAction()
  const [values, setValues] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const exposed = action.action_type_parameters
    .filter((p) => p.exposed).sort((a, b) => a.position - b.position)
  const targeted = needsTarget(action)
  const touched = action.action_type_rules
    .map((r) => r.object_type_id).filter((id): id is string => id !== null)

  const run = async () => {
    setBusy(true)
    try {
      if (!targeted) {
        await new Promise<void>((res, rej) => {
          apply.mutate({ actionTypeId: action.id, parameters: values, objectTypeIds: touched },
            { onSuccess: () => { res() }, onError: rej })
        })
      } else {
        // One apply per selected object — the set is what the button meant.
        for (const pk of targets) {
          await new Promise<void>((res, rej) => {
            apply.mutate({ actionTypeId: action.id, parameters: values,
              primaryKey: pk, objectTypeIds: touched },
              { onSuccess: () => { res() }, onError: rej })
          })
        }
        toast.success(`${action.label} applied to ${targets.length} object${targets.length === 1 ? '' : 's'}`)
      }
      onClose()
    } catch {
      // useApplyAction already toasts the named error.
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog isOpen title={action.label} icon="take-action" onClose={onClose}>
      <DialogBody>
        <div className="space-y-2">
          {action.description && <p className="text-xs text-muted-foreground">{action.description}</p>}
          {targeted && (
            <Tag minimal round>
              Applies to {targets.length} object{targets.length === 1 ? '' : 's'}
            </Tag>
          )}
          {exposed.map((p) => (
            <label key={p.id} className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {p.display_name}{p.required && <span className="text-red-600"> *</span>}
              </span>
              <InputGroup size="small" value={values[p.api_name] ?? ''} disabled={!p.editable}
                onChange={(e) => { setValues({ ...values, [p.api_name]: e.currentTarget.value }) }} />
            </label>
          ))}
          {targeted && targets.length === 0 && (
            <Callout intent={Intent.WARNING} className="!text-[11px]">
              This action modifies objects — select rows in Results, or clear filters that leave nothing.
            </Callout>
          )}
          {apply.error && <Callout intent={Intent.DANGER} className="!text-[11px]">{apply.error.message}</Callout>}
        </div>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button variant="minimal" onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} icon="play" loading={busy}
            disabled={targeted && targets.length === 0}
            onClick={() => { void run() }}>
            Apply
          </Button>
        </>
      } />
    </Dialog>
  )
}
