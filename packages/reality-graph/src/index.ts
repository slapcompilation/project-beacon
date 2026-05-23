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
  constraintRejected,
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
  // AIP-native nodes
  documentNode,
  proposalNode,
  principleNode,
  approvedAnswerNode,
  caseNode,
  constraintNode,
} from './nodes/index'
export type {
  StockUrgency,
  ConsumptionUrgency,
  RestockUrgency,
  SupplierRiskLevel,
  // AIP-native node payloads
  DocumentPayload,
  DocumentSource,
  IngestionStage,
  ProposalPayload,
  ProposalStatus,
  PrinciplePayload,
  PrincipleCategory,
  ApprovedAnswerPayload,
  CasePayload,
  CaseStatus,
  ConstraintPayload,
  ConstraintBucket,
  ConstraintSeverity,
} from './nodes/index'

// ── Logic Tool Registry — typed functions, dual-callable by humans + LLMs ────
// Phase A stub: contracts only. Tool implementations land in src/tools/<name>.ts
// See CLAUDE.md → "The Logic Tool Registry (Compute Layer)".
export type { LogicTool, ToolResultMeta, ToolScope, ToolCategory, ToolKind } from './tools/index'
export {
  toolRegistry,
  registerTool,
  getTool,
  listTools,
  listToolsByCategory,
} from './tools/index'
export type { GraphReader, VariantRow, RestockRequestRow, StockLogRow, SupplierRow, HotelRow } from './tools/index'

// ── AIP-Style Agents — LLM-orchestrated workflows that propose BeaconActions ─
// Phase B stub: contracts only. Agents land in src/agents/<agent_name>/.
// See CLAUDE.md → "AIP-Style Agents".
export type {
  AgentSpec,
  AgentScope,
  AgentCadence,
  AgentReleaseStage,
  AgentApprovalBoundary,
  AgentInput,
  AgentProposal,
  AgentRunResult,
  AgentRunTrace,
  AgentRunStep,
  AgentRunStepType,
} from './agents/index'
export {
  agentRegistry,
  registerAgent,
  getAgent,
  listAgents,
} from './agents/index'

// ── Agent runtime + LLM adapter ─────────────────────────────────────────────
export type { LLMClient, LLMCallInput, LLMResponse, LLMMessage, LLMToolCall, LLMToolSpec } from './agents/llm'
export { StubLLMClient } from './agents/llm'
export type { BlockDef, BlockContext, RunAgentArgs, AgentRunner } from './agents/runtime'
export { createBlock, buildRunner, llmCallWithSchema } from './agents/runtime'

// ── First concrete agent: restock_advisor v1 ────────────────────────────────
export {
  buildRestockAdvisorAgent,
  RESTOCK_ADVISOR_TASK_PROMPT,
  type RestockAdvisorDeps,
} from './agents/restock_advisor/index'

// ── Modeling Objectives & Adapters — predictive layer (deferred) ────────────
// Phase C stub: contracts only. Objectives land in src/objectives/<name>/.
// See CLAUDE.md → "Modeling Objectives and Adapters (Predictive Layer — Deferred)".
export type {
  ModelAdapter,
  ModelingObjective,
  EvalSuite,
  Release,
  ReleaseStage,
  Deployment,
  DeploymentKind,
} from './objectives/index'
export {
  objectiveRegistry,
  adapterRegistry,
  registerObjective,
  registerAdapter,
  getObjective,
  getAdapter,
} from './objectives/index'

// ── Constraint engine — typed rules + pure evaluator ────────────────────────
export {
  evaluateConstraints,
  isAutoExecutable,
} from './constraints/index'
export type {
  ConstraintRecord,
  ConstraintTypedRule,
  ScopeRule,
  ThresholdRule,
  TimeWindowRule,
  ActorRoleRule,
  ConstraintViolation,
  EvaluationContext,
} from './constraints/index'
