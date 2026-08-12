// Define an interface, then mark which types implement it.
//
// A type that doesn't have the shape is shown with the reason and can't be
// ticked — the claim has to be true, and the database enforces that too.

import { useState } from 'react'
import {
  Button, Card, Checkbox, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, Tag,
} from '@blueprintjs/core'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  toSlug, toCamel, toPascal, validateInterfaceDraft, PROPERTY_TYPES,
  type InterfacePropertyDef, type ObjectTypeDef, type PropertyDef, type PropertyType,
} from '@beacon/ontology'
import {
  useInterfaces, useImplementations, useCreateInterface, useDeleteInterface,
  useImplement, useUnimplement, useStageClauses,
} from './hooks'
import { rowToInterface, type InterfaceRow, type MappingDraft } from './api'
import { saveObjectType } from '@/features/objectTypes/api'

const TYPES: PropertyType[] = PROPERTY_TYPES.map((t) => t.value)

export default function InterfacesSection({ types, ontologyId }: {
  types: ObjectTypeDef[]
  /** An interface belongs to one ontology; this is the one the manager is on. */
  ontologyId: string
}) {
  const interfaces = useInterfaces()
  const impls = useImplementations()
  const create = useCreateInterface()
  const del = useDeleteInterface()
  const unimplement = useUnimplement()
  const [wizard, setWizard] = useState<{ type: ObjectTypeDef; row: InterfaceRow } | null>(null)

  const [label, setLabel] = useState('')
  const [props, setProps] = useState<InterfacePropertyDef[]>([{ key: '', label: '', type: 'string' }])

  const draft = { apiName: toPascal(label), label, properties: props.map((p) => ({ ...p, key: toSlug(p.label) })) }
  const errors = validateInterfaceDraft(draft)
  const implemented = (typeId: string, ifaceId: string) =>
    (impls.data ?? []).some((i) => i.object_type_id === typeId && i.interface_id === ifaceId)

  return (
    <Card className="space-y-3">
      <div>
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Interfaces</span>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          A shape several types share. A tool or agent written against an interface works on every type that
          implements it — including ones you author later.
        </p>
      </div>

      {interfaces.data.filter((row) => row.ontology_id === ontologyId).map((row) => {
        const iface = rowToInterface(row)
        return (
          <div key={row.id} className="rounded border px-2 py-1.5 space-y-1">
            <div className="flex items-center gap-2">
              <Icon icon="layers" size={12} className="text-violet-500" />
              <span className="text-xs font-semibold">{iface.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{iface.apiName}</span>
              <span className="text-[10px] text-muted-foreground">
                {iface.properties.map((p) => `${p.key}:${p.type}`).join(' · ')}
              </span>
              {/* An active interface cannot be deleted; say so rather than
                  surfacing the database exception as a toast. */}
              <Button size="small" variant="minimal" icon="trash" className="ml-auto"
                onClick={() => { del.mutate(row.id) }} />
            </div>
            <div className="flex flex-wrap gap-x-4">
              {/* Ticking opens the mapping wizard — an implementation is a set
                  of declared resolutions, not a bare row. */}
              {types.map((t) => {
                const on = implemented(t.id, row.id)
                return (
                  <Checkbox key={t.id} checked={on} className="!mb-0.5"
                    onChange={() => {
                      if (on) unimplement.mutate({ objectTypeId: t.id, interfaceId: row.id })
                      else setWizard({ type: t, row })
                    }}
                    labelElement={<span className="text-[11px]">{t.label}</span>} />
                )
              })}
            </div>
            <ContractPanel row={row} all={interfaces.data.filter((r) => r.ontology_id === ontologyId)} types={types} />
          </div>
        )
      })}

      <NewInterfaceForm ontologyId={ontologyId} create={create} label={label} setLabel={setLabel}
        props={props} setProps={setProps} draft={draft} errors={errors} />

      {wizard && (
        <MappingWizard type={wizard.type} row={wizard.row} all={interfaces.data}
          onClose={() => { setWizard(null) }} />
      )}
    </Card>
  )
}

/** The creation half of choose_backing_column and edit_only: stage the new
 *  properties onto the implementing type, full list travelling as always. */
function useStageCreatedProperties() {
  const qc = useQueryClient()
  return (type: ObjectTypeDef, props: InterfaceRow['interface_properties'], drafts: MappingDraft[]) => {
    const created: PropertyDef[] = drafts
      .filter((d) => (d.resolution === 'choose_backing_column' || d.resolution === 'edit_only')
        && !type.properties.some((tp) => tp.key === d.property_id))
      .map((d) => {
        const p = props.find((x) => x.property_id === d.property_id)
        if (!p) return null
        return {
          key: p.property_id, apiName: toCamel(p.display_name), label: p.display_name,
          type: p.base_type, required: p.required,
          source: d.resolution === 'edit_only' ? 'user_input' as const : 'column' as const,
          backingColumn: d.resolution === 'edit_only' ? null : d.backing_column,
          // A new column-backed property reads the datasource its siblings do.
          datasourceId: type.properties.find((tp) => tp.datasourceId)?.datasourceId ?? null,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
    if (created.length === 0) return
    void saveObjectType({
      id: type.id, label: type.label, icon: type.icon, description: type.description,
      properties: [...type.properties, ...created],
    }).then(() => {
      void qc.invalidateQueries({ queryKey: ['object-types'] })
      void qc.invalidateQueries({ queryKey: ['working-state'] })
      toast.success(`${String(created.length)} propert${created.length === 1 ? 'y' : 'ies'} staged on ${type.label} — save to add them`)
    }).catch((e: unknown) => { toast.error(e instanceof Error ? e.message : String(e)) })
  }
}

/** The interface's properties, own and inherited — the conformance obligation
 *  "includes the inherited clause". */
function contractProperties(row: InterfaceRow, all: InterfaceRow[]): InterfaceRow['interface_properties'] {
  const seen = new Set<string>()
  const out: InterfaceRow['interface_properties'] = []
  const walk = (r: InterfaceRow | undefined) => {
    if (!r || seen.has(r.id)) return
    seen.add(r.id)
    out.push(...r.interface_properties)
    for (const e of r.extensions) walk(all.find((i) => i.id === e.parent_interface_id))
  }
  walk(row)
  return out
}

/** The wizard's five menu items, per interface property. "choose_backing_column
 *  and edit_only create a property on the implementing type at apply time; that
 *  creation is the surface's job" — so submitting stages those properties onto
 *  the type, and they land with the next save. */
function MappingWizard({ type, row, all, onClose }: {
  type: ObjectTypeDef; row: InterfaceRow; all: InterfaceRow[]; onClose: () => void
}) {
  const implement = useImplement()
  const stageProps = useStageCreatedProperties()
  const props = contractProperties(row, all)
  const [drafts, setDrafts] = useState<MappingDraft[]>(() => props.map((p) => {
    // Prefill: an existing property with the same name and base type maps itself.
    const match = type.properties.find((tp) =>
      (tp.key === p.property_id || tp.apiName === p.property_id) && tp.type === p.base_type)
    if (match) return { property_id: p.property_id, resolution: 'choose_existing', object_property_id: match.id }
    return { property_id: p.property_id, resolution: p.required ? 'edit_only' : 'skip' }
  }))

  const set = (i: number, patch: Partial<MappingDraft>) => {
    setDrafts(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  }
  const ready = drafts.every((d) =>
    (d.resolution !== 'choose_existing' && d.resolution !== 'replace_existing') || d.object_property_id)
    && drafts.every((d) => d.resolution !== 'choose_backing_column' || d.backing_column)

  return (
    <Dialog isOpen onClose={onClose} title={`Implement ${row.label} on ${type.label}`} style={{ width: 560 }}>
      <DialogBody>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Declare how {type.label} satisfies each interface property. The database refuses the
            claim unless every required property has a non-skip resolution that matches.
          </p>
          {props.map((p, i) => {
            const d = drafts[i]
            const candidates = type.properties.filter((tp) => tp.type === p.base_type)
            return (
              <div key={p.property_id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-medium w-32">{p.display_name}{p.required && <span className="text-red-500"> *</span>}</span>
                <Tag minimal className="!text-[10px]">{p.base_type}</Tag>
                <HTMLSelect value={d.resolution} onChange={(e) => {
                  set(i, { resolution: e.currentTarget.value as MappingDraft['resolution'],
                           object_property_id: null, backing_column: null })
                }}>
                  <option value="choose_existing">Choose existing property</option>
                  <option value="replace_existing">Replace existing property</option>
                  <option value="choose_backing_column">Choose backing column</option>
                  <option value="edit_only">Edit-only property</option>
                  <option value="skip" disabled={p.required}>Skip</option>
                </HTMLSelect>
                {(d.resolution === 'choose_existing' || d.resolution === 'replace_existing') && (
                  <HTMLSelect value={d.object_property_id ?? ''}
                    onChange={(e) => { set(i, { object_property_id: e.currentTarget.value || null }) }}>
                    <option value="">Property…</option>
                    {candidates.map((tp) => <option key={tp.id} value={tp.id}>{tp.label}</option>)}
                  </HTMLSelect>
                )}
                {d.resolution === 'choose_backing_column' && (
                  <InputGroup size="small" placeholder="Column" value={d.backing_column ?? ''}
                    onChange={(e) => { set(i, { backing_column: e.currentTarget.value }) }} />
                )}
              </div>
            )
          })}
        </div>
      </DialogBody>
      <DialogFooter actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button intent={Intent.PRIMARY} disabled={!ready} loading={implement.isPending}
          onClick={() => {
            implement.mutate(
              { objectTypeId: type.id, interfaceId: row.id, mappings: drafts },
              { onSuccess: () => { stageProps(type, props, drafts); onClose() } })
          }}>
          Implement
        </Button>
      </>} />
    </Dialog>
  )
}

/** The contract's other two clauses, and what this interface extends.
 *  Link constraints "describe expected link capabilities"; action constraints
 *  "describe expected action capabilities that implementing object types can
 *  satisfy with concrete action types" (action-types/actions-on-interfaces). */
function ContractPanel({ row, all, types }: {
  row: InterfaceRow
  all: InterfaceRow[]
  types: ObjectTypeDef[]
}) {
  const [open, setOpen] = useState(false)
  const stage = useStageClauses()
  const [linkName, setLinkName] = useState('')
  const [cardinality, setCardinality] = useState<'ONE' | 'MANY'>('ONE')
  const [target, setTarget] = useState('')
  const [actionName, setActionName] = useState('')
  const nameOf = (id: string | null) =>
    all.find((i) => i.id === id)?.label ?? types.find((t) => t.id === id)?.label ?? '?'

  const addLink = () => {
    // The full set travels — the apply deletes what a listed clause omits.
    const [kind, id] = target.split(':')
    stage.mutate({ id: row.id, patch: { link_constraints: [
      ...row.interface_link_constraints,
      { api_name: toCamel(linkName), display_name: linkName.trim(), required: true, cardinality,
        target_kind: kind as 'interface' | 'object_type',
        target_interface_id: kind === 'interface' ? id : null,
        target_object_type_id: kind === 'object_type' ? id : null },
    ] } }, { onSuccess: () => { setLinkName(''); setTarget('') } })
  }
  const dropLink = (apiName: string) => {
    stage.mutate({ id: row.id, patch: {
      link_constraints: row.interface_link_constraints.filter((c) => c.api_name !== apiName) } })
  }
  const addAction = () => {
    stage.mutate({ id: row.id, patch: { action_constraints: [
      ...row.interface_action_constraints,
      { api_name: toCamel(actionName), display_name: actionName.trim(), description: '', required: true },
    ] } }, { onSuccess: () => { setActionName('') } })
  }
  const dropAction = (apiName: string) => {
    stage.mutate({ id: row.id, patch: {
      action_constraints: row.interface_action_constraints.filter((c) => c.api_name !== apiName) } })
  }
  const parents = row.extensions.map((e) => e.parent_interface_id)
  const setParents = (next: string[]) => { stage.mutate({ id: row.id, patch: { extends: next } }) }

  return (
    <div className="pt-1">
      <Button variant="minimal" size="small" icon={open ? 'chevron-down' : 'chevron-right'}
        onClick={() => { setOpen(!open) }} className="!text-[11px]">
        Contract
        {(row.interface_link_constraints.length > 0 || row.interface_action_constraints.length > 0 || parents.length > 0) &&
          <Tag minimal className="!text-[10px] ml-1">
            {row.interface_link_constraints.length + row.interface_action_constraints.length + parents.length}
          </Tag>}
      </Button>
      {open && (
        <div className="pl-5 pt-1 space-y-2 text-[11px]">
          <div className="space-y-1">
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Link constraints</span>
            {row.interface_link_constraints.map((c) => (
              <div key={c.api_name} className="flex items-center gap-2">
                <Icon icon="link" size={11} className="text-violet-500" />
                <span>{c.display_name}</span>
                <Tag minimal className="!text-[10px]">{c.cardinality}</Tag>
                <span className="text-muted-foreground">→ {nameOf(c.target_interface_id ?? c.target_object_type_id)}</span>
                <Button variant="minimal" size="small" icon="cross" onClick={() => { dropLink(c.api_name) }} />
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <InputGroup size="small" placeholder="Link name" value={linkName}
                onChange={(e) => { setLinkName(e.currentTarget.value) }} style={{ width: 140 }} />
              <HTMLSelect value={cardinality} onChange={(e) => { setCardinality(e.currentTarget.value as 'ONE' | 'MANY') }}>
                <option value="ONE">ONE</option>
                <option value="MANY">MANY</option>
              </HTMLSelect>
              <HTMLSelect value={target} onChange={(e) => { setTarget(e.currentTarget.value) }}>
                <option value="">Target…</option>
                <optgroup label="Interfaces">
                  {all.map((i) => <option key={i.id} value={`interface:${i.id}`}>{i.label}</option>)}
                </optgroup>
                <optgroup label="Object types">
                  {types.map((t) => <option key={t.id} value={`object_type:${t.id}`}>{t.label}</option>)}
                </optgroup>
              </HTMLSelect>
              <Button size="small" icon="add" disabled={!linkName.trim() || !target} onClick={addLink} />
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Action constraints</span>
            {row.interface_action_constraints.map((c) => (
              <div key={c.api_name} className="flex items-center gap-2">
                <Icon icon="take-action" size={11} className="text-violet-500" />
                <span>{c.display_name}</span>
                <Button variant="minimal" size="small" icon="cross" onClick={() => { dropAction(c.api_name) }} />
              </div>
            ))}
            <div className="flex items-center gap-1.5">
              <InputGroup size="small" placeholder="Expected action (e.g. Retire)" value={actionName}
                onChange={(e) => { setActionName(e.currentTarget.value) }} style={{ width: 180 }} />
              <Button size="small" icon="add" disabled={!actionName.trim()} onClick={addAction} />
            </div>
          </div>

          <div className="space-y-1">
            <span className="font-semibold text-muted-foreground uppercase text-[10px] tracking-wide">Extends</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {parents.map((p) => (
                <Tag key={p} minimal className="!text-[10px]"
                  onRemove={() => { setParents(parents.filter((x) => x !== p)) }}>
                  {nameOf(p)}
                </Tag>
              ))}
              <HTMLSelect value="" onChange={(e) => {
                const v = e.currentTarget.value
                if (v) setParents([...parents, v])
              }}>
                <option value="">Extend…</option>
                {all.filter((i) => i.id !== row.id && !parents.includes(i.id)
                  && !i.extensions.some((x) => x.parent_interface_id === row.id))
                  .map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
              </HTMLSelect>
            </div>
            <p className="text-muted-foreground">
              An interface inherits the properties of the interface it extends; deeper cycles and
              name collisions are refused when the save applies.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function NewInterfaceForm({ ontologyId, create, label, setLabel, props, setProps, draft, errors }: {
  ontologyId: string
  create: ReturnType<typeof useCreateInterface>
  label: string
  setLabel: (v: string) => void
  props: InterfacePropertyDef[]
  setProps: (v: InterfacePropertyDef[]) => void
  draft: { apiName: string; label: string; properties: InterfacePropertyDef[] }
  errors: string[]
}) {
  return (
      <div className="space-y-1.5 border-t pt-2">
        <div className="flex items-center gap-2">
          <InputGroup size="small" placeholder="Interface name (e.g. Roomed)" value={label}
            onChange={(e) => { setLabel(e.currentTarget.value) }} style={{ width: 200 }} />
          {label.trim() !== '' && <Tag minimal className="!text-[10px] font-mono">{toPascal(label)}</Tag>}
        </div>
        {props.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground w-14">requires</span>
            <InputGroup size="small" placeholder="Property (e.g. Room)" value={p.label}
              onChange={(e) => { setProps(props.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x))) }} />
            <HTMLSelect value={p.type} onChange={(e) => {
              setProps(props.map((x, j) => (j === i ? { ...x, type: e.currentTarget.value as PropertyType } : x)))
            }} options={TYPES.map((t) => ({ value: t, label: t }))} />
            <Button size="small" variant="minimal" icon="cross" disabled={props.length === 1}
              onClick={() => { setProps(props.filter((_, j) => j !== i)) }} />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button size="small" variant="minimal" icon="add"
            onClick={() => { setProps([...props, { key: '', label: '', type: 'string' }]) }}>Add property</Button>
          <Button size="small" intent={Intent.PRIMARY} icon="floppy-disk" loading={create.isPending}
            disabled={errors.length > 0}
            onClick={() => {
              create.mutate(
                { apiName: toPascal(label), label: label.trim(), description: '', properties: draft.properties, ontologyId },
                { onSuccess: () => { setLabel(''); setProps([{ key: '', label: '', type: 'string' }]) } },
              )
            }}>
            Create interface
          </Button>
          {label.trim() !== '' && errors.length > 0 && (
            <span className="text-[11px] text-amber-600">{errors[0]}</span>
          )}
        </div>
      </div>
  )
}
