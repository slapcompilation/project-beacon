// The Struct fields section, for every struct property on a type.
//
// Foundry draws this inside the Property editor panel. Ours is a card on the
// type instead, because our Properties step is a draft-and-save editor while
// struct fields are their own rows written immediately — mixing the two would
// mean a field that looks saved and is not. A scoped divergence, stated here
// and in 633.
import { useState } from 'react'
import { Button, Callout, Card, HTMLSelect, HTMLTable, InputGroup, Intent, Tag } from '@blueprintjs/core'
import type { PropertyDef } from '@beacon/ontology'
import {
  STRUCT_FIELD_TYPES, useAddStructField, useRemoveStructField, useStructFields,
  type StructFieldType,
} from '@/features/objectTypes/structFields'

export function StructFieldsCard({ properties }: { properties: PropertyDef[] }) {
  const structs = properties.filter((p) => p.type === 'struct' && p.id)
  const ids = structs.map((p) => p.id as string)
  const { data: fields = [] } = useStructFields(ids)
  if (structs.length === 0) return null

  return (
    <Card compact className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Struct fields</h3>
        <Tag minimal className="tabular-nums">{structs.length}</Tag>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        A struct has a depth of one, so a field cannot itself be a struct. Twelve field types
        are available.
      </p>
      {structs.map((p) => (
        <StructProperty key={p.id} property={p}
          fields={fields.filter((f) => f.property_id === p.id)} />
      ))}
    </Card>
  )
}

function StructProperty({ property, fields }: {
  property: PropertyDef
  fields: ReturnType<typeof useStructFields>['data'] & object
}) {
  const add = useAddStructField()
  const remove = useRemoveStructField()
  const [apiName, setApiName] = useState('')
  const [label, setLabel] = useState('')
  const [type, setType] = useState<StructFieldType>('string')
  const [column, setColumn] = useState('')

  const ready = /^[a-z][A-Za-z0-9]*$/.test(apiName) && label.trim().length > 0

  return (
    <div className="space-y-2 border-t pt-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold">{property.label}</span>
        <span className="text-xs text-muted-foreground">{property.apiName}</span>
      </div>

      {fields.length === 0 ? (
        // "Structs must have at least 1 field" — a violation rather than a
        // refusal, so the property exists in this state and the card says why.
        <Callout intent={Intent.WARNING} className="!text-xs">
          No fields yet. A struct property must have at least one, and shows in Health issues
          until it does.
        </Callout>
      ) : (
        <HTMLTable compact className="w-full text-xs">
          <thead><tr><th>Field</th><th>Type</th><th>Column</th><th /></tr></thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id}>
                <td>{f.display_name} <span className="text-muted-foreground">{f.api_name}</span></td>
                <td><Tag minimal>{f.field_type}</Tag></td>
                <td className="text-muted-foreground">{f.backing_column ?? '—'}</td>
                <td className="text-right">
                  <Button variant="minimal" size="small" icon="cross"
                    onClick={() => { remove.mutate(f.id) }} />
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Name</span>
          <InputGroup size="small" value={label} onValueChange={setLabel} placeholder="Street" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">API name</span>
          <InputGroup size="small" value={apiName} onValueChange={setApiName} placeholder="street" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Type</span>
          <HTMLSelect value={type}
            onChange={(e) => { setType(e.currentTarget.value as StructFieldType) }}>
            {STRUCT_FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </HTMLSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold">Backing column</span>
          <InputGroup size="small" value={column} onValueChange={setColumn} placeholder="optional" />
        </label>
        <Button icon="add" disabled={!ready || add.isPending}
          onClick={() => {
            add.mutate({
              propertyId: property.id as string,
              apiName, displayName: label.trim(), fieldType: type,
              backingColumn: column.trim() || null,
              position: fields.length,
            }, { onSuccess: () => { setApiName(''); setLabel(''); setColumn('') } })
          }}>Add field</Button>
      </div>
    </div>
  )
}
