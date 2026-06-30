import { z } from 'zod'
import { createBlock } from '../../runtime'
import { principleProvenance, principleReasoningSuffix } from '../../principles'
import type { PrincipleRecord } from '../../../tools/graph_reader'
import type { ForecastConsumptionOutput } from '../../../tools/logic/forecast_consumption'
import type { QuerySisterPropertyInventoryOutput } from '../../../tools/data/query_sister_property_inventory'

const principleSchema = z.object({
  id:               z.string(),
  body:             z.string(),
  category:         z.string(),
  appliesToNodeIds: z.array(z.string()).optional(),
})

export const inputSchema = z.object({
  variantId:           z.string().uuid(),
  variantName:         z.string().min(1),
  hotelId:             z.string().uuid(),
  userId:              z.string().uuid(),
  currentStock:        z.number().nonnegative(),
  horizonDays:         z.number().int().min(1).max(90).default(30),
  /** currentStock must be >= projectedUnits * this before any of it is surplus. */
  overstockMultiple:   z.number().min(1).default(2),
  confidenceThreshold: z.number().min(0).max(1).default(0.6),
  principles:          z.array(principleSchema).default([]),
})

const proposalSchema = z.object({
  action: z.object({
    type:        z.literal('TRANSFER_STOCK'),
    fromHotelId: z.string().uuid(),
    toHotelId:   z.string().uuid(),
    variantId:   z.string().uuid(),
    quantity:    z.number().int().positive(),
    reason:      z.string(),
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(1),
  provenance: z.array(
    z.object({
      kind:   z.enum(['tool', 'document', 'principle']),
      ref:    z.string().min(1),
      detail: z.string().optional(),
    }),
  ),
})

export const outputSchema = z.object({
  proposals: z.array(proposalSchema),
  paused: z.object({
    question: z.string(),
    contextSummary: z.string(),
    currentConfidence: z.number(),
  }).nullable(),
})

export type ReasonAndRebalanceInput = z.infer<typeof inputSchema>
export type ReasonAndRebalanceOutput = z.infer<typeof outputSchema>

export const reasonAndRebalanceBlock = createBlock<ReasonAndRebalanceInput, ReasonAndRebalanceOutput>({
  name: 'reason_and_rebalance',
  inputSchema,
  outputSchema,
  systemPrompt:
    'You are the main reasoning step of the overstock_rebalancer agent. Follow the numbered procedure exactly. ' +
    'Only propose TRANSFER_STOCK, and only when genuine surplus can fill a sister property below par without ' +
    'dropping the source below its own projected need. If confidence is below threshold, call request_clarification.',
  run: async (input, ctx) => {
    // 1. Size the surplus via forecast.
    const forecast = await ctx.invokeTool<{ variantId: string; horizonDays: number }, ForecastConsumptionOutput>(
      'forecast_consumption',
      { variantId: input.variantId, horizonDays: input.horizonDays },
    )

    // Overstock gate: require >= overstockMultiple x the horizon's projected burn.
    const coverThreshold = forecast.projectedUnits * input.overstockMultiple
    const surplusUnits = input.currentStock >= coverThreshold
      ? Math.max(0, input.currentStock - forecast.projectedUnits)
      : 0

    if (surplusUnits === 0) {
      return { proposals: [], paused: null }
    }

    // 2. Clarify on shaky forecast confidence — a regretted transfer is a real cost.
    if (forecast.confidence < input.confidenceThreshold) {
      await ctx.invokeTool<
        { question: string; contextSummary: string; currentConfidence: number },
        { paused: true; question: string; contextSummary: string; currentConfidence: number }
      >('request_clarification', {
        question: `Forecast confidence is ${String(forecast.confidence)} — should I redistribute ${String(surplusUnits)} surplus units, or hold pending more data?`,
        contextSummary: `${input.variantName}: ${String(input.currentStock)} on hand, ${String(forecast.projectedUnits)} projected over ${String(input.horizonDays)}d (basis ${forecast.basis}, sample ${String(forecast.sampleSize)}).`,
        currentConfidence: forecast.confidence,
      })
      return {
        proposals: [],
        paused: {
          question: `Forecast confidence is ${String(forecast.confidence)} — should I redistribute ${String(surplusUnits)} surplus units, or hold pending more data?`,
          contextSummary: `${input.variantName}: ${String(input.currentStock)} on hand, ${String(forecast.projectedUnits)} projected over ${String(input.horizonDays)}d.`,
          currentConfidence: forecast.confidence,
        },
      }
    }

    // 3. Find a sister below par that needs this variant.
    const sisters = await ctx.invokeTool<
      { variantId: string; variantName: string; hotelId: string },
      QuerySisterPropertyInventoryOutput
    >('query_sister_property_inventory', {
      variantId: input.variantId,
      variantName: input.variantName,
      hotelId: input.hotelId,
    })

    const needy = sisters.sisters
      .map((s) => ({ ...s, gap: (s.parLevel ?? 0) - s.currentStock }))
      .filter((s) => s.parLevel != null && s.currentStock < s.parLevel * 0.5 && s.gap > 0)
      .sort((a, b) => b.gap - a.gap)

    const target = needy[0]
    if (!target) {
      // 6. Nowhere productive to move it — don't invent a destination.
      return { proposals: [], paused: null }
    }

    // 4. Size the transfer: fill the sister's gap from surplus, but never drop
    //    the source below its own projected need.
    const sourceFloor = Math.max(0, input.currentStock - forecast.projectedUnits)
    const transferQty = Math.min(target.gap, surplusUnits, sourceFloor)
    if (transferQty <= 0) {
      return { proposals: [], paused: null }
    }

    const proposals: ReasonAndRebalanceOutput['proposals'] = [{
      action: {
        type:        'TRANSFER_STOCK' as const,
        fromHotelId: input.hotelId,
        toHotelId:   target.hotelId,
        variantId:   input.variantId,
        quantity:    transferQty,
        reason: `Rebalance ${String(transferQty)} surplus units to ${target.hotelName} (${String(target.currentStock)}/${String(target.parLevel ?? 0)} par, gap ${String(target.gap)}). Source retains ${String(input.currentStock - transferQty)} vs ${String(forecast.projectedUnits)} projected ${String(input.horizonDays)}d need.`,
      },
      confidence: Math.min(forecast.confidence, 0.85),
      reasoning:
        `forecast_consumption: projected ${String(forecast.projectedUnits)}u over ${String(input.horizonDays)}d (basis ${forecast.basis}, conf ${String(forecast.confidence)}). ` +
        `Current ${String(input.currentStock)} ≥ ${String(input.overstockMultiple)}× cover → surplus ${String(surplusUnits)}. ` +
        `query_sister_property_inventory: ${target.hotelName} at ${String(target.currentStock)}/${String(target.parLevel ?? 0)} par (gap ${String(target.gap)}) → transfer ${String(transferQty)}.`,
      provenance: [
        { kind: 'tool', ref: 'forecast_consumption', detail: `${String(forecast.projectedUnits)}u, basis=${forecast.basis}` },
        { kind: 'tool', ref: 'query_sister_property_inventory', detail: `${String(sisters.sisters.length)} sisters scanned, ${String(needy.length)} needy` },
      ],
    }]

    // Apply operator Principles as soft constraints (learning flywheel).
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
