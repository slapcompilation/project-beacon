import { z } from 'zod'
import { createBlock } from '../../runtime'
import { principleProvenance, principleReasoningSuffix } from '../../principles'
import type { PrincipleRecord } from '../../../tools/graph_reader'
import type { ForecastConsumptionOutput } from '../../../tools/logic/forecast_consumption'
import type { QueryRecentWasteLogsOutput } from '../../../tools/data/query_recent_waste_logs'
import type { QuerySisterPropertyInventoryOutput } from '../../../tools/data/query_sister_property_inventory'

const principleSchema = z.object({
  id:               z.string(),
  body:             z.string(),
  category:         z.string(),
  appliesToNodeIds: z.array(z.string()).optional(),
})

const inputSchema = z.object({
  variantId:           z.string().uuid(),
  variantName:         z.string().min(1),
  hotelId:             z.string().uuid(),
  userId:              z.string().uuid(),
  currentStock:        z.number().nonnegative(),
  safeWindowDays:      z.number().int().min(1).max(60).default(7),
  confidenceThreshold: z.number().min(0).max(1).default(0.6),
  /** Active operator Principles applicable to this variant. */
  principles:          z.array(principleSchema).default([]),
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
      type:        z.literal('WRITE_OFF'),
      variantId:   z.string().uuid(),
      quantity:    z.number().int().positive(),
      wasteReason: z.string().min(1),
      hotelId:     z.string().uuid(),
      userId:      z.string().uuid(),
    }),
  ]),
  confidence: z.number().min(0).max(1),
  reasoning:  z.string().min(1),
  provenance: z.array(
    z.object({
      kind:   z.enum(['tool', 'document', 'principle']),
      ref:    z.string().min(1),
      detail: z.string().optional(),
    }),
  ),
})

const outputSchema = z.object({
  proposals: z.array(proposalSchema),
  paused: z.object({
    question:          z.string(),
    contextSummary:    z.string(),
    currentConfidence: z.number(),
  }).nullable(),
})

export type ProposeWasteActionsInput  = z.infer<typeof inputSchema>
export type ProposeWasteActionsOutput = z.infer<typeof outputSchema>

export const proposeWasteActionsBlock = createBlock<ProposeWasteActionsInput, ProposeWasteActionsOutput>({
  name: 'propose_waste_actions',
  inputSchema,
  outputSchema,
  systemPrompt:
    'You are the main reasoning step of waste_triage. Follow the numbered procedure in the task prompt exactly. ' +
    'Every proposal must include the typed BeaconAction, a confidence score, a reasoning string that cites each tool result, ' +
    'and full provenance. If confidence drops below the threshold, call request_clarification instead.',
  run: async (input, ctx) => {
    // 1. Recent waste pattern — feeds reasoning + confidence calibration.
    const waste = await ctx.invokeTool<{ variantId: string; sinceDays: number }, QueryRecentWasteLogsOutput>(
      'query_recent_waste_logs',
      { variantId: input.variantId, sinceDays: 14 },
    )

    // 2. Project consumption inside the safe window.
    const forecast = await ctx.invokeTool<{ variantId: string; horizonDays: number }, ForecastConsumptionOutput>(
      'forecast_consumption',
      { variantId: input.variantId, horizonDays: input.safeWindowDays },
    )
    const atRiskUnits = Math.max(0, input.currentStock - forecast.projectedUnits)

    if (atRiskUnits === 0) {
      return { proposals: [], paused: null }
    }

    // Clarification when forecast is shaky — a write-off is irreversible.
    if (forecast.confidence < input.confidenceThreshold) {
      const question =
        `Forecast confidence is ${String(forecast.confidence)} for ${input.variantName}. ` +
        `Should I size a write-off at ${String(atRiskUnits)} units, or wait for more consumption data?`
      const contextSummary =
        `${input.variantName}: ${String(input.currentStock)} on hand, projected ${String(forecast.projectedUnits)}u over ${String(input.safeWindowDays)}d ` +
        `(basis ${forecast.basis}, sample ${String(forecast.sampleSize)}). Recent 14d waste: ${String(waste.totalWasteUnits)}u across ${String(waste.daysWithWaste)} days.`

      await ctx.invokeTool<
        { question: string; contextSummary: string; currentConfidence: number },
        { paused: true; question: string; contextSummary: string; currentConfidence: number }
      >('request_clarification', { question, contextSummary, currentConfidence: forecast.confidence })

      return {
        proposals: [],
        paused: { question, contextSummary, currentConfidence: forecast.confidence },
      }
    }

    // 3. Find sisters that NEED this variant (stock < 50% of par).
    const sisters = await ctx.invokeTool<
      { variantId: string; variantName: string; hotelId: string },
      QuerySisterPropertyInventoryOutput
    >('query_sister_property_inventory', {
      variantId:   input.variantId,
      variantName: input.variantName,
      hotelId:     input.hotelId,
    })

    const needy = sisters.sisters
      .filter((s) => (s.parLevel ?? 0) > 0 && s.currentStock < (s.parLevel ?? 0) * 0.5)
      .map((s) => ({
        ...s,
        gap: Math.max(0, (s.parLevel ?? 0) - s.currentStock),
      }))
      .filter((s) => s.gap > 0)
      .sort((a, b) => b.gap - a.gap)

    const proposals: ProposeWasteActionsOutput['proposals'] = []
    let remaining = atRiskUnits

    const bestNeedy = needy[0]
    if (bestNeedy && bestNeedy.gap >= atRiskUnits * 0.4) {
      const transferQty = Math.min(bestNeedy.gap, remaining)
      proposals.push({
        action: {
          type:        'TRANSFER_STOCK',
          fromHotelId: input.hotelId,
          toHotelId:   bestNeedy.hotelId,
          variantId:   input.variantId,
          quantity:    transferQty,
          reason:      `Redirect ${String(transferQty)} at-risk units to ${bestNeedy.hotelName} (${String(bestNeedy.currentStock)}/${String(bestNeedy.parLevel ?? 0)} on hand) before spoilage.`,
        },
        confidence: Math.min(forecast.confidence, 0.85),
        reasoning:
          `forecast_consumption: projected ${String(forecast.projectedUnits)}u over ${String(input.safeWindowDays)}d (basis ${forecast.basis}, conf ${String(forecast.confidence)}). ` +
          `Current stock ${String(input.currentStock)} → at-risk ${String(atRiskUnits)} units. ` +
          `query_sister_property_inventory: ${bestNeedy.hotelName} has ${String(bestNeedy.currentStock)}/${String(bestNeedy.parLevel ?? 0)} (gap ${String(bestNeedy.gap)}). ` +
          `Transfer ${String(transferQty)} units.`,
        provenance: [
          { kind: 'tool', ref: 'forecast_consumption',            detail: `${String(forecast.projectedUnits)}u, basis=${forecast.basis}` },
          { kind: 'tool', ref: 'query_sister_property_inventory', detail: `${String(needy.length)} needy sisters` },
          { kind: 'tool', ref: 'query_recent_waste_logs',         detail: `${String(waste.totalWasteUnits)}u over 14d` },
        ],
      })
      remaining -= transferQty
    }

    // 4. Write off whatever's left.
    if (remaining > 0) {
      const recentlyHighWaste = waste.daysWithWaste >= 5
      proposals.push({
        action: {
          type:        'WRITE_OFF',
          variantId:   input.variantId,
          quantity:    remaining,
          wasteReason: `Projected to spoil within ${String(input.safeWindowDays)}d safe-window: forecast ${String(forecast.projectedUnits)}u vs ${String(input.currentStock)}u on hand.${recentlyHighWaste ? ' Pattern of recurring waste flagged.' : ''}`,
          hotelId:     input.hotelId,
          userId:      input.userId,
        },
        confidence: Math.min(forecast.confidence, recentlyHighWaste ? 0.8 : 0.75),
        reasoning:
          `Remaining at-risk after lateral redirect: ${String(remaining)} units. ` +
          `query_recent_waste_logs: ${String(waste.totalWasteUnits)}u over ${String(waste.daysWithWaste)}/14 days (mean ${String(waste.meanDailyWaste)}u/day). ` +
          (recentlyHighWaste ? 'Recent pattern raises confidence in the write-off.' : 'Single-event write-off — no recurring pattern detected.'),
        provenance: [
          { kind: 'tool', ref: 'forecast_consumption',    detail: `gap=${String(atRiskUnits)}` },
          { kind: 'tool', ref: 'query_recent_waste_logs', detail: `${String(waste.totalWasteUnits)}u over ${String(waste.daysWithWaste)}/14d` },
        ],
      })
    }

    // Apply operator Principles as soft constraints — annotate each proposal
    // with the principles that shaped it and surface them in the reasoning.
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
