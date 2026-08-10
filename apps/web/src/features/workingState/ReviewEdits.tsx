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
  useWorkingStateConflicts, useUpdateWorkingState,
  type WorkingEntry, type ResourceKind, type Conflict, type Choice, type Resolution,
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

/** What somebody else moved while I was editing.
 *
 *  "You can choose between keeping the changes in the latest version of the
 *   Ontology or overriding them with the changes in your working state."
 *
 *  The fields are listed, but the choice is one pair of buttons for the whole
 *  resource — that asymmetry is the screenshot's, not ours. */
function ConflictPanel({ conflicts, onResolved }: {
  conflicts: Conflict[]
  onResolved: () => void
}) {
  const update = useUpdateWorkingState()
  const [choices, setChoices] = useState<Record<string, Choice>>({})

  // One group per resource, because that is the unit a decision applies to.
  const groups = new Map<string, Conflict[]>()
  for (const c of conflicts) {
    const key = `${c.resource_kind}:${c.resource_id}`
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  const undecided = [...groups.keys()].filter((k) => !(k in choices))

  const apply = () => {
    const resolutions: Resolution[] = [...groups.keys()].map((k) => {
      const [kind, id] = k.split(':') as [ResourceKind, string]
      return { resource_kind: kind, resource_id: id, choice: choices[k] }
    })
    update.mutate(resolutions, { onSuccess: onResolved })
  }

  return (
    <Callout intent={Intent.WARNING} icon="git-merge" title={
      `${conflicts.length} field${conflicts.length === 1 ? '' : 's'} changed by someone else`
    } className="!mb-3">
      <p className="text-[11px] mb-2">
        The ontology was saved by another user since you began. Choose per resource, then Update —
        this changes your working state only, never the ontology.
      </p>
      {[...groups.entries()].map(([key, fields]) => (
        <div key={key} className="mb-2 last:mb-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold flex-1">
              {KIND_LABEL[fields[0].resource_kind]} · {key.split(':')[1].slice(0, 8)}
            </span>
            <Button size="small" variant={choices[key] === 'latest' ? 'solid' : 'minimal'}
              onClick={() => { setChoices({ ...choices, [key]: 'latest' }) }}>Use latest</Button>
            <Button size="small" variant={choices[key] === 'mine' ? 'solid' : 'minimal'}
              onClick={() => { setChoices({ ...choices, [key]: 'mine' }) }}>Keep my changes</Button>
          </div>
          {fields.map((c) => (
            <div key={c.field} className="flex items-center gap-2 pl-2 py-0.5">
              <span className="text-[11px] w-32 shrink-0 text-muted-foreground">{c.field}</span>
              <Tag minimal className="!text-[10px]">theirs: {show(c.theirs)}</Tag>
              <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">mine: {show(c.mine)}</Tag>
            </div>
          ))}
        </div>
      ))}
      <Button size="small" intent={Intent.WARNING} icon="refresh" className="mt-1"
        disabled={undecided.length > 0} loading={update.isPending}
        title={undecided.length > 0 ? 'Every resource needs a choice' : undefined}
        onClick={apply}>Update</Button>
    </Callout>
  )
}

/** The header's save area, and the dialog behind it. With unsaved work the
 *  header reads `1 edit … Discard … Save`; with none there is nothing to show,
 *  so it renders nothing at all (§6.2, §10.4). */
export function SaveControl() {
  const { data: entries = [] } = useWorkingState()
  const { data: conflicts = [] } = useWorkingStateConflicts()
  const [reviewing, setReviewing] = useState(false)
  const save = useSaveWorkingState()
  const discard = useDiscardWorkingState()

  if (entries.length === 0) return null
  const count = entries.length
  // "While errors need to be handled in order to save" — a stale entry is one.
  const blocked = conflicts.length > 0

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="minimal" size="small" onClick={() => { setReviewing(true) }}>
          {count} edit{count === 1 ? '' : 's'}
        </Button>
        <Button variant="minimal" size="small" loading={discard.isPending}
          title="Throw away every unsaved change"
          onClick={() => { discard.mutate(undefined) }}>Discard</Button>
        <Button size="small" intent={blocked ? Intent.WARNING : Intent.PRIMARY}
          icon={blocked ? 'git-merge' : 'floppy-disk'} loading={save.isPending}
          title={blocked ? 'Someone else saved since you began — review and update first' : undefined}
          onClick={() => { if (blocked) setReviewing(true); else save.mutate() }}>
          {blocked ? 'Review' : 'Save'}
        </Button>
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
          {blocked && (
            <ConflictPanel conflicts={conflicts} onResolved={() => { setReviewing(false) }} />
          )}
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
              disabled={blocked} title={blocked ? 'Resolve the conflicts above first' : undefined}
              onClick={() => { save.mutate(undefined, { onSuccess: () => { setReviewing(false) } }) }}>
              Save changes
            </Button>
          </>
        } />
      </Dialog>
    </>
  )
}
