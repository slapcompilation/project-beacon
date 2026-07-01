// Mechanics of the version-diff runner: run two agent versions over the same
// judgment case and confirm the diff correctly reports pass rates and flags
// regressions / improvements against the baseline. The judge is scripted
// (case-outer, version-inner order); live runs swap in a real model.

import { describe, expect, it } from 'vitest'
import { runVersionDiff, type AgentVersion } from './versionDiff'
import { type JudgmentCase } from './judgmentEval'
import type { RubricCheck } from './rubricGrader'
import { StubLLMClient, type LLMResponse } from '../agents/llm'
import type { AgentSpec, AgentProposal } from '../agents/index'
import { buildRestockAdvisorAgent } from '../agents/restock_advisor/index'
import { IDS, emptyWorld, makeReader, scriptedLLM, dailyConsumptionLogs } from '../agents/restock_advisor/eval/fixtures'

const RUBRIC: RubricCheck[] = [
  { id: 'prefers-lateral', question: 'Does the plan move stock laterally before external procurement?', required: true },
  { id: 'acts',            question: 'Did it produce an actionable proposal?' },
]

const lateralCase: JudgmentCase = {
  name: 'lateral before external',
  input: { prompt: 'tomatoes are out', userId: IDS.user, scope: { hotelId: IDS.hotelA, organizationId: IDS.org } },
  rubric: RUBRIC,
}

// Real deterministic baseline: a sister holds 60u → it proposes a transfer.
function realAgent(): AgentSpec {
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
  return buildRestockAdvisorAgent({ llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }), reader: makeReader(world) })
}

// A degraded version that fails to act — stands in for a regressed reasoning
// path. Same JudgmentCase input; different AgentSpec.
function idleAgent(label: string): AgentSpec {
  const emptyProposals: AgentProposal[] = []
  return {
    name: label, version: '0.0.0', purpose: 'stub', scope: 'hotel', cadence: 'on-event',
    toolset: [], approvalBoundary: 'operator', releaseStage: 'sandbox',
    run: () => Promise.resolve({
      proposals: emptyProposals,
      paused: { question: 'unsure', contextSummary: '', currentConfidence: 0.3 },
      trace: { agentName: label, agentVersion: '0.0.0', startedAt: new Date(), endedAt: new Date(), totalTokensUsed: 0, steps: [] },
    }),
  }
}

const passVerdict: LLMResponse = { output: { checks: [{ id: 'prefers-lateral', passed: true, rationale: 'transfer' }, { id: 'acts', passed: true, rationale: 'proposal present' }] }, toolCalls: [], tokensUsed: 0 }
const failVerdict: LLMResponse = { output: { checks: [{ id: 'prefers-lateral', passed: false, rationale: 'no action' }, { id: 'acts', passed: false, rationale: 'empty' }] }, toolCalls: [], tokensUsed: 0 }

describe('runVersionDiff', () => {
  it('flags a regression when the challenger version fails a case the baseline passes', async () => {
    const versions: AgentVersion[] = [
      { label: 'deterministic', agent: realAgent() },
      { label: 'llm',           agent: idleAgent('llm') },
    ]
    // case-outer, version-inner → [deterministic (pass), llm (fail)]
    const judge = new StubLLMClient([passVerdict, failVerdict])
    const diff = await runVersionDiff({ versions, cases: [lateralCase], judge })

    expect(diff.baseline).toBe('deterministic')
    expect(diff.summary.find((s) => s.version === 'deterministic')?.passRate).toBe(1)
    expect(diff.summary.find((s) => s.version === 'llm')?.passRate).toBe(0)
    expect(diff.deltas).toHaveLength(1)
    expect(diff.deltas[0]).toMatchObject({ version: 'llm', regressions: ['lateral before external'], improvements: [] })
  })

  it('flags an improvement when the challenger passes a case the baseline fails', async () => {
    const versions: AgentVersion[] = [
      { label: 'deterministic', agent: idleAgent('deterministic') },  // baseline fails
      { label: 'llm',           agent: realAgent() },                 // challenger passes
    ]
    const judge = new StubLLMClient([failVerdict, passVerdict])
    const diff = await runVersionDiff({ versions, cases: [lateralCase], judge })

    expect(diff.deltas[0]).toMatchObject({ version: 'llm', regressions: [], improvements: ['lateral before external'] })
  })

  it('requires at least two versions', async () => {
    await expect(
      runVersionDiff({ versions: [{ label: 'only', agent: idleAgent('only') }], cases: [lateralCase], judge: new StubLLMClient([]) }),
    ).rejects.toThrow(/at least two versions/)
  })

  it('slices the diff by cohort, pinning a regression to the property it hit', async () => {
    const single: RubricCheck[] = [{ id: 'ok', question: 'ok?', required: true }]
    const caseA: JudgmentCase = { name: 'case A', cohort: 'valinor',   input: lateralCase.input, rubric: single }
    const caseB: JudgmentCase = { name: 'case B', cohort: 'rivendell', input: lateralCase.input, rubric: single }
    const pass: LLMResponse = { output: { checks: [{ id: 'ok', passed: true,  rationale: 'ok' }] }, toolCalls: [], tokensUsed: 0 }
    const fail: LLMResponse = { output: { checks: [{ id: 'ok', passed: false, rationale: 'no' }] }, toolCalls: [], tokensUsed: 0 }
    const versions: AgentVersion[] = [
      { label: 'deterministic', agent: idleAgent('deterministic') },
      { label: 'llm',           agent: idleAgent('llm') },
    ]
    // case-outer, version-inner → [A-det, A-llm, B-det, B-llm]; llm fails only case B.
    const judge = new StubLLMClient([pass, pass, pass, fail])
    const diff = await runVersionDiff({ versions, cases: [caseA, caseB], judge })

    expect(diff.cohorts).toHaveLength(2)
    expect(diff.cohorts.find((c) => c.cohort === 'rivendell')?.deltas[0]).toMatchObject({ version: 'llm', regressions: ['case B'] })
    expect(diff.cohorts.find((c) => c.cohort === 'valinor')?.deltas[0]).toMatchObject({ version: 'llm', regressions: [] })
    expect(diff.summary.find((s) => s.version === 'llm')?.passRate).toBe(0.5)
  })
})
