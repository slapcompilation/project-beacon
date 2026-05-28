// waste_triage — operator-facing agent for spoilage / waste concerns.
// Reads via Logic Tools, emits TRANSFER_STOCK (redirect to a needy sister)
// and/or WRITE_OFF proposals for at-risk units.

import { z } from 'zod'
import type { AgentInput, AgentSpec } from '../index'
import type { LogicTool } from '../../tools/index'
import type { GraphReader } from '../../tools/graph_reader'
import { makeForecastConsumptionTool } from '../../tools/logic/forecast_consumption'
import { makeQuerySisterPropertyInventoryTool } from '../../tools/data/query_sister_property_inventory'
import { makeQueryRecentWasteLogsTool } from '../../tools/data/query_recent_waste_logs'
import { makeQueryVariantDocumentsTool } from '../../tools/data/query_variant_documents'
import { makeQueryDocumentChunksTool } from '../../tools/data/query_document_chunks'
import { requestClarificationTool } from '../../tools/predefined/request_clarification'
import type { LLMClient } from '../llm'
import type { ModelAdapter } from '../../objectives/index'
import type {
  ConsumptionForecastInput,
  ConsumptionForecastOutput,
} from '../../objectives/consumption_forecast/types'
import { buildRunner } from '../runtime'
import { selectApplicablePrinciples } from '../principles'
import { extractVariantBlock } from './blocks/extract_variant'
import { proposeWasteActionsBlock } from './blocks/propose_waste_actions'
import { WASTE_TRIAGE_TASK_PROMPT } from './prompt'

export { WASTE_TRIAGE_TASK_PROMPT }
export { extractVariantBlock as wasteExtractVariantBlock }
export { proposeWasteActionsBlock as wasteProposeActionsBlock }

const AGENT_NAME    = 'waste_triage'
const AGENT_VERSION = '1.0.0'

export interface WasteTriageDeps {
  llm: LLMClient
  reader: GraphReader
  /** Adapter the forecast_consumption tool delegates to. When omitted, the
   *  tool falls back to its inline baseline. */
  forecastAdapter?: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput>
}

export function buildWasteTriageAgent(deps: WasteTriageDeps): AgentSpec {
  const tools: LogicTool[] = [
    makeQueryRecentWasteLogsTool(deps.reader)         as LogicTool,
    makeForecastConsumptionTool({ reader: deps.reader, adapter: deps.forecastAdapter }) as LogicTool,
    makeQuerySisterPropertyInventoryTool(deps.reader) as LogicTool,
    makeQueryVariantDocumentsTool(deps.reader)        as LogicTool,
    makeQueryDocumentChunksTool(deps.reader)          as LogicTool,
    requestClarificationTool                          as LogicTool,
  ]
  const registry = new Map(tools.map((t) => [t.name, t]))
  const toolset  = tools.map((t) => t.name)

  return {
    name: AGENT_NAME,
    version: AGENT_VERSION,
    purpose:
      'Resolves operator waste / spoilage concerns into typed TRANSFER_STOCK (redirect to a needy sister) ' +
      'and/or WRITE_OFF proposals for at-risk units.',
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
          hotelId:        z.string().uuid(),
          organizationId: z.string().uuid().optional(),
        }),
        context: z.record(z.string(), z.unknown()).optional(),
      })
      const input = inputSchema.parse(rawInput)

      const runner = buildRunner({
        agentName:     AGENT_NAME,
        agentVersion:  AGENT_VERSION,
        llm:           deps.llm,
        toolRegistry:  registry,
        allowedTools:  toolset,
      })

      const variant = await runner.runBlock(extractVariantBlock, {
        prompt:  input.prompt,
        hotelId: input.scope.hotelId,
      })

      const variantRow = await deps.reader.getVariant(variant.variantId)
      if (!variantRow) {
        return {
          proposals: [],
          trace: runner.snapshotTrace(),
        }
      }

      const allPrinciples = await deps.reader.getActivePrinciples(
        input.scope.hotelId,
        input.scope.organizationId,
      )
      const principles = selectApplicablePrinciples(allPrinciples, variant.variantId)

      const result = await runner.runBlock(proposeWasteActionsBlock, {
        variantId:           variant.variantId,
        variantName:         variant.variantName,
        hotelId:             input.scope.hotelId,
        userId:              input.userId,
        currentStock:        variantRow.current_stock,
        safeWindowDays:      7,
        confidenceThreshold: 0.6,
        principles,
      })

      return {
        proposals: result.proposals.map((p) => ({
          action:     p.action,
          confidence: p.confidence,
          reasoning:  p.reasoning,
          provenance: p.provenance,
        })),
        paused: result.paused ?? undefined,
        trace:  runner.snapshotTrace(),
      }
    },
  }
}
