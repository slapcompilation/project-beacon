// User administration, to the capture rather than to its page: the table
// draws Username | Given name | Family name | Organization | Realm, and the
// details panel runs identity, User ID, Organization, Groups, Attributes
// (platform-security-management/images/manage-users.png). The prose lists a
// different set of columns; the capture is the drawn surface.
//
// Search is the search endpoint's own spec: "a case-insensitive prefix
// search for active users based on username, given name and family name",
// deleted users excluded — which is why Show deleted is a separate switch.

import { useState } from 'react'
import { Button, Card, Icon, InputGroup, Intent, Switch, Tag } from '@blueprintjs/core'
import {
  useUsers, useUserAttributes, useUserGroups, useUpdateUser, useSetUserStatus,
  useSetUserAttribute, useRemoveUserAttribute, type PlatformUser,
} from './api'

const initials = (u: PlatformUser): string => {
  const g = u.givenName?.[0] ?? ''
  const f = u.familyName?.[0] ?? ''
  return (g + f) || u.username.slice(0, 2).toUpperCase()
}

const fullName = (u: PlatformUser): string =>
  [u.givenName, u.familyName].filter((p) => p !== null && p !== '').join(' ')

export function UsersSection() {
  const { data: users = [], isLoading } = useUsers()
  const [term, setTerm] = useState('')
  const [showDeleted, setShowDeleted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const prefix = term.trim().toLowerCase()
  const rows = users.filter((u) => {
    if (u.status === 'DELETED' && !showDeleted) return false
    if (prefix === '') return true
    return [u.username, u.givenName ?? '', u.familyName ?? '']
      .some((f) => f.toLowerCase().startsWith(prefix))
  })
  const selected = rows.find((u) => u.id === selectedId) ?? null

  return (
    <section className="space-y-3 border-t pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <Icon icon="people" size={15} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">
          User administration{isLoading ? '' : ` (${String(rows.length)} user${rows.length === 1 ? '' : 's'})`}
        </h2>
        <span className="text-[11px] text-muted-foreground/70">Create and manage users.</span>
        <div className="ml-auto flex items-center gap-2">
          <Switch checked={showDeleted} label="Show deleted" className="!mb-0 !text-xs"
            onChange={(e) => { setShowDeleted(e.currentTarget.checked) }} />
          <InputGroup size="small" leftIcon="search" value={term} placeholder="Search users…"
            onChange={(e) => { setTerm(e.currentTarget.value) }} />
        </div>
      </div>

      <Card compact className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-3 py-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Username</th>
                <th className="px-3 py-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Given name</th>
                <th className="px-3 py-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Family name</th>
                <th className="px-3 py-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Organization</th>
                <th className="px-3 py-1.5 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Realm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}
                  className={`border-b border-border/30 cursor-pointer ${selectedId === u.id ? 'bg-muted' : ''}`}
                  onClick={() => { setSelectedId(selectedId === u.id ? null : u.id) }}>
                  <td className="px-3 py-1.5">
                    <span className={u.status === 'DELETED' ? 'line-through opacity-60' : ''}>{u.username}</span>
                    {u.status === 'DELETED' && <Tag minimal className="!text-[9px] ml-1">deleted</Tag>}
                  </td>
                  <td className="px-3 py-1.5">{u.givenName ?? ''}</td>
                  <td className="px-3 py-1.5">{u.familyName ?? ''}</td>
                  <td className="px-3 py-1.5">{u.organizationName ?? ''}</td>
                  <td className="px-3 py-1.5 truncate">{u.realm ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            {prefix === '' ? 'No users yet.' : 'No active user matches that prefix.'}
          </p>
        )}
      </Card>

      {selected && <UserDetails user={selected} />}
    </section>
  )
}

function UserDetails({ user }: { user: PlatformUser }) {
  const { data: attributes = [] } = useUserAttributes(user.id)
  const { data: groups = [] } = useUserGroups(user.id)
  const update = useUpdateUser()
  const setStatus = useSetUserStatus()
  const setAttribute = useSetUserAttribute(user.id)
  const removeAttribute = useRemoveUserAttribute(user.id)
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState(user.username)
  const [givenName, setGivenName] = useState(user.givenName ?? '')
  const [familyName, setFamilyName] = useState(user.familyName ?? '')
  const [attrName, setAttrName] = useState('')
  const [attrValues, setAttrValues] = useState('')

  const startEdit = () => {
    setUsername(user.username)
    setGivenName(user.givenName ?? '')
    setFamilyName(user.familyName ?? '')
    setEditing(true)
  }

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="user-avatar">{initials(user)}</span>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {fullName(user) || user.username}
            <span className="text-muted-foreground font-normal"> ({user.username})</span>
          </p>
          <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
        </div>
        {!editing && (
          <Button size="small" variant="minimal" icon="edit" className="ml-auto" text="Edit"
            onClick={startEdit} />
        )}
      </div>

      {editing && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border px-3 py-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Username</span>
            <InputGroup size="small" value={username} onChange={(e) => { setUsername(e.currentTarget.value) }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Given name</span>
            <InputGroup size="small" value={givenName} onChange={(e) => { setGivenName(e.currentTarget.value) }} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Family name</span>
            <InputGroup size="small" value={familyName} onChange={(e) => { setFamilyName(e.currentTarget.value) }} />
          </label>
          <Button size="small" intent={Intent.PRIMARY} icon="tick" loading={update.isPending}
            disabled={username.trim() === ''}
            onClick={() => {
              update.mutate({
                id: user.id, username: username.trim(),
                givenName: givenName.trim() === '' ? null : givenName.trim(),
                familyName: familyName.trim() === '' ? null : familyName.trim(),
              }, { onSuccess: () => { setEditing(false) } })
            }}>Save</Button>
          <Button size="small" variant="minimal" onClick={() => { setEditing(false) }}>Cancel</Button>
          <p className="text-[11px] text-muted-foreground w-full">
            A username is unique within its realm.
          </p>
        </div>
      )}

      <div className="border-b border-border px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">User ID</p>
        <p className="text-[11px] font-mono truncate">{user.id}</p>
      </div>

      <div className="border-b border-border px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Organization</p>
        <p className="text-xs flex items-center gap-1">
          <Icon icon="office" size={11} className="text-muted-foreground" />
          {user.organizationName ?? 'None'}
        </p>
      </div>

      <div className="border-b border-border px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Groups</p>
        {groups.length === 0 ? (
          <p className="text-xs text-muted-foreground">No groups.</p>
        ) : (
          <ul>
            {groups.map((g) => (
              <li key={g.id} className="text-xs flex items-center gap-1">
                <Icon icon="people" size={11} className="text-muted-foreground" />{g.name}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* The capture renders each attribute as its name over its values. */}
      <div className="border-b border-border px-3 py-2 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Attributes</p>
        {attributes.map((a) => (
          <div key={a.name} className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{a.name}</p>
              <p className="text-xs text-muted-foreground">{a.values.join(', ')}</p>
            </div>
            {!a.name.startsWith('multipass:') && (
              <Button variant="minimal" size="small" icon="cross" title="Remove attribute"
                onClick={() => { removeAttribute.mutate(a.name) }} />
            )}
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-2">
          <InputGroup size="small" value={attrName} placeholder="location:country"
            onChange={(e) => { setAttrName(e.currentTarget.value) }} />
          <InputGroup size="small" value={attrValues} placeholder="Germany, Austria"
            onChange={(e) => { setAttrValues(e.currentTarget.value) }} />
          <Button size="small" icon="add" loading={setAttribute.isPending}
            disabled={attrName.trim() === ''}
            onClick={() => {
              setAttribute.mutate({
                name: attrName.trim(),
                values: attrValues.split(',').map((v) => v.trim()).filter((v) => v !== ''),
              }, { onSuccess: () => { setAttrName(''); setAttrValues('') } })
            }} />
          <span className="text-[11px] text-muted-foreground">
            Names starting <code>multipass:</code> are reserved for the platform.
          </span>
        </div>
      </div>

      {/* Deleting is soft: the row survives so it can be undeleted. */}
      <div className="flex items-center gap-2 px-3 py-2">
        {user.status === 'ACTIVE' ? (
          <Button size="small" variant="minimal" intent={Intent.DANGER} icon="trash" text="Delete user"
            loading={setStatus.isPending}
            onClick={() => { setStatus.mutate({ id: user.id, status: 'DELETED' }) }} />
        ) : (
          <Button size="small" variant="minimal" icon="undo" text="Undelete user"
            loading={setStatus.isPending}
            onClick={() => { setStatus.mutate({ id: user.id, status: 'ACTIVE' }) }} />
        )}
        <span className="text-[11px] text-muted-foreground">
          {user.status === 'ACTIVE'
            ? 'A deleted account keeps its row and can be restored; it is granted nothing while deleted.'
            : 'This account is deleted. Its tokens are invalid and it can be granted nothing.'}
        </span>
      </div>
    </Card>
  )
}
