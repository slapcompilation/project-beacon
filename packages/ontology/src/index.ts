// @beacon/ontology
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

export type { NodeType, EdgeType, GraphNode, GraphEdge, LayerDeclaration } from './types'
// Operator-defined action types — the third authored artifact, after tools and
// agents. A shipped action always wins a name collision.

// ── Node computed properties — logic on nodes, never in UI ────────────────────

// ── Logic Tool Registry — typed functions, dual-callable by humans + LLMs ────
// Phase A stub: contracts only. Tool implementations land in src/tools/<name>.ts
// See CLAUDE.md → "The Logic Tool Registry (Compute Layer)".
// Canonical Studio catalog — single source of truth for the Studio's tool/agent/objective views.

// ── Decision calibration — reliability math behind trustworthy autonomy ──────

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

// ── Agent runtime + LLM adapter ─────────────────────────────────────────────

// ── Modeling Objectives & Adapters — predictive layer (deferred) ────────────
// Phase C stub: contracts only. Objectives land in src/objectives/<name>/.
// See CLAUDE.md → "Modeling Objectives and Adapters (Predictive Layer — Deferred)".

// ── Constraint engine — typed rules + pure evaluator ────────────────────────




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


// W7 — describing an application. The generator proposes; this validates.

export {
  validateInterfaceDraft, conformanceErrors, implementsInterface, typesConforming, interfaceProperties,
} from './interfaces/index'
export type { InterfaceDef, InterfacePropertyDef } from './interfaces/index'

export {
  PROPERTY_TYPES, RESERVED_API_NAMES, parseGeopoint, formatGeopoint,
  canBeTitleKey, titleKeyOf, primaryKeyOf, primaryKeyEligibility, primaryKeyAdvice,
  objectTitle, toSlug, toCamel, toPascal,
  validateObjectTypeDraft, validateRecord, coerceValue, validateLinkTypeDraft, pluralise,
} from './objectTypes/index'
export type {
  PropertyType, PropertyDef, ObjectTypeDef, ObjectTypeDraft, RecordDraft,
  LinkTypeDef, LinkTypeDraft, Validation as ObjectTypeValidation,
} from './objectTypes/index'

// Developmental state — Foundry's status + visibility, one definition.
export {
  ONTOLOGY_STATUSES, OBJECT_TYPE_STATUSES, ONTOLOGY_VISIBILITIES,
  STATUS_META, VISIBILITY_META, linkStatusFromEnds, statusChangeProblem,
} from './ontology/status'
export type {
  OntologyStatus, ObjectTypeStatus, OntologyVisibility, OntologyStatusMeta, Deprecation,
  OntologyStatusFields,
} from './ontology/status'

// Link cardinality, and which backing can express it — Foundry's grammar, not
// ours. See create-link-type.md.
export type { LinkCardinality, LinkBackingKind } from './ontology/linkCardinality'
export {
  LINK_CARDINALITIES, LINK_BACKINGS, CARDINALITY_LABEL, BACKING_LABEL, BACKING_ICON,
  CARDINALITY_BACKINGS, canBack, preferredBacking,
} from './ontology/linkCardinality'

// Projects — Foundry's primary security boundary — and the roles granted on
// them. Discretionary, inside the mandatory org/hotel boundary.
export type { ProjectRole } from './projects/roles'

// Is this a filled-in document or a blank form? A form that reaches the graph
// looks like evidence and is not.

// An extracted entity's name is its identity — so it has to name something.

// Shared properties — one definition reused across object types (gap 3).
export {
  resolveProperty, resolveProperties, attachProblem, usedBy, INHERITED_FIELDS,
} from './objectTypes/sharedProperties'
export type { SharedPropertyDef, ResolvedProperty } from './objectTypes/sharedProperties'

// ── Scenarios — graph-overlay sandbox + non-persistent runner (H2) ──────────
export { grantableRoles, roleAtLeast, ROLE_META, PROJECT_ROLES } from './projects/roles'

// Generated from object_types — one interface per registered type.

// The Dataset Layer. The view algorithm and the commit rules are in SQL
// (migrations 392–394) because a trigger is the only place a rule cannot be
// walked around; this is the grammar a surface needs to render one.
export {
  FIELD_TYPES, NOT_A_BASE_TYPE, TRANSACTION_TYPES, TRANSACTION_STATUSES,
  validateDatasetSchema, describeField,
} from './datasets/index'
export type {
  FieldType, DatasetField, TransactionType, TransactionStatus,
  Dataset, DatasetBranch, DatasetTransaction, DatasetFile,
} from './datasets/index'

// Markings — the mandatory control. Enforcement is in SQL (399–402); this is the
// grammar for rendering the access panel.
export {
  MARKING_KINDS, MARKING_KIND_META, MARKING_ORIGIN_META, MARKING_PERMISSION_META,
  ACCESS_LEVEL_META, accessLevel, satisfiesAll,
} from './markings/index'
export type {
  MarkingKind, MarkingOrigin, MarkingPermission, CategoryVisibility,
  ResourceMarking, AccessLevel,
} from './markings/index'
