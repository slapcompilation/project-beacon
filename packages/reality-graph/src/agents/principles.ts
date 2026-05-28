// Principle injection — the operator-feedback half of the learning flywheel.
//
// Operators author Principles ("never restock tomatoes past par × 1.5",
// "prefer Sysco for dairy") in the UI. Agents fetch the active set and weigh
// the applicable ones as SOFT constraints: they don't hard-gate a proposal
// (that's the Constraint engine's job at submission), but they shape reasoning
// and are recorded in provenance so the operator sees their feedback landed.

import type { PrincipleRecord } from '../tools/graph_reader'

/**
 * Filters the active principle set to those that apply to a specific variant:
 * hotel-wide principles (no appliesToNodeIds) plus any explicitly scoped to
 * this variant id. Order is preserved so the most-recently-authored win ties
 * when a caller dedupes downstream.
 */
export function selectApplicablePrinciples(
  principles: ReadonlyArray<PrincipleRecord>,
  variantId: string,
): PrincipleRecord[] {
  return principles.filter((p) => {
    const scoped = p.appliesToNodeIds
    if (!scoped || scoped.length === 0) return true // hotel-wide
    return scoped.includes(variantId)
  })
}

/**
 * Builds the provenance entries recording which principles shaped a proposal.
 * One entry per principle; `detail` carries the body so the operator slide-over
 * renders it verbatim without a second fetch.
 */
export function principleProvenance(
  principles: ReadonlyArray<PrincipleRecord>,
): Array<{ kind: 'principle'; ref: string; detail: string }> {
  return principles.map((p) => ({ kind: 'principle', ref: p.id, detail: p.body }))
}

/**
 * A one-line reasoning suffix listing the honored principles, appended to a
 * proposal's reasoning string. Returns '' when no principles apply so callers
 * can concatenate unconditionally.
 */
export function principleReasoningSuffix(
  principles: ReadonlyArray<PrincipleRecord>,
): string {
  if (principles.length === 0) return ''
  const bodies = principles.map((p) => `"${p.body}"`).join('; ')
  return ` Honored operator principle(s): ${bodies}.`
}
