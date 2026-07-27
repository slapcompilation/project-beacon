// Running authored agents as part of a cycle.
//
// Cost discipline is the whole design here. Each authored agent is ONE model
// call per cycle — not one per scanned variant — and the number of agents run is
// capped. An agent reasons about the at-risk set it is given and names the
// variant its proposal concerns; the cycle then puts that proposal through the
// same gate as everything else.

import {
  buildAuthoredAgentTools, runAuthoredAgent,
  type AgentProposal, type CycleVariant, type GraphReader,
} from '@beacon/reality-graph'
import { AnthropicLLMClient } from '@/features/agents/anthropicLLM'
import { fetchAuthoredLogicTools } from '@/features/userTools/authoredToolReader'
import { fetchUserAgents, rowToAgentDef } from './api'

/** Hard ceiling on authored agents per cycle. Without it, authoring a dozen
 *  agents would quietly multiply every cycle's model spend. */
const MAX_AGENTS_PER_CYCLE = 3

export async function runAuthoredAgents(args: {
  variants: ReadonlyArray<CycleVariant>
  hotelId: string
  reader: GraphReader
}): Promise<ReadonlyArray<{ variant: CycleVariant; proposal: AgentProposal }>> {
  if (args.variants.length === 0) return []

  const rows = (await fetchUserAgents().catch(() => []))
    .filter((r) => r.enabled && (r.hotel_id === args.hotelId || r.hotel_id === null))
    .slice(0, MAX_AGENTS_PER_CYCLE)
  if (rows.length === 0) return []

  // The org's own tools are in the registry too — an authored agent that can
  // only call shipped tools can't ask about anything the org authored.
  const toolRegistry = buildAuthoredAgentTools(args.reader, await fetchAuthoredLogicTools())
  const llm = new AnthropicLLMClient()
  // The at-risk set the agent is reasoning about, named so it can point at one.
  const situation =
    `At-risk items in this scope: ${args.variants.map((v) => `${v.name} (id ${v.id})`).join(', ')}. ` +
    `Name the variant id your proposal concerns.`

  const out: { variant: CycleVariant; proposal: AgentProposal }[] = []
  for (const row of rows) {
    const def = rowToAgentDef(row)
    try {
      const run = await runAuthoredAgent({ def, llm, toolRegistry, situation })
      if (run.output.outcome !== 'proposal' || !run.output.actionType) continue

      const variant = pickVariant(args.variants, run.output.params)
      if (!variant) continue   // a proposal we can't attach to a scanned variant is dropped

      out.push({
        variant,
        proposal: {
          action: { type: run.output.actionType, ...(run.output.params ?? {}) } as AgentProposal['action'],
          confidence: run.output.confidence,
          reasoning: run.output.reasoning,
          provenance: [{ kind: 'tool', ref: `authored-agent:${def.apiName}` }],
        } as AgentProposal,
      })
    } catch {
      // One misbehaving authored agent must not fail the operator's cycle.
    }
  }
  return out
}

/** Match the agent's stated variantId against the scanned set. Anything it
 *  names outside that set is not something this cycle may act on. */
function pickVariant(
  variants: ReadonlyArray<CycleVariant>,
  params: Record<string, unknown> | undefined,
): CycleVariant | undefined {
  const id = typeof params?.variantId === 'string' ? params.variantId : undefined
  return id ? variants.find((v) => v.id === id) : undefined
}
