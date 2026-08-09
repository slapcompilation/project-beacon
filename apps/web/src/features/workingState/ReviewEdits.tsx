// The Save control and the Review edits dialog.
//
// "Open the Review edits dialog to review all your changes."
// "Each resource in the Ontology that you edit will have its own entry."
// "You can discard the changes you made to a resource by hovering over the
//  entry and selecting the trash icon."
//
// The per-field diff — old struck through, new in green — is not in the prose;
// it comes off `save-button-review.png`. Same for the running edit count beside
// the Save button.

import { useState } from 'react'
import {
  Button, Callout, Card, Dialog, DialogBody, DialogFooter, Intent, Tag,
} from '@blueprintjs/core'
import {
  useWorkingState, useSaveWorkingState, useDiscardWorkingState,
  type WorkingEntry, type ResourceKind,
} from './api'

const KIND_LABEL: Record<ResourceKind, string> = {
  object_type: 'Object type', link_type: 'Link type', shared_property: 'Shared property',
  interface: 'Interface', action_type: 'Action type', type_group: 'Type group',
}

const OPERATION_INTENT = { created: Intent.SUCCESS, modified: Intent.PRIMARY, deleted: Intent.DANGER }

/** Sections travel inside their resource's entry, so they are summarised rather
 *  than diffed value by value — the dialog nests them one level deeper than we
 *  render today. */
const SECTIONS = new Set(['properties', 'datasources'])

// A field value is jsonb, so it may be anything. Objects get JSON rather than
// [object Object] — a diff that renders nothing is worse than a dense one.
const show = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—'
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? '' : 's'}`
  if (typeof v === 'object') return JSON.stringify(v)
  if (typeof v === 'string') return v
  return JSON.stringify(v)
}

function FieldDiff({ field, before, after }: { field: string; before: unknown; after: unknown }) {
  if (SECTIONS.has(field)) {
    return (
      <div className="flex items-center gap-2 py-0.5">
        <span className="text-[11px] w-40 shrink-0 text-muted-foreground uppercase tracking-wide">{field}</span>
        <span className="text-[11px]">{show(after)}</span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-[11px] w-40 shrink-0 text-muted-foreground">{field}</span>
      {before !== undefined && <span className="text-[11px] line-through opacity-50">{show(before)}</span>}
      <span className="text-[11px] text-emerald-600 font-medium">{show(after)}</span>
    </div>
  )
}

function Entry({ entry }: { entry: WorkingEntry }) {
  const discard = useDiscardWorkingState()
  const fields = Object.keys(entry.fields)
  const named = entry.fields.label ?? entry.fields.api_name
  const title = typeof named === 'string' && named !== '' ? named : entry.resourceId.slice(0, 8)

  return (
    <Card compact className="!p-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold flex-1">{title}</span>
        <Tag minimal className="!text-[10px]">{KIND_LABEL[entry.resourceKind]}</Tag>
        <Tag minimal intent={OPERATION_INTENT[entry.operation]} className="!text-[10px]">
          {entry.operation}
        </Tag>
        <Tag minimal className="!text-[10px]">
          {fields.length} edit{fields.length === 1 ? '' : 's'}
        </Tag>
        <Button variant="minimal" size="small" icon="trash" title="Discard the changes to this resource"
          loading={discard.isPending}
          onClick={() => { discard.mutate({ kind: entry.resourceKind, id: entry.resourceId }) }} />
      </div>
      {entry.operation !== 'deleted' && (
        <div className="pl-1 border-l-2 border-border/40">
          {fields.map((f) => (
            <FieldDiff key={f} field={f}
              before={entry.operation === 'created' ? undefined : entry.base[f]}
              after={entry.fields[f]} />
          ))}
        </div>
      )}
    </Card>
  )
}

/** The header control: a running count, and the button that ends the session. */
export function SaveControl() {
  const { data: entries = [] } = useWorkingState()
  const [reviewing, setReviewing] = useState(false)
  const save = useSaveWorkingState()
  const discard = useDiscardWorkingState()

  if (entries.length === 0) return null
  const count = entries.length

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="minimal" size="small" onClick={() => { setReviewing(true) }}>
          {count} unsaved {count === 1 ? 'change' : 'changes'}
        </Button>
        <Button size="small" intent={Intent.PRIMARY} icon="floppy-disk" loading={save.isPending}
          onClick={() => { save.mutate() }}>Save</Button>
      </div>

      <Dialog isOpen={reviewing} onClose={() => { setReviewing(false) }}
        title={`Review edits (${count})`} icon="edit" style={{ width: 640 }}>
        <DialogBody>
          <Callout intent={Intent.PRIMARY} icon="info-sign" className="!mb-3">
            <span className="text-[11px]">
              These changes are yours alone until you save. Saving applies them all, or none —
              an error stops the whole save and nothing is written.
            </span>
          </Callout>
          <div className="space-y-2">
            {entries.map((e) => <Entry key={e.id} entry={e} />)}
          </div>
        </DialogBody>
        <DialogFooter actions={
          <>
            <Button variant="minimal" intent={Intent.DANGER} icon="trash" loading={discard.isPending}
              onClick={() => { discard.mutate(undefined, { onSuccess: () => { setReviewing(false) } }) }}>
              Discard all
            </Button>
            <Button variant="minimal" onClick={() => { setReviewing(false) }}>Close</Button>
            <Button intent={Intent.PRIMARY} icon="floppy-disk" loading={save.isPending}
              onClick={() => { save.mutate(undefined, { onSuccess: () => { setReviewing(false) } }) }}>
              Save changes
            </Button>
          </>
        } />
      </Dialog>
    </>
  )
}
