// Judgment eval for restock_advisor — grades reasoning *quality* on cases where
// the right call is a judgment, not a lookup. Demonstrates the AIP evaluator
// triad on one scenario: object-match + string-contains on the real agent
// output (regression guards), and an LLM-as-judge rubric (the durable judgment
// criteria). In CI the judge is a scripted stub; a live run (BEACON_EVAL_LIVE)
// swaps in a real model to measure the 'llm' version against this baseline.

import { describe, expect, it } from 'vitest'
import { buildRestockAdvisorAgent } from '../index'
import { IDS, emptyWorld, makeReader, scriptedLLM, dailyConsumptionLogs, type FixtureWorld } from './fixtures'
import { runJudgmentCase, stubRubricJudge, type JudgmentCase } from '../../../evals/judgmentEval'
import type { RubricCheck } from '../../../evals/rubricGrader'

// Lateral-before-external: the home property is empty, but a sister holds 60u —
// enough to cover a meaningful share of the gap. The right judgment is to move
// stock laterally before raising an external order (CLAUDE.md multi-echelon).
function lateralWorld(): FixtureWorld {
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

// The judgment criteria — the durable asset. A real-model judge grades the
// agent's reasoning against exactly these in a live run; the stub mirrors them.
const LATERAL_RUBRIC: RubricCheck[] = [
  { id: 'prefers-lateral', question: 'When a sister property can cover a meaningful share of the gap, does the plan move stock laterally (TRANSFER_STOCK) before any external procurement?', required: true },
  { id: 'cites-tools',     question: 'Does the reasoning name the tools it relied on (forecast, sister inventory, reorder point)?', required: true },
  { id: 'sized-to-need',   question: 'Is the transfer quantity tied to a computed gap / reorder point rather than arbitrary?' },
  { id: 'has-confidence',  question: 'Is a confidence in [0,1] present and consistent with the evidence cited?' },
]

const lateralCase: JudgmentCase = {
  name: 'prefers lateral transfer when a sister can cover the gap',
  input: { prompt: 'tomatoes are out', userId: IDS.user, scope: { hotelId: IDS.hotelA, organizationId: IDS.org } },
  rubric: LATERAL_RUBRIC,
}

describe('restock_advisor — judgment eval (lateral before external)', () => {
  it('object-match + string-contains: the real plan chooses a lateral transfer', async () => {
    const agent = buildRestockAdvisorAgent({ llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }), reader: makeReader(lateralWorld()) })
    const r = await agent.run(lateralCase.input)

    // object-match: the leading action is a TRANSFER_STOCK from the sister.
    expect(r.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    if (r.proposals[0]?.action.type === 'TRANSFER_STOCK') {
      expect(r.proposals[0].action.fromHotelId).toBe(IDS.hotelB)
    }
    // string-contains: the reasoning + provenance actually cite the sister lookup.
    expect(r.proposals[0]?.reasoning).toMatch(/sister|transfer|Hotel B/i)
    expect(r.proposals[0]?.provenance.some((p) => p.ref === 'query_sister_property_inventory')).toBe(true)
  })

  it('rubric (LLM-as-judge): the baseline output passes the judgment criteria', async () => {
    const agent = buildRestockAdvisorAgent({ llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }), reader: makeReader(lateralWorld()) })
    const { verdict } = await runJudgmentCase({
      agent,
      judge: stubRubricJudge([
        { id: 'prefers-lateral', passed: true },
        { id: 'cites-tools',     passed: true },
        { id: 'sized-to-need',   passed: true },
        { id: 'has-confidence',  passed: true },
      ]),
      testCase: lateralCase,
    })
    expect(verdict.passed).toBe(true)
    expect(verdict.score).toBe(1)
  })

  it('rubric gate blocks a plan that skips the lateral option (required check fails)', async () => {
    const agent = buildRestockAdvisorAgent({ llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }), reader: makeReader(lateralWorld()) })
    const { verdict } = await runJudgmentCase({
      agent,
      judge: stubRubricJudge([
        { id: 'prefers-lateral', passed: false },   // model went straight to external procurement
        { id: 'cites-tools',     passed: true },
        { id: 'sized-to-need',   passed: true },
        { id: 'has-confidence',  passed: true },
      ]),
      testCase: lateralCase,
    })
    expect(verdict.passed).toBe(false)   // a failed required check fails the rubric
  })
})
