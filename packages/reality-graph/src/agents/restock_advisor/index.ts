// restock_advisor — operator-facing agent for stockout concerns.
// Reads via Logic Tools, emits TRANSFER_STOCK and/or REQUEST_RESTOCK proposals.
// See CLAUDE.md → "Agents — N small blocks, never one big call".

import { z } from 'zod'
import type { AgentInput, AgentSpec } from '../index'
import type { LogicTool } from '../../tools/index'
import type { GraphReader } from '../../tools/graph_reader'
import { makeQueryOpenRestockRequestsTool } from '../../tools/data/query_open_restock_requests'
import { makeForecastConsumptionTool } from '../../tools/logic/forecast_consumption'
import { makeQuerySisterPropertyInventoryTool } from '../../tools/data/query_sister_property_inventory'
import { makeRankAlternativeSuppliersTool } from '../../tools/logic/rank_alternative_suppliers'
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
import { extractVariantBlock } from './blocks/extract_variant'
import { extractSupplierBlock } from './blocks/extract_supplier'
import { reasonAndProposeBlock } from './blocks/reason_and_propose'
import { RESTOCK_ADVISOR_TASK_PROMPT } from './prompt'

export { RESTOCK_ADVISOR_TASK_PROMPT }
export { extractVariantBlock as restockExtractVariantBlock }
export { extractSupplierBlock as restockExtractSupplierBlock }
export { reasonAndProposeBlock as restockReasonAndProposeBlock }

const AGENT_NAME = 'restock_advisor'
const AGENT_VERSION = '1.0.0'

export interface RestockAdvisorDeps {
  llm: LLMClient
  reader: GraphReader
  /** Adapter the forecast_consumption tool delegates to. When omitted, the
   *  tool falls back to its inline baseline. */
  forecastAdapter?: ModelAdapter<ConsumptionForecastInput, ConsumptionForecastOutput>
}

export function buildRestockAdvisorAgent(deps: RestockAdvisorDeps): AgentSpec {
  const tools: LogicTool[] = [
    makeQueryOpenRestockRequestsTool(deps.reader) as LogicTool,
    makeForecastConsumptionTool({ reader: deps.reader, adapter: deps.forecastAdapter }) as LogicTool,
    makeQuerySisterPropertyInventoryTool(deps.reader) as LogicTool,
    makeRankAlternativeSuppliersTool(deps.reader) as LogicTool,
    makeQueryVariantDocumentsTool(deps.reader) as LogicTool,
    makeQueryDocumentChunksTool(deps.reader) as LogicTool,
    requestClarificationTool as LogicTool,
  ]
  const registry = new Map(tools.map((t) => [t.name, t]))
  const toolset = tools.map((t) => t.name)

  return {
    name: AGENT_NAME,
    version: AGENT_VERSION,
    purpose: 'Resolves operator stockout concerns into typed TRANSFER_STOCK and/or REQUEST_RESTOCK proposals.',
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

      const supplier = await runner.runBlock(extractSupplierBlock, {
        prompt: input.prompt,
      })

      const variantRow = await deps.reader.getVariant(variant.variantId)
      if (!variantRow) {
        return {
          proposals: [],
          trace: runner.snapshotTrace(),
        }
      }

      const result = await runner.runBlock(reasonAndProposeBlock, {
        variantId: variant.variantId,
        variantName: variant.variantName,
        hotelId: input.scope.hotelId,
        requestorId: input.userId,
        currentStock: variantRow.current_stock,
        preferredSupplierName: supplier.supplierName,
        confidenceThreshold: 0.6,
      })

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
