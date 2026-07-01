// Judgment eval for restock_advisor — grades reasoning *quality* on cases where
// the right call is a judgment, not a lookup. Demonstrates the AIP evaluator
// triad on one scenario: object-match + string-contains on the real agent
// output (regression guards), and an LLM-as-judge rubric (the durable judgment
// criteria). In CI the judge is a scripted stub; a live run (BEACON_EVAL_LIVE)
// swaps in a real model to measure the 'llm' version against this baseline.

import { describe, expect, it } from 'vitest'
import { buildRestockAdvisorAgent } from '../index'
import { IDS, makeReader, scriptedLLM } from './fixtures'
import { lateralWorld, lateralCase } from './judgmentScenarios'
import { runJudgmentCase, stubRubricJudge } from '../../../evals/judgmentEval'

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
