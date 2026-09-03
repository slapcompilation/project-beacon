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
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
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
  // A function rule targets no object type; where such an action belongs is
  // documented only by the card's own provenance line, so it appears on the
  // types its function DECLARES edits on. Inference, operator-approved.
  const versionIds = actions.flatMap((a) =>
    a.action_type_rules.filter((r) => r.kind === 'function' && r.function_version_id)
      .map((r) => r.function_version_id as string))
  const { data: provenance = {} } = useQuery({
    queryKey: ['edit-provenance', objectTypeId, [...versionIds].sort().join(',')],
    enabled: versionIds.length > 0,
    queryFn: async (): Promise<Record<string, string[]>> => {
      const [{ data: vs }, { data: me }] = await Promise.all([
        supabase.from('function_versions').select('id, edits').in('id', versionIds),
        supabase.from('object_types').select('api_name').eq('id', objectTypeId).single(),
      ])
      const mine = (me as { api_name: string } | null)?.api_name
      return Object.fromEntries(((vs ?? []) as { id: string; edits: { object_types?: string[] } }[])
        .map((v) => [v.id, mine !== undefined && (v.edits.object_types ?? []).includes(mine) ? [mine] : []]))
    },
  })
  const relevant = actions.filter((a) =>
    a.status !== 'deprecated'
    && a.action_type_rules.some((r) => r.object_type_id === objectTypeId
      || (r.kind === 'function' && r.function_version_id !== null
          && (provenance[r.function_version_id] ?? []).length > 0)))
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
          objectTypeId={objectTypeId} onClose={() => { setRunning(null) }} />
      )}
    </>
  )
}

// Exported since F6.5/F9: the OMA's Apply reuses THIS dialog, so both apply
// surfaces agree about what the form is — sections, defaults, overrides,
// through the one resolver.
export function RunActionDialog({ action, targets, selectedRow, objectTypeId, onClose }: {
  action: ActionTypeRow
  targets: string[]
  selectedRow: Record<string, unknown> | null
  /** The type the targets belong to — how the selection finds its
   *  object-reference parameter. Absent from the OMA's Apply. */
  objectTypeId?: string
  onClose: () => void
}) {
  const apply = useApplyAction()
  const [values, setValues] = useState<Record<string, string>>({})
  const [runError, setRunError] = useState<string | null>(null)
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

  const functionBacked = action.action_type_rules.some((r) => r.kind === 'function')
  // "a `Demo Ticket` parameter of type Object reference has been created" —
  // the selection reaches a function-backed action through this parameter.
  const objectParam = objectTypeId !== undefined
    ? action.action_type_parameters.find((p) => p.data_kind === 'object' && p.object_type_id === objectTypeId)
    : undefined

  // prefill once, when the effective form first arrives: static values
  // directly, object-property values from the one selected row, and the one
  // selected object into its object-reference parameter
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
    if (objectParam !== undefined && targets.length === 1) next[objectParam.api_name] = targets[0]
    setPrefills(next)
    if (Object.keys(next).length > 0) setValues((prev) => ({ ...next, ...prev }))
  }, [form, action, selectedRow, targets, prefills, objectParam])

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

  // invoke wraps every non-2xx as a generic FunctionsHttpError; the named
  // error action-apply returned is the response body, on error.context.
  const invokeOnce = async (parameters: Record<string, string>): Promise<number> => {
    const res = await supabase.functions.invoke('action-apply', {
      body: { actionTypeId: action.id, parameters },
    }) as { data: unknown; error: { message: string; context?: unknown } | null }
    if (res.error) {
      const ctx = res.error.context
      const named = ctx instanceof Response
        ? await ctx.json().then((b: { error?: string; detail?: string }) =>
            b.error !== undefined ? `${b.error}${b.detail !== undefined ? ` — ${b.detail}` : ''}` : null)
          .catch(() => null)
        : null
      throw new Error(named ?? res.error.message)
    }
    const body = res.data as { error?: string; written?: number } | null
    if (body?.error !== undefined) throw new Error(body.error)
    return body?.written ?? 0
  }

  const run = async () => {
    setBusy(true)
    setRunError(null)
    try {
      if (functionBacked) {
        // "The only way to update objects using a function is by configuring
        // an action to use the function" — apply_action is SQL and cannot run
        // TypeScript, so this door goes through the isolate. One apply per
        // selected object, the same reading of the selection as the SQL branch.
        let written = 0
        if (objectParam !== undefined && effTargets.length > 1) {
          for (const pk of effTargets) {
            written += await invokeOnce({ ...values, [objectParam.api_name]: pk })
          }
        } else {
          written = await invokeOnce(values)
        }
        toast.success(`${action.label} applied — ${written} edit${written === 1 ? '' : 's'}`)
      } else if (!targeted) {
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
    } catch (e) {
      // The SQL branch's named error is also toasted by useApplyAction; the
      // function branch has only this surface, so the dialog stays open and
      // says what refused.
      setRunError(e instanceof Error ? e.message : String(e))
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
          {(targeted || (functionBacked && objectParam !== undefined && targets.length > 0)) && (
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
          {(runError !== null || apply.error) && (
            <Callout intent={Intent.DANGER} className="!text-[11px]">
              {runError ?? apply.error?.message}
            </Callout>
          )}
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
