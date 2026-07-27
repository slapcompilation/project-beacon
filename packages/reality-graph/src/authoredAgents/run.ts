// Running an authored agent. The definition compiles to prompts (compileAgent);
// this hands those to the SAME runtime a shipped agent uses — buildRunner for
// the trace, runToolLoop for the bounded tool loop. No second execution path.
//
// The output is a typed proposal set, so an authored agent's output enters
// decideAutoExecution exactly like a shipped agent's. Nothing here writes.

import { z } from 'zod'
import { buildRunner, runToolLoop, type BlockContext } from '../agents/runtime'
import type { LLMClient } from '../agents/llm'
import type { AgentRunTrace } from '../agents/index'
import type { LogicTool } from '../tools/index'
import { compileAgent, type AuthoredAgentDef } from './index'

/** What an authored agent is allowed to emit. Deliberately narrow: a proposed
 *  action with the reasoning and confidence the review queue already renders,
 *  or an explicit ask when it isn't confident enough. */
export const authoredAgentOutputSchema = z.object({
  outcome: z.enum(['proposal', 'clarification', 'no-action']),
  /** Present when outcome === 'proposal'. */
  actionType: z.string().optional(),
  params: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  /** Present when outcome === 'clarification'. */
  question: z.string().optional(),
})

export type AuthoredAgentOutput = z.infer<typeof authoredAgentOutputSchema>

export interface RunAuthoredAgentArgs {
  def: Pick<AuthoredAgentDef, 'name' | 'apiName' | 'purpose' | 'scope' | 'toolset' | 'procedure' | 'clarificationThreshold'>
  llm: LLMClient
  /** Every tool the agent may call, already resolved — code tools and authored
   *  ones alike. The runtime rejects any name outside this map. */
  toolRegistry: Map<string, LogicTool>
  /** Context the operator is asking about, appended to the task prompt. */
  situation: string
  maxIterations?: number
  tokenWindow?: number
}

export interface AuthoredAgentRun {
  output: AuthoredAgentOutput
  trace: AgentRunTrace
}

/** Runs the agent and returns its output plus the trace. A run that fails to
 *  produce valid output resolves to a no-action with the reason — an authored
 *  agent misbehaving must not throw into the caller's cycle. */
export async function runAuthoredAgent(args: RunAuthoredAgentArgs): Promise<AuthoredAgentRun> {
  const compiled = compileAgent(args.def)
  const runner = buildRunner({
    agentName: args.def.apiName,
    agentVersion: 'authored',
    llm: args.llm,
    toolRegistry: args.toolRegistry,
    allowedTools: compiled.toolset,
    tokenWindow: args.tokenWindow,
  })

  const block = {
    name: 'reason_and_propose',
    inputSchema: z.object({ situation: z.string() }),
    outputSchema: authoredAgentOutputSchema,
    systemPrompt: compiled.systemPrompt,
    run: async (input: { situation: string }, ctx: BlockContext): Promise<AuthoredAgentOutput> =>
      runToolLoop<AuthoredAgentOutput>({
        ctx,
        systemPrompt: compiled.systemPrompt,
        taskPrompt: `${compiled.taskPrompt}\n\nThe situation you are asked about:\n${input.situation}`,
        toolSpecs: toSpecs(compiled.toolset, args.toolRegistry),
        finalSchema: authoredAgentOutputSchema,
        maxIterations: args.maxIterations,
        maxTokens: args.tokenWindow,
      }),
  }

  try {
    const output = await runner.runBlock(block, { situation: args.situation })
    return { output, trace: runner.snapshotTrace() }
  } catch (err) {
    return {
      output: {
        outcome: 'no-action',
        confidence: 0,
        reasoning: `Run did not produce a valid proposal: ${err instanceof Error ? err.message : String(err)}`,
      },
      trace: runner.snapshotTrace(),
    }
  }
}

/** The agent's whitelist as the loop's tool specs. A name with no registered
 *  tool is dropped rather than offered — the model can't call what isn't real. */
function toSpecs(toolset: ReadonlyArray<string>, registry: Map<string, LogicTool>) {
  return toolset.flatMap((name) => {
    const tool = registry.get(name)
    if (!tool) return []
    return [{ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }]
  })
}
