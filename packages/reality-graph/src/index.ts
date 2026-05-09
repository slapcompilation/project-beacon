// @beacon/reality-graph
// Core ontology and four-layer engine for the hotel Reality Graph.
// This package is the heart of the application — all features plug into it.

// ── Result + Error primitives — used by every fallible function ─────────────
export type { Result, Ok, Err } from './result'
export { ok, err, isOk, isErr, mapResult, unwrapOr, andThen } from './result'

export type {
  BeaconError,
  BeaconResult,
  ValidationError,
} from './errors'
export {
  validationFailed,
  notFound,
  scopeDenied,
  rpcFailed,
  unknownError,
  mapPostgrestError,
} from './errors'

export type { Layer, LayerMeta } from './layers'
export { LAYERS } from './layers'
export type { NodeType, EdgeType, GraphNode, GraphEdge, LayerDeclaration } from './types'
export type { EdgeRecord, TraversalNode, TraverseOptions } from './engine'
export { edgesForNode, outEdges, inEdges, walkRevertChain, hasEdge, groupByEdgeType, traverseGraph, otherSide } from './engine'

// ── Graph query primitive (Phase 5 — punch-list #3 from osdk-ts audit) ───────
export type { Direction, NodeSetQuery, NodeSetEdge } from './queries'
export { NodeSetBuilder, nodeSet, linkedIds } from './queries'

// ── Action Registry — every mutation flows through here ───────────────────────
export type {
  BeaconAction,
  TriggeredBy,
  ActionResult,
  ActionSuccess,
  ActionFailure,
  ValidationResult,
  EdgeInsert,
  EdgeContext,
  MutationResult,
  RestockRequestResult,
  StockLogResult,
  ReceiveStockResult,
  RevertActionResult,
  SupplierCreateResult,
  POCreateResult,
  InvoiceSubmitResult,
} from './actions/index'
export { validateAction, edgesForAction } from './actions/index'

// ── Node computed properties — logic on nodes, never in UI ────────────────────
export {
  variantNode,
  stockUrgency,
  daysUntilZero,
  consumptionUrgency,
  restockRecommendedQty,
  forecastForVariant,
  restockRequestNode,
  restockFulfillmentPct,
  totalReceived,
  remainingQty,
  restockUrgency,
  isStale,
  restockEstimatedCost,
  purchaseOrderNode,
  poFulfillmentPct,
  fulfilledLineCount,
  costVariancePct,
  costVarianceAmount,
  isOverdue,
  daysOpenSinceSent,
  daysUntilDelivery,
  supplierNode,
  riskLevel,
  riskLevelFromRow,
  leadTimeLabel,
  leadTimeSourceLabel,
  daysUntilContractExpiry,
  hasContractExpiringSoon,
  onTimePctLabel,
  costVarianceLabel,
  // Network tier — Phase R1
  organizationNode,
  isMultiProperty,
  hotelCount,
  echelonLabel,
  canActAtOrgScope,
  effectiveScope,
  hasOrgMembership,
  orgRoleFor,
  ECHELON_RANK,
} from './nodes/index'
export type {
  StockUrgency,
  ConsumptionUrgency,
  RestockUrgency,
  SupplierRiskLevel,
} from './nodes/index'
