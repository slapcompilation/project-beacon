// Space management — the screen Foundry's Platform Settings calls "Space
// management" under ENROLLMENT.
//
// Built from `platform-security-management/images/space-settings.png`, which
// readings/spaces-and-the-resource-path.md Decision 1 takes as the surface IN
// FULL: two cards, `Space details` and `Access requirements`, a breadcrumb back
// to the list, and a footer whose primary reads `Save for <space>`. Every
// string below is that capture's.
//
// The engine has existed since 397 and nothing reached it — `spaces`,
// `space_organizations`, `create_space()`, and `portfolios`, which had a
// complete engine and zero rows because a portfolio can only be made inside a
// space and no screen could open one.
//
// WHAT THE CAPTURES SHOW AND THIS DOES NOT BUILD, each with the reason:
//   · `Role sets` (roles-card-space-settings.png) — a Project role set and a
//     Marketplace installation role set, each with `Replace`. There is no
//     role_sets table; role sets are a different rung from our space_roles and
//     both the Compass and markings readings record them as absent. A Replace
//     button over a set we cannot name would be an empty shell.
//   · steps 3, 4 and 5 of the create wizard (create-space-dialog.png):
//     `Deletion policy`, `Data storage and usage`, `Role set`. 397 excluded all
//     three by name — each belongs to a system we do not have — so the dialog
//     here is its first two steps and says so, rather than showing five with
//     three of them empty.

import { useEffect, useState } from 'react'
import {
  Button, Callout, Card, Checkbox, Dialog, DialogBody, DialogFooter, Icon,
  InputGroup, Intent, NonIdealState, Spinner, SpinnerSize, Tag, TextArea,
} from '@blueprintjs/core'
import {
  useSpaces, useOrganizations, useSpaceOrganizations, useCreateSpace,
  useUpdateSpace, useSetSpaceOrganization, usePortfolios, useCreatePortfolio,
  useSpaceRoles, useSpaceRoleGrants, useGrantSpaceRole, useRevokeSpaceRole,
  type Space,
} from '@/features/spaces/api'
import { usePrincipalSearch } from '@/features/organization/api'

function NewSpaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateSpace()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  return (
    <Dialog isOpen={open} onClose={onClose} title="Create new space">
      <DialogBody>
        <Callout intent={Intent.PRIMARY} icon="info-sign" className="mb-3">
          Foundry's wizard has five steps. Deletion policy, Data storage and usage,
          and Role set are not built — each belongs to a system this platform does
          not have yet, and an empty step would look like a choice.
        </Callout>
        <label className="text-xs font-semibold">Name</label>
        <InputGroup value={name} placeholder="Enter a name…" className="mb-3"
          onChange={(e) => { setName(e.currentTarget.value) }} />
        <label className="text-xs font-semibold">Description <span className="text-muted-foreground">(optional)</span></label>
        <TextArea fill value={description} placeholder="Enter a description…"
          onChange={(e) => { setDescription(e.currentTarget.value) }} />
        <p className="text-xs text-muted-foreground mt-2">
          The space is created for your organization, with an ontology of the same name.
        </p>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} disabled={!name.trim()} loading={create.isPending}
            onClick={() => {
              create.mutate({ name: name.trim(), description },
                { onSuccess: () => { setName(''); setDescription(''); onClose() } })
            }}>Create space</Button>
        </>
      } />
    </Dialog>
  )
}

function NewPortfolioDialog({ space, open, onClose }: {
  space: Space; open: boolean; onClose: () => void
}) {
  const create = useCreatePortfolio()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  return (
    <Dialog isOpen={open} onClose={onClose} title="New portfolio">
      <DialogBody>
        {/* "Portfolios cannot move between Spaces after creation" — the space is
            fixed by context and guard_portfolio_space refuses any later change. */}
        <p className="text-xs text-muted-foreground mb-3">In space <strong>{space.name}</strong></p>
        <label className="text-xs font-semibold">Name</label>
        <InputGroup value={name} placeholder="Enter a name…" className="mb-3"
          onChange={(e) => { setName(e.currentTarget.value) }} />
        <label className="text-xs font-semibold">Description <span className="text-muted-foreground">(optional)</span></label>
        <InputGroup value={description} placeholder="Enter a description…"
          onChange={(e) => { setDescription(e.currentTarget.value) }} />
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} disabled={!name.trim()} loading={create.isPending}
            onClick={() => {
              create.mutate({ spaceId: space.id, name: name.trim(), description },
                { onSuccess: () => { setName(''); setDescription(''); onClose() } })
            }}>Create portfolio</Button>
        </>
      } />
    </Dialog>
  )
}

// `space-permissions.png`: "Grant roles to people and manage aspects of a
// space." One card per role — description, a `Default role` tag, the people
// holding it, and a `Grants N workflows` footer that expands.
//
// A role with no workflow rows reads "Workflow list not published", NOT
// "Grants 0 workflows". The capture shows `Grants 1 workflow` and
// `Grants 61 workflows` for the other two roles with their contents collapsed,
// so we have no rows for them by decision, not because the roles grant nothing
// — and 397 refused to build space roles at all precisely because a role that
// looks like it grants nothing is worse than none.
const workflowLabel = (w: string) => {
  const words = w.replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function SpacePermissions({ space }: { space: Space }) {
  const roles = useSpaceRoles()
  const grants = useSpaceRoleGrants(space.id)
  const grant = useGrantSpaceRole()
  const revoke = useRevokeSpaceRole()
  const [selected, setSelected] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [term, setTerm] = useState('')
  const search = usePrincipalSearch(term)

  const role = (roles.data ?? []).find((r) => r.id === selected) ?? null
  const held = (roleId: string) => (grants.data ?? []).filter((g) => g.roleId === roleId)

  return (
    <Card>
      <h2 className="text-base font-semibold">Space permissions</h2>
      <p className="text-sm text-muted-foreground mt-0.5 mb-3">
        Grant roles to people and manage aspects of a space.
      </p>
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          {roles.isLoading && <Spinner size={SpinnerSize.SMALL} />}
          {(roles.data ?? []).map((r) => (
            <div key={r.id}
              className={`border rounded-sm ${selected === r.id ? 'border-primary' : ''}`}>
              <button type="button" className="w-full text-left p-3"
                onClick={() => { setSelected(r.id) }}>
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{r.displayName}</span>
                  {/* Ours are all platform-wide (space_id is null), which is the
                      same thing the capture's tag says. */}
                  {r.spaceId === null && <Tag minimal className="!text-[10px]">Default role</Tag>}
                </span>
                <span className="block text-xs text-muted-foreground">{r.description}</span>
                <span className="flex items-center gap-1 mt-1">
                  {held(r.id).map((g) => (
                    <Tag key={g.id} minimal title={g.label} className="!text-[10px]">
                      {g.kind === 'group' ? <Icon icon="people" size={10} /> : g.label.slice(0, 2).toUpperCase()}
                    </Tag>
                  ))}
                </span>
              </button>
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t">
                <span className="text-xs text-muted-foreground">
                  {r.workflows.length === 0
                    ? 'Workflow list not published'
                    : `Grants ${r.workflows.length} workflow${r.workflows.length === 1 ? '' : 's'}`}
                </span>
                {r.workflows.length > 0 && (
                  <Button variant="minimal" size="small"
                    endIcon={expanded === r.id ? 'chevron-up' : 'chevron-down'}
                    onClick={() => { setExpanded(expanded === r.id ? null : r.id) }}>
                    {expanded === r.id ? 'Hide details' : 'Show details'}
                  </Button>
                )}
              </div>
              {expanded === r.id && r.workflows.length > 0 && (
                <div className="px-3 pb-3">
                  <span className="text-xs font-semibold">Workflows</span>
                  <ul>
                    {r.workflows.map((w) => (
                      <li key={w} className="text-xs text-muted-foreground">{workflowLabel(w)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="w-72 border-l pl-3">
          <h3 className="text-sm font-semibold">Manage privileges</h3>
          {!role ? (
            <p className="text-xs text-muted-foreground mt-1">Select a role to grant it.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Grant people <strong>{role.displayName}</strong> to manage aspects of{' '}
                <strong>{space.name}</strong>.
              </p>
              <InputGroup leftIcon="search" value={term} placeholder="Add a user or group…"
                onChange={(e) => { setTerm(e.currentTarget.value) }} />
              {term.trim() && (search.data ?? []).length > 0 && (
                <div className="border rounded-sm mt-1">
                  {(search.data ?? []).map((pr) => (
                    <button key={pr.id} type="button"
                      className="flex items-center gap-2 w-full text-left px-2 py-1 text-sm"
                      onClick={() => {
                        grant.mutate({
                          spaceId: space.id, roleId: role.id,
                          principalId: pr.id, kind: pr.kind,
                        })
                        setTerm('')
                      }}>
                      {pr.kind === 'group' && <Icon icon="people" size={12} />}{pr.label}
                    </button>
                  ))}
                </div>
              )}
              <ul className="mt-2">
                {held(role.id).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2 py-1 text-xs">
                    <span className="truncate flex items-center gap-1">
                      {g.kind === 'group' && <Icon icon="people" size={12} />}{g.label}
                    </span>
                    <Button variant="minimal" size="small" icon="cross"
                      onClick={() => { revoke.mutate({ spaceId: space.id, grantId: g.id }) }} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

function SpaceDetail({ space, onBack }: { space: Space; onBack: () => void }) {
  const orgs = useOrganizations()
  const on = useSpaceOrganizations(space.id)
  const save = useUpdateSpace()
  const setOrg = useSetSpaceOrganization()
  const portfolios = usePortfolios(space.id)
  const [name, setName] = useState(space.name)
  const [description, setDescription] = useState(space.description ?? '')
  const [orgFilter, setOrgFilter] = useState('')
  const [newPortfolio, setNewPortfolio] = useState(false)

  // Selecting a different space reuses this component, so the draft follows it.
  useEffect(() => {
    setName(space.name)
    setDescription(space.description ?? '')
  }, [space.id, space.name, space.description])

  const held = new Set(on.data ?? [])
  const dirty = name !== space.name || description !== (space.description ?? '')
  const shown = (orgs.data ?? []).filter((o) =>
    o.name.toLowerCase().includes(orgFilter.trim().toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="minimal" size="small" icon="arrow-left" onClick={onBack}>Spaces</Button>
        <Icon icon="chevron-right" size={12} className="text-muted-foreground" />
        <span className="font-semibold">{space.name}</span>
      </div>

      <Card>
        <h2 className="text-base font-semibold mb-3">Space details</h2>
        <label className="text-xs font-semibold">Name</label>
        <InputGroup value={name} className="mb-3"
          onChange={(e) => { setName(e.currentTarget.value) }} />
        <label className="text-xs font-semibold">Path</label>
        {/* Greyed in the capture, and refused on update by 397: the path is
            captured at insert so a rename does not move the space's resources. */}
        <InputGroup readOnly value={space.path ?? ''} className="mb-3" />
        <label className="text-xs font-semibold">
          Description <span className="text-muted-foreground">(optional)</span>
        </label>
        <TextArea fill value={description} placeholder="Enter a description…"
          onChange={(e) => { setDescription(e.currentTarget.value) }} />
      </Card>

      <Card>
        <h2 className="text-base font-semibold mb-1">Access requirements</h2>
        <p className="text-sm text-muted-foreground mb-3">
          To access this space, users must be a member of at least one of the selected
          organizations below. Additional requirements may need to be met for project access.
        </p>
        <label className="text-xs font-semibold">Organizations</label>
        <InputGroup leftIcon="search" value={orgFilter} placeholder="Search for organizations…"
          className="mb-2" onChange={(e) => { setOrgFilter(e.currentTarget.value) }} />
        <div className="border rounded-sm p-2">
          {orgs.isLoading && <Spinner size={SpinnerSize.SMALL} />}
          {!orgs.isLoading && shown.length === 0 && (
            <p className="text-xs text-muted-foreground">No organizations match.</p>
          )}
          {shown.map((o) => (
            <Checkbox key={o.id} checked={held.has(o.id)}
              labelElement={
                <span className="flex items-center gap-1">
                  <Icon icon="office" size={12} />{o.name}
                </span>
              }
              onChange={() => {
                setOrg.mutate({ spaceId: space.id, organizationId: o.id, on: held.has(o.id) })
              }} />
          ))}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4 mb-1">
          <h2 className="text-base font-semibold">Portfolios</h2>
          <Button size="small" icon="plus" onClick={() => { setNewPortfolio(true) }}>
            New portfolio
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          A portfolio groups projects within this space, and cannot move between spaces
          after creation.
        </p>
        {portfolios.isLoading && <Spinner size={SpinnerSize.SMALL} />}
        {!portfolios.isLoading && (portfolios.data ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">No portfolios in this space yet.</p>
        )}
        <ul>
          {(portfolios.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1 text-sm border-b">
              <Icon icon="grouped-bar-chart" size={12} className="text-muted-foreground" />
              <span>{p.name}</span>
              {p.description && (
                <span className="text-xs text-muted-foreground truncate">{p.description}</span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <SpacePermissions space={space} />

      {/* The footer of the capture: Cancel, then a primary naming the space. */}
      <div className="flex items-center justify-end gap-2">
        <Button disabled={!dirty}
          onClick={() => { setName(space.name); setDescription(space.description ?? '') }}>
          Cancel
        </Button>
        <Button intent={Intent.PRIMARY} disabled={!dirty || !name.trim()} loading={save.isPending}
          onClick={() => { save.mutate({ id: space.id, name: name.trim(), description }) }}>
          Save for {space.name}
        </Button>
      </div>

      <NewPortfolioDialog space={space} open={newPortfolio}
        onClose={() => { setNewPortfolio(false) }} />
    </div>
  )
}

export default function SpacesPage() {
  const spaces = useSpaces()
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const space = (spaces.data ?? []).find((s) => s.id === selected) ?? null

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-4">
        {space ? (
          <SpaceDetail space={space} onBack={() => { setSelected(null) }} />
        ) : (
          <>
            <header className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">Space management</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  A space contains projects and carries the organizations that gate them.
                </p>
              </div>
              <Button intent={Intent.PRIMARY} icon="plus"
                onClick={() => { setCreating(true) }}>Create new space</Button>
            </header>

            <Card className="p-0">
              {spaces.isLoading && <div className="p-4"><Spinner size={SpinnerSize.SMALL} /></div>}
              {!spaces.isLoading && (spaces.data ?? []).length === 0 && (
                <NonIdealState icon="folder-close" title="No spaces"
                  description="Create a space to hold projects and their ontology." />
              )}
              <ul>
                {(spaces.data ?? []).map((s) => (
                  <li key={s.id}>
                    <button type="button"
                      className="flex items-center justify-between gap-2 w-full text-left px-3 py-2 border-b"
                      onClick={() => { setSelected(s.id) }}>
                      <span className="min-w-0">
                        <span className="text-sm font-semibold">{s.name}</span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {s.description || 'No description'}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        {s.path && <Tag minimal className="font-mono !text-[10px]">{s.path}</Tag>}
                        <Icon icon="chevron-right" size={12} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>

      <NewSpaceDialog open={creating} onClose={() => { setCreating(false) }} />
    </div>
  )
}
