// LLM-orchestrated twin of reason_and_rebalance: instead of a hardcoded
// procedure, the model works the numbered task prompt by calling the bounded
// tool set and emits the same typed { proposals, paused } output. Same
// input/output contract, so the agent can swap it for the deterministic block
// (its eval baseline + fallback). Safety is the runtime's (whitelisted tools,
// zod-validated final output, iteration/token caps, full trace) — see runToolLoop.

import { createBlock, runToolLoop } from '../../runtime'
import type { LLMToolSpec } from '../../llm'
import { principleProvenance, principleReasoningSuffix } from '../../principles'
import type { PrincipleRecord } from '../../../tools/graph_reader'
import { inputSchema, outputSchema, type ReasonAndRebalanceInput, type ReasonAndRebalanceOutput } from './reason_and_rebalance'
import { OVERSTOCK_REBALANCER_TASK_PROMPT } from '../prompt'

const SYSTEM_PROMPT =
  'You are the reasoning core of the overstock_rebalancer agent. Work the numbered procedure by CALLING the ' +
  'listed tools — one call at a time, reading each result before deciding the next. Use only the tools ' +
  'provided; never invent tools or data. Only propose TRANSFER_STOCK, and only when genuine surplus can fill a ' +
  'sister property below par without dropping the source below its own projected need. When finished, respond ' +
  'with ONLY the final JSON object { "proposals": [...], "paused": null } matching the schema. Every proposal ' +
  'must carry the TRANSFER_STOCK action, a confidence in [0,1], a reasoning string citing each tool result, and ' +
  'provenance entries. If forecast confidence is below the threshold, return { "proposals": [], "paused": ' +
  '{ question, contextSummary, currentConfidence } } instead of a low-confidence proposal.'

export function makeReasonAndRebalanceLlmBlock(toolSpecs: ReadonlyArray<LLMToolSpec>) {
  return createBlock<ReasonAndRebalanceInput, ReasonAndRebalanceOutput>({
    name: 'reason_and_rebalance_llm',
    inputSchema,
    outputSchema,
    systemPrompt: SYSTEM_PROMPT,
    run: async (input, ctx) => {
      const taskPrompt =
        `${OVERSTOCK_REBALANCER_TASK_PROMPT}\n\n[Context]\n` +
        `variantId=${input.variantId}\nvariantName=${input.variantName}\nhotelId=${input.hotelId}\n` +
        `userId=${input.userId}\ncurrentStock=${String(input.currentStock)}\n` +
        `horizonDays=${String(input.horizonDays)}\noverstockMultiple=${String(input.overstockMultiple)}\n` +
        `confidenceThreshold=${String(input.confidenceThreshold)}` +
        (input.principles.length > 0 ? `\nactivePrinciples=${JSON.stringify(input.principles)}` : '')

      const result = await runToolLoop<ReasonAndRebalanceOutput>({
        ctx,
        systemPrompt: SYSTEM_PROMPT,
        taskPrompt,
        toolSpecs,
        finalSchema: outputSchema,
        maxIterations: 8,
      })

      // Belt-and-suspenders: guarantee operator principles are honored in
      // provenance even if the model omitted them (the deterministic block does
      // the same), so the learning flywheel holds on either path.
      const principles = input.principles as PrincipleRecord[]
      if (principles.length > 0) {
        const provEntries = principleProvenance(principles)
        const suffix = principleReasoningSuffix(principles)
        for (const p of result.proposals) {
          if (!p.reasoning.includes('Honored operator principle')) p.reasoning += suffix
          const have = new Set(p.provenance.filter((x) => x.kind === 'principle').map((x) => x.ref))
          p.provenance = [...p.provenance, ...provEntries.filter((e) => !have.has(e.ref))]
        }
      }
      return result
    },
  })
}
