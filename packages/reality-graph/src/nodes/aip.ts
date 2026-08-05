// AIP-native node payload shapes.
// Each lives in relationship_nodes with the matching `type` discriminator.

// ── Document ──────────────────────────────────────────────────────────────────

export type DocumentSource = 'upload' | 'email' | 'integration' | 'ocr-capture'
export type IngestionStage = 'raw' | 'ocr' | 'embedded' | 'contextualized' | 'linked'

export interface DocumentPayload {
  source: DocumentSource
  ingestion_stage: IngestionStage
  title: string
  mime_type: string
  uri: string
  page_count?: number
  /** Per-chunk page anchors written when stage advances to 'embedded'. */
  chunks?: ReadonlyArray<{ chunk_id: string; page: number; text_preview: string }>
}

// ── Proposal — versioned agent output operators review ───────────────────────

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'superseded' | 'expired'

export interface ProposalPayload {
  agent_name: string
  agent_version: string
  /** The BeaconAction the agent wants to apply. */
  action_type: string
  action_payload: Record<string, unknown>
  confidence: number
  reasoning: string
  /** Tool calls + cited documents that produced the proposal. */
  provenance: ReadonlyArray<{ kind: 'tool' | 'document'; ref: string; detail?: string }>
  status: ProposalStatus
  /** When refined via NL, the prior proposal id; new versions diff against this. */
  parent_version_id?: string
  /** Operator-authored diff explanation when superseding. */
  refinement_note?: string
}

// ── Principle — operator feedback the LLM categorizes ────────────────────────

export type PrincipleCategory =
  | 'inventory-policy'
  | 'supplier-preference'
  | 'time-window'
  | 'budget'
  | 'compliance'
  | 'other'

export interface PrinciplePayload {
  body: string
  category: PrincipleCategory
  /** True until the operator retires it; expired principles stay for audit. */
  active: boolean
  /** Optional scope narrowing — applies only to these variants/suppliers/agents. */
  applies_to_node_ids?: ReadonlyArray<string>
}

// ── ApprovedAnswer — curated Q&A served before fresh LLM calls ────────────────

export interface ApprovedAnswerPayload {
  question: string
  answer: string
  /** Embedding for semantic match against new questions. */
  embedding_ref: string
  /** Tracks reuse — high counts indicate "stable knowledge". */
  hit_count: number
  /** NULL once the curator is deleted — the answer outlives them (mig 231). */
  curated_by_user_id: string | null
}

// ── Case — canonical workflow envelope ───────────────────────────────────────

export type CaseStatus = 'open' | 'in_review' | 'resolved' | 'closed'

export interface CasePayload {
  title: string
  status: CaseStatus
  opened_by_user_id: string | null
  /** Inputs that triggered the case (alert id, agent run id, manual context). */
  input_refs: ReadonlyArray<string>
  /** Proposal node ids attached to this case. */
  proposal_ids: ReadonlyArray<string>
  /** Final outcome if resolved — typically a BeaconAction summary. */
  outcome?: { action_type: string; summary: string }
}

// ── Constraint — NL rule the LLM categorizes into a typed bucket ─────────────

export type ConstraintBucket = 'scope' | 'threshold' | 'time-window' | 'actor-role'
export type ConstraintSeverity = 'hard' | 'soft'

export interface ConstraintPayload {
  body: string
  bucket: ConstraintBucket
  severity: ConstraintSeverity
  /** BeaconAction types this constraint gates. Empty = applies to all. */
  applies_to_action_types: ReadonlyArray<string>
  active: boolean
  authored_by_user_id: string | null
}

// ── Node descriptors ─────────────────────────────────────────────────────────

export const documentNode        = { computed: {} } as const
export const proposalNode        = { computed: {} } as const
