// Inventory: custom removal reason categories shown in the stock-adjustment modal.

import { useState } from 'react'
import {
  Button, Card, Icon, InputGroup, Intent, Spinner, SpinnerSize, Switch,
} from '@blueprintjs/core'
import { useActiveHotel, useUpdateRemovalReasonPolicy } from '@/features/hotel/hooks'
import {
  useCustomRemovalReasons,
  useCreateCustomRemovalReason,
  useUpdateCustomRemovalReason,
  useDeleteCustomRemovalReason,
} from '@/features/removal-reasons/hooks'
import { SectionHeader, SettingRow } from './_shared'

export function MoveReasonsSection() {
  const hotel = useActiveHotel()
  const updateRemovalPolicy = useUpdateRemovalReasonPolicy()
  const { data: reasons = [], isLoading } = useCustomRemovalReasons()
  const createReason = useCreateCustomRemovalReason()
  const updateReason = useUpdateCustomRemovalReason()
  const deleteReason = useDeleteCustomRemovalReason()
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const requireRemovalReason = hotel?.require_removal_reason === true

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    await createReason.mutateAsync({ name, sortOrder: reasons.length })
    setNewName('')
  }

  const handleSaveEdit = async (id: string) => {
    const name = editName.trim()
    if (!name) return
    await updateReason.mutateAsync({ id, patch: { name } })
    setEditingId(null)
  }

  return (
    <div>
      <SectionHeader
        title="Move Reasons"
        description="Custom removal reason categories shown in the stock adjustment modal, alongside built-in ones."
      />

      <Card compact className="mb-5">
        <SettingRow
          label="Require move reason category"
          description="Operators must select a category when removing stock. Enables enforcement in the adjustment modal."
        >
          <Switch
            checked={requireRemovalReason}
            onChange={(e) => {
              void updateRemovalPolicy.mutateAsync(e.currentTarget.checked)
            }}
            className="!mb-0"
          />
        </SettingRow>
      </Card>

      <Card compact className="!p-0 divide-y">
        {isLoading && (
          <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </div>
        )}
        {!isLoading && reasons.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No custom reasons yet — built-in reasons (Breakage, Theft, etc.) are always available.
          </div>
        )}
        {reasons.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
            <Icon icon="drag-handle-vertical" size={14} className="text-muted-foreground/40 flex-shrink-0" />
            {editingId === r.id ? (
              <InputGroup
                className="flex-1"
                value={editName}
                onChange={(e) => { setEditName(e.target.value) }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { void handleSaveEdit(r.id) }
                  if (e.key === 'Escape') { setEditingId(null) }
                }}
                autoFocus
              />
            ) : (
              <span className="flex-1 text-sm">{r.name}</span>
            )}
            <div className="flex items-center gap-1">
              {editingId === r.id ? (
                <>
                  <Button size="small" intent={Intent.PRIMARY} onClick={() => { void handleSaveEdit(r.id) }}>Save</Button>
                  <Button size="small" variant="minimal" onClick={() => { setEditingId(null) }}>Cancel</Button>
                </>
              ) : (
                <>
                  <Button
                    icon="edit"
                    variant="minimal"
                    size="small"
                    aria-label="Edit reason"
                    onClick={() => { setEditingId(r.id); setEditName(r.name) }}
                  />
                  <Button
                    icon="trash"
                    variant="minimal"
                    size="small"
                    intent={Intent.DANGER}
                    aria-label="Delete reason"
                    onClick={() => { deleteReason.mutate(r.id) }}
                  />
                </>
              )}
            </div>
          </div>
        ))}

        <div className="flex items-center gap-2 px-4 py-3">
          <InputGroup
            className="flex-1"
            placeholder="e.g. Event consumption, Guest request…"
            value={newName}
            onChange={(e) => { setNewName(e.target.value) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { void handleAdd() }
            }}
          />
          <Button
            icon="plus"
            intent={Intent.PRIMARY}
            disabled={!newName.trim()}
            loading={createReason.isPending}
            onClick={() => { void handleAdd() }}
          >
            Add
          </Button>
        </div>
      </Card>
    </div>
  )
}
