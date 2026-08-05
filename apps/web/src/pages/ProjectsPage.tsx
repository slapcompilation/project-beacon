// Projects — Foundry's primary security boundary, given a surface.
//
// Shape copied from Compass rather than invented: a landing page listing the
// projects with **+ New project** at the upper right, a create pane taking a
// name, an optional description and a default role, and a details panel whose
// **Access** tab manages who holds which role
// (mirror/compass/create-a-project.md, use-project-details-panel.md).
//
// Their Access tab behaves differently by role, and so does this one: "for a
// Project Owner, this panel provides an interface to... configure additional
// access by granting roles to other users and groups. For users with a Viewer or
// Editor role, the Access panel shows an overview of the current groups with
// Project access."
//
// The space picker is deliberately absent — Foundry's "location (space)" is the
// tenant a project lives in, and ours is the organization, decided by RLS rather
// than by a dropdown.

import { useState } from 'react'
import {
  Button, Callout, Card, HTMLSelect, Icon, InputGroup, Intent, NonIdealState,
  Spinner, SpinnerSize, Tag, TextArea,
} from '@blueprintjs/core'
import { toSlug, grantableRoles, roleAtLeast, ROLE_META, PROJECT_ROLES, type ProjectRole } from '@beacon/ontology'
import { useAuthStore } from '@/stores/auth.store'
import {
  useProjects, useCreateProject, useProjectMembers, useMyProjectRole,
  useGrantRole, useRevokeRole, useProjectResources, useOrgMembers,
  type Project,
} from '@/features/projects/api'

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const selected = projects.find((p) => p.id === selectedId) ?? null

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Projects</h1>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
              A project is a bucket of shared work, and the boundary access is granted on.
              A role given here reaches everything the project contains.
            </p>
          </div>
          <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setCreating(!creating) }}>
            New project
          </Button>
        </header>

        {creating && <CreatePane onDone={() => { setCreating(false) }} />}

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : projects.length === 0 ? (
          <NonIdealState icon="folder-close" title="No projects yet"
            description="A project groups the object types, applications and documents that belong to one piece of work — and is where you grant someone access to all of it at once." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {projects.map((p) => (
              <Card key={p.id} interactive compact
                className={selectedId === p.id ? '!border-violet-400' : ''}
                onClick={() => { setSelectedId(selectedId === p.id ? null : p.id) }}>
                <div className="flex items-center gap-2">
                  <Icon icon="folder-close" size={14} className="text-violet-500" />
                  <span className="text-sm font-semibold truncate">{p.name}</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{p.apiName}</p>
                {p.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{p.description}</p>}
              </Card>
            ))}
          </div>
        )}

        {selected && <ProjectDetails project={selected} />}
      </div>
    </div>
  )
}

function CreatePane({ onDone }: { onDone: () => void }) {
  const create = useCreateProject()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  // "You can also change the default role for users within your Organization."
  const [defaultRole, setDefaultRole] = useState<ProjectRole>('owner')
  const apiName = toSlug(name)

  return (
    <Card className="space-y-3 !border-violet-400/50">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-48">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
          <InputGroup value={name} placeholder="Bar inventory" onChange={(e) => { setName(e.currentTarget.value) }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your role</span>
          <HTMLSelect value={defaultRole} onChange={(e) => { setDefaultRole(e.currentTarget.value as ProjectRole) }}>
            {PROJECT_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
          </HTMLSelect>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</span>
        <TextArea fill rows={2} value={description} placeholder="Optional — what this work is."
          onChange={(e) => { setDescription(e.currentTarget.value) }} />
      </label>
      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} size="small" icon="tick" loading={create.isPending}
          disabled={!apiName}
          onClick={() => {
            create.mutate({ apiName, name: name.trim(), description: description.trim(), defaultRole },
              { onSuccess: onDone })
          }}>
          Create
        </Button>
        <Button variant="minimal" size="small" onClick={onDone}>Cancel</Button>
        {apiName && <span className="text-[11px] text-muted-foreground font-mono">{apiName}</span>}
      </div>
    </Card>
  )
}

function ProjectDetails({ project }: { project: Project }) {
  const { data: myRole } = useMyProjectRole(project.id)
  const { data: members = [] } = useProjectMembers(project.id)
  const { data: resources = [] } = useProjectResources(project.id)
  const role = useAuthStore((s) => s.role)
  // An org admin can always manage access — the bootstrap, since someone has to
  // grant the first Owner. Otherwise it is the project's own Owner.
  const canGrant = role === 'owner' || role === 'admin' || roleAtLeast(myRole, 'owner')

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex items-center gap-2">
        <Icon icon="folder-open" size={15} className="text-violet-500" />
        <h2 className="text-sm font-semibold">{project.name}</h2>
        {myRole && <Tag minimal intent={Intent.PRIMARY} className="!text-[9px] uppercase">{ROLE_META[myRole].label}</Tag>}
      </div>

      <Card compact className="!p-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Icon icon="box" size={12} className="text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Contents</span>
          <Tag minimal className="!text-[10px]">{resources.length}</Tag>
        </div>
        {resources.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            Nothing in this project yet. A resource belongs to one project — work and its output live together.
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {resources.map((r) => (
              <li key={`${r.resourceKind}-${r.resourceId}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <Tag minimal className="!text-[9px]">{r.resourceKind.replace('_', ' ')}</Tag>
                <span className="font-mono text-[10px] text-muted-foreground truncate">{r.resourceId}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AccessPanel projectId={project.id} members={members} myRole={myRole ?? null} canGrant={canGrant} />
    </section>
  )
}

function AccessPanel({
  projectId, members, myRole, canGrant,
}: {
  projectId: string
  members: { userId: string; role: ProjectRole; email: string | null }[]
  myRole: ProjectRole | null
  canGrant: boolean
}) {
  const grant = useGrantRole(projectId)
  const revoke = useRevokeRole(projectId)
  const { data: people = [] } = useOrgMembers()
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<ProjectRole>('viewer')

  // "Each role can assign other users the same or lesser role." An org admin
  // bootstrapping has no project role, so they may grant anything.
  const offerable = canGrant && myRole === null ? [...PROJECT_ROLES] : grantableRoles(myRole)
  const unassigned = people.filter((p) => !members.some((m) => m.userId === p.id))

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="key" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Access</span>
        <Tag minimal className="!text-[10px]">{members.length}</Tag>
        <span className="text-[11px] text-muted-foreground/70 ml-1">
          A role here reaches everything the project contains.
        </span>
      </div>

      {members.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          Nobody has been granted a role yet. Org admins can still administer it.
        </p>
      ) : (
        <ul className="divide-y divide-border/30">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <Icon icon="person" size={11} className="text-muted-foreground" />
              <span className="flex-1 truncate">{m.email ?? m.userId}</span>
              <Tag minimal className="!text-[9px] uppercase" title={ROLE_META[m.role].help}>
                {ROLE_META[m.role].label}
              </Tag>
              {canGrant && (
                <Button variant="minimal" size="small" icon="cross" intent={Intent.DANGER}
                  title="Remove access" onClick={() => { revoke.mutate(m.userId) }} />
              )}
            </li>
          ))}
        </ul>
      )}

      {canGrant ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border px-3 py-3">
          <label className="flex flex-col gap-1 flex-1 min-w-48">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Grant to</span>
            <HTMLSelect value={userId} onChange={(e) => { setUserId(e.currentTarget.value) }}>
              <option value="">Pick someone…</option>
              {unassigned.map((p) => <option key={p.id} value={p.id}>{p.email}</option>)}
            </HTMLSelect>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Role</span>
            <HTMLSelect value={role} onChange={(e) => { setRole(e.currentTarget.value as ProjectRole) }}>
              {offerable.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
            </HTMLSelect>
          </label>
          <Button size="small" icon="add" loading={grant.isPending} disabled={!userId}
            onClick={() => { grant.mutate({ userId, role }, { onSuccess: () => { setUserId('') } }) }}>
            Grant
          </Button>
          <p className="text-[11px] text-muted-foreground w-full">{ROLE_META[role].help}</p>
        </div>
      ) : (
        <Callout className="!rounded-none !border-0 border-t !text-xs" icon="info-sign">
          You can see who has access. Granting it needs the Owner role on this project.
        </Callout>
      )}
    </Card>
  )
}
