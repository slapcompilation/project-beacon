// The Branching application — the Branches tab of the Global Branching app:
// "view all branches that you have access to, and lists their name, status,
// creator, and creation date… New: Create a new branch. Archive: Archive an
// open branch. This will close any open proposals."

import { useEffect, useState } from 'react'
import {
  Button, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon, InputGroup,
  Intent, Tag,
} from '@blueprintjs/core'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { toSlug } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { useOntologies } from '@/features/ontologies/api'
import { useAllBranches, useProposals, useSetBranchStatus } from '@/features/branching/api'

const STATUS_INTENT = {
  active: Intent.PRIMARY, inactive: Intent.WARNING,
  archived: Intent.NONE, merged: Intent.SUCCESS,
} as const

export default function BranchesPage() {
  const { data: ontologies = [] } = useOntologies()
  const [ontologyId, setOntologyId] = useState<string | null>(null)
  useEffect(() => {
    if (ontologyId === null && ontologies.length > 0) setOntologyId(ontologies[0].id)
  }, [ontologies, ontologyId])
  const { data: branches = [] } = useAllBranches(ontologyId)
  const { data: proposals = [] } = useProposals(ontologyId)
  const setStatus = useSetBranchStatus()
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="p-6 max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Icon icon="git-branch" size={18} className="text-violet-500" />
        <div>
          <h1 className="text-base font-semibold">Branching</h1>
          <p className="text-xs text-muted-foreground">
            Safely build, test, and merge your changes without impacting users in production.
          </p>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <HTMLSelect value={ontologyId ?? ''} onChange={(e) => { setOntologyId(e.currentTarget.value || null) }}>
            {ontologies.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </HTMLSelect>
          <Button intent={Intent.SUCCESS} icon="git-new-branch" disabled={ontologyId === null}
            onClick={() => { setCreating(true) }}>New</Button>
        </span>
      </div>

      <div className="space-y-1.5">
        {branches.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No branches yet. A branch is a separate environment to experiment in without affecting Main.
          </p>
        )}
        {branches.map((b) => {
          const open = proposals.find((p) => p.branch_id === b.id && p.status === 'open')
          return (
            <div key={b.id} className="flex flex-wrap items-center gap-2 rounded border px-3 py-2">
              <Icon icon="git-branch" size={13} className="text-violet-500" />
              <span className="text-sm font-medium">{b.title}</span>
              <code className="text-[10px] text-muted-foreground">{b.name}</code>
              <Tag minimal intent={STATUS_INTENT[b.status]} className="!text-[10px]">{b.status}</Tag>
              <span className="ml-auto flex items-center gap-1.5">
                {open && (
                  <Button size="small" variant="minimal" icon="git-pull"
                    onClick={() => { void navigate(`/ontology/proposals?p=${open.id}`) }}>
                    View proposal
                  </Button>
                )}
                {(b.status === 'active' || b.status === 'inactive') && (
                  <Button size="small" variant="minimal" icon="box"
                    title="Archiving is always manual, and closes any open proposal"
                    loading={setStatus.isPending}
                    onClick={() => { setStatus.mutate({ branchId: b.id, status: 'archived' }) }}>
                    Archive
                  </Button>
                )}
                {b.status === 'archived' && (
                  <Button size="small" variant="minimal" icon="unarchive"
                    loading={setStatus.isPending}
                    onClick={() => { setStatus.mutate({ branchId: b.id, status: 'active' }) }}>
                    Restore
                  </Button>
                )}
                {b.status === 'merged' && (
                  <span className="text-[10px] text-muted-foreground" title="Merged branches are terminal">terminal</span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {ontologyId && creating && (
        <NewBranchDialog ontologyId={ontologyId} ontologies={ontologies}
          onClose={() => { setCreating(false) }} />
      )}
    </div>
  )
}

/** The Create new branch dialog, with the ontology select the screenshot has:
 *  "Only this ontology will be editable on this branch." */
function NewBranchDialog({ ontologyId, ontologies, onClose }: {
  ontologyId: string
  ontologies: { id: string; label: string }[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [ont, setOnt] = useState(ontologyId)
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('ontology_branches')
        .insert({ ontology_id: ont, name: toSlug(title).replace(/_/g, '-'), title: title.trim() })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void qc.invalidateQueries()
      onClose()
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
  return (
    <Dialog isOpen onClose={onClose} title="Create new branch" icon="git-new-branch" style={{ width: 440 }}>
      <DialogBody>
        <div className="space-y-2">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Branch name</span>
            <InputGroup placeholder="A short descriptive name for this branch" value={title}
              onChange={(e) => { setTitle(e.currentTarget.value) }} />
            <span className="text-[11px] text-muted-foreground">Do not include sensitive information</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ontology</span>
            <HTMLSelect value={ont} onChange={(e) => { setOnt(e.currentTarget.value) }}>
              {ontologies.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </HTMLSelect>
            <span className="text-[11px] text-muted-foreground">Only this ontology will be editable on this branch</span>
          </label>
        </div>
      </DialogBody>
      <DialogFooter actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button intent={Intent.PRIMARY} disabled={!title.trim()} loading={create.isPending}
          onClick={() => { create.mutate() }}>Create</Button>
      </>} />
    </Dialog>
  )
}
