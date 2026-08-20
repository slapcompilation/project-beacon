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
// **Default role** is a standing setting granted to the whole ORGANIZATION, not
// the creator — the create dialog states its own effect: "Everyone from <org> can
// see the existence of this project and is granted the <role> role." It is a
// floor; an explicit grant can only raise it (migration 398).
//
// The space picker is still absent. Spaces exist (migration 397) but a project's
// space is not yet chosen here, so a project's location falls back to /<project>.

import { useState } from 'react'
import {
  Button, Callout, Card, HTMLSelect, Icon, InputGroup, Intent, NonIdealState,
  Spinner, SpinnerSize, Tag, TextArea,
} from '@blueprintjs/core'
import { toSlug, grantableRoles, roleAtLeast, ROLE_META, PROJECT_ROLES, type ProjectRole } from '@beacon/ontology'
import { useAuthStore } from '@/stores/auth.store'
import { PolicyPanel } from '@/features/projects/PolicyPanel'
import {
  useProjects, useCreateProject, useProjectMembers, useMyProjectRole,
  useGrantRole, useRevokeRole, useSetDefaultRole, useProjectResources, useOrgMembers,
  type Project,
} from '@/features/projects/api'
import { useGroups } from '@/features/groups/api'
import { FilesCard } from '@/features/compass/FilesCard'

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
                className={selectedId === p.id ? '!border-primary' : ''}
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
  const [defaultRole, setDefaultRole] = useState<ProjectRole>('viewer')
  const apiName = toSlug(name)

  return (
    <Card className="space-y-3 !border-violet-400/50">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-48">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
          <InputGroup value={name} placeholder="Bar inventory" onChange={(e) => { setName(e.currentTarget.value) }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Default role</span>
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
        {/* Foundry's dialog builds this sentence from the selections above. */}
        <span className="text-[11px] text-muted-foreground/70">
          Everyone in the organization is granted {ROLE_META[defaultRole].label}.
        </span>
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

      <FilesCard projectId={project.id} />

      {/* 462 stored the policy and its trigger enforces it; this is the
          "Policies rendered" leftover from readings/branch-overlay.md. */}
      <PolicyPanel project={project} members={members} canEdit={canGrant} />

      <AccessPanel projectId={project.id} members={members} myRole={myRole ?? null}
        canGrant={canGrant} defaultRole={project.defaultRole} />
    </section>
  )
}

function AccessPanel({
  projectId, members, myRole, canGrant, defaultRole,
}: {
  projectId: string
  members: { userId: string | null; groupId: string | null; role: ProjectRole; label: string | null }[]
  myRole: ProjectRole | null
  canGrant: boolean
  defaultRole: ProjectRole | null
}) {
  const grant = useGrantRole(projectId)
  const revoke = useRevokeRole(projectId)
  const setDefault = useSetDefaultRole(projectId)
  const { data: people = [] } = useOrgMembers()
  const { data: groups = [] } = useGroups()
  const [principal, setPrincipal] = useState('')
  const [role, setRole] = useState<ProjectRole>('viewer')

  // "Each role can assign other users the same or lesser role." An org admin
  // bootstrapping has no project role, so they may grant anything.
  const offerable = canGrant && myRole === null ? [...PROJECT_ROLES] : grantableRoles(myRole)
  const unassigned = people.filter((p) => !members.some((m) => m.userId === p.id))
  // "Access to Projects and resources are usually granted to groups rather
  // than individual users." — so groups sit in the same picker.
  const ungrantedGroups = groups.filter((g) => !members.some((m) => m.groupId === g.id))

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

      {/* Foundry puts Default role at the top of Manage roles, above the
          principals, because it is what everyone gets before anyone is named. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Default role</span>
        <HTMLSelect minimal disabled={!canGrant} value={defaultRole ?? ''}
          onChange={(e) => { setDefault.mutate((e.currentTarget.value || null) as ProjectRole | null) }}>
          <option value="">None</option>
          {PROJECT_ROLES.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
        </HTMLSelect>
        <span className="text-[11px] text-muted-foreground/70">
          {defaultRole
            ? `Everyone in the organization is granted ${ROLE_META[defaultRole].label}. A grant below can only raise it.`
            : 'Nobody gets a role just for being in the organization.'}
        </span>
      </div>

      {members.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          Nobody has been granted a role beyond the default. Org admins can still administer it.
        </p>
      ) : (
        <ul className="divide-y divide-border/30">
          {members.map((m) => (
            <li key={m.userId ?? m.groupId} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <Icon icon={m.groupId ? 'people' : 'person'} size={11} className="text-muted-foreground" />
              <span className="flex-1 truncate">{m.label ?? m.userId ?? m.groupId}</span>
              <Tag minimal className="!text-[9px] uppercase" title={ROLE_META[m.role].help}>
                {ROLE_META[m.role].label}
              </Tag>
              {canGrant && (
                <Button variant="minimal" size="small" icon="cross" intent={Intent.DANGER}
                  title="Remove access"
                  onClick={() => { revoke.mutate({ userId: m.userId ?? undefined, groupId: m.groupId ?? undefined }) }} />
              )}
            </li>
          ))}
        </ul>
      )}

      {canGrant ? (
        <div className="flex flex-wrap items-end gap-2 border-t border-border px-3 py-3">
          <label className="flex flex-col gap-1 flex-1 min-w-48">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Grant to</span>
            <HTMLSelect value={principal} onChange={(e) => { setPrincipal(e.currentTarget.value) }}>
              <option value="">Pick a user or a group…</option>
              {ungrantedGroups.length > 0 && (
                <optgroup label="Groups">
                  {ungrantedGroups.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}
                </optgroup>
              )}
              {unassigned.length > 0 && (
                <optgroup label="Users">
                  {unassigned.map((p) => <option key={p.id} value={`u:${p.id}`}>{p.email}</option>)}
                </optgroup>
              )}
            </HTMLSelect>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Role</span>
            <HTMLSelect value={role} onChange={(e) => { setRole(e.currentTarget.value as ProjectRole) }}>
              {offerable.map((r) => <option key={r} value={r}>{ROLE_META[r].label}</option>)}
            </HTMLSelect>
          </label>
          <Button size="small" icon="add" loading={grant.isPending} disabled={!principal}
            onClick={() => {
              const [kind, id] = principal.split(':')
              grant.mutate(
                { userId: kind === 'u' ? id : undefined, groupId: kind === 'g' ? id : undefined, role },
                { onSuccess: () => { setPrincipal('') } })
            }}>
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
