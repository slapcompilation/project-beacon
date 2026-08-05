// @beacon/reality-graph
// Core ontology and four-layer engine for the hotel Reality Graph.
// This package is the heart of the application — all features plug into it.

// ── Result + Error primitives — used by every fallible function ─────────────
export type { Result, Ok, Err } from './result'
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
export type { NodeType, EdgeType, GraphNode, GraphEdge, LayerDeclaration } from './types'
export type { EdgeRecord, TraversalNode, TraverseOptions } from './engine'
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
// Operator-defined action types — the third authored artifact, after tools and
// agents. A shipped action always wins a name collision.
export {
  authoredActionDescriptor, validateAuthoredAction, evaluateSubmissionCriteria,
  parametersFromProperties,
  SHIPPED_ACTION_NAMES,
} from './actions/authored'
export type {
  AuthoredActionDef, AuthoredActionParameter, AuthoredActionOperation,
  SubmissionCriterion, CriterionFailure,
} from './actions/authored'
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
  makeQueryDocumentChunksTool,
  makeComputeDecisionCalibrationTool,
  requestClarificationTool,
} from './tools/index'
export type { GraphReader, ContractTerms, VariantRow, RestockRequestRow, StockLogRow, SupplierRow, HotelRow, DocumentRow, DocumentChunkMatch, PrincipleRecord, MinedProcessResult, ProcessStateStat, ProcessTransitionStat } from './tools/index'
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
export type { BlockDef, BlockContext, RunAgentArgs, AgentRunner } from './agents/runtime'
export {
  selectApplicablePrinciples,
  principleProvenance,
  principleReasoningSuffix,
} from './agents/principles'
export type { MineProcessInput, MineProcessOutput } from './tools/data/mine_process'
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
  groupObjectSet,
} from './userTools/index'

// Tier 1 — the object set: the selection an authored tool aggregates over, and
// that an automation and a cohort will act on and name.
export {
  selectObjectSet, bindSetArgs, validateSetDefinition, validateObjectSet, describeSetFilters,
} from './objectSets/index'
export type {
  ObjectSetDef, SetDefinition, SetSubject, SetFilter, SetParamDef, SetArgs,
  SetRecord, RecordGroup, ObjectSetSelection, SetTypeBreakdown,
} from './objectSets/index'

// searchAround — Foundry's set-to-set traversal, capped at depth 3 and gated on
// registered link types (api-object-sets).
export {
  MAX_TRAVERSAL_DEPTH, searchAround, traverseOnce, validateTraversals, describeTraversals,
} from './objectSets/traversal'
export type {
  SetTraversal, TraversalDirection, LinkRow, TraversalResult, TraversalStep,
} from './objectSets/traversal'

export {
  AGENT_CADENCES, validateAuthoredAgent, compileAgent, describeAuthoredAgent,
} from './authoredAgents/index'
export type {
  AuthoredAgentDef, CompiledAgent, ProcedureStep, AgentApproval, CadenceDef,
} from './authoredAgents/index'
export {
  MODULE_WIDGET_TYPES, MODULE_VARIABLE_TYPES, MODULE_DEFINITION_KINDS,
  IMPLEMENTED_DEFINITION_KINDS, MODULE_LAYOUT_TYPES, MODULE_TRIGGERS,
  IMPLEMENTED_EFFECTS, WIDGET_BINDING,
} from './modules/vocabulary'
export type {
  ModuleWidgetType, ModuleVariableType, ModuleDefinitionKind, ModuleLayoutType,
  ModuleTrigger,
} from './modules/vocabulary'

// W7 — describing an application. The generator proposes; this validates.
export {
  validateModuleSpec, moduleSpecToRows, buildAuthoringPrompt, parseModuleSpec,
  WIDGET_TYPES, VARIABLE_TYPES, DEFINITION_KINDS, LAYOUT_TYPES,
  TRIGGERS as AUTHORING_TRIGGERS, EFFECT_TYPES as AUTHORING_EFFECTS,
} from './authoring/moduleSpec'
export type {
  ModuleSpec, SpecVariable, SpecLayout, SpecWidget, SpecEvent,
  AuthoringCatalog, SpecProblem, RowPayloads,
} from './authoring/moduleSpec'
export type { AuthoredToolReader } from './userTools/asLogicTool'

export {
  validateInterfaceDraft, conformanceErrors, implementsInterface, typesConforming, interfaceProperties,
} from './interfaces/index'
export type { InterfaceDef, InterfacePropertyDef } from './interfaces/index'
export type { AuthoredAgentOutput, AuthoredAgentRun, RunAuthoredAgentArgs } from './authoredAgents/run'
export type {
  UserToolDef, UserToolResult, ToolFilter, ToolParamDef, ToolArgs, ToolRecord,
  ToolRecordGroup, ToolSubject, ToolTypeBreakdown, AggregationFn, AggregationDef,
  SetBucket, GroupedSet,
} from './userTools/index'

export {
  PROPERTY_TYPES, RESERVED_PROPERTY_KEYS, parseGeopoint, formatGeopoint, canBeTitleKey, isBacked, objectTitle, COMPUTED_FNS, EMPTY_VIEW_CONFIG, toSlug,
  validateObjectTypeDraft, validateRecord, coerceValue, validateLinkTypeDraft,
  evaluateComputed, validateComputedProperty, resolveViewConfig, validateViewConfig,
} from './objectTypes/index'
export type {
  PropertyType, PropertyDef, ObjectTypeDef, ObjectTypeDraft, RecordDraft,
  LinkTypeDef, LinkTypeDraft, ComputedFn, ComputedFnDef, ComputedPropertyDef,
  ViewSection, ViewConfigDef, Validation as ObjectTypeValidation,
} from './objectTypes/index'

// Developmental state — Foundry's status + visibility, one definition.
export {
  ONTOLOGY_STATUSES, ONTOLOGY_VISIBILITIES,
  STATUS_META, VISIBILITY_META, linkStatusFromEnds, statusChangeProblem,
} from './ontology/status'
// Compass resource status — a separate axis from the one above.
export {
  PROMOTABLE_KINDS, RESOURCE_STATUSES, PROMOTABLE_LABELS, promotionEffects,
} from './ontology/promotion'
export type { PromotableKind, ResourceStatus } from './ontology/promotion'
export type {
  OntologyStatus, OntologyVisibility, OntologyStatusMeta, Deprecation,
  OntologyStatusFields,
} from './ontology/status'

// Link cardinality, and which backing can express it — Foundry's grammar, not
// ours. See create-link-type.md.
export type { LinkCardinality } from './ontology/linkCardinality'

// Projects — Foundry's primary security boundary — and the roles granted on
// them. Discretionary, inside the mandatory org/hotel boundary.
export type { ProjectRole } from './projects/roles'

// Is this a filled-in document or a blank form? A form that reaches the graph
// looks like evidence and is not.
export type { TemplateVerdict } from './documents/blankTemplate'

// An extracted entity's name is its identity — so it has to name something.
export type { EntityCategory, EntityNameVerdict } from './documents/entityNames'

// Shared properties — one definition reused across object types (gap 3).
export {
  resolveProperty, resolveProperties, attachProblem, usedBy, INHERITED_FIELDS,
} from './objectTypes/sharedProperties'
export type { SharedPropertyDef, ResolvedProperty } from './objectTypes/sharedProperties'

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
export * from './lifecycles'
export { buildAuthoredAgentTools, shippedAgentToolNames } from './authoredAgents/tools'
export { runAuthoredAgent } from './authoredAgents/run'
export { authoredToolAsLogicTool } from './userTools/asLogicTool'
export { grantableRoles, roleAtLeast, ROLE_META, PROJECT_ROLES } from './projects/roles'
