// Safety + mechanics of the LLM tool-loop reasoning path (reasoning: 'llm').
// The StubLLM scripts the model's turns; the tools run for real against the
// fixture world. Proves: the model can orchestrate tools → typed proposal; a
// disallowed tool is rejected (not executed); any loop failure falls back to the
// deterministic procedure; the iteration cap holds.

import { describe, expect, it } from 'vitest'
import { buildRestockAdvisorAgent } from '../index'
import { IDS, makeReader, dailyConsumptionLogs, type FixtureWorld } from './fixtures'
import { StubLLMClient, type LLMResponse } from '../../llm'

function world(): FixtureWorld {
  return {
    variants: [{ id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 5, par_level: 100 }],
    restockRequests: [],
    stockLogs: dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 12 }),
    hotels: [{ id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' }],
    suppliers: [{ id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 }],
    principles: [],
  }
}

const extracts: LLMResponse[] = [
  { output: { variantId: IDS.varTomatoesA, variantName: 'tomatoes', confidence: 0.9 }, toolCalls: [], tokensUsed: 100 },
  { output: { supplierName: null, confidence: 0.8 }, toolCalls: [], tokensUsed: 80 },
]

const baseInput = { prompt: 'tomatoes low', userId: IDS.user, scope: { hotelId: IDS.hotelA, organizationId: IDS.org } }

const validProposal = {
  proposals: [{
    action: { type: 'REQUEST_RESTOCK', variantId: IDS.varTomatoesA, quantityNeeded: 50, urgency: 'high', supplier: 'Sysco', notes: null, hotelId: IDS.hotelA, requestorId: IDS.user },
    confidence: 0.8,
    reasoning: 'compute_reorder_point: position below reorder point → order 50 via Sysco.',
    provenance: [{ kind: 'tool', ref: 'compute_reorder_point' }],
  }],
  paused: null,
}

describe('restock_advisor — LLM tool-loop reasoning', () => {
  it('the model orchestrates a tool call then emits a typed proposal', async () => {
    const llm = new StubLLMClient([
      ...extracts,
      { toolCalls: [{ toolName: 'compute_reorder_point', input: { variantId: IDS.varTomatoesA, serviceLevel: 0.95 }, thought: 'size the reorder' }], tokensUsed: 50 },
      { output: validProposal, toolCalls: [], tokensUsed: 80 },
    ])
    const agent = buildRestockAdvisorAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.proposals).toHaveLength(1)
    expect(r.proposals[0]?.action.type).toBe('REQUEST_RESTOCK')
    // the tool actually ran, with the model's thought captured in the trace
    const call = r.trace.steps.find((s) => s.type === 'llm_tool_use' && s.toolName === 'compute_reorder_point')
    expect(call?.thought).toBe('size the reorder')
    expect(r.trace.steps.some((s) => s.type === 'tool_response' && s.toolName === 'compute_reorder_point')).toBe(true)
  })

  it('rejects a disallowed tool call without executing it, then continues', async () => {
    const llm = new StubLLMClient([
      ...extracts,
      { toolCalls: [{ toolName: 'set_org_policy', input: { evil: true }, thought: 'escalate privileges' }], tokensUsed: 30 },
      { output: { proposals: [], paused: { question: 'blocked — need guidance', contextSummary: 'tomatoes', currentConfidence: 0.4 } }, toolCalls: [], tokensUsed: 40 },
    ])
    const agent = buildRestockAdvisorAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    // The disallowed tool was rejected + recorded, never executed.
    const rejected = r.trace.steps.find((s) => s.type === 'tool_response' && s.toolName === 'set_org_policy')
    expect(rejected?.output).toMatchObject({ rejected: expect.stringContaining('not allowed') })
    expect(r.trace.steps.some((s) => s.type === 'llm_tool_use' && s.toolName === 'set_org_policy')).toBe(false)
    // and it still produced a safe result (paused), no rogue proposal
    expect(r.paused).toBeDefined()
    expect(r.proposals).toHaveLength(0)
  })

  it('falls back to the deterministic procedure when the LLM loop errors', async () => {
    // Only the extract responses scripted → the loop\'s first call exhausts the
    // stub and throws → agent falls back to deterministic, still produces output.
    const llm = new StubLLMClient([...extracts])
    const agent = buildRestockAdvisorAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.proposals.length).toBeGreaterThanOrEqual(1)   // deterministic fallback ran
    expect(r.trace.steps.some((s) => s.blockName === 'reason_and_propose')).toBe(true)
  })

  it('caps the loop and falls back when the model never finalizes', async () => {
    const spin: LLMResponse = { toolCalls: [{ toolName: 'query_open_restock_requests', input: { variantId: IDS.varTomatoesA }, thought: 'again' }], tokensUsed: 10 }
    const llm = new StubLLMClient([...extracts, ...Array.from({ length: 8 }, () => spin)])
    const agent = buildRestockAdvisorAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.trace.steps.some((s) => s.type === 'llm_output' && (s.output as { loopFailed?: string }).loopFailed?.includes('max iterations'))).toBe(true)
    expect(r.proposals.length).toBeGreaterThanOrEqual(1)   // deterministic fallback ran
  })

  it('deterministic mode (default) ignores the LLM loop entirely', async () => {
    const llm = new StubLLMClient([...extracts])   // only extracts → deterministic uses no further calls
    const agent = buildRestockAdvisorAgent({ llm, reader: makeReader(world()) })  // no reasoning → deterministic
    const r = await agent.run(baseInput)
    expect(r.proposals.length).toBeGreaterThanOrEqual(1)
    expect(r.trace.steps.some((s) => s.blockName === 'reason_and_propose_llm')).toBe(false)
  })
})
