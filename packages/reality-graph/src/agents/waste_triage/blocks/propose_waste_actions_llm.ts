// LLM-orchestrated twin of propose_waste_actions: instead of a hardcoded
// procedure, the model works the numbered task prompt by calling the bounded
// tool set and emits the same typed { proposals, paused } output. Same
// input/output contract, so the agent can swap it for the deterministic block
// (its eval baseline + fallback). Safety is the runtime's (whitelisted tools,
// zod-validated final output, iteration/token caps, full trace) — see runToolLoop.

import { createBlock, runToolLoop } from '../../runtime'
import type { LLMToolSpec } from '../../llm'
import { principleProvenance, principleReasoningSuffix } from '../../principles'
import type { PrincipleRecord } from '../../../tools/graph_reader'
import { inputSchema, outputSchema, type ProposeWasteActionsInput, type ProposeWasteActionsOutput } from './propose_waste_actions'
import { WASTE_TRIAGE_TASK_PROMPT } from '../prompt'

const SYSTEM_PROMPT =
  'You are the reasoning core of the waste_triage agent. Work the numbered procedure by CALLING the listed ' +
  'tools — one call at a time, reading each result before deciding the next. Use only the tools provided; never ' +
  'invent tools or data. Redirect at-risk stock to a needy sister (TRANSFER_STOCK) before writing anything off; ' +
  'whatever cannot be redirected becomes a WRITE_OFF. A write-off is irreversible — never size one on a shaky ' +
  'forecast. When finished, respond with ONLY the final JSON object { "proposals": [...], "paused": null } ' +
  'matching the schema. Every proposal must carry the typed action, a confidence in [0,1], a reasoning string ' +
  'citing each tool result, and provenance entries. If forecast confidence is below the threshold, return ' +
  '{ "proposals": [], "paused": { question, contextSummary, currentConfidence } } instead.'

export function makeProposeWasteActionsLlmBlock(toolSpecs: ReadonlyArray<LLMToolSpec>) {
  return createBlock<ProposeWasteActionsInput, ProposeWasteActionsOutput>({
    name: 'propose_waste_actions_llm',
    inputSchema,
    outputSchema,
    systemPrompt: SYSTEM_PROMPT,
    run: async (input, ctx) => {
      const taskPrompt =
        `${WASTE_TRIAGE_TASK_PROMPT}\n\n[Context]\n` +
        `variantId=${input.variantId}\nvariantName=${input.variantName}\nhotelId=${input.hotelId}\n` +
        `userId=${input.userId}\ncurrentStock=${String(input.currentStock)}\n` +
        `safeWindowDays=${String(input.safeWindowDays)}\nconfidenceThreshold=${String(input.confidenceThreshold)}` +
        (input.principles.length > 0 ? `\nactivePrinciples=${JSON.stringify(input.principles)}` : '')

      const result = await runToolLoop<ProposeWasteActionsOutput>({
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
