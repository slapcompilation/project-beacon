// Judgment eval for overstock_rebalancer — grades the capital-efficiency call:
// free genuinely-surplus stock to a needy sister WITHOUT stripping the source
// below its own projected need. Demonstrates the AIP evaluator triad
// (object-match + string-contains on the real output, plus an LLM-as-judge
// rubric). CI uses a scripted judge; a live run (BEACON_EVAL_LIVE) swaps in a
// real model to measure the 'llm' version against this baseline.

import { describe, expect, it } from 'vitest'
import { buildOverstockRebalancerAgent } from '../index'
import { IDS, emptyWorld, makeReader, scriptedLLM, dailyConsumptionLogs, type FixtureWorld } from './fixtures'
import { runJudgmentCase, stubRubricJudge, type JudgmentCase } from '../../../evals/judgmentEval'
import type { RubricCheck } from '../../../evals/rubricGrader'

// Source holds 130 (burns 2/day → 60 over 30d, so 70 is surplus). A sister is
// far below par (gap 90). The judgment: move surplus, but cap it so the source
// keeps its own 60-unit projected need — transfer 70, not 90.
function cappedSurplusWorld(): FixtureWorld {
  return {
    ...emptyWorld(),
    hotels: [
      { id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' },
      { id: IDS.hotelB, organization_id: IDS.org, name: 'Hotel B' },
    ],
    variants: [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 130, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 },
    ],
    stockLogs: dailyConsumptionLogs({ variantId: IDS.varSugarA, hotelId: IDS.hotelA, dailyUnits: 2 }),
  }
}

const PROTECT_SOURCE_RUBRIC: RubricCheck[] = [
  { id: 'protects-source', question: 'Does the transfer leave the source property with at least its own projected consumption need (never stripped below it)?', required: true },
  { id: 'targets-needy',   question: 'Is the destination a sister genuinely below par that needs the stock?', required: true },
  { id: 'cites-tools',     question: 'Does the reasoning cite the forecast + sister inventory it relied on?' },
  { id: 'capital-rationale', question: 'Is the transfer framed as freeing excess/idle capital rather than an arbitrary move?' },
]

const cappedCase: JudgmentCase = {
  name: 'caps the transfer to protect the source while freeing surplus',
  input: { prompt: 'too much sugar sitting here', userId: IDS.user, scope: { hotelId: IDS.hotelA, organizationId: IDS.org } },
  rubric: PROTECT_SOURCE_RUBRIC,
}

describe('overstock_rebalancer — judgment eval (protect source while freeing surplus)', () => {
  it('object-match + string-contains: transfers the surplus but caps at the source floor', async () => {
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(cappedSurplusWorld()) })
    const r = await agent.run(cappedCase.input)

    expect(r.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    if (r.proposals[0]?.action.type === 'TRANSFER_STOCK') {
      expect(r.proposals[0].action.toHotelId).toBe(IDS.hotelB)
      expect(r.proposals[0].action.quantity).toBe(70)   // capped: source retains its 60-unit need
    }
    expect(r.proposals[0]?.reasoning).toMatch(/surplus|projected|Hotel B/i)
    expect(r.proposals[0]?.provenance.some((p) => p.ref === 'query_sister_property_inventory')).toBe(true)
  })

  it('rubric (LLM-as-judge): the baseline output passes the judgment criteria', async () => {
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(cappedSurplusWorld()) })
    const { verdict } = await runJudgmentCase({
      agent,
      judge: stubRubricJudge([
        { id: 'protects-source',   passed: true },
        { id: 'targets-needy',     passed: true },
        { id: 'cites-tools',       passed: true },
        { id: 'capital-rationale', passed: true },
      ]),
      testCase: cappedCase,
    })
    expect(verdict.passed).toBe(true)
  })

  it('rubric gate blocks a plan that strips the source below its need (required check fails)', async () => {
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(cappedSurplusWorld()) })
    const { verdict } = await runJudgmentCase({
      agent,
      judge: stubRubricJudge([
        { id: 'protects-source',   passed: false },   // over-transferred, leaving the source short
        { id: 'targets-needy',     passed: true },
        { id: 'cites-tools',       passed: true },
        { id: 'capital-rationale', passed: true },
      ]),
      testCase: cappedCase,
    })
    expect(verdict.passed).toBe(false)
  })
})
