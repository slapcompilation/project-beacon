// @beacon/reality-graph
// Core ontology and four-layer engine for the hotel Reality Graph.
// This package is the heart of the application — all features plug into it.

export type { Layer, LayerMeta } from './layers'
export { LAYERS } from './layers'
export type { NodeType, EdgeType, GraphNode, GraphEdge, LayerDeclaration } from './types'
export type { EdgeRecord, TraversalNode, TraverseOptions } from './engine'
export { edgesForNode, outEdges, inEdges, walkRevertChain, hasEdge, groupByEdgeType, traverseGraph, otherSide } from './engine'

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
} from './nodes/index'
export type {
  StockUrgency,
  ConsumptionUrgency,
  RestockUrgency,
  SupplierRiskLevel,
} from './nodes/index'
