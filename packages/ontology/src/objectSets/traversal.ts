// searchAround — traversal that turns a set of one type into a set of another.
//
// Foundry (api-object-sets): "Based on the object type of your object set,
// Search Around methods are generated to enable traversing links ... This
// results in an object set of Passengers, which can be further filtered or
// searched around on."
//
// Two things that follow, and are copied rather than reinterpreted:
//
//   • The RESULT IS A SET, not a filtered version of the original. The type
//     changes at each hop, which is what makes "restock requests for variants
//     supplied by Supplier X" expressible at all — you cannot get there by
//     filtering suppliers.
//
//   • DEPTH IS CAPPED AT 3. "for performance reasons, the number of Search
//     Around operations you can conduct in a single search is currently limited
//     to 3. If you attempt to run a search with more than three levels of Search
//     Around depth, the search will fail at runtime." Copied because the limit
//     encodes a reason, not because three is a nice number.
//
// Foundry also only generates a search-around for link types imported into the
// project. Our equivalent is `declared`: a hop over a link type nobody
// registered is rejected, which is what finally makes CLAUDE.md's
// `traversableLinks` claim true.
//
// Pure, like the rest of objectSets: the caller supplies the link rows, this
// decides which members come out the other side.

// The filter shape, inlined when the in-memory set module was deleted (725's
// arc) — this engine survives as the named executor for Vertex's
// search-around expansion.
export type ComparisonOp = 'lt' | 'lte' | 'gt' | 'gte'
export interface SetFilter {
  property: string
  op: ComparisonOp | 'eq' | 'neq'
  /** Typed against the property. When `param` is set this is the fallback used
   *  if the caller omits an optional parameter. */
  value: number | string | boolean
  /** Take the comparison value from this parameter instead of the literal
   *  above — what turns one set into a family of sets. */
  param?: string
}

/** Foundry's runtime limit, copied deliberately. */
export const MAX_TRAVERSAL_DEPTH = 3

/** A link type has two sides; a hop names which one it is walking.
 *  `forward` follows source -> target, `reverse` follows target -> source. */
export type TraversalDirection = 'forward' | 'reverse'

export interface SetTraversal {
  /** The link type walked, by the edge type that names it. */
  edgeType: string
  direction: TraversalDirection
  /** Applied to the set that comes OUT of the hop, over the new type's
   *  properties — the old type's are no longer in scope. */
  filters: SetFilter[]
}

/** One link, flattened. The caller fetches these from whichever backing owns
 *  the relationship; traversal does not care which. */
export interface LinkRow {
  edgeType: string
  sourceId: string
  targetId: string
}

/** The ids reachable in one hop. Deduplicated: two links onto the same object
 *  make it one member, not two — a set, not a list. */
export function traverseOnce(
  members: ReadonlySet<string>,
  links: ReadonlyArray<LinkRow>,
  hop: Pick<SetTraversal, 'edgeType' | 'direction'>,
): Set<string> {
  const out = new Set<string>()
  for (const l of links) {
    if (l.edgeType !== hop.edgeType) continue
    const [from, to] = hop.direction === 'forward' ? [l.sourceId, l.targetId] : [l.targetId, l.sourceId]
    if (members.has(from)) out.add(to)
  }
  return out
}

/** Checks a traversal chain before anything runs.
 *
 *  `declared` is the set of link types registered in the ontology. A hop over
 *  anything else is refused rather than silently returning nothing — an empty
 *  answer from a typo is indistinguishable from an empty answer that is true. */
export function validateTraversals(
  traversals: ReadonlyArray<Pick<SetTraversal, 'edgeType' | 'direction'>>,
  declared: ReadonlySet<string>,
): string[] {
  const errors: string[] = []
  if (traversals.length > MAX_TRAVERSAL_DEPTH) {
    errors.push(
      `A search may traverse at most ${String(MAX_TRAVERSAL_DEPTH)} links; this one traverses ${String(traversals.length)}`,
    )
  }
  for (const t of traversals) {
    if (!t.edgeType.trim()) {
      errors.push('Pick a link to traverse')
    } else if (!declared.has(t.edgeType)) {
      errors.push(`"${t.edgeType}" is not a registered link type, so it cannot be traversed`)
    }
    if (t.direction !== 'forward' && t.direction !== 'reverse') {
      errors.push(`Traversal of "${t.edgeType}" needs a direction`)
    }
  }
  return errors
}

export interface TraversalStep {
  edgeType: string
  direction: TraversalDirection
  /** Members entering this hop. */
  from: number
  /** Members leaving it. */
  to: number
}

export interface TraversalResult {
  members: Set<string>
  /** One entry per hop — where a chain collapsed to nothing is the first
   *  question anyone asks of an empty result. */
  steps: TraversalStep[]
}

/** Walks the whole chain. Stops early when a hop yields nothing: further hops
 *  from an empty set are empty too, and the trace shows where it died. */
export function searchAround(
  start: ReadonlySet<string>,
  links: ReadonlyArray<LinkRow>,
  traversals: ReadonlyArray<SetTraversal>,
): TraversalResult {
  let members = new Set(start)
  const steps: TraversalStep[] = []
  for (const hop of traversals.slice(0, MAX_TRAVERSAL_DEPTH)) {
    const from = members.size
    members = traverseOnce(members, links, hop)
    steps.push({ edgeType: hop.edgeType, direction: hop.direction, from, to: members.size })
    if (members.size === 0) break
  }
  return { members, steps }
}

/** One-line English for a chain, so a traversal reads as a question. */
export function describeTraversals(
  traversals: ReadonlyArray<SetTraversal>,
  labelFor: (edgeType: string, direction: TraversalDirection) => string = (e) => e,
): string {
  return traversals.map((t) => labelFor(t.edgeType, t.direction)).join(' → ')
}
