// Define an interface, then mark which types implement it.
//
// A type that doesn't have the shape is shown with the reason and can't be
// ticked — the claim has to be true, and the database enforces that too.

import { useState } from 'react'
import { Button, Card, Checkbox, HTMLSelect, Icon, InputGroup, Intent, Tag, Tooltip } from '@blueprintjs/core'
import {
  conformanceErrors, toSlug, validateInterfaceDraft,
  type InterfacePropertyDef, type ObjectTypeDef, type PropertyType,
} from '@beacon/reality-graph'
import { useInterfaces, useImplementations, useCreateInterface, useDeleteInterface, useSetImplementation } from './hooks'
import { rowToInterface } from './api'

const TYPES: PropertyType[] = ['text', 'number', 'boolean', 'date']

export default function InterfacesSection({ types }: { types: ObjectTypeDef[] }) {
  const interfaces = useInterfaces()
  const impls = useImplementations()
  const create = useCreateInterface()
  const del = useDeleteInterface()
  const setImpl = useSetImplementation()

  const [label, setLabel] = useState('')
  const [props, setProps] = useState<InterfacePropertyDef[]>([{ key: '', label: '', type: 'text' }])

  const draft = { apiName: toSlug(label), label, properties: props.map((p) => ({ ...p, key: toSlug(p.label) })) }
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

      {(interfaces.data ?? []).map((row) => {
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
              <Button size="small" variant="minimal" icon="trash" className="ml-auto"
                onClick={() => { del.mutate(row.id) }} />
            </div>
            <div className="flex flex-wrap gap-x-4">
              {types.map((t) => {
                const why = conformanceErrors(t, iface)
                const on = implemented(t.id, row.id)
                const box = (
                  <Checkbox key={t.id} checked={on} disabled={why.length > 0 && !on} className="!mb-0.5"
                    onChange={() => { setImpl.mutate({ objectTypeId: t.id, interfaceId: row.id, on: !on }) }}
                    labelElement={<span className="text-[11px]">{t.label}</span>} />
                )
                return why.length > 0
                  ? <Tooltip key={t.id} content={why[0]} compact>{box}</Tooltip>
                  : box
              })}
            </div>
          </div>
        )
      })}

      <div className="space-y-1.5 border-t pt-2">
        <div className="flex items-center gap-2">
          <InputGroup size="small" placeholder="Interface name (e.g. Roomed)" value={label}
            onChange={(e) => { setLabel(e.currentTarget.value) }} style={{ width: 200 }} />
          {label.trim() !== '' && <Tag minimal className="!text-[10px] font-mono">{toSlug(label)}</Tag>}
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
            onClick={() => { setProps([...props, { key: '', label: '', type: 'text' }]) }}>Add property</Button>
          <Button size="small" intent={Intent.PRIMARY} icon="floppy-disk" loading={create.isPending}
            disabled={errors.length > 0}
            onClick={() => {
              create.mutate(
                { apiName: toSlug(label), label: label.trim(), description: '', properties: draft.properties },
                { onSuccess: () => { setLabel(''); setProps([{ key: '', label: '', type: 'text' }]) } },
              )
            }}>
            Create interface
          </Button>
          {label.trim() !== '' && errors.length > 0 && (
            <span className="text-[11px] text-amber-600">{errors[0]}</span>
          )}
        </div>
      </div>
    </Card>
  )
}
