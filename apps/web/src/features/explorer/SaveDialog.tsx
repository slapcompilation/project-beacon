// The save dialog, in the screenshot's own words: Exploration saves "filters
// as a dynamic exploration that updates with new results", List saves
// "current results as a static list matching filters at this moment"
// (explorations_saved_list.png). Every save here is public and lands in a
// project — there are no home folders to be private in.

import { useState } from 'react'
import { Button, Dialog, DialogBody, DialogFooter, HTMLSelect, InputGroup, Radio, RadioGroup } from '@blueprintjs/core'
import { useProjects } from '@/features/projects/api'
import { useSaveObjectSet, type ExplorerFilter } from './api'

export function SaveDialog({ isOpen, onClose, subjectTypeId, filters, selectedPks = [] }: {
  isOpen: boolean
  onClose: () => void
  subjectTypeId: string
  filters: ExplorerFilter[]
  selectedPks?: string[]
}) {
  const { data: projects = [] } = useProjects()
  const save = useSaveObjectSet()
  const [kind, setKind] = useState<'exploration' | 'list'>('exploration')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [scope, setScope] = useState<'selected' | 'all'>('all')

  const submit = () => {
    save.mutate(
      { name, description, subjectTypeId, projectId, kind, filters,
        primaryKeys: kind === 'list' && scope === 'selected' ? selectedPks : undefined },
      { onSuccess: () => { onClose(); setName(''); setDescription('') } })
  }

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Save exploration or list">
      <DialogBody>
        <RadioGroup selectedValue={kind}
          onChange={(e) => { setKind(e.currentTarget.value as 'exploration' | 'list') }}>
          <Radio value="exploration"
            labelElement={<span><b>Exploration</b> — save filters as a dynamic exploration that updates with new results</span>} />
          <Radio value="list"
            labelElement={<span><b>List</b> — save current results as a static list matching filters at this moment</span>} />
        </RadioGroup>
        {kind === 'list' && selectedPks.length > 0 && (
          <RadioGroup className="mt-2" selectedValue={scope}
            onChange={(e) => { setScope(e.currentTarget.value as 'selected' | 'all') }}>
            <Radio value="selected" label={`Only save ${selectedPks.length} selected`} />
            <Radio value="all" label="Save all objects in results" />
          </RadioGroup>
        )}
        <div className="space-y-2 mt-3">
          <InputGroup placeholder="Name" value={name}
            onChange={(e) => { setName(e.currentTarget.value) }} />
          <InputGroup placeholder="Description (optional)" value={description}
            onChange={(e) => { setDescription(e.currentTarget.value) }} />
          <HTMLSelect fill value={projectId}
            onChange={(e) => { setProjectId(e.currentTarget.value) }}>
            <option value="">Select a project to save in…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.spacePath ? `${p.spacePath}/` : ''}{p.name}</option>
            ))}
          </HTMLSelect>
        </div>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent="primary" loading={save.isPending}
            disabled={name.trim() === '' || projectId === ''} onClick={submit}>
            Save
          </Button>
        </>
      } />
    </Dialog>
  )
}
