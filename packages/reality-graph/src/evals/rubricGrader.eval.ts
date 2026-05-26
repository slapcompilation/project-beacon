// Eval for the rubric grader itself + a demonstration of LLM-as-judge
// scoring against a restock_advisor proposal shape.

import { describe, expect, it } from 'vitest'
import { gradeWithRubric, type RubricCheck } from './rubricGrader'
import { StubLLMClient } from '../agents/llm'

const sampleProposal = {
  action:     { type: 'REQUEST_RESTOCK', variantId: 'abc', quantityNeeded: 200, urgency: 'high', hotelId: 'hotel-1', requestorId: 'user-1' },
  confidence: 0.82,
  reasoning:  'forecast_consumption projected 280u over 7d (basis baseline-rolling-30d-avg, confidence 0.85). Current stock 80 → gap 200. rank_alternative_suppliers: top=Sysco (score 0.91, lead 2d). Proposing REQUEST_RESTOCK 200 units.',
  provenance: [
    { kind: 'tool', ref: 'forecast_consumption',          detail: '280u, basis=baseline-rolling-30d-avg' },
    { kind: 'tool', ref: 'rank_alternative_suppliers',    detail: 'top=Sysco, score=0.91' },
  ],
}

const checks: RubricCheck[] = [
  { id: 'cites-tool',     question: 'Does the reasoning name at least one tool that was called?', required: true },
  { id: 'has-confidence', question: 'Is a confidence score in [0,1] present?' },
  { id: 'is-actionable',  question: 'Is the action payload a well-formed BeaconAction with required fields?' },
  { id: 'matches-gap',    question: 'Does the proposed quantity correspond to the gap mentioned in the reasoning?' },
]

describe('gradeWithRubric', () => {
  it('aggregates per-check verdicts into a weighted score + pass bit', async () => {
    const llm = new StubLLMClient([
      {
        output: {
          checks: [
            { id: 'cites-tool',     passed: true,  rationale: 'forecast_consumption + rank_alternative_suppliers are named' },
            { id: 'has-confidence', passed: true,  rationale: 'confidence=0.82 sits inside [0,1]' },
            { id: 'is-actionable',  passed: true,  rationale: 'REQUEST_RESTOCK fields all present' },
            { id: 'matches-gap',    passed: true,  rationale: 'Gap stated as 200; quantity matches' },
          ],
        },
        toolCalls:  [],
        tokensUsed: 0,
      },
    ])

    const verdict = await gradeWithRubric({ llm, input: { variantId: 'abc' }, output: sampleProposal, checks })

    expect(verdict.passed).toBe(true)
    expect(verdict.score).toBe(1)
    expect(verdict.perCheck).toHaveLength(4)
    expect(verdict.perCheck.every((c) => c.passed)).toBe(true)
  })

  it('fails when a required check fails, even with a high overall score', async () => {
    const llm = new StubLLMClient([
      {
        output: {
          checks: [
            { id: 'cites-tool',     passed: false, rationale: 'reasoning mentions no tool by name' },
            { id: 'has-confidence', passed: true,  rationale: 'ok' },
            { id: 'is-actionable',  passed: true,  rationale: 'ok' },
            { id: 'matches-gap',    passed: true,  rationale: 'ok' },
          ],
        },
        toolCalls:  [],
        tokensUsed: 0,
      },
    ])

    const verdict = await gradeWithRubric({ llm, input: {}, output: sampleProposal, checks })
    expect(verdict.passed).toBe(false)
    expect(verdict.score).toBe(0.75)
  })

  it('honors passThreshold for non-required checks', async () => {
    const noRequired: RubricCheck[] = checks.map((c) => ({ ...c, required: false }))
    const llm = new StubLLMClient([
      {
        output: {
          checks: [
            { id: 'cites-tool',     passed: true,  rationale: 'ok' },
            { id: 'has-confidence', passed: false, rationale: 'missing' },
            { id: 'is-actionable',  passed: false, rationale: 'missing' },
            { id: 'matches-gap',    passed: false, rationale: 'missing' },
          ],
        },
        toolCalls:  [],
        tokensUsed: 0,
      },
    ])

    const verdict = await gradeWithRubric({ llm, input: {}, output: sampleProposal, checks: noRequired, passThreshold: 0.5 })
    expect(verdict.passed).toBe(false)  // 0.25 < 0.5
    expect(verdict.score).toBe(0.25)
  })

  it('marks missing verdicts as failed (defensive)', async () => {
    const llm = new StubLLMClient([
      {
        output: {
          checks: [
            { id: 'cites-tool', passed: true, rationale: 'ok' },
            // grader omitted the other three
          ],
        },
        toolCalls:  [],
        tokensUsed: 0,
      },
    ])

    const verdict = await gradeWithRubric({ llm, input: {}, output: sampleProposal, checks })
    expect(verdict.passed).toBe(false)
    const missing = verdict.perCheck.filter((c) => c.rationale.includes('no verdict'))
    expect(missing.length).toBe(3)
  })

  it('respects custom weights', async () => {
    const weighted: RubricCheck[] = [
      { id: 'cites-tool',     question: '...', weight: 3 },
      { id: 'has-confidence', question: '...', weight: 1 },
    ]
    const llm = new StubLLMClient([
      {
        output: {
          checks: [
            { id: 'cites-tool',     passed: true,  rationale: 'ok' },
            { id: 'has-confidence', passed: false, rationale: 'ok' },
          ],
        },
        toolCalls:  [],
        tokensUsed: 0,
      },
    ])
    const verdict = await gradeWithRubric({ llm, input: {}, output: {}, checks: weighted })
    expect(verdict.score).toBe(0.75)  // 3/(3+1) earned
  })
})
