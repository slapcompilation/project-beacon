// Markings — the mandatory control.
//
// The enforcement is in SQL (migrations 399–402), because a mandatory control
// that a caller can route around is not one. What lives here is the grammar a
// surface needs to render the access panel: which card a marking belongs in, how
// it got there, and what to say about it.
//
// The one rule worth restating wherever markings are touched: **a permission on a
// marking is not membership of it.** "a user can have 'Apply marking' and 'Manage
// permissions' access on a Marking and not be a member of the Marking… they could
// apply the Marking… but they could not see the data marked with that Marking."

/** Which requirement card a marking sits in. Foundry shows them as two, joined
 *  by AND, under separate headings: File access and Data access. */
export type MarkingKind = 'file' | 'data'

/** How the marking reached this resource. Foundry draws each with its own
 *  sidecar icon on the chip, which is how you tell them apart at a glance. */
export type MarkingOrigin = 'direct' | 'file_hierarchy' | 'data_dependency'

export type MarkingPermission = 'manage' | 'apply' | 'remove'
export type CategoryVisibility = 'visible' | 'hidden'

export interface ResourceMarking {
  markingId: string
  name: string
  category: string
  kind: MarkingKind
  origin: MarkingOrigin
  /** Whether the caller is a member. Per-marking, because the panel shows which
   *  requirement you fail rather than a single verdict. */
  satisfied: boolean
}

export const MARKING_ORIGIN_META: Record<MarkingOrigin, { label: string; help: string; icon: 'shield' | 'folder-close' | 'graph' }> = {
  direct: {
    label: 'Applied here',
    help: 'This marking was applied directly to this resource.',
    icon: 'shield',
  },
  file_hierarchy: {
    label: 'Inherited from the project',
    help: 'Applied to a container. Restricting access to a project always restricts access to everything inside it.',
    icon: 'folder-close',
  },
  data_dependency: {
    label: 'Inherited from an input',
    help: 'This marking is inherited from an input to this dataset. It travelled with the data.',
    icon: 'graph',
  },
}

export const MARKING_KIND_META: Record<MarkingKind, { label: string; help: string; gates: string }> = {
  file: {
    label: 'File markings',
    help: 'Applied to this resource or inherited from its project.',
    gates: 'Failing one of these hides the dataset entirely — you cannot tell it exists.',
  },
  data: {
    label: 'Additional data markings',
    help: 'Propagated from data upstream, in order to access data in this file.',
    gates: 'Failing one of these still shows the dataset, its schema and its history — but not a single row.',
  },
}

export const MARKING_PERMISSION_META: Record<MarkingPermission, { label: string; help: string }> = {
  manage: { label: 'Manage permissions', help: 'Can grant permissions to manage this marking, its members, and edit its metadata.' },
  apply:  { label: 'Apply marking',      help: 'Can apply this marking on projects and files. Does not grant membership.' },
  remove: { label: 'Remove marking',     help: 'Can remove this marking from projects and files. Requires the apply permission too.' },
}

/** The two cards, in the order the panel stacks them. */
export const MARKING_KINDS: ReadonlyArray<MarkingKind> = ['file', 'data']

/** Conjunctive, and an empty set passes: "a user must be a member of all the
 *  Markings on a file, folder, or Project". No markings is not a restriction.
 *  Mirrors satisfies_markings() in SQL — the database remains the enforcer. */
export const satisfiesAll = (ms: ResourceMarking[]): boolean => ms.every((m) => m.satisfied)

/** What a viewer can actually do, given the markings they fail. The three states
 *  are Foundry's, and the middle one is the whole reason the split exists. */
export type AccessLevel = 'none' | 'metadata_only' | 'full'

export function accessLevel(ms: ResourceMarking[]): AccessLevel {
  if (ms.some((m) => m.kind === 'file' && !m.satisfied)) return 'none'
  if (ms.some((m) => m.kind === 'data' && !m.satisfied)) return 'metadata_only'
  return 'full'
}

export const ACCESS_LEVEL_META: Record<AccessLevel, { label: string; help: string }> = {
  none: {
    label: 'No access',
    help: 'A file marking is unmet, so this resource is not discoverable.',
  },
  metadata_only: {
    label: 'Metadata only',
    help: 'You can see this dataset, its schema and its history, but not its rows. Column names are metadata and are not hidden by a data marking.',
  },
  full: { label: 'Full access', help: 'Every marking on this resource is satisfied.' },
}
