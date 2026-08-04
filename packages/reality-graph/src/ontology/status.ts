// @vocabulary-declaration — restates the database CHECKs; not a consumer.
// Developmental state for an ontology resource — object type, link type or
// interface. Foundry's, from metadata-statuses: "Every object type, property,
// link type, action, or interface in the Ontology has a status that indicates
// developmental state."
//
// Until now a resource here was either present or deleted, which is why every
// cleanup this month was a manual sweep reconstructing why something was still
// in the tree. The status says so, and deprecation carries a reason, a deadline
// and a successor rather than being a flag.
//
// The database is the authority — migration 321 holds the CHECK constraints and
// the guards. This is the one place TypeScript states them, so a picker and a
// badge cannot disagree about what the values are.

export const ONTOLOGY_STATUSES = [
  'promoted', 'active', 'experimental', 'deprecated', 'example',
] as const
export type OntologyStatus = typeof ONTOLOGY_STATUSES[number]

/** `promoted` is object types only — "not available for properties, link types,
 *  action types or interfaces". */
export const LINK_AND_INTERFACE_STATUSES = ONTOLOGY_STATUSES.filter((s) => s !== 'promoted')

export const ONTOLOGY_VISIBILITIES = ['prominent', 'normal', 'hidden'] as const
export type OntologyVisibility = typeof ONTOLOGY_VISIBILITIES[number]

export interface OntologyStatusMeta {
  label: string
  /** What the operator is told the status means, close to Foundry's wording. */
  help: string
  /** Blueprint intent for the badge. */
  intent: 'success' | 'primary' | 'warning' | 'danger' | 'none'
  /** May a resource in this state be deleted? */
  deletable: boolean
  /** May its api name change? Only experimental, per Foundry. */
  renamable: boolean
}

export const STATUS_META: Record<OntologyStatus, OntologyStatusMeta> = {
  promoted: {
    label: 'Promoted',
    help: 'A core, trusted resource, vetted by an ontology owner. Surfaces prominently.',
    intent: 'success', deletable: false, renamable: false,
  },
  active: {
    label: 'Active',
    help: 'Actively in use. Breaking changes will not be made — it cannot be deleted or renamed.',
    intent: 'primary', deletable: false, renamable: false,
  },
  experimental: {
    label: 'Experimental',
    help: 'Still under development. Anything new starts here; only here can it be renamed.',
    intent: 'warning', deletable: true, renamable: true,
  },
  deprecated: {
    label: 'Deprecated',
    help: 'Scheduled for deletion. Should not be relied on for new work.',
    intent: 'danger', deletable: true, renamable: false,
  },
  example: {
    label: 'Example',
    help: 'Notional — installed to demonstrate a shape, not intended for production workflows.',
    intent: 'none', deletable: true, renamable: false,
  },
}

export const VISIBILITY_META: Record<OntologyVisibility, { label: string; help: string }> = {
  prominent: { label: 'Prominent', help: 'Surfaced first when browsing and searching the ontology.' },
  normal:    { label: 'Normal',    help: 'Appears wherever ontology resources are listed.' },
  hidden:    { label: 'Hidden',    help: 'Kept out of browsing. Everything already pointed at it still works.' },
}

/** What a deprecation must carry. Foundry asks for all three; the deadline and
 *  the reason are required by the database, the replacement is not — sometimes
 *  a thing is going away with nothing taking its place. */
export interface Deprecation {
  reason: string
  /** ISO date — when it is expected to be deleted. */
  deadline: string
  /** api_name of the successor, or null. */
  replacedBy: string | null
}

export interface OntologyStatusFields {
  status: OntologyStatus
  visibility: OntologyVisibility
  deprecation: Deprecation | null
}

/** Precedence when a link type inherits from the object types it joins. Their
 *  table settles deprecated over experimental; it has no `example` column, so
 *  example-vs-experimental is ours — see migration 322 and DIVERGENCES. Mirrors
 *  sync_link_type_status so the UI can predict what the write will do. */
const WEAKNESS: OntologyStatus[] = ['deprecated', 'experimental', 'example']

export function linkStatusFromEnds(
  source: OntologyStatus, target: OntologyStatus, current: OntologyStatus,
): OntologyStatus {
  return WEAKNESS.find((s) => source === s || target === s) ?? current
}

/** Why a status change would be refused, or null when it is allowed. The
 *  database enforces this; saying it here turns a thrown error into a disabled
 *  button with a reason. */
export function statusChangeProblem(
  from: OntologyStatus, to: OntologyStatus, deprecation: Deprecation | null,
): string | null {
  if (to === 'deprecated' && !deprecation?.reason.trim()) {
    return 'Deprecating needs a reason — what replaced it, or why it is going.'
  }
  if (to === 'deprecated' && !deprecation?.deadline) {
    return 'Deprecating needs a deadline for when it is expected to be deleted.'
  }
  if (from === to) return 'Already ' + STATUS_META[to].label.toLowerCase() + '.'
  return null
}
