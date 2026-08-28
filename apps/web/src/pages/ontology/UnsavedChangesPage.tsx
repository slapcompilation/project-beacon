// The Unsaved changes page — "From the homepage sidebar, select Unsaved
// changes to view a list of all unsaved changes made by you"
// (restore-changes). The entries are the working state's, branch-scoped the
// way the save is; saving itself stays in the top bar's session control.

import { Button, Card, Icon, NonIdealState, Tag } from '@blueprintjs/core'
import { useWorkingState, useDiscardWorkingState } from '@/features/workingState/api'

const OP_ICON = { created: 'plus', modified: 'edit', deleted: 'trash' } as const

export default function UnsavedChangesPage() {
  const { data: entries = [], isLoading } = useWorkingState()
  const discard = useDiscardWorkingState()
  return (
    <div className="px-8 py-6 max-w-3xl space-y-3">
      <header className="flex items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Unsaved changes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Everything you have edited and not yet saved. Save lives in the top bar;
            nothing here has reached the ontology.
          </p>
        </div>
        {entries.length > 0 && (
          <Button size="small" icon="trash" loading={discard.isPending}
            onClick={() => { discard.mutate(undefined) }}>Discard all</Button>
        )}
      </header>
      {isLoading ? null : entries.length === 0 ? (
        <NonIdealState icon="clean" title="Nothing unsaved"
          description="Edits stage here until you save them to the ontology." />
      ) : entries.map((e) => (
        <Card key={e.id} compact className="flex items-center gap-2">
          <Icon icon={OP_ICON[e.operation]} size={12} className="text-violet-500" />
          <Tag minimal className="!text-[9px]">{e.resourceKind.replace('_', ' ')}</Tag>
          <span className="text-sm font-medium truncate">
            {(e.fields.label ?? e.fields.api_name ?? e.resourceId) as string}
          </span>
          <span className="text-xs text-muted-foreground">{e.operation}</span>
          <span className="text-xs text-muted-foreground ml-auto">
            {new Date(e.updatedAt).toLocaleString()}
          </span>
          <Button variant="minimal" size="small" icon="cross" title="Discard this change"
            onClick={() => { discard.mutate({ kind: e.resourceKind, id: e.resourceId }) }} />
        </Card>
      ))}
    </div>
  )
}
