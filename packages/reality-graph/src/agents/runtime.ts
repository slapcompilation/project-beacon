// Agent runtime — orchestrates N small LLM blocks, collects an AgentRunTrace.
// Each block is a typed function: (input, ctx) => output. Blocks call tools
// via ctx.invokeTool, which is recorded in the trace.

import type { z } from 'zod'
import type { LogicTool } from '../tools/index'
import type { LLMClient, LLMMessage, LLMResponse, LLMToolSpec } from './llm'
import type {
  AgentRunStep,
  AgentRunTrace,
} from './index'

// ── Block primitives ─────────────────────────────────────────────────────────

export interface BlockContext {
  /** Calls a Logic Tool by name and records the call in the trace. The optional
   *  `thought` is the LLM's reasoning before the call (surfaced in the trace). */
  invokeTool: <I, O>(toolName: string, input: I, opts?: { thought?: string }) => Promise<O>
  /** Pushes a typed step into the trace. */
  appendStep: (step: Omit<AgentRunStep, 'index'>) => void
  /** Bounded LLM client. */
  llm: LLMClient
  /** Tools the block is allowed to invoke. Names only — runtime resolves to the registry. */
  toolset: ReadonlyArray<string>
}

export interface BlockDef<I, O> {
  name: string
  /** zod schema for the block's input — checked at runtime. */
  inputSchema: z.ZodType<I>
  /** zod schema for the block's output — checked at runtime. */
  outputSchema: z.ZodType<O>
  /** One-paragraph system prompt for the sub-LLM. */
  systemPrompt: string
  /** Implementation. Receives parsed input + ctx; returns typed output. */
  run: (input: I, ctx: BlockContext) => Promise<O>
}

export function createBlock<I, O>(def: BlockDef<I, O>): BlockDef<I, O> {
  return def
}

// ── Tool I/O validation ───────────────────────────────────────────────────────
// AIP blocks are typed: every block "takes an input, returns an output". Logic
// Tools declare zod input/output schemas, so the runtime enforces them at the
// invoke boundary — a hallucinated/malformed tool call fails fast with a clear
// error recorded in the trace, instead of feeding garbage into tool logic.
// Tools whose schema isn't zod (plain-object placeholders) pass through.

function isZodSchema(s: unknown): s is { safeParse: (v: unknown) => { success: boolean; error?: { issues: { path: (string | number)[]; message: string }[] } } } {
  return !!s && typeof (s as { safeParse?: unknown }).safeParse === 'function'
}

/** Throws when `value` violates `schema` (when schema is zod); otherwise no-op.
 *  Validate-only — never transforms the value, so tool output shapes are untouched. */
export function validateToolIO(schema: unknown, value: unknown, label: string): void {
  if (!isZodSchema(schema)) return
  const res = schema.safeParse(value)
  if (!res.success) {
    const issues = (res.error?.issues ?? []).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
    throw new Error(`${label} failed schema validation: ${issues}`)
  }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

export interface RunAgentArgs {
  agentName: string
  agentVersion: string
  llm: LLMClient
  /** Tools the agent is permitted to use. Names must exist in toolRegistry. */
  toolRegistry: Map<string, LogicTool>
  /** Subset of the registry names the orchestrator allows the blocks to call. */
  allowedTools: ReadonlyArray<string>
  /** Token budget shown on trace steps ("1,607 of 24,000"). Matches the
   *  tool-loop default; pass the loop's maxTokens when overriding it. */
  tokenWindow?: number
}

export interface AgentRunner {
  /** Run a block. Validates I/O against schemas, records step transitions. */
  runBlock: <I, O>(block: BlockDef<I, O>, input: I) => Promise<O>
  /** Snapshot the trace at any point. */
  snapshotTrace: () => AgentRunTrace
}

/**
 * Build a stateful runner for a single agent invocation. The agent's index.ts
 * calls this once, then runs blocks in sequence, then returns the trace.
 */
export function buildRunner(args: RunAgentArgs): AgentRunner {
  const startedAt = new Date()
  const steps: AgentRunStep[] = []
  let stepIndex = 0
  let tokensUsed = 0

  const allowed = new Set(args.allowedTools)

  const tokenWindow = args.tokenWindow ?? 24_000

  const appendStep = (partial: Omit<AgentRunStep, 'index'>): void => {
    stepIndex += 1
    // LLM-driven steps carry the running budget so the trace renders the AIP
    // debugger's "N of M tokens used" bar per step.
    const tokens = (partial.type === 'llm_tool_use' || partial.type === 'llm_output') && tokensUsed > 0
      ? { used: tokensUsed, window: tokenWindow }
      : undefined
    steps.push({ index: stepIndex, ...(tokens ? { tokens } : {}), ...partial })
  }

  const runBlock = async <I, O>(block: BlockDef<I, O>, rawInput: I): Promise<O> => {
    const parsedInput = block.inputSchema.parse(rawInput)
    appendStep({
      blockName: block.name,
      type: 'system_prompt',
      input: block.systemPrompt,
    })
    appendStep({
      blockName: block.name,
      type: 'task_prompt',
      input: parsedInput,
    })

    const blockCtx: BlockContext = {
      invokeTool: async <BI, BO>(toolName: string, toolInput: BI, opts?: { thought?: string }): Promise<BO> => {
        if (!allowed.has(toolName)) {
          throw new Error(`Tool '${toolName}' not allowed for agent '${args.agentName}'`)
        }
        const tool = args.toolRegistry.get(toolName)
        if (!tool) {
          throw new Error(`Tool '${toolName}' not found in registry`)
        }
        validateToolIO(tool.inputSchema, toolInput, `tool '${toolName}' input`)
        appendStep({
          blockName: block.name,
          type: 'llm_tool_use',
          toolName,
          input: toolInput,
          thought: opts?.thought,
        })
        const started = Date.now()
        const rawResult = await tool.invoke(toolInput)
        validateToolIO(tool.outputSchema, rawResult, `tool '${toolName}' output`)
        const result = rawResult as BO
        appendStep({
          blockName: block.name,
          type: 'tool_response',
          toolName,
          output: result,
          durationMs: Date.now() - started,
        })
        return result
      },
      appendStep: (step) => {
        appendStep({ ...step, blockName: step.blockName || block.name })
      },
      llm: args.llm,
      toolset: args.allowedTools,
    }

    const output = await block.run(parsedInput, blockCtx)
    const parsedOutput = block.outputSchema.parse(output)

    appendStep({
      blockName: block.name,
      type: 'llm_output',
      output: parsedOutput,
    })
    appendStep({
      blockName: block.name,
      type: 'exited_block',
      output: parsedOutput,
    })

    return parsedOutput
  }

  const snapshotTrace = (): AgentRunTrace => ({
    agentName: args.agentName,
    agentVersion: args.agentVersion,
    startedAt,
    endedAt: new Date(),
    totalTokensUsed: tokensUsed,
    steps: [...steps],
  })

  // Track tokens via LLM proxy — wraps the supplied client so every response
  // increments the running count automatically.
  const baseLlm = args.llm
  const trackedLlm: LLMClient = {
    async call<T>(input: Parameters<LLMClient['call']>[0]): Promise<LLMResponse<T>> {
      const resp = await baseLlm.call<T>(input)
      tokensUsed += resp.tokensUsed
      return resp
    },
  }
  args.llm = trackedLlm

  return { runBlock, snapshotTrace }
}

// ── LLM tool loop — the model orchestrates the reasoning ──────────────────────
// The LLM, given the bounded tool specs + the numbered task prompt, decides which
// tool to call, reads the result, and loops until it emits a typed proposal (or
// calls request_clarification). Safety is inherited, not re-implemented:
//   • every tool call goes through ctx.invokeTool → tool whitelist + zod I/O +
//     trace. A call to an unregistered tool is rejected, recorded, and fed back
//     as an error so the model can correct — it never executes.
//   • the final output is validated against the proposal schema (zod) — never raw
//     text to a writer.
//   • hard iteration + token ceilings; on any breach the loop throws ToolLoopError
//     so the caller can fall back to the deterministic procedure.
// The decideAutoExecution gate sits AFTER the agent, unchanged — an LLM-authored
// proposal still cannot auto-execute without a production release + clean
// constraints + calibration.

export class ToolLoopError extends Error {
  constructor(message: string, public readonly meta?: Record<string, unknown>) {
    super(message)
    this.name = 'ToolLoopError'
  }
}

export interface ToolLoopArgs<O> {
  ctx: BlockContext
  systemPrompt: string
  taskPrompt: string
  /** Tools the model may call (a subset of the agent's allowed set). */
  toolSpecs: ReadonlyArray<LLMToolSpec>
  /** Schema the final proposal must satisfy. */
  finalSchema: z.ZodType<O>
  /** Max model turns before giving up (→ fallback). Default 8. */
  maxIterations?: number
  /** Token budget across the loop before giving up (→ fallback). Default 24k. */
  maxTokens?: number
}

export async function runToolLoop<O>(args: ToolLoopArgs<O>): Promise<O> {
  const maxIterations = args.maxIterations ?? 8
  const maxTokens = args.maxTokens ?? 24_000
  const messages: LLMMessage[] = [{ role: 'user', content: args.taskPrompt }]
  let tokens = 0

  for (let iter = 1; iter <= maxIterations; iter++) {
    const resp = await args.ctx.llm.call<O>({
      systemPrompt: args.systemPrompt,
      messages,
      tools: args.toolSpecs,
      outputSchema: args.finalSchema,
    })
    tokens += resp.tokensUsed
    if (tokens > maxTokens) {
      args.ctx.appendStep({ blockName: '', type: 'llm_output', output: { loopFailed: 'token budget exceeded', tokens } })
      throw new ToolLoopError('token budget exceeded', { tokens })
    }

    // No tool calls → the model is done. Validate the final proposal.
    if (resp.toolCalls.length === 0) {
      if (resp.output === undefined) {
        throw new ToolLoopError('model returned neither a tool call nor a final proposal')
      }
      const parsed = args.finalSchema.safeParse(resp.output)
      if (!parsed.success) {
        args.ctx.appendStep({ blockName: '', type: 'llm_output', output: { loopFailed: 'final output failed schema validation' } })
        throw new ToolLoopError('final output failed schema validation', { issues: parsed.error.issues })
      }
      return parsed.data
    }

    // Execute each requested tool call through the guarded invoke path.
    for (const call of resp.toolCalls) {
      let resultText: string
      try {
        const out = await args.ctx.invokeTool(call.toolName, call.input, { thought: call.thought })
        resultText = JSON.stringify(out)
      } catch (err) {
        // Containment: rejected call is recorded + fed back; the tool never ran.
        const msg = err instanceof Error ? err.message : String(err)
        args.ctx.appendStep({
          blockName: '', type: 'tool_response', toolName: call.toolName,
          thought: call.thought, output: { rejected: msg },
        })
        resultText = `ERROR: ${msg}`
      }
      messages.push({ role: 'assistant', content: `${call.thought ? `Thought: ${call.thought}\n` : ''}Call: ${call.toolName}` })
      messages.push({ role: 'user', content: `Result of ${call.toolName}: ${resultText}` })
    }
  }

  args.ctx.appendStep({ blockName: '', type: 'llm_output', output: { loopFailed: `max iterations (${maxIterations}) reached` } })
  throw new ToolLoopError(`max iterations (${maxIterations}) reached without a final proposal`)
}

/** Convenience helper for blocks that just need to call the LLM and validate output. */
export async function llmCallWithSchema<T>(
  llm: LLMClient,
  args: {
    systemPrompt: string
    userPrompt: string
    schema: z.ZodType<T>
    tools?: ReadonlyArray<LLMToolSpec>
  },
): Promise<{ output: T; tokensUsed: number }> {
  const resp = await llm.call<T>({
    systemPrompt: args.systemPrompt,
    messages: [{ role: 'user', content: args.userPrompt }],
    tools: args.tools,
    outputSchema: args.schema,
  })
  if (resp.output === undefined) {
    throw new Error('LLM returned no output (expected structured output)')
  }
  const parsed = args.schema.parse(resp.output)
  return { output: parsed, tokensUsed: resp.tokensUsed }
}
