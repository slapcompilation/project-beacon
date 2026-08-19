// Ontology Manager's own chrome, nested inside the platform's.
//
// "The two persisting elements of Ontology Manager are the top bar and the
// sidebar. The top bar and sidebar serve as navigation elements, providing
// intuitive access to various features, functionalities, and sections within
// the application." (readings/home-and-navigation.md §6)
//
// The dark rail to the left is the platform's and stays; everything here is the
// application's, and light (§5.1). Two chromes, nested — that is the point.
//
// The sidebar screenshot (§6.3) inventories fourteen entries. Seven lead
// somewhere — Cleanup and Health issues arrived last, each once something
// rendered the query that had been backing it all along. OMITTED BY NAME, with
// what would have to exist first:
//   Unsaved changes  — the save session lives in the top bar instead, where the
//                      count and its buttons already are (§10.8 puts it here too).
//   History          — `object_edits` and `branch_resource_changes` exist; no reader.
//   Properties       — a flat index of every property across types; nothing builds
//                      it. It is also the one entry with no count in the screenshot.
//   Groups           — `type_groups` and `object_type_group_members` exist; no surface.
//   Value types      — nothing behind it.
//   Functions        — nothing behind it.
//   Ontology configuration — nothing behind it.
// The header's `New ▾` goes with them: creation lives in the object types page.

import { useEffect, useState } from 'react'
import {
  Button, Dialog, DialogBody, DialogFooter, Icon, InputGroup, Intent, Menu,
  MenuDivider, MenuItem, NonIdealState, Popover, Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { toSlug } from '@beacon/ontology'
import { supabase } from '@/lib/supabase/client'
import { useBranches, useBranchChanges, useProposals, useCreateProposal, useBranchConflicts, useSetBranchStatus } from '@/features/branching/api'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { useViolations, useWarnings } from '@/features/health/api'
import { useAuthStore } from '@/stores/auth.store'
import { useProjects } from '@/features/projects/api'
import { OntologyPicker } from '@/features/ontologies/OntologyPicker'
import { SaveControl } from '@/features/workingState/ReviewEdits'
import { OmaSearch } from './OmaSearch'
import { RESOURCE_NAV, countOf, useOmaResources, useOmaOntology } from './resources'

/** What the OS renders in the hint; the handler takes either. */
const MOD = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘ ' : 'Ctrl '

export default function OmaLayout() {
  const role = useAuthStore((s) => s.role)
  const setOntology = useAppStore((s) => s.setOmaOntology)
  const ontologyId = useAppStore((s) => s.omaOntologyId)
  const resources = useOmaResources()
  const [searching, setSearching] = useState(false)

  // "hold down Cmd/Ctrl + K to open the Search bar dialog" (§6.2).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearching(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [])

  if (role !== 'owner' && role !== 'admin') {
    return <NonIdealState icon="shield" title="Ontology Manager is available to admin and owner roles" />
  }

  return (
    <div className="oma">
      <header className="oma-top">
        <div className="oma-brand">
          <span className="oma-tile"><Icon icon="cube" size={16} color="#fff" /></span>
          <span className="oma-title">Ontology Manager</span>
        </div>

        <button type="button" className="oma-search-trigger" onClick={() => { setSearching(true) }}>
          <Icon icon="search" size={14} />
          <span>Search by name, RID, aliases...</span>
          <kbd>{MOD}K</kbd>
        </button>

        <div className="oma-actions">
          <BranchControl />
          {/* The save session: "N edits · Discard · Save", or nothing at all. */}
          <SaveControl />
        </div>
      </header>

      <div className="oma-body">
        <aside className="oma-side">
          <OntologyPicker value={ontologyId} onChange={setOntology} />
          <OmaProjectPicker />
          <nav className="oma-nav">
            <NavRow icon="compass" label="Discover" path="/ontology" end />
            <NavRow icon="people" label="Proposals" path="/ontology/proposals" />
            <MainBranchUpdatesRow />
            <div className="oma-rule" />
            <p className="oma-group-title">Resources</p>
            {RESOURCE_NAV.map((r) => (
              <NavRow key={r.path} icon={r.icon} label={r.label} path={r.path}
                count={countOf(resources, r.kind)} />
            ))}
            {/* Health issues and Cleanup are one group below the resource list,
                in that order, with Flag settings indented under Cleanup — as
                the Ontology Manager nav screenshot draws it. */}
            <div className="oma-rule" />
            <HealthIssuesRow />
            <NavRow icon="clean" label="Cleanup" path="/ontology/cleanup" end />
            <NavRow icon="flag" label="Flag settings" path="/ontology/cleanup/flags" />
          </nav>
        </aside>

        <div className="oma-content">
          <Outlet />
        </div>
      </div>

      {searching && <OmaSearch resources={resources} onClose={() => { setSearching(false) }} />}
      <BranchTaskbar />
    </div>
  )
}

function NavRow({ icon, label, path, count, end = false }: {
  icon: IconName; label: string; path: string; count?: number; end?: boolean
}) {
  return (
    <NavLink to={path} end={end} className={({ isActive }) => cn('oma-row', isActive && 'is-active')}>
      <Icon icon={icon} size={14} />
      <span className="oma-row-label">{label}</span>
      {count !== undefined && <span className="oma-count">{count}</span>}
    </NavLink>
  )
}

/** Health issues carries its count in the sidebar, and keeps it even when a
 *  search facets every other row — so it is a NavRow with a number, not a dot. */
function HealthIssuesRow() {
  const { data: errors = [] } = useViolations()
  const { data: warnings = [] } = useWarnings()
  return <NavRow icon="pulse" label="Health issues" path="/ontology/health"
    count={errors.length + warnings.length} end />
}

/** "When there are new changes from main, a blue indicator appears on the
 *  Main branch updates tab" — the entry exists only on a branch. */
function MainBranchUpdatesRow() {
  const branchId = useAppStore((s) => s.omaBranchId)
  const { data: conflicts = [] } = useBranchConflicts(branchId)
  if (branchId === null) return null
  return (
    <NavLink to="/ontology/main-branch-updates"
      className={({ isActive }) => cn('oma-row', isActive && 'is-active')}>
      <Icon icon="git-merge" size={14} />
      <span className="oma-row-label">Main branch updates</span>
      {conflicts.length > 0 && <span className="oma-dot" />}
    </NavLink>
  )
}

/** The branch selector: Main, your branches, and Create new branch — the
 *  screenshot's dropdown, minus the legacy "Ontology branches" tab (we have
 *  one branch kind). */
function BranchControl() {
  const { ontology } = useOmaOntology()
  const branchId = useAppStore((s) => s.omaBranchId)
  const setBranch = useAppStore((s) => s.setOmaBranch)
  const { data: branches = [] } = useBranches(ontology?.id ?? null)
  const [creating, setCreating] = useState(false)
  const [waking, setWaking] = useState<{ id: string; title: string; status: string } | null>(null)
  const current = branches.find((b) => b.id === branchId)

  return (
    <>
      <Popover placement="bottom-end" content={
        <Menu>
          <MenuItem icon="add" text="Create new branch" onClick={() => { setCreating(true) }} />
          <MenuDivider />
          <MenuItem icon="git-branch" text="Main" label="Default" active={branchId === null}
            onClick={() => { setBranch(null) }} />
          {branches.length > 0 && <MenuDivider title="Your branches" />}
          {branches.map((b) => (
            <MenuItem key={b.id} icon="git-branch" text={b.title}
              label={b.status !== 'active' ? b.status : undefined}
              active={b.id === branchId}
              onClick={() => { if (b.status === 'active') setBranch(b.id); else setWaking(b) }} />
          ))}
        </Menu>
      }>
        <Button variant="minimal" size="small" icon="git-branch" endIcon="caret-down"
          text={current?.title ?? 'Main'} />
      </Popover>
      <CreateBranchDialog isOpen={creating} onClose={() => { setCreating(false) }} />
      {waking && <WakeBranchDialog branch={waking} onClose={() => { setWaking(null) }} />}
    </>
  )
}

/** The warning the docs show when opening a resource on a non-active branch,
 *  verbatim per state. Closing it still switches — "you can continue
 *  interacting with the resource, although this is not recommended." */
function WakeBranchDialog({ branch, onClose }: {
  branch: { id: string; title: string; status: string }
  onClose: () => void
}) {
  const setBranch = useAppStore((s) => s.setOmaBranch)
  const setStatus = useSetBranchStatus()
  const archived = branch.status === 'archived'
  return (
    <Dialog isOpen onClose={() => { setBranch(branch.id); onClose() }}
      title={archived ? 'This branch is archived' : 'This branch is inactive'} style={{ width: 440 }}>
      <DialogBody>
        <p className="text-sm">The branch you are viewing has been {archived ? 'archived' : 'marked as inactive'}.</p>
        <p className="text-sm mt-2">
          {archived ? 'Restore' : 'Activate'} the branch before making changes to prevent data deletion
          and allow indexing to take place.
        </p>
      </DialogBody>
      <DialogFooter actions={
        <Button intent={Intent.SUCCESS} icon="tick-circle" loading={setStatus.isPending}
          onClick={() => {
            setStatus.mutate({ branchId: branch.id, status: 'active' },
              { onSuccess: () => { setBranch(branch.id); onClose() } })
          }}>
          {archived ? 'Restore branch' : 'Activate branch'}
        </Button>
      } />
    </Dialog>
  )
}

function CreateBranchDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { ontology } = useOmaOntology()
  const setBranch = useAppStore((s) => s.setOmaBranch)
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('ontology_branches')
        .insert({ ontology_id: ontology?.id ?? '', name: toSlug(title).replace(/_/g, '-'), title: title.trim() })
        .select('id').single()
      if (error) throw new Error(error.message)
      return (data as { id: string }).id
    },
    onSuccess: (id) => {
      void qc.invalidateQueries({ queryKey: ['ontology-branches'] })
      setBranch(id)
      onClose()
      setTitle('')
    },
    onError: (e: Error) => { toast.error(e.message) },
  })
  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Create new branch" icon="git-new-branch" style={{ width: 420 }}>
      <DialogBody>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Branch name</span>
          <InputGroup placeholder="A short descriptive name for this branch" value={title}
            onChange={(e) => { setTitle(e.currentTarget.value) }} />
          <span className="text-[11px] text-muted-foreground">Do not include sensitive information</span>
        </label>
        <p className="text-[11px] text-muted-foreground mt-2">
          Only this ontology will be editable on this branch.
        </p>
      </DialogBody>
      <DialogFooter actions={<>
        <Button onClick={onClose}>Cancel</Button>
        <Button intent={Intent.PRIMARY} disabled={!title.trim()} loading={create.isPending}
          onClick={() => { create.mutate() }}>Create</Button>
      </>} />
    </Dialog>
  )
}

/** "The branch taskbar is displayed as a blue bar at the bottom of supported
 *  applications" — branch name, the modified-resource count, and the proposal
 *  actions. */
function BranchTaskbar() {
  const branchId = useAppStore((s) => s.omaBranchId)
  const setBranch = useAppStore((s) => s.setOmaBranch)
  const { ontology } = useOmaOntology()
  const { data: branches = [] } = useBranches(ontology?.id ?? null)
  const { data: changes = [] } = useBranchChanges(branchId)
  const { data: proposals = [] } = useProposals(ontology?.id ?? null)
  const createProposal = useCreateProposal()
  const navigate = useNavigate()
  if (branchId === null) return null
  const branch = branches.find((b) => b.id === branchId)
  const open = proposals.find((p) => p.branch_id === branchId && p.status === 'open')

  return (
    <div className="oma-taskbar">
      <Tag minimal className="!text-[10px]">Beta</Tag>
      <span className="ml-auto" />
      <Button variant="minimal" size="small" icon="git-branch" endIcon="caret-down"
        className="!text-white" onClick={() => { setBranch(null) }}
        title="Back to Main" text={branch?.title ?? 'branch'} />
      <Tag icon="folder-close" minimal className="!text-[10px] !text-white">{changes.length}</Tag>
      {open ? (
        <Button size="small" icon="git-pull" className="!text-white" variant="minimal"
          onClick={() => { void navigate(`/ontology/proposals?p=${open.id}`) }}>View proposal</Button>
      ) : (
        <Button size="small" icon="git-pull" variant="minimal" className="!text-white"
          loading={createProposal.isPending}
          disabled={changes.length === 0}
          title={changes.length === 0 ? 'This branch has changed nothing' : undefined}
          onClick={() => {
            createProposal.mutate(
              { branchId, name: `Proposal for foundry branch: ${branch?.title ?? ''}` },
              { onSuccess: () => { void navigate('/ontology/proposals') } })
          }}>Create proposal</Button>
      )}
    </div>
  )
}

/** A section heading with its count and a link onwards — the shape every
 *  Discover section and resource page header takes (§6.4). */
export function SectionHead({ title, count, seeAll }: { title: string; count?: number; seeAll?: React.ReactNode }) {
  return (
    <div className="oma-section-head">
      <h2 className="oma-section-title">{title}</h2>
      {count !== undefined && <Tag minimal className="!text-[10px]">{count}</Tag>}
      <span className="ml-auto">{seeAll}</span>
    </div>
  )
}


/** "Ontology resources are saved into a project" — new resources land in the
 *  project chosen here, and the database refuses a create without one while
 *  the ontology's toggle requires it. */
function OmaProjectPicker() {
  const { data: projects = [] } = useProjects()
  const projectId = useAppStore((s) => s.omaProjectId)
  const setProject = useAppStore((s) => s.setOmaProject)
  return (
    <label className="oma-project-picker">
      <span className="oma-project-label">Project</span>
      <select value={projectId ?? ''} onChange={(e) => { setProject(e.currentTarget.value || null) }}>
        <option value="">Select a project…</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  )
}
