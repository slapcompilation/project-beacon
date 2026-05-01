// Reality Graph — typed nodeSet() chainable query primitive
// Layer: meta — used by all four layers, no Supabase dependency
//
// Punch-list item #3 from the osdk-ts comparative audit. Replaces ad-hoc
// `supabase.from('table').select('*, joins').eq(...)` calls — repeated across
// ~30 feature APIs — with a single set-based, edge-aware builder backed by the
// `get_node_set()` Postgres RPC (migration 120).
//
// Design constraints
// ──────────────────
// • This package must stay platform-agnostic — no Supabase client import.
//   The builder produces a frozen `NodeSetQuery` value; execution happens at
//   the apps/web layer via `runNodeSet()` (in apps/web/src/lib/queries/).
//   This mirrors osdk-ts' separation of `ObjectSet` (description) from the
//   underlying client (execution).
// • Chainable methods return a new builder (immutable) so query construction
//   composes without spooky aliasing.
// • Direction defaults to `out` (`source -> target`) to match how operators
//   typically read the graph: "what does this variant lead to?" The reverse
//   ("what consumes this variant?") is `.in()`.
//
// Examples
// ────────
//
//   // All `consumes` edges pointing to a set of variants in this hotel:
//   const query = nodeSet('variant')
//     .forIds(['v1', 'v2'])
//     .forHotel(hotelId)
//     .via('consumes')
//     .in()                    // edges where the variant is the *target*
//     .to('stock_log')
//     .build()
//
//   // All edges (any type, both directions) touching a single variant:
//   const flow = nodeSet('variant')
//     .forIds([v.id])
//     .forHotel(hotelId)
//     .bidirectional()
//     .build()

import type { NodeType, EdgeType } from '../types'

// ─── Query value object (RPC parameter shape) ────────────────────────────────

export type Direction = 'out' | 'in' | 'both'

/** Frozen description of a graph query. Pass to `runNodeSet()` for execution. */
export interface NodeSetQuery {
  readonly nodeType:     NodeType
  readonly ids:          readonly string[]
  readonly hotelId:      string
  readonly viaEdgeType?: EdgeType
  readonly toNodeType?:  NodeType
  readonly direction:    Direction
}

// ─── Builder state ───────────────────────────────────────────────────────────

interface BuilderState<T extends NodeType> {
  readonly nodeType:     T
  readonly ids?:         readonly string[]
  readonly hotelId?:     string
  readonly viaEdgeType?: EdgeType
  readonly toNodeType?:  NodeType
  readonly direction:    Direction
}

// ─── Public entry point ──────────────────────────────────────────────────────

/** Start a graph query rooted at `type`. Chain `.forIds()` / `.forHotel()` /
 *  `.via()` / `.to()` / `.in()` / `.bidirectional()` then `.build()`. */
export function nodeSet<T extends NodeType>(type: T): NodeSetBuilder<T> {
  return new NodeSetBuilder<T>({ nodeType: type, direction: 'out' })
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/** Immutable chainable. Each method returns a fresh builder; the underlying
 *  state is never mutated. */
export class NodeSetBuilder<T extends NodeType> {
  /** @internal — exposed for tests; do not mutate. */
  readonly state: BuilderState<T>

  constructor(state: BuilderState<T>) {
    this.state = Object.freeze({ ...state })
  }

  /** Restrict the source set to these node ids. */
  forIds(ids: readonly string[]): NodeSetBuilder<T> {
    return new NodeSetBuilder({ ...this.state, ids: Object.freeze([...ids]) })
  }

  /** Set the hotel scope. Required before `.build()`. */
  forHotel(hotelId: string): NodeSetBuilder<T> {
    return new NodeSetBuilder({ ...this.state, hotelId })
  }

  /** Filter edges by type. */
  via(edgeType: EdgeType): NodeSetBuilder<T> {
    return new NodeSetBuilder({ ...this.state, viaEdgeType: edgeType })
  }

  /** Restrict the linked-side node type. Use after `.via()` to narrow further. */
  to<U extends NodeType>(targetType: U): NodeSetBuilder<T> {
    return new NodeSetBuilder({ ...this.state, toNodeType: targetType })
  }

  /** Walk edges where the source set is on the *target* side
   *  (i.e. "what consumes this variant?"). */
  in(): NodeSetBuilder<T> {
    return new NodeSetBuilder({ ...this.state, direction: 'in' })
  }

  /** Walk edges in both directions (default is `out` only). */
  bidirectional(): NodeSetBuilder<T> {
    return new NodeSetBuilder({ ...this.state, direction: 'both' })
  }

  /** Walk edges where the source set is on the *source* side (default).
   *  Provided as a no-op for symmetry with `.in()` / `.bidirectional()`. */
  out(): NodeSetBuilder<T> {
    return new NodeSetBuilder({ ...this.state, direction: 'out' })
  }

  /** Freeze the builder into a `NodeSetQuery` ready for execution. Throws if
   *  required fields are missing — use `tryBuild()` for a Result-shaped variant. */
  build(): NodeSetQuery {
    const { ids, hotelId } = this.state
    if (!ids)     throw new Error('nodeSet: forIds() is required before build()')
    if (!hotelId) throw new Error('nodeSet: forHotel() is required before build()')
    return Object.freeze({
      nodeType:    this.state.nodeType,
      ids,
      hotelId,
      viaEdgeType: this.state.viaEdgeType,
      toNodeType:  this.state.toNodeType,
      direction:   this.state.direction,
    })
  }
}

// ─── RPC result shape ────────────────────────────────────────────────────────
// Mirror of the columns returned by `public.get_node_set()` (migration 120).
// Note `edge_id` (not `id`) — the RPC renames it to avoid colliding with
// downstream JOIN aliases.

export interface NodeSetEdge {
  edge_id:      string
  edge_type:    EdgeType
  source_type:  NodeType
  source_id:    string
  target_type:  NodeType
  target_id:    string
  hotel_id:     string
  triggered_by: string
  actor_id:     string | null
  metadata:     Record<string, unknown> | null
  created_at:   string
}

/** Convenience: extract the unique target ids on the linked side of the
 *  traversal. Useful for batch hydration via existing feature APIs. */
export function linkedIds(
  query: NodeSetQuery,
  edges: readonly NodeSetEdge[],
): string[] {
  const seen = new Set<string>()
  for (const e of edges) {
    if (query.direction === 'out' || query.direction === 'both') {
      if (e.source_type === query.nodeType && query.ids.includes(e.source_id)) {
        seen.add(e.target_id)
      }
    }
    if (query.direction === 'in' || query.direction === 'both') {
      if (e.target_type === query.nodeType && query.ids.includes(e.target_id)) {
        seen.add(e.source_id)
      }
    }
  }
  return Array.from(seen)
}
