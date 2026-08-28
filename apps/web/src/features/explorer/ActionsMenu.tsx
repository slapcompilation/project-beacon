// Apply Actions from an exploration (apply-actions.md): "The current set of
// selected objects in your exploration (or all objects, if none are selected)
// is passed directly to the form, so only other parameters must be
// configured. Note that Actions are unavailable if the number of selected
// objects exceeds 1000." Relevance is the rules: an action belongs here when
// one of its rules touches this object type.

import { useEffect, useMemo, useState } from 'react'
import {
  Button, Callout, Collapse, Dialog, DialogBody, DialogFooter, Icon, InputGroup,
  Intent, Menu, MenuDivider, MenuItem, Popover, Tag,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import {
  useActionFormEffective, useActionTypes, useApplyAction, useFormSections,
  type ActionParameterRow, type ActionTypeRow,
} from '@/features/actionTypes/api'

const ACTION_CAP = 1000

const needsTarget = (a: ActionTypeRow) =>
  a.action_type_rules.some((r) => r.kind === 'modify_object' || r.kind === 'delete_object')

export function ActionsMenu({ ontologyId, objectTypeId, targets, selectedRow }: {
  ontologyId: string
  objectTypeId: string
  /** Selected primary keys — or every loaded one when nothing is selected. */
  targets: string[]
  /** The one selected row's data, when exactly one is selected — what an
   *  object-property default prefills from. */
  selectedRow?: Record<string, unknown> | null
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
        <RunActionDialog action={running} targets={targets} selectedRow={selectedRow ?? null}
          onClose={() => { setRunning(null) }} />
      )}
    </>
  )
}

// Exported since F6.5/F9: the OMA's Apply reuses THIS dialog, so both apply
// surfaces agree about what the form is — sections, defaults, overrides,
// through the one resolver.
export function RunActionDialog({ action, targets, selectedRow, onClose }: {
  action: ActionTypeRow
  targets: string[]
  selectedRow: Record<string, unknown> | null
  onClose: () => void
}) {
  const apply = useApplyAction()
  const [values, setValues] = useState<Record<string, string>>({})
  const [prefills, setPrefills] = useState<Record<string, string> | null>(null)
  const [debounced, setDebounced] = useState<Record<string, string>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  // With no selection to act on (the OMA's per-action Apply), the target is
  // typed rather than picked.
  const [manualPk, setManualPk] = useState('')
  const effTargets = targets.length > 0 ? targets : (manualPk.trim() ? [manualPk.trim()] : [])

  // conditions read the values, so the resolver follows them — debounced,
  // because it is a round trip per change
  useEffect(() => {
    const t = setTimeout(() => { setDebounced(values) }, 350)
    return () => { clearTimeout(t) }
  }, [values])
  const { data: form } = useActionFormEffective(action.id, debounced)
  const { data: sectionOrder = [] } = useFormSections(action.id)

  // prefill once, when the effective form first arrives: static values
  // directly, object-property values from the one selected row
  useEffect(() => {
    if (form === undefined || prefills !== null) return
    const next: Record<string, string> = {}
    for (const p of action.action_type_parameters) {
      const d = form.parameters[p.api_name]?.default
      if (d === null || d === undefined) continue
      if (d.source === 'static' && d.value !== null && d.value !== undefined) {
        const dv = d.value
        next[p.api_name] = typeof dv === 'object' ? JSON.stringify(dv) : String(dv as string | number | boolean)
      } else if (d.source === 'object_property' && selectedRow !== null
                 && targets.length === 1 && d.property !== undefined) {
        const v = selectedRow[d.property]
        if (v !== null && v !== undefined) {
          next[p.api_name] = typeof v === 'object' ? JSON.stringify(v) : String(v as string | number | boolean)
        }
      }
    }
    setPrefills(next)
    if (Object.keys(next).length > 0) setValues((prev) => ({ ...next, ...prev }))
  }, [form, action, selectedRow, targets, prefills])

  const targeted = needsTarget(action)
  const touched = action.action_type_rules
    .map((r) => r.object_type_id).filter((id): id is string => id !== null)

  // one ordered list of sections and loose parameters — the Form Content order
  const parameters = useMemo(() =>
    [...action.action_type_parameters].sort((a, b) => a.position - b.position),
  [action])
  const bySection = useMemo(() => {
    const map = new Map<string, ActionParameterRow[]>()
    for (const p of parameters) {
      const sec = form?.parameters[p.api_name]?.section ?? null
      if (sec !== null) map.set(sec, [...(map.get(sec) ?? []), p])
    }
    return map
  }, [parameters, form])
  const loose = parameters.filter((p) => (form?.parameters[p.api_name]?.section ?? null) === null)

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
        for (const pk of effTargets) {
          await new Promise<void>((res, rej) => {
            apply.mutate({ actionTypeId: action.id, parameters: values,
              primaryKey: pk, objectTypeIds: touched },
              { onSuccess: () => { res() }, onError: rej })
          })
        }
        toast.success(`${action.label} applied to ${effTargets.length} object${effTargets.length === 1 ? '' : 's'}`)
      }
      onClose()
    } catch {
      // useApplyAction already toasts the named error.
    } finally {
      setBusy(false)
    }
  }

  const field = (p: ActionParameterRow) => {
    const eff = form?.parameters[p.api_name]
    if (eff !== undefined && !eff.visible) return null
    const required = eff?.required ?? p.required
    const disabled = eff !== undefined ? eff.disabled : !p.editable
    const prefilled = prefills?.[p.api_name]
    const edited = prefilled !== undefined && (values[p.api_name] ?? '') !== prefilled
    return (
      <label key={p.id} className="flex flex-col gap-1">
        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {p.display_name}{required && <span className="text-red-600"> *</span>}
          {/* "the `Lifetime Hours` value shows as edited once this default
              value is updated by the action user" */}
          {edited && <Tag minimal className="!text-[9px] aform-edited">Edited</Tag>}
        </span>
        <InputGroup size="small" value={values[p.api_name] ?? ''} disabled={disabled}
          onChange={(e) => { setValues({ ...values, [p.api_name]: e.currentTarget.value }) }} />
      </label>
    )
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
          {loose.map(field)}
          {sectionOrder.map(({ api_name }) => {
            const sec = form?.sections[api_name]
            if (sec === undefined || !sec.visible) return null
            const members = bySection.get(api_name) ?? []
            if (members.length === 0) return null
            const isCollapsed = collapsed[api_name] ?? false
            return (
              <div key={api_name} className="aform-section">
                {sec.show_title_bar && sec.title !== '' && (
                  <button type="button" className="aform-section-title"
                    disabled={!sec.collapsible}
                    onClick={() => { setCollapsed({ ...collapsed, [api_name]: !isCollapsed }) }}>
                    <span>{sec.title}</span>
                    {sec.collapsible && <Icon icon={isCollapsed ? 'chevron-right' : 'chevron-down'} size={12} />}
                  </button>
                )}
                <Collapse isOpen={!isCollapsed}>
                  {/* "The description is not stylized and ... will always be
                      shown in the section itself, not in a tooltip." */}
                  {sec.description !== '' && (
                    <p className="text-[11px] text-muted-foreground mb-1">{sec.description}</p>
                  )}
                  <div className={sec.columns === 2 ? 'aform-two-col' : 'space-y-2'}>
                    {members.map(field)}
                  </div>
                </Collapse>
              </div>
            )
          })}
          {targeted && targets.length === 0 && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Target primary key <span className="text-red-600">*</span>
              </span>
              <InputGroup size="small" value={manualPk} className="font-mono"
                onChange={(e) => { setManualPk(e.currentTarget.value) }} />
            </label>
          )}
          {apply.error && <Callout intent={Intent.DANGER} className="!text-[11px]">{apply.error.message}</Callout>}
        </div>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button variant="minimal" onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} icon="play" loading={busy}
            disabled={targeted && effTargets.length === 0}
            onClick={() => { void run() }}>
            Apply
          </Button>
        </>
      } />
    </Dialog>
  )
}
