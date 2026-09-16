// Manage markings — the administration screen.
//
// Built from readings/markings-admin-screen.md, which read
// platform-security-management/manage-markings.md whole and opened 12 of its 22
// captures. The engine has been complete since 399-403 and nothing reached it:
// markings, categories, members, permissions and the two guards all existed
// with no screen at all, which made this the largest engine-without-surface in
// the repo.
//
// The shape is a DRILL-DOWN CARD, not a fixed grid — the column set changes
// with depth (two columns with nothing selected, three with a category, four
// with a marking, and a Manage link replaces the fourth in place). The reading's
// first pass called the marking table "always present" with three columns; its
// refuter caught that, and a build that rendered three columns unconditionally
// would have been wrong.
//
// What is deliberately NOT here:
//   · any delete. "Once created, marking categories cannot be deleted." and
//     "Once created, markings cannot be deleted or moved to a different
//     category." Both are printed by the page and rendered as amber callouts in
//     the two creation dialogs below.
//   · any post-creation edit of a category's type, visibility or organization:
//     ReplaceMarkingCategoryRequest carries name and description only.
//   · the "View all marking members" switch. It is in the capture and no page
//     says what it toggles (the reading's Question 1), so rendering it would be
//     a control that does nothing.

import { useMemo, useState } from 'react'
import {
  Button, Callout, Card, Checkbox, Dialog, DialogBody, DialogFooter, HTMLSelect,
  Icon, InputGroup, Intent, NonIdealState, Popover, Spinner, SpinnerSize, Tag, TextArea,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import {
  useMarkingCategories, useMarkings, useMarkingRoles, useMarkingMembers,
  useCategoryGrants, useCreateMarkingCategory, useCreateMarking,
  useUpdateCategoryDescription, useUpdateMarkingDescription,
  useSetMarkingPermission, useRemoveAllMarkingPermissions, useSetMarkingMember,
  useSetCategoryGrant,
  type MarkingCategory, type Marking, type MarkingPermission, type CategoryType,
  type CategoryVisibility, type CategoryRole,
} from '@/features/markings/api'
import { usePrincipalSearch } from '@/features/organization/api'

/** The three permission bullets, in the page's own order and wording. The API
 *  spells the same three ADMINISTER / DECLASSIFY / USE; this screen takes the
 *  screen's words, which is CLAUDE.md's two-vocabularies rule. */
const PERMISSIONS: { value: MarkingPermission; label: string; help: string }[] = [
  { value: 'manage', label: 'Manage permissions',
    help: 'People who can grant permissions to manage this marking, its members, and edit its metadata.' },
  { value: 'apply', label: 'Apply marking',
    help: 'People who can apply this marking on projects and files.' },
  { value: 'remove', label: 'Remove marking',
    help: 'People who can remove this marking from projects and files.' },
]

const TYPE_HELP: Record<CategoryType, { word: string; op: string; help: string }> = {
  conjunctive: { word: 'Conjunctive', op: '• And', help: 'All applied markings will be required.' },
  disjunctive: { word: 'Disjunctive', op: '• Or', help: 'Any one of the applied markings will be required.' },
}

const VISIBILITY_HELP: Record<CategoryVisibility, string> = {
  visible: 'Visible to everyone.',
  hidden: 'Only visible to people with permissions on this category or its markings.',
}

const initials = (label: string) =>
  label.replace(/@.*$/, '').split(/[.\s_-]+/).filter(Boolean).slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase()).join('') || '?'

function Avatars({ items }: { items: { label: string; kind: 'user' | 'group' }[] }) {
  if (items.length === 0) return <span className="text-xs text-muted-foreground">None</span>
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map((p) => (
        <Tag key={p.label} minimal title={p.label}>
          {p.kind === 'group' ? <Icon icon="people" size={12} /> : initials(p.label)}
        </Tag>
      ))}
    </div>
  )
}

function Section({ label, children, onManage }: {
  label: string; children: React.ReactNode; onManage?: () => void
}) {
  return (
    <div className="border-b py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs font-semibold">{label}</span>
        {onManage && <Button variant="minimal" size="small" onClick={onManage}>Manage</Button>}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  )
}

/** Both dialogs carry the page's irreversibility sentence as an amber callout,
 *  which is what the captures show above the first field. */
function NewCategoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateMarkingCategory()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [categoryType, setCategoryType] = useState<CategoryType>('conjunctive')
  const [visibility, setVisibility] = useState<CategoryVisibility>('visible')
  return (
    <Dialog isOpen={open} onClose={onClose} title="New marking category">
      <DialogBody>
        <Callout intent={Intent.WARNING} icon="warning-sign" className="mb-3">
          Once created, marking categories cannot be deleted.
        </Callout>
        <label className="text-xs font-semibold">Category name</label>
        <InputGroup value={name} placeholder="Add category name…" className="mb-3"
          onChange={(e) => { setName(e.currentTarget.value) }} />
        <label className="text-xs font-semibold">Description</label>
        <InputGroup value={description} placeholder="Add description…" className="mb-3"
          onChange={(e) => { setDescription(e.currentTarget.value) }} />
        <label className="text-xs font-semibold">Category type</label>
        <HTMLSelect fill value={categoryType} className="mb-3"
          onChange={(e) => { setCategoryType(e.currentTarget.value as CategoryType) }}>
          <option value="conjunctive">Conjunctive • And</option>
          <option value="disjunctive">Disjunctive • Or</option>
        </HTMLSelect>
        <p className="text-xs text-muted-foreground mb-3">{TYPE_HELP[categoryType].help}</p>
        <label className="text-xs font-semibold">Category visibility</label>
        <HTMLSelect fill value={visibility} className="mb-1"
          onChange={(e) => { setVisibility(e.currentTarget.value as CategoryVisibility) }}>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </HTMLSelect>
        <p className="text-xs text-muted-foreground">{VISIBILITY_HELP[visibility]}</p>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} disabled={!name.trim()} loading={create.isPending}
            onClick={() => {
              create.mutate(
                { name: name.trim(), description, categoryType, visibility, organizationId: null },
                { onSuccess: () => { setName(''); setDescription(''); onClose() } },
              )
            }}>Create category</Button>
        </>
      } />
    </Dialog>
  )
}

function NewMarkingDialog({ category, open, onClose }: {
  category: MarkingCategory; open: boolean; onClose: () => void
}) {
  const create = useCreateMarking()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  return (
    <Dialog isOpen={open} onClose={onClose} title="New marking">
      <DialogBody>
        <Callout intent={Intent.WARNING} icon="warning-sign" className="mb-3">
          Once created, markings cannot be deleted or moved to a different category.
        </Callout>
        {/* The category is fixed by context — the button that opens this lives
            in the category's own footer, so the form carries no picker. */}
        <p className="text-xs text-muted-foreground mb-3">In category <strong>{category.name}</strong></p>
        <label className="text-xs font-semibold">Marking name</label>
        <InputGroup value={name} placeholder="Add a marking name…" className="mb-3"
          onChange={(e) => { setName(e.currentTarget.value) }} />
        <label className="text-xs font-semibold">Description</label>
        <InputGroup value={description} placeholder="Add description…"
          onChange={(e) => { setDescription(e.currentTarget.value) }} />
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button intent={Intent.PRIMARY} disabled={!name.trim()} loading={create.isPending}
            onClick={() => {
              create.mutate(
                { categoryId: category.id, name: name.trim(), description },
                { onSuccess: () => { setName(''); setDescription(''); onClose() } },
              )
            }}>Create marking</Button>
        </>
      } />
    </Dialog>
  )
}

/** Add a principal and search the existing list are the SAME control on this
 *  screen, so one input serves both. */
function PrincipalAdd({ onPick, placeholder = 'Add a user or group…' }: {
  onPick: (p: { id: string; kind: 'user' | 'group'; label: string }) => void
  placeholder?: string
}) {
  const [term, setTerm] = useState('')
  const search = usePrincipalSearch(term)
  return (
    <div className="mb-2">
      <InputGroup leftIcon="search" value={term} placeholder={placeholder}
        onChange={(e) => { setTerm(e.currentTarget.value) }} />
      {term.trim() && (search.data ?? []).length > 0 && (
        <div className="border rounded-sm mt-1">
          {(search.data ?? []).map((p) => (
            <button key={p.id} type="button"
              className="flex items-center gap-2 w-full text-left px-2 py-1 text-sm"
              onClick={() => { onPick(p); setTerm('') }}>
              {p.kind === 'group' && <Icon icon="people" size={12} />}
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** The category's own two roles. The only capture of this control is truncated
 *  to "Manage permissi…" and clips with an ellipsis, so its popover is not
 *  recoverable (the reading's Question 2) — but the page enumerates the pair in
 *  prose, and that is what this renders. The API spells them ADMINISTER and
 *  VIEW. */
const CATEGORY_ROLES: { value: CategoryRole; label: string; help: string }[] = [
  { value: 'administrator', label: 'Category Administrators',
    help: 'Users who can change the description and permissions for the category and create Markings in the category.' },
  { value: 'viewer', label: 'Category Viewers',
    help: 'Users who can see the existence of the category and all the Markings within it.' },
]

function ManageCategoryPermissions({ category, onBack }: {
  category: MarkingCategory; onBack: () => void
}) {
  const grants = useCategoryGrants(category.id)
  const set = useSetCategoryGrant()
  const rows = grants.data ?? []
  const held = (userId: string, role: CategoryRole) =>
    rows.some((g) => g.userId === userId && g.role === role)
  const principals = [...new Map(rows.map((g) => [g.userId, g])).values()]
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
        <Button variant="minimal" size="small" icon="chevron-left" onClick={onBack}>Details</Button>
        <span className="text-xs font-semibold">Manage permissions</span>
      </div>
      <PrincipalAdd onPick={(p) => {
        if (p.kind !== 'user') { toast.error('Category permissions are granted to users here'); return }
        set.mutate({ categoryId: category.id, userId: p.id, role: 'viewer', held: false })
      }} />
      {grants.isLoading && <Spinner size={SpinnerSize.SMALL} />}
      {!grants.isLoading && principals.length === 0 && (
        <p className="text-xs text-muted-foreground">Nobody holds a permission on this category.</p>
      )}
      {principals.map((g) => (
        <div key={g.userId} className="py-1">
          <span className="text-sm truncate">{g.label}</span>
          {CATEGORY_ROLES.map((r) => (
            <Checkbox key={r.value} checked={held(g.userId, r.value)}
              labelElement={
                <span>
                  <strong>{r.label}</strong>
                  <span className="block text-xs text-muted-foreground">{r.help}</span>
                </span>
              }
              onChange={() => {
                set.mutate({
                  categoryId: category.id, userId: g.userId, role: r.value,
                  held: held(g.userId, r.value),
                })
              }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ManagePermissions({ marking, onBack }: { marking: Marking; onBack: () => void }) {
  const roles = useMarkingRoles(marking.id)
  const set = useSetMarkingPermission()
  const removeAll = useRemoveAllMarkingPermissions()
  const rows = roles.data ?? []
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
        <Button variant="minimal" size="small" icon="chevron-left" onClick={onBack}>Marking details</Button>
        <span className="text-xs font-semibold">Manage permissions</span>
      </div>
      <PrincipalAdd onPick={(p) => {
        set.mutate({ markingId: marking.id, principalId: p.id, kind: p.kind, permission: 'apply', held: false })
      }} />
      {roles.isLoading && <Spinner size={SpinnerSize.SMALL} />}
      {!roles.isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">Nobody holds a permission on this marking.</p>
      )}
      {rows.map((r) => (
        <div key={r.principalId} className="flex items-center justify-between gap-2 py-1">
          <span className="text-sm truncate flex items-center gap-1">
            {r.kind === 'group' && <Icon icon="people" size={12} />}{r.label}
          </span>
          <Popover content={
            <div className="p-2 space-y-1">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-semibold">{r.permissions.length} roles selected</span>
                <Button variant="minimal" size="small" intent={Intent.DANGER}
                  onClick={() => { removeAll.mutate({ markingId: marking.id, principalId: r.principalId, kind: r.kind }) }}>
                  Remove all
                </Button>
              </div>
              {PERMISSIONS.map((p) => (
                <Checkbox key={p.value} checked={r.permissions.includes(p.value)}
                  labelElement={
                    <span>
                      <strong>{p.label}</strong>
                      <span className="block text-xs text-muted-foreground">{p.help}</span>
                    </span>
                  }
                  onChange={() => {
                    set.mutate({
                      markingId: marking.id, principalId: r.principalId, kind: r.kind,
                      permission: p.value, held: r.permissions.includes(p.value),
                    })
                  }} />
              ))}
            </div>
          }>
            <Button size="small" endIcon="caret-down">
              {PERMISSIONS.find((p) => p.value === r.permissions[0])?.label ?? 'None'}
              {r.permissions.length > 1 ? ` +${r.permissions.length - 1}` : ''}
            </Button>
          </Popover>
        </div>
      ))}
    </div>
  )
}

function ManageMembers({ marking, onBack }: { marking: Marking; onBack: () => void }) {
  const members = useMarkingMembers(marking.id)
  const set = useSetMarkingMember()
  const rows = members.data ?? []
  return (
    <div>
      <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
        <Button variant="minimal" size="small" icon="chevron-left" onClick={onBack}>Marking details</Button>
        <span className="text-xs font-semibold">Manage members</span>
      </div>
      <PrincipalAdd onPick={(p) => {
        set.mutate({ markingId: marking.id, principalId: p.id, kind: p.kind, member: false })
      }} />
      {members.isLoading && <Spinner size={SpinnerSize.SMALL} />}
      {!members.isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">Nobody is a member of this marking.</p>
      )}
      {rows.map((m) => (
        <Checkbox key={m.principalId} checked
          labelElement={
            <span className="flex items-center gap-1">
              {m.kind === 'group' && <Icon icon="people" size={12} />}{m.label}
            </span>
          }
          onChange={() => {
            set.mutate({ markingId: marking.id, principalId: m.principalId, kind: m.kind, member: true })
          }} />
      ))}
    </div>
  )
}

type Pane = 'details' | 'permissions' | 'members'

export default function MarkingsPage() {
  const categories = useMarkingCategories()
  const markings = useMarkings()
  const [filter, setFilter] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [pane, setPane] = useState<Pane>('details')
  const [catPane, setCatPane] = useState<'details' | 'permissions'>('details')
  const [newCategory, setNewCategory] = useState(false)
  const [newMarking, setNewMarking] = useState(false)

  const category = (categories.data ?? []).find((c) => c.id === categoryId) ?? null
  const marking = (markings.data ?? []).find((m) => m.id === markingId) ?? null
  const grants = useCategoryGrants(categoryId)
  const roles = useMarkingRoles(markingId)
  const members = useMarkingMembers(markingId)
  const editCategory = useUpdateCategoryDescription()
  const editMarking = useUpdateMarkingDescription()

  // The table is scoped to the selected category — the refuter's correction,
  // from two captures that show only that category's markings listed.
  const rows = useMemo(() => {
    const all = markings.data ?? []
    const scoped = categoryId ? all.filter((m) => m.categoryId === categoryId) : all
    const q = filter.trim().toLowerCase()
    return q ? scoped.filter((m) => m.name.toLowerCase().includes(q)) : scoped
  }, [markings.data, categoryId, filter])

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 space-y-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Manage markings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create, edit, and organize security markings.
            </p>
          </div>
          <InputGroup leftIcon="search" value={filter} placeholder="Filter markings…"
            onChange={(e) => { setFilter(e.currentTarget.value) }} />
        </header>

        <Card className="p-0">
          <div className="flex items-stretch">
            {/* Column 1 — Categories, or the category's details once picked. */}
            <div className="w-72 border-r p-3 flex flex-col">
              {!category ? (
                <>
                  <div className="text-xs font-semibold text-center border-b pb-2 mb-2">Categories</div>
                  {categories.isLoading && <Spinner size={SpinnerSize.SMALL} />}
                  <div className="flex-1 space-y-1">
                    {(categories.data ?? []).map((c) => (
                      <button key={c.id} type="button"
                        className="flex items-center justify-between gap-2 w-full text-left px-2 py-1 text-sm"
                        onClick={() => { setCategoryId(c.id); setMarkingId(null); setCatPane('details') }}>
                        {c.name}<Icon icon="chevron-right" size={12} />
                      </button>
                    ))}
                  </div>
                  <Button fill intent={Intent.PRIMARY} icon="plus" className="mt-2"
                    onClick={() => { setNewCategory(true) }}>New marking category</Button>
                </>
              ) : catPane === 'permissions' ? (
                <ManageCategoryPermissions category={category}
                  onBack={() => { setCatPane('details') }} />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 border-b pb-2 mb-2">
                    <Button variant="minimal" size="small" icon="chevron-left"
                      onClick={() => { setCategoryId(null); setMarkingId(null) }}>Categories</Button>
                    <span className="text-xs font-semibold">Details</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <h2 className="text-sm font-semibold">{category.name}</h2>
                    <TextArea fill size="small" placeholder="Add description…" className="mt-1"
                      defaultValue={category.description ?? ''}
                      onBlur={(e) => {
                        const next = e.currentTarget.value
                        if (next !== (category.description ?? '')) {
                          editCategory.mutate({ id: category.id, description: next })
                        }
                      }} />
                    <Section label="Created">
                      <span className="text-xs">
                        {new Date(category.createdAt).toLocaleString()}
                        {category.createdByLabel ? ` by ${category.createdByLabel}` : ''}
                      </span>
                    </Section>
                    <Section label="Category type">
                      {/* A static glyph and a word, not a switch — the type is
                          fixed at creation, and the capture's "toggle" is the
                          same two-ring icon rendered in this pane. */}
                      <span className="text-xs flex items-center gap-1">
                        <Icon icon="circle" size={12} />
                        <strong>{TYPE_HELP[category.categoryType].word}</strong>
                        <span className="text-muted-foreground">{TYPE_HELP[category.categoryType].op}</span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {TYPE_HELP[category.categoryType].help}
                      </span>
                    </Section>
                    <Section label="Category visibility">
                      <span className="text-xs">
                        <strong>{category.visibility === 'visible' ? 'Visible' : 'Hidden'}</strong>
                        <span className="block text-muted-foreground">{VISIBILITY_HELP[category.visibility]}</span>
                      </span>
                    </Section>
                    <Section label="Organization">
                      <span className="text-xs text-muted-foreground">
                        {category.organizationId
                          ? 'This category and its markings can be seen by users from the following organization.'
                          : 'This category and its markings can be seen by users from all organizations.'}
                      </span>
                    </Section>
                    <Section label="Category permissions" onManage={() => { setCatPane('permissions') }}>
                      <span className="block text-xs text-muted-foreground mb-1">
                        People with administrative permissions to manage aspects of this category.
                      </span>
                      <Avatars items={(grants.data ?? []).map((g) => ({ label: g.label, kind: 'user' as const }))} />
                    </Section>
                  </div>
                  <Button fill intent={Intent.PRIMARY} icon="plus" className="mt-2"
                    onClick={() => { setNewMarking(true) }}>New marking…</Button>
                </>
              )}
            </div>

            {/* Column 2 — the marking table. */}
            <div className="flex-1 min-w-0 p-3 overflow-x-auto">
              {markings.isLoading && <Spinner size={SpinnerSize.SMALL} />}
              {!markings.isLoading && rows.length === 0 && (
                <NonIdealState icon="shield" title="No markings"
                  description={category ? 'This category has no markings yet.' : 'Create a category, then a marking.'} />
              )}
              {rows.length > 0 && (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-semibold py-1">Marking</th>
                      <th className="text-left font-semibold py-1">Category</th>
                      <th className="text-left font-semibold py-1">Date created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((m) => (
                      <tr key={m.id} className="border-b">
                        <td className="py-1">
                          <button type="button" onClick={() => { setMarkingId(m.id); setPane('details') }}>
                            <Tag icon="shield" minimal={markingId !== m.id}
                              intent={markingId === m.id ? Intent.PRIMARY : Intent.NONE}>{m.name}</Tag>
                          </button>
                        </td>
                        <td className="py-1 text-muted-foreground">{m.categoryName}</td>
                        <td className="py-1 text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Column 3 — the marking, or whichever editor a Manage link opened. */}
            {marking && (
              <div className="w-80 border-l p-3">
                {pane === 'details' && (
                  <>
                    <div className="text-xs font-semibold text-center border-b pb-2 mb-2">Marking details</div>
                    <h2 className="text-sm font-semibold">{marking.name}</h2>
                    <TextArea fill size="small" placeholder="Add description…" className="mt-1"
                      defaultValue={marking.description ?? ''}
                      onBlur={(e) => {
                        const next = e.currentTarget.value
                        if (next !== (marking.description ?? '')) {
                          editMarking.mutate({ id: marking.id, description: next })
                        }
                      }} />
                    <Section label="Marking ID">
                      <span className="flex items-center gap-1">
                        <code className="text-xs font-mono truncate">{marking.id}</code>
                        <Button variant="minimal" size="small" icon="clipboard"
                          onClick={() => {
                            void navigator.clipboard.writeText(marking.id)
                            toast.success('Marking ID copied')
                          }} />
                      </span>
                    </Section>
                    <Section label="Created">
                      <span className="text-xs">
                        {new Date(marking.createdAt).toLocaleString()}
                        {marking.createdByLabel ? ` by ${marking.createdByLabel}` : ''}
                      </span>
                    </Section>
                    <Section label="Marking permissions" onManage={() => { setPane('permissions') }}>
                      <span className="block text-xs text-muted-foreground mb-1">
                        Grant people administrative permissions to manage aspects of this marking.
                      </span>
                      <Avatars items={(roles.data ?? []).map((r) => ({ label: r.label, kind: r.kind }))} />
                    </Section>
                    <Section label="Members" onManage={() => { setPane('members') }}>
                      <span className="block text-xs text-muted-foreground mb-1">
                        People who can see resources protected by this marking.
                      </span>
                      <Avatars items={(members.data ?? []).map((m) => ({ label: m.label, kind: m.kind }))} />
                    </Section>
                  </>
                )}
                {pane === 'permissions' && (
                  <ManagePermissions marking={marking} onBack={() => { setPane('details') }} />
                )}
                {pane === 'members' && (
                  <ManageMembers marking={marking} onBack={() => { setPane('details') }} />
                )}
              </div>
            )}
          </div>
        </Card>
      </div>

      <NewCategoryDialog open={newCategory} onClose={() => { setNewCategory(false) }} />
      {category && (
        <NewMarkingDialog category={category} open={newMarking}
          onClose={() => { setNewMarking(false) }} />
      )}
    </div>
  )
}
