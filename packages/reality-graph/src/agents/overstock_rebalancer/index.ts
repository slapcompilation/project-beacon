// overstock_rebalancer — operator-facing agent for excess-stock concerns.
// The third inventory decision: restock_advisor fixes shortages, waste_triage
// handles spoilage, this frees capital tied up in healthy excess stock by
// moving it to a sister property below par. Emits TRANSFER_STOCK only.
// See CLAUDE.md → "Agents — N small blocks, never one big call".

import { z } from 'zod'
import type { AgentInput, AgentSpec } from '../index'
import type { LogicTool } from '../../tools/index'
import type { GraphReader } from '../../tools/graph_reader'
import { makeForecastConsumptionTool } from '../../tools/logic/forecast_consumption'
import { makeQuerySisterPropertyInventoryTool } from '../../tools/data/query_sister_property_inventory'
import { makeQueryVariantDocumentsTool } from '../../tools/data/query_variant_documents'
import { requestClarificationTool } from '../../tools/predefined/request_clarification'
import type { LLMClient, LLMToolSpec } from '../llm'
import type { ModelAdapter } from '../../objectives/index'
import type {
  ConsumptionForecastInput,
  ConsumptionForecastOutput,
} from '../../objectives/consumption_forecast/types'
import { buildRunner } from '../runtime'
import { selectApplicablePrinciples } from '../principles'
import { extractVariantBlock } from './blocks/extract_variant'
import { reasonAndRebalanceBlock, type ReasonAndRebalanceOutput } from './blocks/reason_and_rebalance'
import { makeReasonAndRebalanceLlmBlock } from './blocks/reason_and_rebalance_llm'
import { OVERSTOCK_REBALANCER_TASK_PROMPT } from './prompt'

export { OVERSTOCK_REBALANCER_TASK_PROMPT }
export { extractVariantBlock as overstockExtractVariantBlock }
export { reasonAndRebalanceBlock as overstockReasonAndRebalanceBlock }

const AGENT_NAME = 'overstock_rebalancer'
const AGENT_VERSION = '1.0.0'

export interface OverstockRebalancerDeps {
  llm: LLMClient
  reader: GraphReader
  /** Adapter the forecast_consumption tool delegates to. Omit for baseline. */
  forecastAdapter?: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput>
  /** Reasoning mode. 'deterministic' (default) runs the hardcoded procedure —
   *  zero LLM spend, the eval baseline + cron path. 'llm' lets the model
   *  orchestrate the tool loop, falling back to deterministic on any failure. */
  reasoning?: 'llm' | 'deterministic'
}

export function buildOverstockRebalancerAgent(deps: OverstockRebalancerDeps): AgentSpec {
  const tools: LogicTool[] = [
    makeForecastConsumptionTool({ reader: deps.reader, adapter: deps.forecastAdapter }) as LogicTool,
    makeQuerySisterPropertyInventoryTool(deps.reader) as LogicTool,
    makeQueryVariantDocumentsTool(deps.reader) as LogicTool,
    requestClarificationTool as LogicTool,
  ]
  const registry = new Map(tools.map((t) => [t.name, t]))
  const toolset = tools.map((t) => t.name)
  // Tool specs the LLM sees when it orchestrates the loop (reasoning: 'llm').
  const toolSpecs: LLMToolSpec[] = tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }))
  const reasonLlmBlock = makeReasonAndRebalanceLlmBlock(toolSpecs)

  return {
    name: AGENT_NAME,
    version: AGENT_VERSION,
    purpose: 'Frees working capital tied up in excess stock by proposing TRANSFER_STOCK to a sister property below par.',
    scope: 'hotel',
    cadence: 'on-event',
    toolset,
    approvalBoundary: 'operator',
    releaseStage: 'sandbox',

    run: async (rawInput: AgentInput) => {
      const inputSchema = z.object({
        prompt: z.string().min(1),
        userId: z.string().uuid(),
        scope: z.object({
          hotelId: z.string().uuid(),
          organizationId: z.string().uuid().optional(),
        }),
        context: z.record(z.string(), z.unknown()).optional(),
      })
      const input = inputSchema.parse(rawInput)

      const runner = buildRunner({
        agentName: AGENT_NAME,
        agentVersion: AGENT_VERSION,
        llm: deps.llm,
        toolRegistry: registry,
        allowedTools: toolset,
      })

      const variant = await runner.runBlock(extractVariantBlock, {
        prompt: input.prompt,
        hotelId: input.scope.hotelId,
      })

      const variantRow = await deps.reader.getVariant(variant.variantId)
      if (!variantRow) {
        return { proposals: [], trace: runner.snapshotTrace() }
      }

      const allPrinciples = await deps.reader.getActivePrinciples(
        input.scope.hotelId,
        input.scope.organizationId,
      )
      const principles = selectApplicablePrinciples(allPrinciples, variant.variantId)

      const reasoningInput = {
        variantId: variant.variantId,
        variantName: variant.variantName,
        hotelId: input.scope.hotelId,
        userId: input.userId,
        currentStock: variantRow.current_stock,
        horizonDays: 30,
        overstockMultiple: 2,
        confidenceThreshold: 0.6,
        principles,
      }

      // 'llm' mode: the model orchestrates the tool loop; on any failure (LLM
      // error, blown budget/iterations, invalid output) fall back to the
      // deterministic procedure so the agent always returns a typed result.
      let result: ReasonAndRebalanceOutput
      if (deps.reasoning === 'llm') {
        try {
          result = await runner.runBlock(reasonLlmBlock, reasoningInput)
        } catch {
          result = await runner.runBlock(reasonAndRebalanceBlock, reasoningInput)
        }
      } else {
        result = await runner.runBlock(reasonAndRebalanceBlock, reasoningInput)
      }

      return {
        proposals: result.proposals.map((p) => ({
          action: p.action,
          confidence: p.confidence,
          reasoning: p.reasoning,
          provenance: p.provenance,
        })),
        paused: result.paused ?? undefined,
        trace: runner.snapshotTrace(),
      }
    },
  }
}
