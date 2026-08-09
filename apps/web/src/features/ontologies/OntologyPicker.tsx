// The picker at the top-left of Ontology Manager, and what it shows when there
// is nothing to pick yet.
//
// "In the top left corner of the Ontology Manager application, there is a
// drop-down to select between different Ontologies (if more than one is
// available)." The screenshot shows the display name over the folder it lives
// in — `Palantir (Unmarked) Ontology` above `Palantir (Unmarked)` — so it is two
// lines, not one.
//
// Selecting an ontology is selecting a space, because a space holds exactly one.

import { useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon,
  InputGroup, Intent, Tag,
} from '@blueprintjs/core'
import { toSlug } from '@beacon/ontology'
import {
  useOntologies, useAvailableSpaces, useCreateOntology, useCreateSpace, type Ontology,
} from './api'

export function OntologyPicker({ value, onChange }: {
  value: string | null
  onChange: (id: string) => void
}) {
  const { data: ontologies = [], isLoading } = useOntologies()
  const [creating, setCreating] = useState(false)
  // `.at` rather than `[0]`, because an empty list has no first element and the
  // index signature would claim otherwise.
  const selected = ontologies.find((o) => o.id === value) ?? ontologies.at(0)

  // Nothing to pick. An object type cannot be created without one, so this is
  // the first thing to do rather than an empty dropdown.
  if (!isLoading && ontologies.length === 0) {
    return (
      <>
        <Callout intent={Intent.PRIMARY} icon="cube" title="No ontology yet">
          <p className="text-[11px] mb-2">
            A space holds a single ontology, and every object type belongs to one. Create a
            space and its ontology before defining types.
          </p>
          <Button size="small" icon="add" intent={Intent.PRIMARY}
            onClick={() => { setCreating(true) }}>Create an ontology</Button>
        </Callout>
        <NewOntologyDialog isOpen={creating} onClose={() => { setCreating(false) }} />
      </>
    )
  }

  return (
    <>
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 min-w-56">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Ontology
          </span>
          <HTMLSelect value={selected?.id ?? ''} disabled={isLoading}
            onChange={(e) => { onChange(e.currentTarget.value) }}>
            {ontologies.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </HTMLSelect>
        </label>
        {/* The folder the picker shows underneath the name. */}
        {selected && (
          <div className="flex items-center gap-1.5 pb-1.5 text-[11px] text-muted-foreground">
            <Icon icon="folder-close" size={12} />
            <span className="font-mono">{selected.spacePath || selected.spaceName}</span>
          </div>
        )}
        <Button variant="minimal" size="small" icon="add" className="mb-0.5"
          title="A space holds a single ontology, so a new one needs a new space"
          onClick={() => { setCreating(true) }} />
      </div>
      <NewOntologyDialog isOpen={creating} onClose={() => { setCreating(false) }} />
    </>
  )
}

/** What an ontology carries, for the header of whatever it scopes. */
export function OntologySummary({ ontology }: { ontology: Ontology }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <Tag minimal className="!text-[10px] font-mono">{ontology.apiName}</Tag>
      <span className="font-mono text-muted-foreground">{ontology.spacePath}</span>
      <span className="font-mono text-[10px] text-muted-foreground" title="Resource identifier">
        {ontology.rid}
      </span>
    </div>
  )
}

function NewOntologyDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { data: spaces = [] } = useAvailableSpaces()
  const createSpace = useCreateSpace()
  const create = useCreateOntology()

  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [spaceId, setSpaceId] = useState('')
  const [spaceName, setSpaceName] = useState('')

  const apiName = toSlug(label)
  const needsSpace = spaces.length === 0
  const canSave = apiName !== '' && (needsSpace ? spaceName.trim() !== '' : spaceId !== '')

  const submit = () => {
    if (!canSave) return
    const withSpace = (id: string) => {
      create.mutate(
        { spaceId: id, apiName, label: label.trim(), description: description.trim() },
        { onSuccess: () => { setLabel(''); setDescription(''); onClose() } },
      )
    }
    if (needsSpace) createSpace.mutate(spaceName.trim(), { onSuccess: withSpace })
    else withSpace(spaceId)
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="New ontology" icon="cube">
      <DialogBody>
        <Card compact className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            A space holds a single ontology. Separate spaces are also how environments are
            kept apart — development, test and production are each a space, so each has its
            own ontology.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
            <InputGroup size="small" value={label} placeholder="Production Ontology"
              onChange={(e) => { setLabel(e.currentTarget.value) }} />
          </label>
          {label && <Tag minimal className="font-mono !text-[10px]">{apiName}</Tag>}
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</span>
            <InputGroup size="small" value={description}
              onChange={(e) => { setDescription(e.currentTarget.value) }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Space</span>
            {needsSpace ? (
              <InputGroup size="small" value={spaceName} placeholder="Production"
                onChange={(e) => { setSpaceName(e.currentTarget.value) }} />
            ) : (
              <HTMLSelect value={spaceId} onChange={(e) => { setSpaceId(e.currentTarget.value) }}>
                <option value="">Select…</option>
                {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </HTMLSelect>
            )}
            <span className="text-[10px] text-muted-foreground">
              {needsSpace
                ? 'No space is free — every existing one already holds an ontology, so this creates a new space.'
                : 'Only spaces that hold no ontology yet are listed.'}
            </span>
          </label>
        </Card>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button variant="minimal" onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} icon="tick" disabled={!canSave}
            loading={create.isPending || createSpace.isPending} onClick={submit}>
            Create
          </Button>
        </>
      } />
    </Dialog>
  )
}
