// Platform Settings — the admin console Foundry reaches from Account >
// Settings. One section leads somewhere real today: Groups
// (platform-security-management/manage-groups.md). Users, Roles and
// Organizations arrive when something backs them; empty entries would render
// their empty states forever.
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
        <GroupsSection />
      </div>
    </div>
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
