// One definition of `cost`, used by several object types. Foundry: "update
// metadata in one place instead of on each object type" — so editing here moves
// every type that inherits it, which is the whole point and worth showing.
//
// Its own page now (§6.9 lists Shared Properties among the resource pages
// reachable from the sidebar).
//
// Editing was the whole point and was not reachable: `useUpdateSharedProperty`
// was written, typed and called by nothing, so a definition could be created
// and then never changed. The row now edits in place over the three fields
// `save_shared_property` accepts. Foundry's four-tab editor (General / Display
// / Interaction / Details) with its Usage and Permissions tabs is the shape
// this is a subset of, and SURFACE-BUILD-MAP §3.5 keeps that as the open gap.

import { useState } from 'react'
import { Button, Card, HTMLSelect, Icon, InputGroup, Intent, Tag } from '@blueprintjs/core'
import { PROPERTY_TYPES, toSlug, usedBy, type PropertyType } from '@beacon/ontology'
import {
  useSharedProperties, useCreateSharedProperty, useDeleteSharedProperty,
  useUpdateSharedProperty,
} from '@/features/objectTypes/sharedProperties'
import type { SharedProperty } from '@/features/objectTypes/sharedProperties'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'

export default function SharedPropertiesPage() {
  const { ontology, isLoading } = useOmaOntology()
  const { types } = useOmaTypes()
  const { data: all } = useSharedProperties()
  const create = useCreateSharedProperty()
  const del = useDeleteSharedProperty()
  const [editing, setEditing] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [baseType, setBaseType] = useState<PropertyType>('string')
  const apiName = toSlug(label)

  if (!ontology) {
    return <div className="oma-page max-w-2xl">{isLoading ? null : <NoOntologyCallout />}</div>
  }
  const defs = all.filter((d) => d.ontologyId === ontology.id)

  return (
    <div className="oma-page">
      <SectionHead title="Shared Properties" count={defs.length} />
      <p className="text-sm text-muted-foreground max-w-2xl mb-5">
        One definition used by several object types. The metadata is shared — the data is not;
        each type still stores its own values. Editing a definition moves every property that
        inherits from it.
      </p>

      <div className="max-w-4xl space-y-2">
        <Card compact className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 flex-1 min-w-40">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</span>
            <InputGroup size="small" value={label} placeholder="Cost"
              onChange={(e) => { setLabel(e.currentTarget.value) }} />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-56">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description</span>
            <InputGroup size="small" value={description} placeholder="What it cost us, in the property currency"
              onChange={(e) => { setDescription(e.currentTarget.value) }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Base type</span>
            <HTMLSelect value={baseType} onChange={(e) => { setBaseType(e.currentTarget.value as PropertyType) }}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </HTMLSelect>
          </label>
          <Button size="small" icon="add" intent={Intent.PRIMARY} loading={create.isPending}
            disabled={!apiName || defs.some((d) => d.apiName === apiName)}
            onClick={() => {
              create.mutate(
                { apiName, label: label.trim(), description: description.trim(), baseType, ontologyId: ontology.id },
                { onSuccess: () => { setLabel(''); setDescription('') } })
            }}>
            Create
          </Button>
        </Card>

        {defs.length > 0 && (
          <Card compact className="!p-0">
            <ul className="divide-y divide-border/30">
              {defs.map((d) => {
                const consumers = usedBy(d.id, types)
                if (editing === d.id) {
                  return <EditRow key={d.id} def={d} consumers={consumers.length}
                    onDone={() => { setEditing(null) }} />
                }
                return (
                  <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <Icon icon="globe" size={11} className="text-violet-500 shrink-0" />
                    <span className="font-medium">{d.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{d.apiName}</span>
                    <Tag minimal>{d.baseType}</Tag>
                    {/* Stored since 329 and printed nowhere until now — the
                        capture's third column is VISIBILITY. */}
                    <Tag minimal icon={d.visibility === 'hidden' ? 'eye-off' : 'eye-open'}
                      intent={d.visibility === 'prominent' ? Intent.PRIMARY : Intent.NONE}>
                      {VISIBILITY_LABEL[d.visibility]}
                    </Tag>
                    <span className="flex-1 truncate text-muted-foreground">{d.description}</span>
                    <Tag minimal intent={consumers.length > 0 ? Intent.PRIMARY : Intent.NONE}
                      title={consumers.map((t) => t.label).join(', ') || 'Not used by any object type yet'}>
                      {consumers.length} type{consumers.length === 1 ? '' : 's'}
                    </Tag>
                    <Button variant="minimal" size="small" icon="edit" title="Edit"
                      onClick={() => { setEditing(d.id) }} />
                    <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
                      disabled={consumers.length > 0}
                      title={consumers.length > 0 ? `Used by ${consumers.map((t) => t.label).join(', ')} — detach it there first.` : undefined}
                      onClick={() => { del.mutate(d.id) }} />
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}

const VISIBILITY_LABEL: Record<SharedProperty['visibility'], string> = {
  prominent: 'Prominent', normal: 'Normal', hidden: 'Hidden',
}

/** The three fields `save_shared_property` takes. Saving stages the change —
 *  the Save control in the OMA header is what reaches the ontology — and it
 *  moves every object type that inherits the definition, which the toast says. */
function EditRow({ def, consumers, onDone }:
  { def: SharedProperty; consumers: number; onDone: () => void }) {
  const update = useUpdateSharedProperty()
  const [label, setLabel] = useState(def.label)
  const [description, setDescription] = useState(def.description)
  const [visibility, setVisibility] = useState(def.visibility)

  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs bg-muted/30">
      <Icon icon="globe" size={11} className="text-violet-500 shrink-0" />
      <InputGroup size="small" value={label} className="w-40"
        onChange={(e) => { setLabel(e.currentTarget.value) }} />
      <span className="font-mono text-muted-foreground">{def.apiName}</span>
      <HTMLSelect minimal value={visibility}
        onChange={(e) => { setVisibility(e.currentTarget.value as SharedProperty['visibility']) }}>
        {(Object.keys(VISIBILITY_LABEL) as SharedProperty['visibility'][])
          .map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
      </HTMLSelect>
      <InputGroup size="small" value={description} className="flex-1 min-w-40"
        placeholder="Description" onChange={(e) => { setDescription(e.currentTarget.value) }} />
      <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={update.isPending}
        disabled={label.trim() === ''}
        onClick={() => {
          update.mutate({ id: def.id, label: label.trim(), description: description.trim(), visibility },
            { onSuccess: onDone })
        }}>
        Save
      </Button>
      <Button variant="minimal" size="small" onClick={onDone}>Cancel</Button>
      {consumers > 0 && (
        <span className="text-[11px] text-amber-600 w-full">
          This moves {consumers} object type{consumers === 1 ? '' : 's'} that inherit it.
        </span>
      )}
    </li>
  )
}
