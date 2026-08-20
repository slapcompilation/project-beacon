// The Data Catalog — "an interactive view of curated data and other
// resources": Collections ("curated data for a given topic, audience, or
// purpose") and Files with tag filters. Promoted items sort first with the
// checkmark badge, the documented boost and indicator.

import { useState } from 'react'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, Intent, NonIdealState, Tag,
} from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import {
  useAddToCollection, useCatalogFiles, useCollectionContents, useCollections,
  useCreateCollection, useSetPromoted, useTags,
} from '@/features/compass/catalogApi'

export default function CatalogPage() {
  const { data: collections = [] } = useCollections()
  const { data: files = [] } = useCatalogFiles()
  const { data: tags = [] } = useTags()
  const isAdmin = useAuthStore((s) => s.role === 'owner' || s.role === 'admin')
  const setPromoted = useSetPromoted()
  const addTo = useAddToCollection()
  const create = useCreateCollection()
  const [openCollection, setOpenCollection] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState('')
  const [newName, setNewName] = useState('')
  const { data: contents = [] } = useCollectionContents(openCollection)

  const inOpen = new Set(contents.map((c) => `${c.resource_kind}:${c.resource_id}`))
  const shown = files.filter((fl) =>
    (!tagFilter || fl.tags.includes(tagFilter))
    && (!openCollection || inOpen.has(`${fl.kind}:${fl.id}`)))

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Icon icon="endorsed" className="text-violet-500" />Data Catalog
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Curated data: collections group the files for a topic or audience; anyone can view
            a collection, and each file keeps its own permissions.
          </p>
        </header>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Collections</h2>
            <Tag minimal className="!text-[10px]">{collections.length}</Tag>
            {openCollection && (
              <Button variant="minimal" size="small" onClick={() => { setOpenCollection(null) }}>
                Show all files
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {collections.map((c) => (
              <Card key={c.id} interactive compact
                className={openCollection === c.id ? '!border-primary' : ''}
                onClick={() => { setOpenCollection(openCollection === c.id ? null : c.id) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="box" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{c.name}</span>
                </div>
                {c.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{c.description}</p>}
              </Card>
            ))}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <InputGroup size="small" value={newName} placeholder="New collection…"
                onChange={(e) => { setNewName(e.currentTarget.value) }} />
              <Button size="small" icon="add" loading={create.isPending} disabled={!newName.trim()}
                onClick={() => {
                  create.mutate({ name: newName.trim(), description: '' },
                    { onSuccess: () => { setNewName('') } })
                }} />
            </div>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Files</h2>
            <Tag minimal className="!text-[10px]">{shown.length}</Tag>
            <HTMLSelect minimal value={tagFilter} onChange={(e) => { setTagFilter(e.currentTarget.value) }}>
              <option value="">All tags</option>
              {tags.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </HTMLSelect>
          </div>
          {shown.length === 0 ? (
            <NonIdealState icon="endorsed" title="Nothing curated here yet"
              description="Promote a resource or add files to a collection; they surface here for everyone." />
          ) : (
            <ul className="divide-y divide-border/30">
              {shown.map((fl) => (
                <li key={`${fl.kind}:${fl.id}`} className="flex items-center gap-2 py-1.5 text-xs">
                  <Icon icon={fl.kind === 'dataset' ? 'th' : 'eye-off'} size={12} className="text-violet-500" />
                  <span className="font-medium">{fl.name}</span>
                  {fl.promoted && (
                    <Icon icon="endorsed" size={12} className="text-violet-500"
                      title="Promoted — recommended for all users." />
                  )}
                  {fl.tags.map((t) => <Tag key={t} minimal className="!text-[9px]">{t}</Tag>)}
                  <span className="flex-1" />
                  {isAdmin && openCollection && !inOpen.has(`${fl.kind}:${fl.id}`) && (
                    <Button variant="minimal" size="small" icon="add" title="Add to the open collection"
                      onClick={() => { addTo.mutate({ collectionId: openCollection, kind: fl.kind, resourceId: fl.id }) }} />
                  )}
                  {isAdmin && (
                    <Button variant="minimal" size="small"
                      icon={fl.promoted ? 'remove' : 'endorsed'}
                      intent={fl.promoted ? Intent.NONE : Intent.PRIMARY}
                      title={fl.promoted ? 'Remove status' : 'Change status → Promoted'}
                      onClick={() => {
                        setPromoted.mutate({
                          table: fl.kind === 'dataset' ? 'datasets' : 'restricted_views',
                          id: fl.id, promoted: !fl.promoted,
                        })
                      }} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
