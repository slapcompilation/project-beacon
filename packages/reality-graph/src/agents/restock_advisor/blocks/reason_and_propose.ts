import { z } from 'zod'
import { createBlock } from '../../runtime'
import { principleProvenance, principleReasoningSuffix } from '../../principles'
import type { PrincipleRecord } from '../../../tools/graph_reader'
import type { QueryOpenRestockRequestsOutput } from '../../../tools/data/query_open_restock_requests'
import type { ComputeReorderPointOutput } from '../../../tools/logic/compute_reorder_point'
import type { QuerySisterPropertyInventoryOutput } from '../../../tools/data/query_sister_property_inventory'
import type { RankAlternativeSuppliersOutput } from '../../../tools/logic/rank_alternative_suppliers'

const principleSchema = z.object({
  id:               z.string(),
  body:             z.string(),
  category:         z.string(),
  appliesToNodeIds: z.array(z.string()).optional(),
})

export const inputSchema = z.object({
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

export const outputSchema = z.object({
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

    // 2. Size via the reorder point (s, S): act only when the inventory position
    // has fallen to/below the reorder point, then order up to cover demand over
    // the lead time + safety stock + the review period.
    const REVIEW_DAYS = 7
    const rp = await ctx.invokeTool<{ variantId: string; serviceLevel: number }, ComputeReorderPointOutput>(
      'compute_reorder_point',
      { variantId: input.variantId, serviceLevel: 0.95 },
    )
    const position = input.currentStock + open.totalOpenQuantity

    // Above the reorder point → on-hand + open already cover the risk window.
    if (position > rp.reorderPoint) {
      return { proposals: [], paused: null }
    }

    // Clarification check on the sizing confidence (sparse demand history).
    if (rp.confidence < input.confidenceThreshold) {
      const q = `Reorder sizing confidence is ${String(rp.confidence)} — proceed toward reorder point ${String(rp.reorderPoint)}, or wait for more demand history?`
      await ctx.invokeTool<
        { question: string; contextSummary: string; currentConfidence: number },
        { paused: true; question: string; contextSummary: string; currentConfidence: number }
      >('request_clarification', {
        question: q,
        contextSummary: `${input.variantName}: ${String(input.currentStock)} on hand + ${String(open.totalOpenQuantity)} open = position ${String(position)} vs reorder point ${String(rp.reorderPoint)} (daily ${String(rp.dailyMean)}±${String(rp.dailySigma)}, lead ${String(rp.leadTimeDays)}d).`,
        currentConfidence: rp.confidence,
      })
      return {
        proposals: [],
        paused: { question: q, contextSummary: `${input.variantName}: position ${String(position)} vs reorder point ${String(rp.reorderPoint)}.`, currentConfidence: rp.confidence },
      }
    }

    // Order-up-to S = reorder point + the review period's expected demand.
    const orderUpTo = rp.reorderPoint + Math.round(rp.dailyMean * REVIEW_DAYS)
    const projectedGap = Math.max(0, orderUpTo - position)
    if (projectedGap === 0) {
      return { proposals: [], paused: null }
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
        reason: `Lateral transfer from ${bestSister.hotelName} (${String(bestSister.currentStock)} on hand) closes ${String(transferQty)} of the ${String(projectedGap)}-unit order toward reorder point ${String(rp.reorderPoint)}.`,
        },
        confidence: Math.min(rp.confidence, 0.85),
        reasoning:
          `compute_reorder_point: reorder point ${String(rp.reorderPoint)} (demand-over-lead ${String(rp.demandOverLeadTime)} + safety ${String(rp.safetyStock)}; daily ${String(rp.dailyMean)}±${String(rp.dailySigma)}, lead ${String(rp.leadTimeDays)}d, ${String(rp.serviceLevel * 100)}% service). ` +
          `Position ${String(input.currentStock)} on hand + ${String(open.totalOpenQuantity)} open = ${String(position)} ≤ reorder point → order up to ${String(orderUpTo)}, gap ${String(projectedGap)}. ` +
          `query_sister_property_inventory: ${bestSister.hotelName} has ${String(bestSister.currentStock)} → transfer ${String(transferQty)}.`,
        provenance: [
          { kind: 'tool', ref: 'query_open_restock_requests', detail: `totalOpen=${String(open.totalOpenQuantity)}` },
          { kind: 'tool', ref: 'compute_reorder_point', detail: `reorderPoint=${String(rp.reorderPoint)}, safety=${String(rp.safetyStock)}` },
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
        // Urgency from how depleted the position is vs the risk buffers: below
        // safety stock = high, below demand-over-lead = medium, else low.
        const urgency: 'low' | 'medium' | 'high' =
          position <= rp.safetyStock        ? 'high' :
          position <= rp.demandOverLeadTime ? 'medium' : 'low'

        proposals.push({
          action: {
            type:           'REQUEST_RESTOCK' as const,
            variantId:      input.variantId,
            quantityNeeded: remainingGap,
            urgency,
            supplier:       top.name,
            notes:          `Closes ${String(remainingGap)} of ${String(projectedGap)}-unit order toward reorder point ${String(rp.reorderPoint)} via ${top.name}.`,
            hotelId:        input.hotelId,
            requestorId:    input.requestorId,
          },
          confidence: Math.min(rp.confidence, ranked.confidence, 0.85),
          reasoning:
            `Remaining after sister transfer: ${String(remainingGap)} units (order-up-to ${String(orderUpTo)}, position ${String(position)} vs reorder point ${String(rp.reorderPoint)}). ` +
            `rank_alternative_suppliers: top=${top.name} (score ${String(top.score)}, lead ${String(top.leadTimeDays ?? '?')}d, on-time ${String(top.onTimePct ?? '?')}%). ` +
            `urgency=${urgency} from position vs safety stock ${String(rp.safetyStock)}.`,
          provenance: [
            { kind: 'tool', ref: 'compute_reorder_point', detail: `reorderPoint=${String(rp.reorderPoint)}` },
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
