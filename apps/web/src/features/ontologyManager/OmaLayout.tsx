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
// The sidebar screenshot (§6.3) inventories fourteen entries. Five lead
// somewhere. OMITTED BY NAME, with what would have to exist first:
//   Unsaved changes  — the save session lives in the top bar instead, where the
//                      count and its buttons already are (§10.8 puts it here too).
//   Proposals        — `ontology_proposals` holds rows; nothing opens or reviews one.
//   History          — `object_edits` and `branch_resource_changes` exist; no reader.
//   Properties       — a flat index of every property across types; nothing builds
//                      it. It is also the one entry with no count in the screenshot.
//   Groups           — `type_groups` and `object_type_group_members` exist; no surface.
//   Value types      — nothing behind it.
//   Functions        — nothing behind it.
//   Health issues    — `ontology_violations()` would back it; nothing renders it.
//   Cleanup          — nothing behind it.
//   Ontology configuration — nothing behind it.
// The header's `New ▾` goes with them: creation lives in the object types page.

import { useEffect, useState } from 'react'
import {
  Button, Icon, Menu, MenuDivider, MenuItem, NonIdealState, Popover, Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app.store'
import { useAuthStore } from '@/stores/auth.store'
import { useProjects } from '@/features/projects/api'
import { OntologyPicker } from '@/features/ontologies/OntologyPicker'
import { SaveControl } from '@/features/workingState/ReviewEdits'
import { OmaSearch } from './OmaSearch'
import { RESOURCE_NAV, countOf, useOmaResources } from './resources'

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
            <div className="oma-rule" />
            <p className="oma-group-title">Resources</p>
            {RESOURCE_NAV.map((r) => (
              <NavRow key={r.path} icon={r.icon} label={r.label} path={r.path}
                count={countOf(resources, r.kind)} />
            ))}
          </nav>
        </aside>

        <div className="oma-content">
          <Outlet />
        </div>
      </div>

      {searching && <OmaSearch resources={resources} onClose={() => { setSearching(false) }} />}
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

/** "navigate between or create new branches" (§6.2). `ontology_branches` is a
 *  real table with real policies and no rows: nothing creates or opens one yet,
 *  and Main is the ontology itself rather than a row in it. */
function BranchControl() {
  return (
    <Popover placement="bottom-end" content={
      <Menu>
        <MenuDivider title="Branch" />
        <MenuItem icon="git-branch" text="Main" active disabled />
        <MenuItem disabled text="No branch surface yet — every edit is on main" />
      </Menu>
    }>
      <Button variant="minimal" size="small" icon="git-branch" endIcon="caret-down" text="Main" />
    </Popover>
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
