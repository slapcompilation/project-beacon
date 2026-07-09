// Typed lifecycles (handbook §1, backlog A8): stateful nodes declare their
// legal transitions here — the ontology's state machines, one map per node
// type. Enforced at the deepest boundary by the enforce_lifecycle() trigger
// (migration 197), which reads the lifecycle_transitions table seeded from
// these exact maps. UIs use legalNext() to offer only lawful moves.

export type LifecycleNode = 'restock_request' | 'purchase_order' | 'case' | 'proposal'

/** state → states it may legally move to; [] = terminal. */
export const LIFECYCLES: Record<LifecycleNode, Record<string, ReadonlyArray<string>>> = {
  restock_request: {
    pending:          ['pending_manager', 'pending_director', 'approved', 'rejected', 'cancelled'],
    pending_manager:  ['pending_director', 'approved', 'rejected', 'cancelled'],
    pending_director: ['approved', 'rejected', 'cancelled'],
    approved:         ['fulfilled', 'cancelled'],
    fulfilled:        [],
    rejected:         [],
    cancelled:        [],
  },
  purchase_order: {
    draft:              ['sent', 'cancelled'],
    sent:               ['confirmed', 'cancelled'],
    confirmed:          ['partially_received', 'closed', 'cancelled'],
    partially_received: ['closed', 'cancelled'],
    closed:             [],
    cancelled:          [],
  },
  case: {
    open:      ['in_review', 'resolved', 'closed'],
    in_review: ['open', 'resolved', 'closed'],
    // reopen is allowed — resolution can prove premature
    resolved:  ['open', 'closed'],
    closed:    [],
  },
  proposal: {
    pending:    ['approved', 'rejected', 'superseded', 'expired'],
    approved:   [],
    rejected:   [],
    superseded: [],
    expired:    [],
  },
}

export function canTransition(node: LifecycleNode, from: string, to: string): boolean {
  if (from === to) return true
  return (LIFECYCLES[node][from] ?? []).includes(to)
}

/** Lawful next states — for UIs that render transition buttons. */
export function legalNext(node: LifecycleNode, from: string): ReadonlyArray<string> {
  return LIFECYCLES[node][from] ?? []
}

/** Throws with derived context (self-apply: failure modes carry the chain). */
export function assertTransition(node: LifecycleNode, from: string, to: string): void {
  if (canTransition(node, from, to)) return
  const allowed = legalNext(node, from)
  throw new Error(
    `illegal ${node} transition '${from}' → '${to}'` +
    (allowed.length > 0 ? ` (from '${from}' only: ${allowed.join(', ')})` : ` ('${from}' is terminal)`),
  )
}
