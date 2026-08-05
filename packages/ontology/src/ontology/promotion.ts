// @vocabulary-declaration — restates the database CHECKs; not a consumer.
// Compass resource status. A curator marks a resource as worth everyone's
// attention, and three things follow: it ranks higher in search, it carries a
// checkmark, and it appears in the promoted-items catalog.
//
// Separate from the ontology status in `status.ts`, and that separation is the
// whole correction. Migration 321 modelled `promoted` as a fifth developmental
// state, which made it exclusive with `active` — promoting something meant no
// longer being able to say it was in use. Foundry keeps them on different axes:
// developmental state belongs to the ontology, curation belongs to the
// filesystem, and a resource carries both.
//
//   "Resource status allows you to indicate the importance of resources in the
//    platform... Currently, the only available status is Promoted."
//
// A one-value vocabulary is theirs, not an oversight of ours. Absence is the
// default state — un-promoting deletes the row rather than storing a 'none'.

/** Kinds a promotion can attach to. Foundry promotes any resource; ours covers
 *  what quicksearch can surface, which is the only place promotion is felt. */
export const PROMOTABLE_KINDS = ['object_type', 'module', 'document'] as const
export type PromotableKind = typeof PROMOTABLE_KINDS[number]

export const RESOURCE_STATUSES = ['promoted'] as const
export type ResourceStatus = typeof RESOURCE_STATUSES[number]

export const PROMOTABLE_LABELS: Record<PromotableKind, string> = {
  object_type: 'object type',
  module:      'application',
  document:    'document',
}

/** What promoting this resource will do, in the operator's words. The three
 *  effects are Compass's; saying them at the point of decision is the difference
 *  between a toggle and an informed one. */
export function promotionEffects(kind: PromotableKind): string[] {
  return [
    'Ranks higher in search for everyone in the organization.',
    'Carries a checkmark wherever it is listed.',
    `Appears in the promoted-items catalog — the ${PROMOTABLE_LABELS[kind]}s worth starting from.`,
  ]
}
