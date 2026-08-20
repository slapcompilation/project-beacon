// One definition of `cost`, used by several object types. Foundry: "update
// metadata in one place instead of on each object type" — so editing here moves
// every type that inherits it, which is the whole point and worth showing.
//
// Its own page now (§6.9 lists Shared Properties among the resource pages
// reachable from the sidebar); the form and the list are unchanged.

import { useState } from 'react'
import { Button, Card, HTMLSelect, Icon, InputGroup, Intent, Tag } from '@blueprintjs/core'
import { PROPERTY_TYPES, toSlug, usedBy, type PropertyType } from '@beacon/ontology'
import {
  useSharedProperties, useCreateSharedProperty, useDeleteSharedProperty,
} from '@/features/objectTypes/sharedProperties'
import { NoOntologyCallout } from '@/features/ontologies/OntologyPicker'
import { SectionHead } from '@/features/ontologyManager/OmaLayout'
import { useOmaOntology, useOmaTypes } from '@/features/ontologyManager/resources'

export default function SharedPropertiesPage() {
  const { ontology, isLoading } = useOmaOntology()
  const { types } = useOmaTypes()
  const { data: all } = useSharedProperties()
  const create = useCreateSharedProperty()
  const del = useDeleteSharedProperty()
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
                return (
                  <li key={d.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <Icon icon="globe" size={11} className="text-violet-500 shrink-0" />
                    <span className="font-medium">{d.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">{d.apiName}</span>
                    <Tag minimal>{d.baseType}</Tag>
                    <span className="flex-1 truncate text-muted-foreground">{d.description}</span>
                    <Tag minimal intent={consumers.length > 0 ? Intent.PRIMARY : Intent.NONE}
                      title={consumers.map((t) => t.label).join(', ') || 'Not used by any object type yet'}>
                      {consumers.length} type{consumers.length === 1 ? '' : 's'}
                    </Tag>
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
