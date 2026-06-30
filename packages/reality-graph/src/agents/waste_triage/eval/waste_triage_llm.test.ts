// Safety + mechanics of the LLM tool-loop reasoning path (reasoning: 'llm') for
// waste_triage. The StubLLM scripts the model's turns; the tools run for real
// against the fixture world. Proves: the model can orchestrate tools → a typed
// WRITE_OFF proposal; a disallowed tool is rejected (not executed); any loop
// failure falls back to the deterministic procedure; the cap holds.

import { describe, expect, it } from 'vitest'
import { buildWasteTriageAgent } from '../index'
import { IDS, emptyWorld, makeReader, dailyConsumptionLogs, type FixtureWorld } from './fixtures'
import { StubLLMClient, type LLMResponse } from '../../llm'

// varSalmonA at-risk: 100 on hand, burns 2/day → ~14 over a 7d safe window →
// ~86 at-risk. Single hotel → no needy sister → deterministic writes it off.
function world(): FixtureWorld {
  return {
    ...emptyWorld(),
    hotels: [{ id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' }],
    variants: [{ id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 100, par_level: 40 }],
    stockLogs: dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 2 }),
  }
}

const extract: LLMResponse = { output: { variantId: IDS.varSalmonA, variantName: 'salmon', confidence: 0.9 }, toolCalls: [], tokensUsed: 120 }
const baseInput = { prompt: 'salmon about to spoil', userId: IDS.user, scope: { hotelId: IDS.hotelA, organizationId: IDS.org } }

const validWriteOff = {
  proposals: [{
    action: { type: 'WRITE_OFF', variantId: IDS.varSalmonA, quantity: 86, wasteReason: 'Projected to spoil within 7d safe-window.', hotelId: IDS.hotelA, userId: IDS.user },
    confidence: 0.75,
    reasoning: 'forecast_consumption: projected 14u over 7d vs 100 on hand → 86 at-risk. query_recent_waste_logs: recurring spoilage. No needy sister → write off.',
    provenance: [{ kind: 'tool', ref: 'forecast_consumption' }, { kind: 'tool', ref: 'query_recent_waste_logs' }],
  }],
  paused: null,
}

describe('waste_triage — LLM tool-loop reasoning', () => {
  it('the model orchestrates tool calls then emits a typed WRITE_OFF proposal', async () => {
    const llm = new StubLLMClient([
      extract,
      { toolCalls: [{ toolName: 'query_recent_waste_logs', input: { variantId: IDS.varSalmonA, sinceDays: 14 }, thought: 'check the waste pattern' }], tokensUsed: 50 },
      { toolCalls: [{ toolName: 'forecast_consumption', input: { variantId: IDS.varSalmonA, horizonDays: 7 }, thought: 'project the safe window' }], tokensUsed: 50 },
      { output: validWriteOff, toolCalls: [], tokensUsed: 80 },
    ])
    const agent = buildWasteTriageAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.proposals).toHaveLength(1)
    expect(r.proposals[0]?.action.type).toBe('WRITE_OFF')
    const call = r.trace.steps.find((s) => s.type === 'llm_tool_use' && s.toolName === 'query_recent_waste_logs')
    expect(call?.thought).toBe('check the waste pattern')
    expect(r.trace.steps.some((s) => s.type === 'tool_response' && s.toolName === 'forecast_consumption')).toBe(true)
  })

  it('rejects a disallowed tool call without executing it, then continues', async () => {
    const llm = new StubLLMClient([
      extract,
      { toolCalls: [{ toolName: 'set_org_policy', input: { evil: true }, thought: 'escalate privileges' }], tokensUsed: 30 },
      { output: { proposals: [], paused: { question: 'blocked — need guidance', contextSummary: 'salmon', currentConfidence: 0.4 } }, toolCalls: [], tokensUsed: 40 },
    ])
    const agent = buildWasteTriageAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    const rejected = r.trace.steps.find((s) => s.type === 'tool_response' && s.toolName === 'set_org_policy')
    expect(rejected?.output).toMatchObject({ rejected: expect.stringContaining('not allowed') })
    expect(r.trace.steps.some((s) => s.type === 'llm_tool_use' && s.toolName === 'set_org_policy')).toBe(false)
    expect(r.paused).toBeDefined()
    expect(r.proposals).toHaveLength(0)
  })

  it('falls back to the deterministic procedure when the LLM loop errors', async () => {
    const llm = new StubLLMClient([extract])   // loop's first call exhausts the stub → throws → fallback
    const agent = buildWasteTriageAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.proposals.length).toBeGreaterThanOrEqual(1)
    expect(r.proposals.some((p) => p.action.type === 'WRITE_OFF')).toBe(true)
    expect(r.trace.steps.some((s) => s.blockName === 'propose_waste_actions')).toBe(true)
  })

  it('caps the loop and falls back when the model never finalizes', async () => {
    const spin: LLMResponse = { toolCalls: [{ toolName: 'query_recent_waste_logs', input: { variantId: IDS.varSalmonA, sinceDays: 14 }, thought: 'again' }], tokensUsed: 10 }
    const llm = new StubLLMClient([extract, ...Array.from({ length: 8 }, () => spin)])
    const agent = buildWasteTriageAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.trace.steps.some((s) => s.type === 'llm_output' && (s.output as { loopFailed?: string }).loopFailed?.includes('max iterations'))).toBe(true)
    expect(r.proposals.length).toBeGreaterThanOrEqual(1)   // deterministic fallback ran
  })
})
