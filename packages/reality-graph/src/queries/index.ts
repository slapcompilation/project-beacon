// @beacon/reality-graph — graph query primitives
//
// Punch-list item #3 from the osdk-ts audit. Platform-agnostic builders that
// produce frozen query value objects; execution happens at the apps/web layer.

export type { Direction, NodeSetQuery, NodeSetEdge } from './nodeSet'
export { NodeSetBuilder, nodeSet, linkedIds } from './nodeSet'
