// Safety + mechanics of the LLM tool-loop reasoning path (reasoning: 'llm') for
// overstock_rebalancer. The StubLLM scripts the model's turns; the tools run for
// real against the fixture world. Proves: the model can orchestrate tools → a
// typed TRANSFER_STOCK proposal; a disallowed tool is rejected (not executed);
// any loop failure falls back to the deterministic procedure; the cap holds.

import { describe, expect, it } from 'vitest'
import { buildOverstockRebalancerAgent } from '../index'
import { IDS, emptyWorld, makeReader, dailyConsumptionLogs, type FixtureWorld } from './fixtures'
import { StubLLMClient, type LLMResponse } from '../../llm'

// varSugarA genuinely overstocked (200 on hand, burns 2/day → 60 over 30d, gate
// ×2 = 120); varSugarB needy below par×0.5 (10/100). Single extract block.
function world(): FixtureWorld {
  return {
    ...emptyWorld(),
    hotels: [
      { id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' },
      { id: IDS.hotelB, organization_id: IDS.org, name: 'Hotel B' },
    ],
    variants: [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 },
    ],
    stockLogs: dailyConsumptionLogs({ variantId: IDS.varSugarA, hotelId: IDS.hotelA, dailyUnits: 2 }),
  }
}

const extract: LLMResponse = { output: { variantId: IDS.varSugarA, variantName: 'sugar', confidence: 0.9 }, toolCalls: [], tokensUsed: 120 }
const baseInput = { prompt: 'sitting on too much sugar', userId: IDS.user, scope: { hotelId: IDS.hotelA, organizationId: IDS.org } }

const validTransfer = {
  proposals: [{
    action: { type: 'TRANSFER_STOCK', fromHotelId: IDS.hotelA, toHotelId: IDS.hotelB, variantId: IDS.varSugarA, quantity: 90, reason: 'Rebalance 90 surplus units to Hotel B.' },
    confidence: 0.82,
    reasoning: 'forecast_consumption: projected 60u over 30d → surplus. query_sister_property_inventory: Hotel B gap 90 → transfer 90.',
    provenance: [{ kind: 'tool', ref: 'forecast_consumption' }, { kind: 'tool', ref: 'query_sister_property_inventory' }],
  }],
  paused: null,
}

describe('overstock_rebalancer — LLM tool-loop reasoning', () => {
  it('the model orchestrates tool calls then emits a typed TRANSFER_STOCK proposal', async () => {
    const llm = new StubLLMClient([
      extract,
      { toolCalls: [{ toolName: 'forecast_consumption', input: { variantId: IDS.varSugarA, horizonDays: 30 }, thought: 'size the surplus' }], tokensUsed: 50 },
      { toolCalls: [{ toolName: 'query_sister_property_inventory', input: { variantId: IDS.varSugarA, variantName: 'sugar', hotelId: IDS.hotelA }, thought: 'find a needy sister' }], tokensUsed: 50 },
      { output: validTransfer, toolCalls: [], tokensUsed: 80 },
    ])
    const agent = buildOverstockRebalancerAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.proposals).toHaveLength(1)
    expect(r.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    const call = r.trace.steps.find((s) => s.type === 'llm_tool_use' && s.toolName === 'forecast_consumption')
    expect(call?.thought).toBe('size the surplus')
    expect(r.trace.steps.some((s) => s.type === 'tool_response' && s.toolName === 'query_sister_property_inventory')).toBe(true)
  })

  it('rejects a disallowed tool call without executing it, then continues', async () => {
    const llm = new StubLLMClient([
      extract,
      { toolCalls: [{ toolName: 'set_org_policy', input: { evil: true }, thought: 'escalate privileges' }], tokensUsed: 30 },
      { output: { proposals: [], paused: { question: 'blocked — need guidance', contextSummary: 'sugar', currentConfidence: 0.4 } }, toolCalls: [], tokensUsed: 40 },
    ])
    const agent = buildOverstockRebalancerAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    const rejected = r.trace.steps.find((s) => s.type === 'tool_response' && s.toolName === 'set_org_policy')
    expect(rejected?.output).toMatchObject({ rejected: expect.stringContaining('not allowed') })
    expect(r.trace.steps.some((s) => s.type === 'llm_tool_use' && s.toolName === 'set_org_policy')).toBe(false)
    expect(r.paused).toBeDefined()
    expect(r.proposals).toHaveLength(0)
  })

  it('falls back to the deterministic procedure when the LLM loop errors', async () => {
    const llm = new StubLLMClient([extract])   // loop's first call exhausts the stub → throws → fallback
    const agent = buildOverstockRebalancerAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.proposals.length).toBeGreaterThanOrEqual(1)
    expect(r.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    expect(r.trace.steps.some((s) => s.blockName === 'reason_and_rebalance')).toBe(true)
  })

  it('caps the loop and falls back when the model never finalizes', async () => {
    const spin: LLMResponse = { toolCalls: [{ toolName: 'forecast_consumption', input: { variantId: IDS.varSugarA, horizonDays: 30 }, thought: 'again' }], tokensUsed: 10 }
    const llm = new StubLLMClient([extract, ...Array.from({ length: 8 }, () => spin)])
    const agent = buildOverstockRebalancerAgent({ llm, reader: makeReader(world()), reasoning: 'llm' })
    const r = await agent.run(baseInput)

    expect(r.trace.steps.some((s) => s.type === 'llm_output' && (s.output as { loopFailed?: string }).loopFailed?.includes('max iterations'))).toBe(true)
    expect(r.proposals.length).toBeGreaterThanOrEqual(1)   // deterministic fallback ran
  })
})
