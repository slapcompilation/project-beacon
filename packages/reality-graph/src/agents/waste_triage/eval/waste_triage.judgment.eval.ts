// Judgment eval for waste_triage — grades the redirect-vs-write-off call:
// redirect at-risk stock to a sister that needs it BEFORE writing anything off
// (a write-off is irreversible). Demonstrates the AIP evaluator triad
// (object-match + string-contains on the real output, plus an LLM-as-judge
// rubric). CI uses a scripted judge; a live run (BEACON_EVAL_LIVE) swaps in a
// real model to measure the 'llm' version against this baseline.

import { describe, expect, it } from 'vitest'
import { buildWasteTriageAgent } from '../index'
import { IDS, emptyWorld, makeReader, scriptedLLM, dailyConsumptionLogs, type FixtureWorld } from './fixtures'
import { runJudgmentCase, stubRubricJudge, type JudgmentCase } from '../../../evals/judgmentEval'
import type { RubricCheck } from '../../../evals/rubricGrader'

// 100 salmon on hand, burns 2/day → ~14 needed over a 7d safe window, so ~86 is
// at risk. A sister is below par×0.5 with a gap of 40. The judgment: redirect
// what the sister can absorb (40) before writing off the remainder (46) — never
// write off stock another property still needs.
function redirectableWorld(): FixtureWorld {
  return {
    ...emptyWorld(),
    hotels: [
      { id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' },
      { id: IDS.hotelB, organization_id: IDS.org, name: 'Hotel B' },
    ],
    variants: [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 100, par_level: 40 },
      { id: IDS.varSalmonB, hotel_id: IDS.hotelB, name: 'salmon', current_stock: 10, par_level: 50 },
    ],
    stockLogs: dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 2 }),
  }
}

const REDIRECT_RUBRIC: RubricCheck[] = [
  { id: 'redirect-first',     question: 'Before writing anything off, does the plan redirect at-risk stock to a sister that needs it (TRANSFER_STOCK) when one is available?', required: true },
  { id: 'writeoff-limited',   question: 'Is any WRITE_OFF limited to the units that genuinely cannot be redirected or consumed in time?', required: true },
  { id: 'cites-tools',        question: 'Does the reasoning cite the forecast + waste-log + sister evidence it relied on?' },
  { id: 'irreversible-caution', question: 'Does it treat the write-off as irreversible (not proposed on a shaky forecast)?' },
]

const redirectCase: JudgmentCase = {
  name: 'redirects to a needy sister before writing off the remainder',
  input: { prompt: 'salmon is about to spoil', userId: IDS.user, scope: { hotelId: IDS.hotelA, organizationId: IDS.org } },
  rubric: REDIRECT_RUBRIC,
}

describe('waste_triage — judgment eval (redirect before write-off)', () => {
  it('object-match + string-contains: redirects to the sister, then writes off the remainder', async () => {
    const agent = buildWasteTriageAgent({ llm: scriptedLLM({ variantId: IDS.varSalmonA, variantName: 'salmon' }), reader: makeReader(redirectableWorld()) })
    const r = await agent.run(redirectCase.input)

    // The lateral redirect comes first, ahead of the irreversible write-off.
    expect(r.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    expect(r.proposals.some((p) => p.action.type === 'WRITE_OFF')).toBe(true)
    expect(r.proposals[0]?.reasoning).toMatch(/redirect|at-risk|sister|Hotel B/i)
    expect(r.proposals[0]?.provenance.some((p) => p.ref === 'query_sister_property_inventory')).toBe(true)
  })

  it('rubric (LLM-as-judge): the baseline output passes the judgment criteria', async () => {
    const agent = buildWasteTriageAgent({ llm: scriptedLLM({ variantId: IDS.varSalmonA, variantName: 'salmon' }), reader: makeReader(redirectableWorld()) })
    const { verdict } = await runJudgmentCase({
      agent,
      judge: stubRubricJudge([
        { id: 'redirect-first',       passed: true },
        { id: 'writeoff-limited',     passed: true },
        { id: 'cites-tools',          passed: true },
        { id: 'irreversible-caution', passed: true },
      ]),
      testCase: redirectCase,
    })
    expect(verdict.passed).toBe(true)
  })

  it('rubric gate blocks a plan that writes off stock a sister still needs (required check fails)', async () => {
    const agent = buildWasteTriageAgent({ llm: scriptedLLM({ variantId: IDS.varSalmonA, variantName: 'salmon' }), reader: makeReader(redirectableWorld()) })
    const { verdict } = await runJudgmentCase({
      agent,
      judge: stubRubricJudge([
        { id: 'redirect-first',       passed: false },   // wrote it all off instead of redirecting
        { id: 'writeoff-limited',     passed: true },
        { id: 'cites-tools',          passed: true },
        { id: 'irreversible-caution', passed: true },
      ]),
      testCase: redirectCase,
    })
    expect(verdict.passed).toBe(false)
  })
})
