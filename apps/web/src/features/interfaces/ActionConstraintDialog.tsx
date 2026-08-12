// The "Action type constraint" dialog, from its screenshot: a parameter
// table (Type · Single/List · Name · API name · Required), parameters
// addable from existing interface properties, then metadata and the
// Requiredness toggle — "Whether implementing object types must define an
// action type that satisfies this constraint."

import { useState } from 'react'
import {
  Button, Checkbox, Dialog, DialogBody, DialogFooter, HTMLSelect, InputGroup,
  Intent, Menu, MenuDivider, MenuItem, Popover, Switch, TextArea,
} from '@blueprintjs/core'
import { PROPERTY_TYPES, toCamel } from '@beacon/ontology'
import { useStageClauses } from './hooks'
import type { ActionConstraintRow, InterfaceRow, ParameterConstraintDraft } from './api'

const PARAMETER_KINDS = [
  ...PROPERTY_TYPES.map((t) => ({ value: t.value as string, label: t.label })),
  { value: 'object_reference', label: 'Object reference' },
  { value: 'interface_reference', label: 'Interface reference' },
  { value: 'object_set', label: 'Object set' },
]

export function ActionConstraintDialog({ row, existing, onClose }: {
  row: InterfaceRow
  existing: ActionConstraintRow | null
  onClose: () => void
}) {
  const stage = useStageClauses()
  const [displayName, setDisplayName] = useState(existing?.display_name ?? '')
  const [apiName, setApiName] = useState(existing?.api_name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [required, setRequired] = useState(existing?.required ?? false)
  const [params, setParams] = useState<ParameterConstraintDraft[]>(
    existing?.interface_action_parameter_constraints ?? [])

  const setParam = (i: number, patch: Partial<ParameterConstraintDraft>) => {
    setParams(params.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  }
  const addBlank = () => {
    setParams([...params, { api_name: '', display_name: '', base_type: 'string', is_list: false, required: true }])
  }
  // "Adding parameters from interface properties creates parameter constraints
  // based on the selected properties' display names, types, and required
  // status. The parameter API names are generated from the display names."
  const addFromProperty = (p: InterfaceRow['interface_properties'][number]) => {
    setParams((prev) => [...prev, {
      api_name: toCamel(p.display_name), display_name: p.display_name,
      base_type: p.base_type, is_list: false, required: p.required,
    }])
  }
  const finalApi = apiName || toCamel(displayName)
  const ready = displayName.trim() !== '' && finalApi !== ''
    && params.every((x) => x.display_name.trim() !== '')

  const save = () => {
    const element: ActionConstraintRow = {
      api_name: finalApi, display_name: displayName.trim(), description: description.trim(),
      required,
      parameters: params.map((x, i) => ({
        api_name: x.api_name || toCamel(x.display_name), display_name: x.display_name.trim(),
        base_type: x.base_type, is_list: x.is_list, required: x.required, position: i,
      })),
    }
    // The full set travels; elements not being edited go through untouched —
    // no `parameters` key on them means their parameters stay as they are.
    const others = row.interface_action_constraints
      .filter((c) => c.api_name !== (existing?.api_name ?? finalApi))
      .map(({ interface_action_parameter_constraints: _drop, ...keep }) => keep)
    stage.mutate({ id: row.id, patch: { action_constraints: [...others, element] } },
      { onSuccess: onClose })
  }

  return (
    <Dialog isOpen onClose={onClose} title="Action type constraint" style={{ width: 640 }}>
      <DialogBody>
        <div className="space-y-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Parameter configuration</span>
            {params.map((x, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5 mt-1">
                <HTMLSelect value={x.base_type} onChange={(e) => { setParam(i, { base_type: e.currentTarget.value }) }}>
                  {PARAMETER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                </HTMLSelect>
                <HTMLSelect value={x.is_list ? 'list' : 'single'}
                  onChange={(e) => { setParam(i, { is_list: e.currentTarget.value === 'list' }) }}>
                  <option value="single">Single</option>
                  <option value="list">List</option>
                </HTMLSelect>
                <InputGroup size="small" placeholder="Name" value={x.display_name}
                  onChange={(e) => { setParam(i, { display_name: e.currentTarget.value }) }} />
                <InputGroup size="small" placeholder={toCamel(x.display_name) || 'apiName'}
                  value={x.api_name} className="font-mono max-w-[130px]"
                  onChange={(e) => { setParam(i, { api_name: e.currentTarget.value }) }} />
                <Checkbox className="!mb-0" checked={x.required} label="Required"
                  onChange={(e) => { setParam(i, { required: e.currentTarget.checked }) }} />
                <Button variant="minimal" size="small" icon="cross"
                  onClick={() => { setParams(params.filter((_, j) => j !== i)) }} />
              </div>
            ))}
            <span className="flex gap-1 mt-1.5">
              <Button size="small" variant="minimal" icon="add" onClick={addBlank}>Add parameter</Button>
              {row.interface_properties.length > 0 && (
                <Popover placement="bottom-start" content={
                  <Menu>
                    <MenuDivider title="Existing properties…" />
                    {row.interface_properties.map((p) => (
                      <MenuItem key={p.property_id} text={p.display_name}
                        onClick={() => { addFromProperty(p) }} />
                    ))}
                    <MenuItem text="Add all properties" icon="add-to-artifact"
                      onClick={() => { row.interface_properties.forEach(addFromProperty) }} />
                  </Menu>
                }>
                  <Button size="small" variant="minimal" icon="properties">From properties</Button>
                </Popover>
              )}
            </span>
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Metadata</span>
            <InputGroup placeholder="The name for this action type constraint" value={displayName}
              onChange={(e) => { setDisplayName(e.currentTarget.value) }} />
            <TextArea fill placeholder="Provide a user-readable description explaining the functionality of the action type"
              value={description} onChange={(e) => { setDescription(e.currentTarget.value) }} />
            <InputGroup placeholder={toCamel(displayName) || 'The API name is how this constraint will be referred to in code'}
              value={apiName} className="font-mono"
              onChange={(e) => { setApiName(e.currentTarget.value) }} />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Requiredness</span>
            <Switch className="!mt-1" checked={required}
              label="Required — whether implementing object types must define an action type that satisfies this constraint"
              onChange={(e) => { setRequired(e.currentTarget.checked) }} />
          </div>
        </div>
      </DialogBody>
      <DialogFooter actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button intent={Intent.PRIMARY} disabled={!ready} loading={stage.isPending} onClick={save}>Confirm</Button>
      </>} />
    </Dialog>
  )
}
