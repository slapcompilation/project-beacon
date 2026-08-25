// The project Cover page — "a Markdown-based rich-text editor for writing
// comprehensive documentation about the Project" (security/cover-pages).
// The rail's first entry in Foundry's captures, so it sits first here too;
// the discoverability radio is the capture's two options plus the
// un-configured state (security/images/cover-page.png).

import { useState } from 'react'
import { Button, Card, Icon, Intent, Radio, RadioGroup, Tag, TextArea } from '@blueprintjs/core'
import { DocMarkdown, extractHeadings } from '@/features/compass/DocMarkdown'
import { useSetCoverPage, type Project } from './api'

type Discoverability = 'all_can_discover' | 'require_marking_access' | null

const CHIP: Record<string, string> = {
  all_can_discover: 'Public',
  require_marking_access: 'Requires markings',
}

export function CoverPagePanel({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const save = useSetCoverPage(project.id)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [disc, setDisc] = useState<Discoverability>(project.coverPageDiscoverability)
  const headings = project.coverPage ? extractHeadings(project.coverPage) : []

  const startEdit = () => {
    setDraft(project.coverPage ?? '')
    setDisc(project.coverPageDiscoverability)
    setEditing(true)
  }

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="book" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Cover page</span>
        {project.coverPageDiscoverability && (
          <Tag minimal className="!text-[9px]">{CHIP[project.coverPageDiscoverability]}</Tag>
        )}
        {canEdit && !editing && (
          <Button size="small" variant="minimal" icon="edit" className="ml-auto" text="Edit"
            onClick={startEdit} />
        )}
      </div>

      {editing ? (
        <div className="px-3 py-3 space-y-3">
          <TextArea fill rows={10} value={draft} className="font-mono !text-xs"
            placeholder={'# Cover page\n\nGoals, relevant files, which groups to request access to…'}
            onChange={(e) => { setDraft(e.currentTarget.value) }} />
          {/* "Requirements for discovering the cover page" — the capture's two
              radios; None is the un-configured state 676 records as inference. */}
          <RadioGroup
            label="Cover page discoverability"
            selectedValue={disc ?? 'none'}
            onChange={(e) => {
              const v = e.currentTarget.value
              setDisc(v === 'none' ? null : (v as Discoverability))
            }}>
            <Radio value="none" labelElement={<span>None — the cover page follows project access.</span>} />
            <Radio value="all_can_discover"
              labelElement={<span><b>All can discover</b> — all users within the organization can discover the cover page.</span>} />
            <Radio value="require_marking_access"
              labelElement={<span><b>Require marking access</b> — users within the organization with access to project markings can discover the cover page.</span>} />
          </RadioGroup>
          <div className="flex items-center gap-2">
            <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={save.isPending}
              onClick={() => {
                save.mutate(
                  { coverPage: draft.trim() === '' ? null : draft, discoverability: disc },
                  { onSuccess: () => { setEditing(false) } })
              }}>
              Save
            </Button>
            <Button size="small" variant="minimal" onClick={() => { setEditing(false) }}>Cancel</Button>
          </div>
        </div>
      ) : project.coverPage ? (
        <div className="px-3 py-3 flex gap-4">
          <div className="flex-1 min-w-0"><DocMarkdown text={project.coverPage} /></div>
          {headings.length >= 2 && (
            <div className="doc-toc">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                Table of contents
              </p>
              <ul>
                {headings.map((h, i) => (
                  <li key={String(i)} style={{ paddingLeft: (h.level - 1) * 10 }}>{h.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          No cover page yet. Owners are encouraged to describe the project&apos;s goals, point at the
          relevant files, and say which groups new users should request access to.
        </p>
      )}
    </Card>
  )
}
