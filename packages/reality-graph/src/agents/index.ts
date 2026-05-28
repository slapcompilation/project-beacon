// Layer: Eye / Mind — AIP-Style Agents
//
// Agents are LLM-orchestrated workflows that read the graph via Logic Tools
// and propose typed BeaconActions. An agent is N small LLM blocks, not one
// big call.
//
// Canonical structure:
//   agents/<agent_name>/
//     blocks/
//       extract_<entity>.ts     sub-LLM: resolve text → typed node ref
//       reason_and_propose.ts   main LLM: numbered procedure + tool calls
//     prompt.ts                 exported task prompt
//     eval/                     *.eval.ts with ≥10 historical cases
//     index.ts                  run(input) → { proposals, trace }
//
// See CLAUDE.md → "AIP-Style Agents" for the full agent contract,
// decomposition rules, numbered-task-prompt pattern, and Chain-of-Thought
// product surface requirement.

import type { BeaconAction } from '../actions/index'

// ── Agent declaration ──────────────────────────────────────────────────────────

export type AgentScope = 'hotel' | 'organization'

export type AgentCadence =
  | 'on-event'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'

export type AgentReleaseStage = 'sandbox' | 'staging' | 'production'

export type AgentApprovalBoundary = 'operator' | 'auto-approve' | 'both'

/**
 * The declaration every agent must export. Mirrors the AIP "Every agent
 * declares" checklist in CLAUDE.md.
 */
export interface AgentSpec {
  name: string
  version: string

  /** One-sentence purpose. */
  purpose: string

  /** Scope inherited from the caller's role. */
  scope: AgentScope

  /** How often the agent runs. */
  cadence: AgentCadence

  /** Bounded list of Logic Tool names the agent's blocks may invoke. */
  toolset: ReadonlyArray<string>

  /** Who can approve proposals this agent emits. */
  approvalBoundary: AgentApprovalBoundary

  /** Release stage; the orchestrator pins to a version per stage. */
  releaseStage: AgentReleaseStage

  /**
   * Run the agent against an input. Implementations decompose internally
   * into sub-LLM blocks and return both the proposals and the trace.
   */
  run: (input: AgentInput) => Promise<AgentRunResult>
}

export interface AgentInput {
  prompt: string
  /** The operator who invoked the agent. Becomes `requestorId` / `actor_id` on emitted proposals. */
  userId: string
  /** Caller's resolved scope; agents must not exceed this. */
  scope: { hotelId?: string; organizationId?: string }
  /** Optional structured context (e.g. the Object View node id when invoked from a slide-over). */
  context?: Record<string, unknown>
}

/**
 * A typed proposal: the action the agent wants to apply, plus the metadata
 * the operator UI renders (confidence + reasoning + provenance) and the
 * Proposal node persists.
 */
export interface AgentProposal {
  action: BeaconAction
  confidence: number
  reasoning: string
  /** Why the agent proposed this: which tools it called, which documents it
   *  cited, and which operator Principles shaped the result. `principle`
   *  entries close the learning flywheel — the operator sees their feedback
   *  was honored, and createProposal writes influenced_by edges from them. */
  provenance: ReadonlyArray<{ kind: 'tool' | 'document' | 'principle'; ref: string; detail?: string }>
}

export interface AgentRunResult {
  proposals: ReadonlyArray<AgentProposal>
  /** Set when the agent paused for clarification instead of proposing. */
  paused?: {
    question: string
    contextSummary: string
    currentConfidence: number
  }
  trace: AgentRunTrace
}

// ── Chain-of-Thought trace (product surface, not a debug panel) ────────────────

/**
 * The structured run log. Same data structure renders in two surfaces:
 *  - Developer debugger when iterating on an agent
 *  - Operator slide-over next to the agent's proposal in production
 *
 * A proposal without a viewable trace is a defect.
 */
export interface AgentRunTrace {
  agentName: string
  agentVersion: string
  startedAt: Date
  endedAt: Date
  totalTokensUsed: number
  steps: ReadonlyArray<AgentRunStep>
}

export type AgentRunStepType =
  | 'system_prompt'    // the system prompt sent to a block
  | 'task_prompt'      // the task prompt sent to a block
  | 'llm_tool_use'     // LLM decided to call a tool, with its Thought
  | 'tool_response'    // the tool's return value
  | 'llm_output'       // the block's final output variable
  | 'exited_block'     // block finished; surfaces the output type
  | 'request_clarification' // confidence below threshold; agent paused

export interface AgentRunStep {
  /** 1-based index. Matches the AIP debugger's numbering (09, 10, 11…). */
  index: number
  /** Which sub-block this step belongs to. */
  blockName: string
  type: AgentRunStepType
  /** Set when type is 'llm_tool_use' or 'tool_response'. */
  toolName?: string
  input?: unknown
  output?: unknown
  /** Intermediate LLM reasoning ("Thought: …"). */
  thought?: string
  tokens?: { used: number; window: number }
  durationMs?: number
}

// ── Agent registry ────────────────────────────────────────────────────────────

export const agentRegistry: Map<string, AgentSpec> = new Map()

export function registerAgent(agent: AgentSpec): void {
  const key = `${agent.name}@${agent.version}`
  if (agentRegistry.has(key)) {
    throw new Error(`Agent '${key}' already registered`)
  }
  agentRegistry.set(key, agent)
}

export function getAgent(name: string, version: string): AgentSpec | undefined {
  return agentRegistry.get(`${name}@${version}`)
}

export function listAgents(): ReadonlyArray<AgentSpec> {
  return [...agentRegistry.values()]
}
