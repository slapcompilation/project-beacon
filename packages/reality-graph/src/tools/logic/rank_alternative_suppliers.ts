import { z } from 'zod'
import type { LogicTool } from '../index'
import type { GraphReader } from '../graph_reader'

const inputSchema = z.object({
  variantId: z.string().uuid(),
  maxLeadTimeDays: z.number().int().min(1).max(60),
})

const outputSchema = z.object({
  ranked: z.array(
    z.object({
      supplierId: z.string().uuid(),
      name: z.string(),
      leadTimeDays: z.number().int().nullable(),
      onTimePct: z.number().nullable(),
      costVariancePct: z.number().nullable(),
      /** Composite 0–1 score; higher is better. */
      score: z.number().min(0).max(1),
    }),
  ),
  basis: z.string(),
  confidence: z.number().min(0).max(1),
})

export type RankAlternativeSuppliersInput = z.infer<typeof inputSchema>
export type RankAlternativeSuppliersOutput = z.infer<typeof outputSchema>

/**
 * Composite score: on-time delivery (0.6) + cost discipline (0.3) + lead-time fit (0.1).
 * Suppliers whose lead time exceeds `maxLeadTimeDays` are dropped from the list.
 */
export function makeRankAlternativeSuppliersTool(
  reader: GraphReader,
): LogicTool<RankAlternativeSuppliersInput, RankAlternativeSuppliersOutput> {
  return {
    name: 'rank_alternative_suppliers',
    category: 'logic',
    kind: 'inproc',
    version: '1.0.0',
    description:
      'Ranks suppliers for a variant by composite reliability score (on-time, cost discipline, lead time). ' +
      'Excludes any whose lead time exceeds the supplied ceiling. Use when picking a procurement target.',
    inputSchema,
    outputSchema,
    traversableLinks: ['sourced_from'],
    examples: [
      {
        input: { variantId: '00000000-0000-0000-0000-000000000001', maxLeadTimeDays: 7 },
        output: { ranked: [], basis: 'on-time(0.6)+cost(0.3)+lead(0.1)', confidence: 0.5 },
      },
    ],
    invoke: async (input) => {
      const suppliers = await reader.getSuppliersForVariant(input.variantId)
      const eligible = suppliers.filter(
        (s) => s.lead_time_days != null && s.lead_time_days <= input.maxLeadTimeDays,
      )

      const ranked = eligible
        .map((s) => {
          const onTime = (s.on_time_pct ?? 70) / 100
          const cost = 1 - Math.min(1, Math.abs(s.cost_variance_pct ?? 5) / 25)
          const leadFit = 1 - Math.min(1, (s.lead_time_days ?? input.maxLeadTimeDays) / input.maxLeadTimeDays)
          const score = onTime * 0.6 + cost * 0.3 + leadFit * 0.1
          return {
            supplierId: s.id,
            name: s.name,
            leadTimeDays: s.lead_time_days,
            onTimePct: s.on_time_pct,
            costVariancePct: s.cost_variance_pct,
            score: Number(score.toFixed(3)),
          }
        })
        .sort((a, b) => b.score - a.score)

      const confidence = ranked.length === 0
        ? 0.2
        : Math.min(0.9, 0.5 + ranked.length / 20)

      return {
        ranked,
        basis: 'on-time(0.6)+cost(0.3)+lead(0.1)',
        confidence: Number(confidence.toFixed(2)),
      }
    },
  }
}
