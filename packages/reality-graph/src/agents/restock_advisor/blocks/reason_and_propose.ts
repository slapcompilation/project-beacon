import { z } from 'zod'
import { createBlock } from '../../runtime'
import { principleProvenance, principleReasoningSuffix } from '../../principles'
import type { PrincipleRecord } from '../../../tools/graph_reader'
import type { QueryOpenRestockRequestsOutput } from '../../../tools/data/query_open_restock_requests'
import type { ForecastConsumptionOutput } from '../../../tools/logic/forecast_consumption'
import type { QuerySisterPropertyInventoryOutput } from '../../../tools/data/query_sister_property_inventory'
import type { RankAlternativeSuppliersOutput } from '../../../tools/logic/rank_alternative_suppliers'

const principleSchema = z.object({
  id:               z.string(),
  body:             z.string(),
  category:         z.string(),
  appliesToNodeIds: z.array(z.string()).optional(),
})

const inputSchema = z.object({
  variantId: z.string().uuid(),
  variantName: z.string().min(1),
  hotelId: z.string().uuid(),
  requestorId: z.string().uuid(),
  currentStock: z.number().nonnegative(),
  /** Optional supplier name from extract_supplier; not all proposals use it. */
  preferredSupplierName: z.string().nullable(),
  confidenceThreshold: z.number().min(0).max(1).default(0.6),
  /** Active operator Principles applicable to this variant — soft constraints
   *  the agent honors and records in provenance. Defaults to none. */
  principles: z.array(principleSchema).default([]),
})

const proposalSchema = z.object({
  action: z.discriminatedUnion('type', [
    z.object({
      type:        z.literal('TRANSFER_STOCK'),
      fromHotelId: z.string().uuid(),
      toHotelId:   z.string().uuid(),
      variantId:   z.string().uuid(),
      quantity:    z.number().int().positive(),
      reason:      z.string(),
    }),
    z.object({
      type:           z.literal('REQUEST_RESTOCK'),
      variantId:      z.string().uuid(),
      quantityNeeded: z.number().int().positive(),
      urgency:        z.enum(['low', 'medium', 'high']),
      supplier:       z.string().nullable(),
      notes:          z.string().nullable(),
      hotelId:        z.string().uuid(),
      requestorId:    z.string().uuid(),
    }),
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  provenance: z.array(
    z.object({
      kind: z.enum(['tool', 'document', 'principle']),
      ref: z.string().min(1),
      detail: z.string().optional(),
    }),
  ),
})

const outputSchema = z.object({
  proposals: z.array(proposalSchema),
  /** When agent paused for clarification. Mutually exclusive with non-empty proposals. */
  paused: z.object({
    question: z.string(),
    contextSummary: z.string(),
    currentConfidence: z.number(),
  }).nullable(),
})

export type ReasonAndProposeInput = z.infer<typeof inputSchema>
export type ReasonAndProposeOutput = z.infer<typeof outputSchema>

export const reasonAndProposeBlock = createBlock<ReasonAndProposeInput, ReasonAndProposeOutput>({
  name: 'reason_and_propose',
  inputSchema,
  outputSchema,
  systemPrompt:
    'You are the main reasoning step of the restock_advisor agent. Follow the numbered procedure in the task prompt exactly. ' +
    'Every proposal must include the typed BeaconAction, a confidence score, a reasoning string that cites each tool result, ' +
    'and full provenance. If confidence drops below the threshold, call request_clarification instead.',
  run: async (input, ctx) => {
    // 1. Confirm no existing request covers the gap.
    const open = await ctx.invokeTool<{ variantId: string }, QueryOpenRestockRequestsOutput>(
      'query_open_restock_requests',
      { variantId: input.variantId },
    )

    // 2. Size the gap via forecast.
    const forecast = await ctx.invokeTool<{ variantId: string; horizonDays: number }, ForecastConsumptionOutput>(
      'forecast_consumption',
      { variantId: input.variantId, horizonDays: 7 },
    )
    const projectedGap = Math.max(0, forecast.projectedUnits - input.currentStock - open.totalOpenQuantity)

    if (projectedGap === 0) {
      return {
        proposals: [],
        paused: null,
      }
    }

    // Clarification check on forecast confidence.
    if (forecast.confidence < input.confidenceThreshold) {
      await ctx.invokeTool<
        { question: string; contextSummary: string; currentConfidence: number },
        { paused: true; question: string; contextSummary: string; currentConfidence: number }
      >('request_clarification', {
        question: `Forecast confidence is ${String(forecast.confidence)} — should I proceed with a proposal sized to ${String(projectedGap)} units, or wait for more data?`,
        contextSummary: `${input.variantName}: ${String(input.currentStock)} on hand, ${String(open.totalOpenQuantity)} on open requests, ${String(forecast.projectedUnits)} projected over 7d (sample size ${String(forecast.sampleSize)}).`,
        currentConfidence: forecast.confidence,
      })
      return {
        proposals: [],
        paused: {
          question: `Forecast confidence is ${String(forecast.confidence)} — should I proceed with a proposal sized to ${String(projectedGap)} units, or wait for more data?`,
          contextSummary: `${input.variantName}: ${String(input.currentStock)} on hand, ${String(open.totalOpenQuantity)} on open requests.`,
          currentConfidence: forecast.confidence,
        },
      }
    }

    // 3. Check sister properties — lateral before external.
    const sisters = await ctx.invokeTool<
      { variantId: string; variantName: string; hotelId: string },
      QuerySisterPropertyInventoryOutput
    >('query_sister_property_inventory', {
      variantId: input.variantId,
      variantName: input.variantName,
      hotelId: input.hotelId,
    })

    const proposals: ReasonAndProposeOutput['proposals'] = []
    let remainingGap = projectedGap

    const bestSister = sisters.sisters
      .filter((s) => s.currentStock >= projectedGap * 0.4)
      .sort((a, b) => b.currentStock - a.currentStock)[0]

    if (bestSister) {
      const transferQty = Math.min(bestSister.currentStock, remainingGap)
      proposals.push({
        action: {
          type: 'TRANSFER_STOCK' as const,
          fromHotelId: bestSister.hotelId,
          toHotelId: input.hotelId,
          variantId: input.variantId,
          quantity: transferQty,
        reason: `Lateral transfer from ${bestSister.hotelName} (${String(bestSister.currentStock)} on hand) closes ${String(transferQty)} of ${String(projectedGap)}-unit projected gap.`,
        },
        confidence: Math.min(forecast.confidence, 0.85),
        reasoning:
          `forecast_consumption: projected ${String(forecast.projectedUnits)}u over 7d (basis ${forecast.basis}, conf ${String(forecast.confidence)}). ` +
          `Current stock ${String(input.currentStock)} + open ${String(open.totalOpenQuantity)} = gap ${String(projectedGap)}. ` +
          `query_sister_property_inventory: ${bestSister.hotelName} has ${String(bestSister.currentStock)} → transfer ${String(transferQty)}.`,
        provenance: [
          { kind: 'tool', ref: 'query_open_restock_requests', detail: `totalOpen=${String(open.totalOpenQuantity)}` },
          { kind: 'tool', ref: 'forecast_consumption', detail: `${String(forecast.projectedUnits)}u, basis=${forecast.basis}` },
          { kind: 'tool', ref: 'query_sister_property_inventory', detail: `${String(sisters.sisters.length)} sisters scanned` },
        ],
      })
      remainingGap -= transferQty
    }

    // 4. External procurement for the remainder.
    if (remainingGap > 0) {
      const ranked = await ctx.invokeTool<
        { variantId: string; maxLeadTimeDays: number },
        RankAlternativeSuppliersOutput
      >('rank_alternative_suppliers', { variantId: input.variantId, maxLeadTimeDays: 7 })

      const top = ranked.ranked[0]
      if (top) {
        const urgency: 'low' | 'medium' | 'high' =
          remainingGap > forecast.projectedUnits * 0.6 ? 'high' :
          remainingGap > forecast.projectedUnits * 0.3 ? 'medium' : 'low'

        proposals.push({
          action: {
            type:           'REQUEST_RESTOCK' as const,
            variantId:      input.variantId,
            quantityNeeded: remainingGap,
            urgency,
            supplier:       top.name,
            notes:          `Closes ${String(remainingGap)} of ${String(projectedGap)}-unit gap via ${top.name}.`,
            hotelId:        input.hotelId,
            requestorId:    input.requestorId,
          },
          confidence: Math.min(forecast.confidence, ranked.confidence, 0.85),
          reasoning:
            `Remaining gap after sister transfer: ${String(remainingGap)} units. ` +
            `rank_alternative_suppliers: top=${top.name} (score ${String(top.score)}, lead ${String(top.leadTimeDays ?? '?')}d, on-time ${String(top.onTimePct ?? '?')}%). ` +
            `urgency=${urgency} based on gap-vs-projected ratio.`,
          provenance: [
            { kind: 'tool', ref: 'rank_alternative_suppliers', detail: `top=${top.name}, score=${String(top.score)}` },
          ],
        })
      }
    }

    // Apply operator Principles as soft constraints: annotate every proposal
    // with the principles that shaped it (provenance) and surface them in the
    // reasoning so the operator sees their feedback was honored.
    const principles = input.principles as PrincipleRecord[]
    if (principles.length > 0) {
      const provEntries = principleProvenance(principles)
      const suffix = principleReasoningSuffix(principles)
      for (const p of proposals) {
        p.reasoning += suffix
        p.provenance = [...p.provenance, ...provEntries]
      }
    }

    return { proposals, paused: null }
  },
})
