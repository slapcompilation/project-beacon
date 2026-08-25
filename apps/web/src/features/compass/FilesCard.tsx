// The project's Files area — "Within projects, resources can be organized
// into folders to provide further structure and keep things clean." — and
// its Trash: "Resources deleted from the project that are available for
// recovery or permanent deletion." Folders never gate; a marking applied to
// one flows down in the database.

import { useState } from 'react'
import { Button, Card, HTMLSelect, Icon, InputGroup, Intent, Tag, TextArea } from '@blueprintjs/core'
import {
  useCreateFolder, useFiledResources, useFolders, useMoveToFolder,
  usePermanentDelete, useSetFolderDocumentation, useSetTrashed,
  type FiledResource, type Folder,
} from './api'
import { DocMarkdown } from './DocMarkdown'

// "You can add documentation to any folder … selecting **Add description**
// from the folder's Actions menu" — the README.md drop is not built (no
// file resources exist), so the action is the one route.
function FolderDescription({ f, projectId }: { f: Folder; projectId: string }) {
  const setDoc = useSetFolderDocumentation(projectId)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  if (editing) {
    return (
      <div className="ml-5 my-1 space-y-1">
        <TextArea fill rows={4} value={draft} className="font-mono !text-xs"
          onChange={(e) => { setDraft(e.currentTarget.value) }} />
        <div className="flex gap-1">
          <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={setDoc.isPending}
            onClick={() => {
              setDoc.mutate({ id: f.id, documentation: draft.trim() === '' ? null : draft },
                { onSuccess: () => { setEditing(false) } })
            }}>Save</Button>
          <Button size="small" variant="minimal" onClick={() => { setEditing(false) }}>Cancel</Button>
        </div>
      </div>
    )
  }
  if (f.documentation) {
    return (
      <div className="ml-5 my-1 doc-folder-description">
        <DocMarkdown text={f.documentation} />
        <Button size="small" variant="minimal" icon="edit" text="Edit description"
          onClick={() => { setDraft(f.documentation ?? ''); setEditing(true) }} />
      </div>
    )
  }
  return (
    <Button className="ml-5" size="small" variant="minimal" icon="manually-entered-data" text="Add description"
      onClick={() => { setDraft(''); setEditing(true) }} />
  )
}

export function FilesCard({ projectId }: { projectId: string }) {
  const { data: folders = [] } = useFolders(projectId)
  const { data: resources = [] } = useFiledResources(projectId)
  const create = useCreateFolder(projectId)
  const setTrashed = useSetTrashed(projectId)
  const move = useMoveToFolder(projectId)
  const purge = usePermanentDelete(projectId)
  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState<string>('')

  const live = folders.filter((f) => f.trashedAt === null)
  const trashedFolders = folders.filter((f) => f.trashedAt !== null)
  const trashedResources = resources.filter((r) => r.trashedAt !== null)

  const children = (parent: string | null) => live.filter((f) => f.parentFolderId === parent)
  const filed = (folderId: string | null) =>
    resources.filter((r) => r.folderId === folderId && r.trashedAt === null)

  const ResourceRow = ({ r }: { r: FiledResource }) => (
    <li className="flex items-center gap-2 py-1 text-xs">
      <Icon icon={r.kind === 'dataset' ? 'th' : 'eye-off'} size={11} className="text-violet-500" />
      <span className="flex-1 truncate">{r.name}</span>
      <HTMLSelect minimal value={r.folderId ?? ''}
        onChange={(e) => {
          move.mutate({
            table: r.kind === 'dataset' ? 'datasets' : 'restricted_views',
            id: r.id, folderId: e.currentTarget.value || null,
          })
        }}>
        <option value="">Project root</option>
        {live.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </HTMLSelect>
      <Button variant="minimal" size="small" icon="trash" title="Move to trash"
        onClick={() => {
          setTrashed.mutate({
            table: r.kind === 'dataset' ? 'datasets' : 'restricted_views', id: r.id, trashed: true,
          })
        }} />
    </li>
  )

  const FolderNode = ({ f, depth }: { f: Folder; depth: number }) => (
    <div style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-2 py-1 text-xs">
        <Icon icon="folder-close" size={12} className="text-muted-foreground" />
        <span className="font-medium flex-1">{f.name}</span>
        <Button variant="minimal" size="small" icon="trash" title="Move to trash (contents follow by the chain)"
          onClick={() => { setTrashed.mutate({ table: 'folders', id: f.id, trashed: true }) }} />
      </div>
      <FolderDescription f={f} projectId={projectId} />
      <ul className="ml-5 divide-y divide-border/30">
        {filed(f.id).map((r) => <ResourceRow key={`${r.kind}:${r.id}`} r={r} />)}
      </ul>
      {children(f.id).map((c) => <FolderNode key={c.id} f={c} depth={depth + 1} />)}
    </div>
  )

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="folder-close" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Files</span>
        <span className="text-[11px] text-muted-foreground/70 ml-1">
          Folders organize — a role on the project reaches everything regardless.
        </span>
      </div>

      <div className="px-3 py-2">
        {children(null).map((f) => <FolderNode key={f.id} f={f} depth={0} />)}
        <ul className="divide-y divide-border/30">
          {filed(null).map((r) => <ResourceRow key={`${r.kind}:${r.id}`} r={r} />)}
        </ul>
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-border px-3 py-2">
        <InputGroup size="small" value={newName} placeholder="New folder…"
          onChange={(e) => { setNewName(e.currentTarget.value) }} />
        <HTMLSelect value={newParent} onChange={(e) => { setNewParent(e.currentTarget.value) }}>
          <option value="">At project root</option>
          {live.map((f) => <option key={f.id} value={f.id}>inside {f.name}</option>)}
        </HTMLSelect>
        <Button size="small" icon="folder-new" loading={create.isPending} disabled={!newName.trim()}
          onClick={() => {
            create.mutate({ name: newName.trim(), parentFolderId: newParent || null },
              { onSuccess: () => { setNewName('') } })
          }} />
      </div>

      {(trashedFolders.length > 0 || trashedResources.length > 0) && (
        <div className="border-t border-border px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Trash</p>
          <ul className="divide-y divide-border/30">
            {trashedFolders.map((f) => (
              <li key={f.id} className="flex items-center gap-2 py-1 text-xs">
                <Icon icon="folder-close" size={11} className="text-muted-foreground" />
                <span className="flex-1 truncate line-through opacity-60">{f.name}</span>
                <Button variant="minimal" size="small" icon="undo" title="Restore in place"
                  onClick={() => { setTrashed.mutate({ table: 'folders', id: f.id, trashed: false }) }} />
                <Button variant="minimal" size="small" icon="cross" intent={Intent.DANGER} title="Delete permanently"
                  onClick={() => { purge.mutate({ table: 'folders', id: f.id }) }} />
              </li>
            ))}
            {trashedResources.map((r) => (
              <li key={`${r.kind}:${r.id}`} className="flex items-center gap-2 py-1 text-xs">
                <Icon icon={r.kind === 'dataset' ? 'th' : 'eye-off'} size={11} className="text-muted-foreground" />
                <span className="flex-1 truncate line-through opacity-60">{r.name}</span>
                <Tag minimal className="!text-[9px]">{r.kind}</Tag>
                <Button variant="minimal" size="small" icon="undo" title="Restore in place"
                  onClick={() => {
                    setTrashed.mutate({
                      table: r.kind === 'dataset' ? 'datasets' : 'restricted_views', id: r.id, trashed: false,
                    })
                  }} />
                <Button variant="minimal" size="small" icon="cross" intent={Intent.DANGER} title="Delete permanently"
                  onClick={() => {
                    purge.mutate({ table: r.kind === 'dataset' ? 'datasets' : 'restricted_views', id: r.id })
                  }} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
