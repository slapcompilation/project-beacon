// Shared judgment scenario for restock_advisor — imported by both the CI
// judgment eval (scripted judge) and the live diff run (real-model judge), so
// the two grade the exact same case with no drift.

import { IDS, emptyWorld, dailyConsumptionLogs, type FixtureWorld } from './fixtures'
import type { JudgmentCase } from '../../../evals/judgmentEval'
import type { RubricCheck } from '../../../evals/rubricGrader'

// Lateral-before-external: the home property is empty, but a sister holds 60u —
// enough to cover a meaningful share of the gap. The right judgment is to move
// stock laterally before raising an external order (CLAUDE.md multi-echelon).
export function lateralWorld(): FixtureWorld {
  const world = emptyWorld()
  world.hotels = [
    { id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' },
    { id: IDS.hotelB, organization_id: IDS.org, name: 'Hotel B' },
  ]
  world.variants = [
    { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
    { id: IDS.varTomatoesB, hotel_id: IDS.hotelB, name: 'tomatoes', current_stock: 60, par_level: 100 },
  ]
  world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })
  world.suppliers = [{ id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 }]
  return world
}

// The judgment criteria — the durable asset a real-model judge grades against.
export const LATERAL_RUBRIC: RubricCheck[] = [
  { id: 'prefers-lateral', question: 'When a sister property can cover a meaningful share of the gap, does the plan move stock laterally (TRANSFER_STOCK) before any external procurement?', required: true },
  { id: 'cites-tools',     question: 'Does the reasoning name the tools it relied on (forecast, sister inventory, reorder point)?', required: true },
  { id: 'sized-to-need',   question: 'Is the transfer quantity tied to a computed gap / reorder point rather than arbitrary?' },
  { id: 'has-confidence',  question: 'Is a confidence in [0,1] present and consistent with the evidence cited?' },
]

export const lateralCase: JudgmentCase = {
  name: 'prefers lateral transfer when a sister can cover the gap',
  input: { prompt: 'tomatoes are out', userId: IDS.user, scope: { hotelId: IDS.hotelA, organizationId: IDS.org } },
  rubric: LATERAL_RUBRIC,
}
