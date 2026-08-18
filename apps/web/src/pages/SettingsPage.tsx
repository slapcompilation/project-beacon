// Platform Settings — the admin console Foundry reaches from Account >
// Settings. Groups (platform-security-management/manage-groups.md) and now
// Roles lead somewhere real; Users and Organizations arrive when something
// backs them, because an empty entry renders its empty state forever.
//
// The Group details layout follows the manage-groups dashboard: metadata with
// the permanent ID, Members ("individual users or groups"), Group permissions
// ("Manage permissions" / "Manage membership"), and Membership expiration
// (Latest expiration / Maximum duration — the database holds the rules and
// this page only surfaces its refusals).

import { useState } from 'react'
import {
  Button, Callout, Card, HTMLSelect, Icon, InputGroup, Intent, NonIdealState,
  Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { useAuthStore } from '@/stores/auth.store'
import { useOrgMembers } from '@/features/projects/api'
import {
  useGroups, useGroupMembers, useGroupPermissions, useCreateGroup, useUpdateGroup,
  useDeleteGroup, useAddGroupMember, useRemoveGroupMember,
  useGrantGroupPermission, useRevokeGroupPermission,
  type Group, type GroupPermission,
} from '@/features/groups/api'
import {
  useMyOrganization, useOrgGuests, useAddOrgGuest, useRemoveOrgGuest, useOrgRoles,
  useWorkflowCatalogue,
} from '@/features/organization/api'
import {
  useCreateTag, useCreateTagCategory, useDeleteTagEntity, useTagCategories, useTags,
} from '@/features/compass/catalogApi'

const PERMISSION_META: Record<GroupPermission, { label: string; help: string }> = {
  manage_permissions: {
    label: 'Manage permissions',
    help: 'Can grant permissions to manage aspects of the group, manage its members, and edit its metadata.',
  },
  manage_membership: {
    label: 'Manage membership',
    help: "Can manage the group's members, including membership expiration properties.",
  },
}

export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Platform Settings — what the organization shares, as opposed to the Account page's personal preferences.
          </p>
        </header>
        <OrganizationSection />
        <RolesSection />
        <GroupsSection />
        <TagsSection />
      </div>
    </div>
  )
}

// The Roles half of Organization permissions. The page is a list of role cards
// because Foundry's is: each carries its grantees and a footer counting what it
// confers ("Grants 24 workflows and unlocks 7 settings"), and the panel beside
// them reads "Select a role to manage grants to users or groups".
//
// Read-only for now, deliberately. Granting takes the
// `manage_organization_permissions` workflow, which nobody holds until an
// administrator grant exists — a form that always refuses is worse than no
// form, and the schema already refuses correctly.
function RolesSection() {
  const { data: roles = [], isLoading } = useOrgRoles()
  // The catalogue names each workflow; the role only stores its api name.
  const { data: catalogue = [] } = useWorkflowCatalogue()
  const named = new Map(catalogue.map((w) => [w.apiName, w]))
  if (isLoading) return <Spinner size={SpinnerSize.SMALL} />

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Roles</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          A role is a bundle of workflows, granted to users or groups. Default roles are offered to
          every organization; a custom role belongs to this one.
        </p>
      </div>
      <div className="space-y-2">
        {roles.map((r) => (
          <Card key={r.id} className="!p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.displayName}</span>
                  {r.organizationId === null
                    ? <Tag minimal className="!text-[10px]">Default role</Tag>
                    : <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">Custom</Tag>}
                  {r.applicationSpecific && (
                    <Tag minimal intent={Intent.WARNING} className="!text-[10px]"
                      title="Legacy application-specific roles are not incorporated in the Organization administrator role">
                      Application-specific
                    </Tag>
                  )}
                </div>
                {r.description !== null && (
                  <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1 font-mono">{r.apiName}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">
                  {r.workflows.length === 0
                    ? 'No workflows of its own'
                    : `Grants ${String(r.workflows.length)} workflow${r.workflows.length === 1 ? '' : 's'}`}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {r.grants === 0 ? 'Held by nobody' : `Held by ${String(r.grants)}`}
                </p>
              </div>
            </div>
            {r.workflows.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {r.workflows.map((w) => (
                  <Tag key={w} minimal className="!text-[10px]" title={named.get(w)?.description ?? w}>
                    {named.get(w)?.displayName ?? w}
                  </Tag>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      <Callout intent={Intent.NONE} className="!text-xs">
        The Organization administrator incorporates all workflows from other roles of that level,
        except application-specific ones — but only workflows some role already carries, so one
        held by nobody stays held by nobody.
      </Callout>

      <WorkflowCatalogueSection />
    </section>
  )
}

// The list a custom role is composed from: "Enrollment administrators and
// Organization administrators can define custom roles in Control Panel by
// selecting individual workflows."
//
// Read-only alongside the roles above, and worth showing on its own because a
// workflow exists here before any role carries it — which is exactly the state
// that hid two dead policies until 563. A workflow nothing carries is visible
// here and nowhere else.
function WorkflowCatalogueSection() {
  const { data: catalogue = [] } = useWorkflowCatalogue()
  const { data: roles = [] } = useOrgRoles()
  if (catalogue.length === 0) return null

  const carried = new Set(roles.flatMap((r) => r.workflows))
  const byScope = (scope: 'organization' | 'space') =>
    catalogue.filter((w) => w.scope === scope)

  return (
    <div className="space-y-2 border-t pt-3">
      <div>
        <h3 className="text-xs font-semibold">Workflows</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Everything a role may be given. A workflow exists before any role carries it, which is
          what makes a custom role something you compose rather than inherit.
        </p>
      </div>
      {(['organization', 'space'] as const).map((scope) => (
        <div key={scope}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            {scope}
          </p>
          <div className="space-y-1">
            {byScope(scope).map((w) => (
              <div key={w.apiName} className="flex items-baseline gap-2">
                <span className="text-xs">{w.displayName}</span>
                {!w.published && (
                  <Tag minimal intent={Intent.WARNING} className="!text-[10px]"
                    title="Ours: no Foundry page names this workflow. It exists because a policy needed a token.">
                    ours
                  </Tag>
                )}
                {/* Only meaningful at the organization level, where this page
                    can see which roles carry what. */}
                {scope === 'organization' && !carried.has(w.apiName) && (
                  <Tag minimal className="!text-[10px]" title="Catalogued, so a custom role may include it — but no role carries it today.">
                    carried by no role
                  </Tag>
                )}
                <span className="text-[11px] text-muted-foreground font-mono ml-auto">
                  {w.apiName}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// The Organization permissions surface, Guest membership half: "Manage
// members of other organizations who can view projects and files marked with
// this organization." Registries are org-siloed, so a foreign principal is
// added by its ID; enrollment-wide discovery is the next slice.
function OrganizationSection() {
  const { data: org } = useMyOrganization()
  const { data: guests = [] } = useOrgGuests()
  const add = useAddOrgGuest()
  const remove = useRemoveOrgGuest()
  const isAdmin = useAuthStore((s) => s.role === 'owner' || s.role === 'admin')
  const [kind, setKind] = useState<'user' | 'group'>('user')
  const [principalId, setPrincipalId] = useState('')

  if (!org) return null
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Icon icon="office" size={14} className="text-muted-foreground" />{org.name}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          The organization is a marking{org.markingName ? <> — <Tag minimal className="!text-[10px]">{org.markingName}</Tag></> : null}.
          New projects and groups are restricted to its members by default; guests below can see what it marks.
        </p>
      </div>

      <Card compact className="!p-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Icon icon="following" size={12} className="text-muted-foreground" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Guest membership</span>
          <Tag minimal className="!text-[10px]">{guests.length}</Tag>
          <span className="text-[11px] text-muted-foreground/70 ml-1">
            Members of other organizations who can view what this organization marks.
          </span>
        </div>
        {guests.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">No guests. Only members see what this organization marks.</p>
        ) : (
          <ul className="divide-y divide-border/30">
            {guests.map((g) => (
              <li key={g.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <Icon icon={g.userId ? 'person' : 'people'} size={11} className="text-muted-foreground" />
                <span className="flex-1 truncate">{g.label}</span>
                {isAdmin && (
                  <Button variant="minimal" size="small" icon="cross" intent={Intent.DANGER}
                    title="Remove guest" onClick={() => { remove.mutate(g.id) }} />
                )}
              </li>
            ))}
          </ul>
        )}
        {isAdmin && (
          <div className="flex flex-wrap items-end gap-2 border-t border-border px-3 py-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Kind</span>
              <HTMLSelect value={kind} onChange={(e) => { setKind(e.currentTarget.value as 'user' | 'group') }}>
                <option value="user">User</option>
                <option value="group">Group</option>
              </HTMLSelect>
            </label>
            <label className="flex flex-col gap-1 flex-1 min-w-64">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {kind === 'user' ? 'User ID' : 'Group ID'} (from the other organization)
              </span>
              <InputGroup value={principalId} placeholder="00000000-0000-0000-0000-000000000000"
                onChange={(e) => { setPrincipalId(e.currentTarget.value) }} />
            </label>
            <Button size="small" icon="add" loading={add.isPending} disabled={!principalId.trim()}
              onClick={() => { add.mutate({ kind, principalId: principalId.trim() }, { onSuccess: () => { setPrincipalId('') } }) }}>
              Add guest
            </Button>
          </div>
        )}
      </Card>
    </section>
  )
}

function GroupsSection() {
  const { data: groups = [], isLoading } = useGroups()
  const isAdmin = useAuthStore((s) => s.role === 'owner' || s.role === 'admin')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const selected = groups.find((g) => g.id === selectedId) ?? null

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Icon icon="people" size={14} className="text-muted-foreground" />Groups
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            A set of users and other groups — the usual grant target for project roles.
            A role granted to a group reaches every member, through nesting.
          </p>
        </div>
        {isAdmin && (
          <Button icon="add" size="small" onClick={() => { setCreating(!creating) }}>New group</Button>
        )}
      </div>

      {creating && <CreateGroupPane onDone={() => { setCreating(false) }} />}

      {isLoading ? (
        <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} />Loading…
        </Card>
      ) : groups.length === 0 ? (
        <NonIdealState icon="people" title="No groups yet"
          description="Grant a role to a group once instead of to each person; membership then decides who holds it." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {groups.map((g) => (
            <Card key={g.id} interactive compact
              className={selectedId === g.id ? '!border-violet-400' : ''}
              onClick={() => { setSelectedId(selectedId === g.id ? null : g.id) }}>
              <div className="flex items-center gap-2">
                <Icon icon="people" size={14} className="text-violet-500" />
                <span className="text-sm font-semibold truncate">{g.name}</span>
                <Tag minimal className="!text-[10px] ml-auto">{g.memberCount}</Tag>
              </div>
              {g.description && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{g.description}</p>}
            </Card>
          ))}
        </div>
      )}

      {selected && <GroupDetails group={selected} />}
    </section>
  )
}

function CreateGroupPane({ onDone }: { onDone: () => void }) {
  const create = useCreateGroup()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  return (
    <Card className="space-y-3 !border-violet-400/50">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 flex-1 min-w-48">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
          <InputGroup value={name} placeholder="Flight Ops" onChange={(e) => { setName(e.currentTarget.value) }} />
        </label>
        <label className="flex flex-col gap-1 flex-1 min-w-48">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</span>
          <InputGroup value={description} placeholder="Optional — who this group is."
            onChange={(e) => { setDescription(e.currentTarget.value) }} />
        </label>
        <Button intent={Intent.PRIMARY} size="small" icon="tick" loading={create.isPending}
          disabled={!name.trim()}
          onClick={() => { create.mutate({ name: name.trim(), description: description.trim() }, { onSuccess: onDone }) }}>
          Create
        </Button>
        <Button variant="minimal" size="small" onClick={onDone}>Cancel</Button>
      </div>
      <p className="text-[11px] text-muted-foreground/70">
        You will be able to manage its permissions and membership; both are grantable onward.
      </p>
    </Card>
  )
}

function GroupDetails({ group }: { group: Group }) {
  const del = useDeleteGroup()

  return (
    <section className="space-y-3 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Icon icon="people" className="text-violet-500" />{group.name}
            <Tag minimal className="!text-[10px]">internal</Tag>
          </h3>
          {/* "Group ID: The permanent, unique ID of the group." */}
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{group.id}</p>
          {group.description && <p className="text-xs text-muted-foreground mt-1">{group.description}</p>}
        </div>
        <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
          loading={del.isPending} onClick={() => { del.mutate(group.id) }}>
          Delete
        </Button>
      </div>

      <MembersCard group={group} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PermissionsCard groupId={group.id} />
        <ExpirationCard group={group} />
      </div>
    </section>
  )
}

function MembersCard({ group }: { group: Group }) {
  const { data: members = [] } = useGroupMembers(group.id)
  const { data: groups = [] } = useGroups()
  const { data: people = [] } = useOrgMembers()
  const add = useAddGroupMember(group.id)
  const remove = useRemoveGroupMember(group.id)
  const [principal, setPrincipal] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const bounded = group.latestExpiration !== null || group.maxDuration !== null
  const memberUserIds = new Set(members.flatMap((m) => m.memberUserId ? [m.memberUserId] : []))
  const memberGroupIds = new Set(members.flatMap((m) => m.memberGroupId ? [m.memberGroupId] : []))
  const userChoices = people.filter((p) => !memberUserIds.has(p.id))
  const groupChoices = groups.filter((g) => g.id !== group.id && !memberGroupIds.has(g.id))

  const submit = () => {
    const [kind, id] = principal.split(':')
    add.mutate(
      { userId: kind === 'u' ? id : undefined, memberGroupId: kind === 'g' ? id : undefined,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null },
      { onSuccess: () => { setPrincipal(''); setExpiresAt('') } })
  }

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="person" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Members</span>
        <Tag minimal className="!text-[10px]">{members.length}</Tag>
        <span className="text-[11px] text-muted-foreground/70 ml-1">Individual users or groups.</span>
      </div>

      {members.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">Nobody yet. A role granted to this group reaches no one until someone joins.</p>
      ) : (
        <ul className="divide-y divide-border/30">
          {members.map((m) => {
            const expired = m.expiresAt !== null && new Date(m.expiresAt) <= new Date()
            return (
              <li key={m.memberUserId ?? m.memberGroupId} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                <Icon icon={m.memberUserId ? 'person' : 'people'} size={11} className="text-muted-foreground" />
                <span className="flex-1 truncate">{m.label}</span>
                {m.expiresAt && (
                  <Tag minimal intent={expired ? Intent.DANGER : Intent.WARNING} className="!text-[9px]"
                    title={expired ? 'Expired — grants nothing.' : 'Temporary membership.'}>
                    {expired ? 'expired' : `until ${new Date(m.expiresAt).toLocaleString()}`}
                  </Tag>
                )}
                <Button variant="minimal" size="small" icon="cross" intent={Intent.DANGER} title="Remove member"
                  onClick={() => { remove.mutate({ userId: m.memberUserId ?? undefined, memberGroupId: m.memberGroupId ?? undefined }) }} />
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-border px-3 py-3">
        <label className="flex flex-col gap-1 flex-1 min-w-48">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Add member</span>
          <HTMLSelect value={principal} onChange={(e) => { setPrincipal(e.currentTarget.value) }}>
            <option value="">Pick a user or a group…</option>
            {userChoices.length > 0 && (
              <optgroup label="Users">
                {userChoices.map((p) => <option key={p.id} value={`u:${p.id}`}>{p.email}</option>)}
              </optgroup>
            )}
            {groupChoices.length > 0 && (
              <optgroup label="Groups">
                {groupChoices.map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name}</option>)}
              </optgroup>
            )}
          </HTMLSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Expires{bounded ? ' (required)' : ''}
          </span>
          <InputGroup type="datetime-local" value={expiresAt}
            onChange={(e) => { setExpiresAt(e.currentTarget.value) }} />
        </label>
        <Button size="small" icon="add" loading={add.isPending} disabled={!principal} onClick={submit}>Add</Button>
      </div>
    </Card>
  )
}

function PermissionsCard({ groupId }: { groupId: string }) {
  const { data: grants = [] } = useGroupPermissions(groupId)
  const { data: people = [] } = useOrgMembers()
  const grant = useGrantGroupPermission(groupId)
  const revoke = useRevokeGroupPermission(groupId)
  const [userId, setUserId] = useState('')
  const [permission, setPermission] = useState<GroupPermission>('manage_membership')

  const held = new Set(grants.map((g) => `${g.userId}:${g.permission}`))
  const choices = people.filter((p) => !held.has(`${p.id}:${permission}`))

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="key" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Group permissions</span>
      </div>
      {grants.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">Only org admins can manage this group.</p>
      ) : (
        <ul className="divide-y divide-border/30">
          {grants.map((g) => (
            <li key={`${g.userId}:${g.permission}`} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <Icon icon="person" size={11} className="text-muted-foreground" />
              <span className="flex-1 truncate">{g.label}</span>
              <Tag minimal className="!text-[9px]" title={PERMISSION_META[g.permission].help}>
                {PERMISSION_META[g.permission].label}
              </Tag>
              <Button variant="minimal" size="small" icon="cross" intent={Intent.DANGER} title="Revoke"
                onClick={() => { revoke.mutate({ userId: g.userId, permission: g.permission }) }} />
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2 border-t border-border px-3 py-3">
        <label className="flex flex-col gap-1 flex-1 min-w-40">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Grant to</span>
          <HTMLSelect value={userId} onChange={(e) => { setUserId(e.currentTarget.value) }}>
            <option value="">Pick someone…</option>
            {choices.map((p) => <option key={p.id} value={p.id}>{p.email}</option>)}
          </HTMLSelect>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Permission</span>
          <HTMLSelect value={permission} onChange={(e) => { setPermission(e.currentTarget.value as GroupPermission) }}>
            {(Object.keys(PERMISSION_META) as GroupPermission[]).map((p) => (
              <option key={p} value={p}>{PERMISSION_META[p].label}</option>
            ))}
          </HTMLSelect>
        </label>
        <Button size="small" icon="add" loading={grant.isPending} disabled={!userId}
          onClick={() => { grant.mutate({ userId, permission }, { onSuccess: () => { setUserId('') } }) }}>
          Grant
        </Button>
        <p className="text-[11px] text-muted-foreground w-full">{PERMISSION_META[permission].help}</p>
      </div>
    </Card>
  )
}

function ExpirationCard({ group }: { group: Group }) {
  const update = useUpdateGroup(group.id)
  const [latest, setLatest] = useState(group.latestExpiration?.slice(0, 16) ?? '')
  const [duration, setDuration] = useState(group.maxDuration ?? '')

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon icon="time" size={12} className="text-muted-foreground" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Membership expiration</span>
      </div>
      <div className="space-y-2 px-3 py-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Latest expiration</span>
          <InputGroup type="datetime-local" value={latest}
            onChange={(e) => { setLatest(e.currentTarget.value) }} />
          <span className="text-[11px] text-muted-foreground/70">
            All new memberships must have an expiration date that is earlier than this date.
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Maximum duration</span>
          <InputGroup value={duration} placeholder="e.g. 30 days"
            onChange={(e) => { setDuration(e.currentTarget.value) }} />
          <span className="text-[11px] text-muted-foreground/70">
            All new memberships must expire within the specified duration. When both are set, the most constraining applies.
          </span>
        </label>
        <div className="flex items-center gap-2">
          <Button size="small" icon="tick" loading={update.isPending}
            onClick={() => {
              update.mutate({
                latestExpiration: latest ? new Date(latest).toISOString() : null,
                maxDuration: duration.trim() || null,
              })
            }}>
            Save
          </Button>
          {(group.latestExpiration ?? group.maxDuration) && (
            <Callout compact className="!text-[11px] flex-1" icon="time">
              New memberships must be temporary; existing ones are untouched.
            </Callout>
          )}
        </div>
      </div>
    </Card>
  )
}


// "You can manage tags and tag categories in the **Tags** section of
// Platform Settings." Tags never gate — deleting removes them from every
// resource, and nothing about visibility changes.
function TagsSection() {
  const { data: categories = [] } = useTagCategories()
  const { data: tags = [] } = useTags()
  const createCategory = useCreateTagCategory()
  const createTag = useCreateTag()
  const del = useDeleteTagEntity()
  const isAdmin = useAuthStore((s) => s.role === 'owner' || s.role === 'admin')
  const [newCategory, setNewCategory] = useState('')
  const [newTag, setNewTag] = useState('')
  const [inCategory, setInCategory] = useState('')

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Icon icon="tag" size={14} className="text-muted-foreground" />Tags
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Structured metadata for categorization and discovery — tags never add or imply security.
        </p>
      </div>
      {categories.map((c) => (
        <Card key={c.id} compact className="!py-2">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="font-semibold">{c.name}</span>
            {tags.filter((t) => t.categoryId === c.id).map((t) => (
              <Tag key={t.id} minimal
                onRemove={isAdmin ? () => { del.mutate({ table: 'tags', id: t.id }) } : undefined}>
                {t.name}
              </Tag>
            ))}
            {isAdmin && (
              <Button variant="minimal" size="small" icon="trash" intent={Intent.DANGER}
                title="Delete category — removed from all resources, cannot be undone"
                onClick={() => { del.mutate({ table: 'tag_categories', id: c.id }) }} />
            )}
          </div>
        </Card>
      ))}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup size="small" value={newCategory} placeholder="New tag category…"
            onChange={(e) => { setNewCategory(e.currentTarget.value) }} />
          <Button size="small" icon="add" loading={createCategory.isPending} disabled={!newCategory.trim()}
            onClick={() => { createCategory.mutate(newCategory.trim(), { onSuccess: () => { setNewCategory('') } }) }}>
            Category
          </Button>
          <HTMLSelect value={inCategory} onChange={(e) => { setInCategory(e.currentTarget.value) }}>
            <option value="">In category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </HTMLSelect>
          <InputGroup size="small" value={newTag} placeholder="New tag…"
            onChange={(e) => { setNewTag(e.currentTarget.value) }} />
          <Button size="small" icon="add" loading={createTag.isPending}
            disabled={!newTag.trim() || !inCategory}
            onClick={() => { createTag.mutate({ categoryId: inCategory, name: newTag.trim() }, { onSuccess: () => { setNewTag('') } }) }}>
            Tag
          </Button>
        </div>
      )}
    </section>
  )
}
