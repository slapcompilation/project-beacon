// Phase 5 — authored agents.
//
// A shipped agent is a folder of code: blocks, a numbered prompt, an eval suite.
// An operator can't be handed that, so an authored agent is the same SHAPE
// expressed as data — purpose, scope, cadence, a bounded toolset picked from the
// registry, and a numbered procedure — which compiles here into exactly what
// runToolLoop already consumes (systemPrompt + taskPrompt + tool whitelist).
//
// Nothing new executes it. The definition compiles to prompts; the existing
// runtime runs them; the existing release + auto-execution gates govern it.

// Scope + cadence are the SAME vocabulary shipped agents declare — an authored
// agent is a different authoring path, not a different kind of agent.
import type { AgentScope, AgentCadence } from '../agents/index'
export type { AgentScope, AgentCadence }
/** Where the agent's output lands. Mirrors the automation gate — an authored
 *  agent never invents a new path to execution. */
export type AgentApproval = 'review' | 'auto'

export interface CadenceDef { cadence: AgentCadence; label: string; help: string }

export const AGENT_CADENCES: CadenceDef[] = [
  { cadence: 'on-event', label: 'On event',  help: 'Runs when the cycle scans a matching subject' },
  { cadence: 'hourly',   label: 'Hourly',    help: 'Runs every hour' },
  { cadence: 'daily',    label: 'Daily',     help: 'Runs once a day with the intelligence cycle' },
  { cadence: 'weekly',   label: 'Weekly',    help: 'Runs once a week' },
  { cadence: 'monthly',  label: 'Monthly',   help: 'Runs once a month' },
]

/** One numbered step. `tool` is optional because a closing step ("emit the
 *  proposal citing each result") is legitimately not a tool call. */
export interface ProcedureStep {
  instruction: string
  tool?: string
}

export interface AuthoredAgentDef {
  id: string
  organizationId: string
  hotelId: string | null
  name: string
  apiName: string
  /** One sentence. The agent's purpose, per the CLAUDE.md agent contract. */
  purpose: string
  scope: AgentScope
  cadence: AgentCadence
  /** Tool names the agent may call — the whitelist runToolLoop enforces. */
  toolset: string[]
  procedure: ProcedureStep[]
  approval: AgentApproval
  /** Below this the agent must ask instead of proposing. */
  clarificationThreshold: number
  enabled: boolean
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Every rule here is one the CLAUDE.md agent contract already states; the
 *  composer can't produce an agent that violates it. `availableTools` is the
 *  registry (code tools + authored tools) the operator may pick from. */
export function validateAuthoredAgent(
  draft: Pick<AuthoredAgentDef, 'name' | 'apiName' | 'purpose' | 'toolset' | 'procedure' | 'clarificationThreshold'>,
  availableTools: ReadonlyArray<string>,
): string[] {
  const errors: string[] = []
  if (!draft.name.trim())    errors.push('Name is required')
  if (!draft.apiName.trim()) errors.push('API name is required')
  if (!draft.purpose.trim()) errors.push('Purpose is required — one sentence on what this agent is for')

  if (draft.toolset.length === 0) {
    errors.push('Pick at least one tool — an agent with no tools can only guess')
  }
  const unknown = draft.toolset.filter((t) => !availableTools.includes(t))
  if (unknown.length > 0) errors.push(`Not in the tool registry: ${unknown.join(', ')}`)

  if (draft.procedure.length === 0) {
    errors.push('Add at least one step — the procedure is what makes this an agent rather than a prompt')
  }
  draft.procedure.forEach((s, i) => {
    if (!s.instruction.trim()) errors.push(`Step ${String(i + 1)} is empty`)
    // A step may only call a tool the agent is allowed to call.
    if (s.tool && !draft.toolset.includes(s.tool)) {
      errors.push(`Step ${String(i + 1)} calls "${s.tool}", which is not in this agent's toolset`)
    }
  })

  if (draft.clarificationThreshold < 0 || draft.clarificationThreshold > 1) {
    errors.push('Clarification threshold must be between 0 and 1')
  }
  return errors
}

// ── Compilation ──────────────────────────────────────────────────────────────

/** The definition compiled into what runToolLoop takes. Deterministic: the same
 *  definition always yields the same prompts, so a version is reviewable. */
export interface CompiledAgent {
  systemPrompt: string
  taskPrompt: string
  toolset: string[]
}

export function compileAgent(def: Pick<AuthoredAgentDef,
  'name' | 'purpose' | 'scope' | 'toolset' | 'procedure' | 'clarificationThreshold'>): CompiledAgent {
  const systemPrompt = [
    `You are ${def.name}. ${def.purpose.trim()}`,
    `You operate at ${def.scope} scope and never act beyond it.`,
    `You may only call these tools: ${def.toolset.join(', ')}.`,
    `You never perform retrieval, arithmetic or writes yourself — you call a tool, or you propose a typed action.`,
  ].join(' ')

  const steps = def.procedure.map((s, i) => {
    const call = s.tool ? `Call \`${s.tool}\`. ` : ''
    return `${String(i + 1)}. ${call}${s.instruction.trim()}`
  })

  // The clarification rule is appended, not authored — it is not optional.
  const threshold = def.clarificationThreshold
  steps.push(
    `${String(steps.length + 1)}. If your confidence is below ${threshold.toFixed(2)} at any step, ` +
    `call \`request_clarification\` with your question, what you already know, and your current confidence. ` +
    `Do not emit a low-confidence proposal.`,
  )

  const taskPrompt = [
    def.purpose.trim(),
    '',
    'Follow this procedure strictly:',
    '',
    steps.join('\n\n'),
    '',
    'Cite every tool result you used in the rationale, with the values you read from it.',
  ].join('\n')

  return { systemPrompt, taskPrompt, toolset: [...def.toolset] }
}

/** One line for the list + composer, so an agent reads as a sentence. */
export function describeAuthoredAgent(def: Pick<AuthoredAgentDef, 'scope' | 'cadence' | 'toolset' | 'procedure' | 'approval'>): string {
  const cadence = AGENT_CADENCES.find((c) => c.cadence === def.cadence)?.label ?? def.cadence
  const gate = def.approval === 'auto' ? 'auto-executes when the gate allows' : 'queues for review'
  return `${cadence} · ${def.scope} scope · ${String(def.procedure.length)} step(s) · ` +
    `${String(def.toolset.length)} tool(s) · ${gate}`
}
