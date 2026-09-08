// The implementing object type's Interfaces tab — its Links and Actions
// sub-tabs.
// "After adding the interface implementation in Ontology Manager, the object
// type's Interfaces tab lists the interface's action type constraints in the
// Actions sub-tab. Select a concrete action type on the implementing object
// type for each required constraint. You may skip or map optional
// constraints." (interfaces/interface-action-type-constraints)
// The link clause is the same shape one step earlier: "you must select a link
// type on the object type that satisfies each required link type constraint"
// (interfaces/implement-interface).

import { useMemo, useState } from 'react'
import {
  Button, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon, Intent, Tag,
} from '@blueprintjs/core'
import type { ObjectTypeDef } from '@beacon/ontology'
import { useInterfaces, useImplementations } from './hooks'
import type { InterfaceRow, LinkConstraintRow } from './api'
import {
  useActionConstraints, useSatisfactions, useSatisfy, useUnsatisfy,
  type ActionConstraintFullRow, type ParameterConstraintRow,
} from './actionConstraints'
import { useLinkSatisfactions, useSatisfyLinks } from './linkConstraints'
import { useActionTypes, type ActionTypeRow } from '@/features/actionTypes/api'
import { useLinkTypes } from '@/features/objectTypes/hooks'
import type { LinkTypeRow } from '@/features/objectTypes/api'

/** Own and inherited, because the obligation includes the inherited clause. */
function withAncestors(id: string, all: InterfaceRow[]): string[] {
  const seen = new Set<string>()
  const walk = (i: string | undefined) => {
    if (!i || seen.has(i)) return
    seen.add(i)
    for (const e of all.find((r) => r.id === i)?.extensions ?? []) walk(e.parent_interface_id)
  }
  walk(id)
  return [...seen]
}

export function InterfacesTab({ type }: { type: ObjectTypeDef }) {
  const { data: interfaces } = useInterfaces()
  const { data: impls = [] } = useImplementations()
  const mine = impls.filter((i) => i.object_type_id === type.id)

  if (mine.length === 0) {
    return <p className="text-xs text-muted-foreground">
      This object type implements no interfaces. Claim one on the Interfaces page.
    </p>
  }
  return (
    <div className="space-y-4">
      {mine.map((impl) => {
        const iface = interfaces.find((r) => r.id === impl.interface_id)
        if (!iface) return null
        return (
          <div key={impl.interface_id} className="space-y-3">
            <InterfaceLinks type={type} iface={iface} all={interfaces} />
            <InterfaceActions type={type} iface={iface} all={interfaces} />
          </div>
        )
      })}
    </div>
  )
}

function InterfaceLinks({ type, iface, all }: {
  type: ObjectTypeDef; iface: InterfaceRow; all: InterfaceRow[]
}) {
  const ids = useMemo(() => withAncestors(iface.id, all), [iface.id, all])
  const { data: links } = useLinkTypes()
  const { data: satisfactions = [] } = useLinkSatisfactions(type.id)
  const { data: impls = [] } = useImplementations()
  const constraints = all.filter((r) => ids.includes(r.id)).flatMap((r) => r.interface_link_constraints)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon icon="layers" size={12} className="text-violet-500" />
        <span className="text-xs font-semibold">{iface.label}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-2">Links</span>
      </div>
      {constraints.length === 0 && (
        <p className="text-xs text-muted-foreground pl-5">This interface declares no link type constraints.</p>
      )}
      {constraints.map((c) => (
        <LinkConstraintRowView key={c.api_name} type={type} iface={iface} constraint={c} links={links}
          impls={impls} allIfaces={all}
          chosen={satisfactions.filter((s) => s.interface_id === iface.id && s.constraint_id === c.id)
            .map((s) => s.link_type_id)} />
      ))}
    </div>
  )
}

/** Client-side mirror of `guard_link_satisfaction`, so the picker offers only
 *  what the database would accept — the guard still has the last word. */
function satisfies(l: LinkTypeRow, typeId: string, c: LinkConstraintRow,
                   impls: { object_type_id: string; interface_id: string }[],
                   allIfaces: InterfaceRow[]): boolean {
  const far = l.source_object_type_id === typeId ? l.target_object_type_id
            : l.target_object_type_id === typeId ? l.source_object_type_id
            : null
  if (far === null) return false
  if (c.target_kind === 'object_type') return far === c.target_object_type_id
  return impls.some((i) => i.object_type_id === far
    && withAncestors(i.interface_id, allIfaces).includes(c.target_interface_id ?? ''))
}

function LinkConstraintRowView({ type, iface, constraint, links, impls, allIfaces, chosen }: {
  type: ObjectTypeDef
  iface: InterfaceRow
  constraint: LinkConstraintRow
  links: LinkTypeRow[]
  impls: { object_type_id: string; interface_id: string }[]
  allIfaces: InterfaceRow[]
  chosen: string[]
}) {
  const satisfy = useSatisfyLinks(type.id)
  const set = (linkTypeIds: string[]) => {
    satisfy.mutate({ interfaceId: iface.id, constraintId: constraint.id, linkTypeIds })
  }
  const candidates = links.filter((l) => satisfies(l, type.id, constraint, impls, allIfaces))

  return (
    <div className="flex flex-wrap items-center gap-2 pl-5 text-xs">
      <Icon icon="link" size={11} className="text-violet-500" />
      <span>{constraint.display_name}</span>
      {constraint.required
        ? <Tag minimal intent={Intent.WARNING}>Required</Tag>
        : <Tag minimal>Optional</Tag>}
      {chosen.map((id) => (
        <Tag key={id} minimal onRemove={() => { set(chosen.filter((x) => x !== id)) }}>
          {links.find((l) => l.id === id)?.label ?? '?'}
        </Tag>
      ))}
      {candidates.length === 0 && chosen.length === 0
        ? <span className="text-muted-foreground">No link on this object type satisfies it — create one first.</span>
        : (
          <HTMLSelect value="" onChange={(e) => { set([...chosen, e.currentTarget.value]) }}>
            <option value="">{constraint.required && chosen.length === 0 ? 'Select a link type…' : 'Add a link type…'}</option>
            {candidates.filter((l) => !chosen.includes(l.id))
              .map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </HTMLSelect>
        )}
    </div>
  )
}

function InterfaceActions({ type, iface, all }: {
  type: ObjectTypeDef; iface: InterfaceRow; all: InterfaceRow[]
}) {
  const ids = useMemo(() => withAncestors(iface.id, all), [iface.id, all])
  const { data: constraints = [] } = useActionConstraints(ids)
  const { data: satisfactions = [] } = useSatisfactions(type.id)
  const { data: actions } = useActionTypes(iface.ontology_id)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon icon="layers" size={12} className="text-violet-500" />
        <span className="text-xs font-semibold">{iface.label}</span>
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-2">Actions</span>
      </div>
      {constraints.length === 0 && (
        <p className="text-xs text-muted-foreground pl-5">This interface declares no action type constraints.</p>
      )}
      {constraints.map((c) => (
        <ConstraintRow key={c.id} type={type} iface={iface} constraint={c}
          actions={actions}
          satisfaction={satisfactions.find((s) => s.interface_id === iface.id && s.constraint_id === c.id) ?? null} />
      ))}
    </div>
  )
}

function ConstraintRow({ type, iface, constraint, actions, satisfaction }: {
  type: ObjectTypeDef
  iface: InterfaceRow
  constraint: ActionConstraintFullRow
  actions: ActionTypeRow[]
  satisfaction: { action_type_id: string; interface_action_parameter_mappings: { parameter_constraint_id: string; action_parameter_id: string }[] } | null
}) {
  const satisfy = useSatisfy(type.id)
  const unsatisfy = useUnsatisfy(type.id)
  const [configuring, setConfiguring] = useState(false)
  const params = constraint.interface_action_parameter_constraints
  const chosen = actions.find((a) => a.id === satisfaction?.action_type_id)

  const choose = (actionTypeId: string) => {
    if (actionTypeId === '') {
      unsatisfy.mutate({ interfaceId: iface.id, constraintId: constraint.id })
      return
    }
    // A new action's parameters need their own mapping; prefill by api name +
    // compatibility, then the dialog confirms.
    const action = actions.find((a) => a.id === actionTypeId)
    const mappings = params.flatMap((pc) => {
      const match = action?.action_type_parameters.find((ap) =>
        compatible(pc, ap) && (ap.api_name === pc.api_name || params.length === 1))
      return match ? [{ parameter_constraint_id: pc.id, action_parameter_id: match.id }] : []
    })
    satisfy.mutate({ interfaceId: iface.id, constraintId: constraint.id, actionTypeId, mappings },
      { onSuccess: () => { if (params.length > mappings.length) setConfiguring(true) } })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pl-5 text-xs">
      <Icon icon="take-action" size={11} className="text-violet-500" />
      <span>{constraint.display_name}</span>
      {constraint.required
        ? <Tag minimal intent={Intent.WARNING}>Required</Tag>
        : <Tag minimal>Optional</Tag>}
      <HTMLSelect value={satisfaction?.action_type_id ?? ''} onChange={(e) => { choose(e.currentTarget.value) }}>
        <option value="">{constraint.required ? 'Select an action type…' : 'Skipped'}</option>
        {actions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
      </HTMLSelect>
      {satisfaction && params.length > 0 && (
        <Button variant="minimal" size="small" icon="cog" title="Configure parameters"
          onClick={() => { setConfiguring(true) }} />
      )}
      {satisfaction && chosen && (
        <ConfigureParametersDialog isOpen={configuring} onClose={() => { setConfiguring(false) }}
          type={type} iface={iface} constraint={constraint} action={chosen} satisfaction={satisfaction} />
      )}
    </div>
  )
}

/** Client-side mirror of the mapping guard, so the dialog offers only what the
 *  database would accept — the guard still has the last word. */
function compatible(pc: ParameterConstraintRow, ap: ActionTypeRow['action_type_parameters'][number]): boolean {
  if (pc.base_type === 'object_reference') return ap.object_type_id !== null
  if (pc.base_type === 'interface_reference' || pc.base_type === 'object_set') return false
  if (pc.required && !ap.required) return false
  return ap.base_type === pc.base_type
}

function ConfigureParametersDialog({ isOpen, onClose, type, iface, constraint, action, satisfaction }: {
  isOpen: boolean
  onClose: () => void
  type: ObjectTypeDef
  iface: InterfaceRow
  constraint: ActionConstraintFullRow
  action: ActionTypeRow
  satisfaction: { action_type_id: string; interface_action_parameter_mappings: { parameter_constraint_id: string; action_parameter_id: string }[] }
}) {
  const satisfy = useSatisfy(type.id)
  const params = constraint.interface_action_parameter_constraints
  const [picks, setPicks] = useState<Record<string, string>>(() =>
    Object.fromEntries(satisfaction.interface_action_parameter_mappings
      .map((m) => [m.parameter_constraint_id, m.action_parameter_id])))
  const ready = params.every((pc) => !pc.required || picks[pc.id])

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Configure parameters" icon="cog" style={{ width: 480 }}>
      <DialogBody>
        <p className="text-xs text-muted-foreground mb-2">
          Map each required parameter constraint to a compatible required parameter on {action.label}.
        </p>
        <div className="space-y-1.5">
          {params.map((pc) => {
            const candidates = action.action_type_parameters.filter((ap) => compatible(pc, ap))
            return (
              <div key={pc.id} className="flex items-center gap-2 text-xs">
                <span className="w-32 font-medium">{pc.display_name}</span>
                <Tag minimal>{pc.base_type}{pc.is_list ? ' list' : ''}</Tag>
                {pc.required && <span className="text-red-600">*</span>}
                <HTMLSelect value={picks[pc.id] ?? ''} onChange={(e) => {
                  const v = e.currentTarget.value
                  setPicks((p) => {
                    const next = Object.fromEntries(Object.entries(p).filter(([k]) => k !== pc.id))
                    if (v !== '') next[pc.id] = v
                    return next
                  })
                }}>
                  <option value="">{pc.required ? 'Map a parameter…' : 'Not mapped'}</option>
                  {candidates.map((ap) => <option key={ap.id} value={ap.id}>{ap.display_name}</option>)}
                </HTMLSelect>
              </div>
            )
          })}
        </div>
      </DialogBody>
      <DialogFooter actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button intent={Intent.PRIMARY} disabled={!ready} loading={satisfy.isPending}
          onClick={() => {
            satisfy.mutate({
              interfaceId: iface.id, constraintId: constraint.id, actionTypeId: action.id,
              mappings: Object.entries(picks).map(([parameter_constraint_id, action_parameter_id]) =>
                ({ parameter_constraint_id, action_parameter_id })),
            }, { onSuccess: onClose })
          }}>Save</Button>
      </>} />
    </Dialog>
  )
}
