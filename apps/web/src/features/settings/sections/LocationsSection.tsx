// Inventory: physical storage locations (floors, rooms, units).

import { useState } from 'react'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, Intent, Spinner, SpinnerSize,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import {
  useLocations, useCreateLocation, useUpdateLocation, useDeleteLocation,
} from '@/features/locations/hooks'
import type { Location } from '@beacon/types'
import { SectionHeader } from './_shared'

export function LocationsSection() {
  const { data: locations = [], isLoading } = useLocations()
  const createLocation = useCreateLocation()
  const updateLocation = useUpdateLocation()
  const deleteLocation = useDeleteLocation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [addName, setAddName] = useState('')
  const [addParentId, setAddParentId] = useState<string>('__none__')
  const [adding, setAdding] = useState(false)

  const topLevel = locations.filter((l) => !l.parent_id)
  const childrenOf = (id: string) => locations.filter((l) => l.parent_id === id)

  const handleAdd = async () => {
    if (!addName.trim()) return
    await createLocation.mutateAsync({ name: addName.trim(), parent_id: addParentId === '__none__' ? null : addParentId })
    setAddName(''); setAddParentId('__none__'); setAdding(false)
  }

  const handleSaveEdit = async (loc: Location) => {
    if (!editName.trim()) return
    await updateLocation.mutateAsync({ id: loc.id, input: { name: editName.trim() } })
    setEditingId(null)
  }

  const renderRow = (loc: Location, indent = false) => (
    <div key={loc.id} className={cn('flex items-center gap-3 px-4 py-2.5', indent && 'pl-10 bg-muted/30')}>
      <Icon icon="map-marker" size={14} className={cn('flex-shrink-0', indent ? 'text-muted-foreground/60' : 'text-muted-foreground')} />
      {editingId === loc.id ? (
        <InputGroup
          className="flex-1"
          value={editName}
          onChange={(e) => { setEditName(e.target.value) }}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveEdit(loc); if (e.key === 'Escape') setEditingId(null) }}
          autoFocus
        />
      ) : (
        <span className="flex-1 text-sm">{loc.name}</span>
      )}
      {editingId === loc.id ? (
        <Button size="small" onClick={() => void handleSaveEdit(loc)}>Save</Button>
      ) : (
        <>
          <Button
            icon="edit"
            variant="minimal"
            size="small"
            aria-label="Edit location"
            onClick={() => { setEditingId(loc.id); setEditName(loc.name) }}
          />
          <Button
            icon="trash"
            variant="minimal"
            size="small"
            intent={Intent.DANGER}
            aria-label="Delete location"
            onClick={() => { deleteLocation.mutate(loc.id) }}
          />
        </>
      )}
    </div>
  )

  return (
    <div>
      <SectionHeader title="Storage Locations" description="Define floors, rooms, and storage units. Assign them to variants." />
      <div className="flex justify-end mb-3">
        <Button icon="plus" intent={Intent.PRIMARY} onClick={() => { setAdding(true) }}>Add Location</Button>
      </div>
      {adding && (
        <Card compact className="mb-3 !bg-muted/30">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <InputGroup
              placeholder="Location name…"
              value={addName}
              onChange={(e) => { setAddName(e.target.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
              autoFocus
            />
            <HTMLSelect
              value={addParentId}
              onChange={(e) => { setAddParentId(e.target.value) }}
              options={[
                { value: '__none__', label: 'Top level' },
                ...topLevel.map((l) => ({ value: l.id, label: l.name })),
              ]}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setAdding(false) }}>Cancel</Button>
            <Button intent={Intent.PRIMARY} onClick={() => void handleAdd()} disabled={!addName.trim()} loading={createLocation.isPending}>
              Add Location
            </Button>
          </div>
        </Card>
      )}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6"><Spinner size={SpinnerSize.SMALL} />Loading…</div>
      ) : locations.length === 0 && !adding ? (
        <Card compact className="py-10 flex flex-col items-center gap-2 text-center">
          <Icon icon="map-marker" size={32} className="text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No locations yet.</p>
        </Card>
      ) : locations.length > 0 ? (
        <Card compact className="!p-0 divide-y">
          {topLevel.map((loc) => (
            <div key={loc.id}>{renderRow(loc)}{childrenOf(loc.id).map((c) => renderRow(c, true))}</div>
          ))}
        </Card>
      ) : null}
    </div>
  )
}
