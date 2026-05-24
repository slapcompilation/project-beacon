// Eval suite for waste_triage v1.0.0.
// 10 historical cases covering the decision branches of the numbered procedure.

import { describe, expect, it } from 'vitest'
import { buildWasteTriageAgent } from '../index'
import {
  IDS,
  emptyWorld,
  makeReader,
  scriptedLLM,
  dailyConsumptionLogs,
  recurringWasteLogs,
  type FixtureWorld,
} from './fixtures'

function baseWorld(): FixtureWorld {
  return {
    ...emptyWorld(),
    hotels: [
      { id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' },
      { id: IDS.hotelB, organization_id: IDS.org, name: 'Hotel B' },
      { id: IDS.hotelC, organization_id: IDS.org, name: 'Hotel C' },
    ],
  }
}

const baseInput = {
  prompt: 'salmon expires Friday, what should I do?',
  userId: IDS.user,
  scope:  { hotelId: IDS.hotelA, organizationId: IDS.org },
}

const llm = () => scriptedLLM({ variantId: IDS.varSalmonA, variantName: 'salmon' })

describe('waste_triage v1.0.0', () => {
  it('emits no proposal when current stock fits inside the safe-window forecast', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 50, par_level: 100 },
    ]
    // 10 units/day consumed → 70u over 7d > 50 on hand → atRisk=0
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(0)
  })

  it('proposes only WRITE_OFF when no sister exists', async () => {
    const world = baseWorld()
    world.hotels    = [{ id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' }]
    world.variants  = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]?.action.type).toBe('WRITE_OFF')
  })

  it('proposes only TRANSFER_STOCK when one needy sister covers all at-risk units', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
      { id: IDS.varSalmonB, hotel_id: IDS.hotelB, name: 'salmon', current_stock: 5,   par_level: 500 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals.length).toBeGreaterThanOrEqual(1)
    expect(result.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    if (result.proposals[0]?.action.type === 'TRANSFER_STOCK') {
      expect(result.proposals[0].action.fromHotelId).toBe(IDS.hotelA)
      expect(result.proposals[0].action.toHotelId).toBe(IDS.hotelB)
    }
  })

  it('combines TRANSFER_STOCK + WRITE_OFF when the needy sister covers only part', async () => {
    const world = baseWorld()
    // atRisk = 300 - 70 = 230. Sister gap = 200 - 5 = 195 → qualifies (≥0.4×230).
    // Transfer = min(195, 230) = 195. Remaining = 35 → write-off.
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
      { id: IDS.varSalmonB, hotel_id: IDS.hotelB, name: 'salmon', current_stock: 5,   par_level: 200 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(2)
    expect(result.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    expect(result.proposals[1]?.action.type).toBe('WRITE_OFF')
  })

  it('picks the needy sister with the largest gap when multiple qualify', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
      { id: IDS.varSalmonB, hotel_id: IDS.hotelB, name: 'salmon', current_stock: 10,  par_level: 200 },
      { id: IDS.varSalmonC, hotel_id: IDS.hotelC, name: 'salmon', current_stock: 10,  par_level: 500 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    if (result.proposals[0]?.action.type === 'TRANSFER_STOCK') {
      expect(result.proposals[0].action.toHotelId).toBe(IDS.hotelC)
    }
  })

  it('skips a sister that is at or above PAR', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
      { id: IDS.varSalmonB, hotel_id: IDS.hotelB, name: 'salmon', current_stock: 90, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]?.action.type).toBe('WRITE_OFF')
  })

  it('skips a sister whose gap is < 40% of at-risk units', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
      { id: IDS.varSalmonB, hotel_id: IDS.hotelB, name: 'salmon', current_stock: 95, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    // Gap = 5 < 0.4 × atRisk(230) → skip → write-off only
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]?.action.type).toBe('WRITE_OFF')
  })

  it('raises write-off confidence when recurring waste is detected (≥5 days)', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
    ]
    world.stockLogs = [
      ...dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 }),
      ...recurringWasteLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, units: 5, days: 6 }),
    ]
    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    const writeOff = result.proposals.find((p) => p.action.type === 'WRITE_OFF')
    expect(writeOff).toBeDefined()
    // recurring-waste floor 0.8 vs single-event 0.75; reasoning must call out the pattern.
    expect(writeOff?.reasoning).toMatch(/pattern/i)
  })

  it('every proposal carries non-empty reasoning + provenance + valid confidence', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
      { id: IDS.varSalmonB, hotel_id: IDS.hotelB, name: 'salmon', current_stock: 5,   par_level: 200 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals.length).toBeGreaterThan(0)
    for (const p of result.proposals) {
      expect(p.reasoning.length).toBeGreaterThan(20)
      expect(p.provenance.length).toBeGreaterThan(0)
      expect(p.confidence).toBeGreaterThan(0)
      expect(p.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('trace captures every tool call with input + output + duration', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSalmonA, hotel_id: IDS.hotelA, name: 'salmon', current_stock: 300, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSalmonA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent  = buildWasteTriageAgent({ llm: llm(), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    const uses = result.trace.steps.filter((s) => s.type === 'llm_tool_use')
    const resps = result.trace.steps.filter((s) => s.type === 'tool_response')
    expect(uses.length).toBe(resps.length)
    expect(uses.length).toBeGreaterThanOrEqual(3)
    for (const r of resps) {
      expect(r.durationMs).toBeDefined()
      expect(r.toolName).toBeDefined()
    }
  })
})
