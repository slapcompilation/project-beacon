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
  TransferCreateResult,
  TransferApproveResult,
  PendingApprovalResult,
  ActionField,
  ActionFieldKind,
  ActionDescriptor,
  InvocationMode,
} from './actions/index'
export {
  validateAction,
  edgesForAction,
  actionDescriptors,
  getActionDescriptor,
  SYSTEM_ACTOR,
  isSystemActor,
  resolveActor,
} from './actions/index'

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
  makeQueryOpenRestockRequestsTool,
  makeQuerySisterPropertyInventoryTool,
  makeForecastConsumptionTool,
  makeRankAlternativeSuppliersTool,
  makeQueryVariantDocumentsTool,
  makeQueryDocumentChunksTool,
  makeComputeDecisionCalibrationTool,
  requestClarificationTool,
} from './tools/index'
export type { GraphReader, VariantRow, RestockRequestRow, StockLogRow, SupplierRow, HotelRow, DocumentRow, DocumentChunkMatch, PrincipleRecord } from './tools/index'
export type {
  ComputeDecisionCalibrationInput,
  ComputeDecisionCalibrationOutput,
  CalibrationReader,
  CalibrationProposalRef,
} from './tools/index'

// ── Decision calibration — reliability math behind trustworthy autonomy ──────
export {
  computeCalibration,
  outcomeLabel,
  calibratedConfidence,
} from './calibration/index'
export type {
  CalibrationSample,
  CalibrationBin,
  CalibrationReport,
  CalibrationVerdict,
  CalibrationOptions,
} from './calibration/index'

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

// ── Principle injection — operator-feedback half of the learning flywheel ───
export {
  selectApplicablePrinciples,
  principleProvenance,
  principleReasoningSuffix,
} from './agents/principles'

// ── First concrete agent: restock_advisor v1 ────────────────────────────────
export {
  buildRestockAdvisorAgent,
  RESTOCK_ADVISOR_TASK_PROMPT,
  restockExtractVariantBlock,
  restockExtractSupplierBlock,
  restockReasonAndProposeBlock,
  type RestockAdvisorDeps,
} from './agents/restock_advisor/index'

// ── Second concrete agent: waste_triage v1 ──────────────────────────────────
export {
  buildWasteTriageAgent,
  WASTE_TRIAGE_TASK_PROMPT,
  wasteExtractVariantBlock,
  wasteProposeActionsBlock,
  type WasteTriageDeps,
} from './agents/waste_triage/index'

// ── Third concrete agent: overstock_rebalancer v1 ───────────────────────────
export {
  buildOverstockRebalancerAgent,
  OVERSTOCK_REBALANCER_TASK_PROMPT,
  overstockExtractVariantBlock,
  overstockReasonAndRebalanceBlock,
  type OverstockRebalancerDeps,
} from './agents/overstock_rebalancer/index'

// ── Tool factories (re-exported for descriptor introspection) ──────────────
export { makeQueryRecentWasteLogsTool } from './tools/data/query_recent_waste_logs'

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

// ── First concrete modeling objective: consumption_forecast ────────────────
export {
  CONSUMPTION_FORECAST_OBJECTIVE_NAME,
  consumptionForecastObjective,
  consumptionForecastEvalSuite,
  baselineRolling30dAdapter,
  seasonalNaiveV1Adapter,
  registerConsumptionForecast,
  type ConsumptionForecastInput,
  type ConsumptionForecastOutput,
} from './objectives/consumption_forecast/index'

// ── Eval primitives — rubric grader (LLM-as-judge) + CI auto-persist ───────
export {
  gradeWithRubric,
  type RubricCheck,
  type RubricResult,
  type RubricPerCheck,
  evalAutoPersistReporter,
  type EvalRunRecord,
} from './evals/index'

// ── Constraint engine — typed rules + pure evaluator ────────────────────────
export {
  evaluateConstraints,
  isAutoExecutable,
  decideAutoExecution,
  DEFAULT_AUTO_EXEC_POLICY,
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
  AutoExecutionPolicy,
  AutoExecutionDecision,
  AgentReleaseContext,
  ActiveAgentReleases,
} from './constraints/index'

export { DEFAULT_ORG_POLICY, mergeOrgPolicy, orgPolicyToAutoExecPolicy } from './policy/index'
export type { OrgPolicy } from './policy/index'

export { runIntelligenceCycle } from './cycles/intelligenceCycle'
export type {
  IntelligenceCycleDeps,
  CycleVariant,
  CycleOutcome,
  CycleItem,
  CycleResult,
} from './cycles/intelligenceCycle'

// ── Scenarios — graph-overlay sandbox + non-persistent runner (H2) ──────────
export {
  mergePolicyOverlay,
  mergeConstraintOverlay,
  applyVariantOverlay,
} from './scenarios/index'
export type {
  ScenarioGraphOverlay,
  ScenarioSimulationCache,
} from './scenarios/index'
export {
  simulateCycleWithOverlay,
  diffSimulations,
} from './scenarios/simulate'
export type { SimulationDeps } from './scenarios/simulate'
export type {
  ScenarioGateway,
  ScenarioRow,
  ScenarioSimulationResult,
} from './scenarios/gateway'

export {
  makeApplyOverlayEditTool,
  type ApplyOverlayEditInput,
  type ApplyOverlayEditOutput,
} from './tools/scenarios/apply_overlay_edit'
export {
  makeSimulateCycleWithOverlayTool,
  type SimulateCycleWithOverlayInput,
  type SimulateCycleWithOverlayOutput,
} from './tools/scenarios/simulate_cycle_with_overlay'
export {
  makeQuerySimulationResultTool,
  type QuerySimulationResultInput,
  type QuerySimulationResultOutput,
} from './tools/scenarios/query_simulation_result'
