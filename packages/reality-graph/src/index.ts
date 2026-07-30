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
export { EDGE_TYPES } from './types'
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
  copilotProposalToAction,
  evaluateBatchApprovals,
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
// Canonical Studio catalog — single source of truth for the Studio's tool/agent/objective views.
export { listAllToolDescriptors, listAllAgentSpecs, listAllObjectiveDescriptors, type ObjectiveDescriptor as CatalogObjectiveDescriptor } from './catalog'

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
  makeScoreForecastAccuracyTool,
  makeComputeReorderPointTool,
  makeComputeDecisionQualityTool,
  scoreDecisionQuality,
  makeOccupancyAdjustedForecastTool,
  makeRankAlternativeSuppliersTool,
  makeQueryVariantDocumentsTool,
  makeQueryDocumentChunksTool,
  makeComputeDecisionCalibrationTool,
  makeDetectOntologyGapsTool,
  requestClarificationTool,
} from './tools/index'
export type { GraphReader, VariantRow, RestockRequestRow, StockLogRow, SupplierRow, HotelRow, DocumentRow, DocumentChunkMatch, PrincipleRecord, MinedProcessResult, ProcessStateStat, ProcessTransitionStat } from './tools/index'
export type {
  ComputeDecisionCalibrationInput,
  ComputeDecisionCalibrationOutput,
  CalibrationReader,
  CalibrationProposalRef,
  DetectOntologyGapsInput,
  DetectOntologyGapsOutput,
  OntologyReader,
  ComputeReorderPointInput,
  ComputeReorderPointOutput,
  ComputeDecisionQualityInput,
  ComputeDecisionQualityOutput,
  DecisionQualityScore,
  ScoreForecastAccuracyInput,
  ScoreForecastAccuracyOutput,
  OccupancyAdjustedForecastInput,
  OccupancyAdjustedForecastOutput,
  OccupancyContext,
  OccupancyForecastReader,
} from './tools/index'

// ── Decision calibration — reliability math behind trustworthy autonomy ──────
export {
  computeCalibration,
  outcomeLabel,
  calibratedConfidence,
  recommendAutonomy,
  DEFAULT_CALIBRATION_HALF_LIFE_DAYS,
  DEFAULT_CALIBRATION_EDIT_PENALTY,
  HONEST_LABEL_OPTIONS,
  DEFAULT_AUTONOMY_CONFIG,
} from './calibration/index'
export type {
  CalibrationSample,
  CalibrationBin,
  CalibrationReport,
  CalibrationVerdict,
  CalibrationOptions,
  AutonomyConfig,
  AutonomyRecommendation,
  AgentActionContext,
} from './calibration/index'

// ── Self-evolving ontology — gap detection (Pillar 2) ────────────────────────
export {
  detectReasonCategoryGaps,
  detectRemovalCategoryGaps,
  detectAdditionCategoryGaps,
  detectUntypedEdgeGaps,
} from './ontology/index'
export type {
  OntologyGap,
  OntologyGapKind,
  OntologyGapEvidence,
  ReasonRow,
  DetectReasonCategoryConfig,
  RemovalReasonRow,
  AdditionReasonRow,
  DetectRemovalCategoryOptions,
  EdgeTypeCount,
  DetectUntypedEdgeOptions,
} from './ontology/index'

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
export { StubLLMClient, toolSpec } from './agents/llm'
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
export { makeMineProcessTool } from './tools/data/mine_process'
export type { MineProcessInput, MineProcessOutput } from './tools/data/mine_process'

export { scanForPII, sensitivityFromPII, SENSITIVITY_RANK } from './governance/pii'
export type { PIIType, Sensitivity } from './governance/pii'

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
  recommendAdapterPromotion,
} from './objectives/index'
export type { AdapterEval, PromotionRecommendation } from './objectives/index'

// ── First concrete modeling objective: consumption_forecast ────────────────
export {
  CONSUMPTION_FORECAST_OBJECTIVE_NAME,
  consumptionForecastObjective,
  consumptionForecastEvalSuite,
  baselineRolling30dAdapter,
  seasonalNaiveV1Adapter,
  ewmaV1Adapter,
  holtLinearV1Adapter,
  autoSelectV1Adapter,
  occupancyV1Adapter,
  CONSUMPTION_FORECAST_ADAPTERS,
  registerConsumptionForecast,
  backtestForecastAdapters,
  // The accuracy instrument — score N closed windows and aggregate. A single
  // holdout over few variants is noise; this is what auto-select uses internally.
  reconstructObservations,
  scoreForecastAccuracy,
  rollingCutoffs,
  type ConsumptionForecastInput,
  type ConsumptionForecastOutput,
  type OccupancyInput,
  type OccupancyPoint,
  type BacktestCase,
  type BacktestResult,
  type AdapterScore,
  type CohortScore,
  type CasePrediction,
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

export { DEFAULT_ORG_POLICY, mergeOrgPolicy, orgPolicyToAutoExecPolicy, orgPolicyToCalibrationOptions, LOOP_GOALS, goalProgress, recommendGoalIntervention } from './policy/index'
export type { OrgPolicy, GoalDef, GoalIntervention, ExpiryMonitorConfig, IntegrationHealthConfig, BottleneckMonitorConfig, BudgetMonitorConfig, CporMonitorConfig } from './policy/index'

export {
  selectExpiryTriggers,
  expiryUrgency,
  expiryHitToWriteOff,
  parseExpiryTuning,
  selectStockoutTriggers,
  stockoutUrgency,
  selectWasteTriggers,
  selectSupplierTriggers,
  supplierUrgency,
  classifyIntegrationHealth,
  selectIntegrationHealthAlerts,
  selectBottleneckTriggers,
  bottleneckUrgency,
  selectBudgetTriggers,
  selectCporTrigger,
} from './monitors/index'
export type {
  ExpiryBatch, ExpiryTriggerHit, ExpiryTuningResult,
  StockoutReading, StockoutHit,
  WasteReading, WasteHit,
  SupplierReading, SupplierHit,
  IntegrationSourceReading, IntegrationHealthHit,
  IntegrationHealthStatus, IntegrationSourceKind,
  BottleneckReading, BottleneckHit,
  BudgetReading, BudgetHit, CporReading, CporHit,
} from './monitors/index'

export {
  AUTOMATION_METRICS, AUTOMATION_EFFECTS, COMPARISON_LABELS,
  evaluateAutomation, evaluateAutomations, validateAutomation, describeAutomation,
  automationsToProposals,
} from './automations/index'
export type {
  Automation, AutomationSubject, AutomationCondition, AutomationEffect, AutomationGate,
  AutomationStage, ComparisonOp, MetricDef, EffectDef, AutomationReading, AutomationHit,
  AutomationDraft, AutomationValidation, AutomationProposal, AutomationContext,
} from './automations/index'

export {
  AGGREGATIONS, OP_LABELS, evaluateUserTool, evaluateUserToolAcross, validateUserTool,
  describeUserTool, allProperties, subjectProperties, subjectLabel, bindToolArgs,
} from './userTools/index'

export {
  AGENT_CADENCES, validateAuthoredAgent, compileAgent, describeAuthoredAgent,
} from './authoredAgents/index'
export type {
  AuthoredAgentDef, CompiledAgent, ProcedureStep, AgentApproval, CadenceDef,
} from './authoredAgents/index'
export { runAuthoredAgent, authoredAgentOutputSchema } from './authoredAgents/run'
export { buildAuthoredAgentTools, shippedAgentToolNames } from './authoredAgents/tools'
export { authoredToolAsLogicTool, resolveToolGroups, paramsToSchema } from './userTools/asLogicTool'
export type { AuthoredToolReader } from './userTools/asLogicTool'

export {
  validateInterfaceDraft, conformanceErrors, implementsInterface, typesConforming, interfaceProperties,
} from './interfaces/index'
export type { InterfaceDef, InterfacePropertyDef } from './interfaces/index'
export type { AuthoredAgentOutput, AuthoredAgentRun, RunAuthoredAgentArgs } from './authoredAgents/run'
export type {
  UserToolDef, UserToolResult, ToolFilter, ToolParamDef, ToolArgs, ToolRecord,
  ToolRecordGroup, ToolSubject, ToolTypeBreakdown, AggregationFn, AggregationDef,
} from './userTools/index'

export {
  PROPERTY_TYPES, RESERVED_PROPERTY_KEYS, COMPUTED_FNS, EMPTY_VIEW_CONFIG, toSlug,
  validateObjectTypeDraft, validateRecord, coerceValue, validateLinkTypeDraft,
  evaluateComputed, validateComputedProperty, resolveViewConfig, validateViewConfig,
} from './objectTypes/index'
export type {
  PropertyType, PropertyDef, ObjectTypeDef, ObjectTypeDraft, RecordDraft,
  LinkTypeDef, LinkTypeDraft, ComputedFn, ComputedFnDef, ComputedPropertyDef,
  ViewSection, ViewConfigDef, Validation as ObjectTypeValidation,
} from './objectTypes/index'

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
export * from './lifecycles'
