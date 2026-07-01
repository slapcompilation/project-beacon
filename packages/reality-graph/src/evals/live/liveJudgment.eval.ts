// LIVE judgment diff — the real number. Runs restock_advisor's deterministic
// baseline vs the LLM-reasoning version against the shared lateral case, grading
// both with a real-model LLM-as-judge, and reports the version diff. This is the
// only eval that spends: it is SKIPPED unless BEACON_EVAL_LIVE=1, and needs
// ANTHROPIC_API_KEY.
//
// Run it (PowerShell):
//   $env:BEACON_EVAL_LIVE=1; $env:ANTHROPIC_API_KEY='sk-...'
//   pnpm --filter @beacon/reality-graph run eval:live
// or (bash):
//   BEACON_EVAL_LIVE=1 ANTHROPIC_API_KEY=sk-... pnpm --filter @beacon/reality-graph run eval:live

import { describe, expect, it } from 'vitest'
import { LIVE_JUDGMENT, runVersionDiff, type AgentVersion } from '../index'
import { AnthropicNodeLLMClient } from './anthropicNodeClient'
import { buildRestockAdvisorAgent } from '../../agents/restock_advisor/index'
import { makeReader } from '../../agents/restock_advisor/eval/fixtures'
import { lateralWorld, lateralCase } from '../../agents/restock_advisor/eval/judgmentScenarios'

describe.skipIf(!LIVE_JUDGMENT)('LIVE judgment diff — restock_advisor deterministic vs llm (real model)', () => {
  it('grades both versions on the lateral case and reports the diff', async () => {
    const model = new AnthropicNodeLLMClient()   // key from ANTHROPIC_API_KEY
    const reader = makeReader(lateralWorld())
    const versions: AgentVersion[] = [
      { label: 'deterministic', agent: buildRestockAdvisorAgent({ llm: model, reader, reasoning: 'deterministic' }) },
      { label: 'llm',           agent: buildRestockAdvisorAgent({ llm: model, reader, reasoning: 'llm' }) },
    ]

    const diff = await runVersionDiff({ versions, cases: [lateralCase], judge: model })
    console.log('\n=== LIVE version diff (restock_advisor) ===\n' + JSON.stringify(diff, null, 2) + '\n')

    // The 'llm' version must not regress the deterministic baseline on this case.
    expect(diff.deltas[0]?.regressions ?? []).toHaveLength(0)
  }, 120_000)
})
