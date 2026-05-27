// Inventory: extra fields appended to every product variant.

import { useState } from 'react'
import {
  Alert, Button, Card, HTMLSelect, Icon, InputGroup, Intent, Spinner, SpinnerSize, Switch, Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import {
  useCustomFieldDefs, useCreateCustomFieldDef, useUpdateCustomFieldDef, useDeleteCustomFieldDef,
} from '@/features/custom-fields/hooks'
import type { CustomFieldDef, CustomFieldType } from '@beacon/types'
import { SectionHeader } from './_shared'

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text', number: 'Number', date: 'Date', boolean: 'Yes/No',
}

export function CustomFieldsSection() {
  const { data: fields = [], isLoading } = useCustomFieldDefs()
  const createField = useCreateCustomFieldDef()
  const updateField = useUpdateCustomFieldDef()
  const deleteField = useDeleteCustomFieldDef()
  const [addingOpen, setAddingOpen] = useState(false)
  const [editingField, setEditingField] = useState<CustomFieldDef | null>(null)
  const [addName, setAddName] = useState('')
  const [deleteFieldConfirm, setDeleteFieldConfirm] = useState<{ id: string; name: string } | null>(null)
  const [addType, setAddType] = useState<CustomFieldType>('text')
  const [editName, setEditName] = useState('')
  const [dragFieldId, setDragFieldId] = useState<string | null>(null)
  const [dropFieldId, setDropFieldId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!addName.trim()) return
    await createField.mutateAsync({ name: addName.trim(), field_type: addType })
    setAddName(''); setAddType('text'); setAddingOpen(false)
  }

  const handleSaveEdit = async (field: CustomFieldDef) => {
    if (!editName.trim()) return
    await updateField.mutateAsync({ id: field.id, input: { name: editName.trim() } })
    setEditingField(null)
  }

  const handleFieldDrop = (targetField: CustomFieldDef) => {
    if (!dragFieldId || dragFieldId === targetField.id) return
    const dragged = fields.find((f) => f.id === dragFieldId)
    if (!dragged) return
    updateField.mutate({ id: dragged.id, input: { sort_order: targetField.sort_order } })
    updateField.mutate({ id: targetField.id, input: { sort_order: dragged.sort_order } })
    setDragFieldId(null); setDropFieldId(null)
  }

  return (
    <div>
      <SectionHeader title="Custom Fields" description="Add extra fields to all product variants. Mark as required to enforce data entry. Drag to reorder." />
      <div className="flex justify-end mb-3">
        <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setAddingOpen(true) }}>Add Field</Button>
      </div>
      {addingOpen && (
        <Card compact className="mb-3 !bg-muted/30">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <InputGroup
              placeholder="Field name…"
              value={addName}
              onChange={(e) => { setAddName(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
              autoFocus
            />
            <HTMLSelect
              value={addType}
              onChange={(e) => { setAddType(e.target.value as CustomFieldType) }}
              options={[
                { value: 'text',    label: 'Text' },
                { value: 'number',  label: 'Number' },
                { value: 'date',    label: 'Date' },
                { value: 'boolean', label: 'Yes/No' },
              ]}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setAddingOpen(false) }}>Cancel</Button>
            <Button intent={Intent.PRIMARY} onClick={() => void handleAdd()} disabled={!addName.trim()} loading={createField.isPending}>
              Add Field
            </Button>
          </div>
        </Card>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Spinner size={SpinnerSize.SMALL} />Loading…</div>
      ) : fields.length === 0 && !addingOpen ? (
        <p className="text-sm text-muted-foreground py-4">No custom fields yet.</p>
      ) : fields.length > 0 ? (
        <Card compact className="!p-0 divide-y">
          {fields.map((field) => (
            <div
              key={field.id}
              draggable
              onDragStart={() => { setDragFieldId(field.id) }}
              onDragOver={(e) => { e.preventDefault(); setDropFieldId(field.id) }}
              onDragLeave={() => { setDropFieldId(null) }}
              onDrop={(e) => { e.preventDefault(); handleFieldDrop(field) }}
              onDragEnd={() => { setDragFieldId(null); setDropFieldId(null) }}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 transition-colors',
                dropFieldId === field.id && dragFieldId !== field.id && 'bg-primary/10 ring-1 ring-inset ring-primary/30'
              )}
            >
              <Icon icon="drag-handle-vertical" size={14} className="text-muted-foreground/40 cursor-grab flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {editingField?.id === field.id ? (
                  <InputGroup
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveEdit(field); if (e.key === 'Escape') setEditingField(null) }}
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{field.name}</span>
                    <Tag minimal>{FIELD_TYPE_LABELS[field.field_type]}</Tag>
                    {field.required && (
                      <Tag minimal intent={Intent.DANGER}>Required</Tag>
                    )}
                  </div>
                )}
              </div>
              {editingField?.id === field.id ? (
                <Button size="small" onClick={() => void handleSaveEdit(field)}>Save</Button>
              ) : (
                <>
                  <Switch
                    checked={field.required}
                    onChange={(e) => {
                      updateField.mutate({ id: field.id, input: { required: e.currentTarget.checked } })
                    }}
                    aria-label={`Mark ${field.name} as required`}
                    className="!mb-0"
                  />
                  <Button
                    icon="edit"
                    variant="minimal"
                    size="small"
                    aria-label="Edit field"
                    onClick={() => { setEditingField(field); setEditName(field.name) }}
                  />
                  <Button
                    icon="trash"
                    variant="minimal"
                    size="small"
                    intent={Intent.DANGER}
                    aria-label="Delete field"
                    onClick={() => { setDeleteFieldConfirm({ id: field.id, name: field.name }) }}
                  />
                </>
              )}
            </div>
          ))}
        </Card>
      ) : null}
      <Alert
        isOpen={deleteFieldConfirm !== null}
        intent={Intent.DANGER}
        icon="trash"
        cancelButtonText="Cancel"
        confirmButtonText="Remove"
        onCancel={() => { setDeleteFieldConfirm(null) }}
        onConfirm={() => {
          if (deleteFieldConfirm) deleteField.mutate(deleteFieldConfirm.id)
          setDeleteFieldConfirm(null)
        }}
      >
        <p className="font-semibold mb-1">{`Remove field "${deleteFieldConfirm?.name ?? ''}"?`}</p>
        <p className="text-sm">Any existing data for this field will be lost.</p>
      </Alert>
    </div>
  )
}
