// Eval suite for overstock_rebalancer v1.0.0.
// 12 cases covering the decision branches of the numbered procedure.
// Run: `pnpm --filter @beacon/reality-graph test`

import { describe, expect, it } from 'vitest'
import { buildOverstockRebalancerAgent } from '../index'
import {
  IDS,
  emptyWorld,
  makeReader,
  scriptedLLM,
  dailyConsumptionLogs,
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
  prompt: 'we are sitting on way too much sugar',
  userId: IDS.user,
  scope: { hotelId: IDS.hotelA, organizationId: IDS.org },
}

// burn 2/day over 30d → projectedUnits(30d) = 60, conf 0.85. Overstock gate
// (x2) = 120: a variant must hold ≥120 before any units count as surplus.
function burn2(variantId: string) {
  return dailyConsumptionLogs({ variantId, hotelId: IDS.hotelA, dailyUnits: 2 })
}

describe('overstock_rebalancer v1.0.0', () => {
  it('no proposal when stock is within 2× the projected need (not overstock)', async () => {
    const world = baseWorld()
    world.variants = [{ id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 100, par_level: 50 }]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(0)
  })

  it('proposes TRANSFER_STOCK to a needy sister when genuinely overstocked', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 },
    ]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(1)
    const action = result.proposals[0]?.action
    expect(action?.type).toBe('TRANSFER_STOCK')
    if (action?.type === 'TRANSFER_STOCK') {
      expect(action.fromHotelId).toBe(IDS.hotelA)
      expect(action.toHotelId).toBe(IDS.hotelB)
      // gap = 100-10 = 90; surplus = 200-60 = 140; floor = 140 → min = 90
      expect(action.quantity).toBe(90)
    }
  })

  it('no proposal when overstocked but no sister is below par×0.5', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 80, par_level: 100 },
    ]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(0)
  })

  it('targets the sister with the largest gap when multiple qualify', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 30, par_level: 100 }, // gap 70
      { id: IDS.varSugarC, hotel_id: IDS.hotelC, name: 'sugar', current_stock: 10, par_level: 100 }, // gap 90
    ]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    const action = result.proposals[0]?.action
    if (action?.type === 'TRANSFER_STOCK') {
      expect(action.toHotelId).toBe(IDS.hotelC)
    }
  })

  it('caps transfer so the source never drops below its projected need', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 130, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 }, // gap 90
    ]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    const action = result.proposals[0]?.action
    expect(action?.type).toBe('TRANSFER_STOCK')
    if (action?.type === 'TRANSFER_STOCK') {
      // surplus = 130-60 = 70; floor = 130-60 = 70; gap 90 → min = 70.
      expect(action.quantity).toBe(70)
      // source retains 130-70 = 60 = projected 30d need.
    }
  })

  it('pauses for clarification when forecast confidence is below threshold', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 },
    ]
    // Only 5 days of logs → confidence ≈ 0.43 < 0.6.
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varSugarA, hotelId: IDS.hotelA, dailyUnits: 2, days: 5 })
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(0)
    expect(result.paused).toBeDefined()
    expect(result.paused?.currentConfidence).toBeLessThan(0.6)
  })

  it('no proposal when the hotel has no sister properties', async () => {
    const world = { ...emptyWorld(), hotels: [{ id: IDS.hotelA, organization_id: IDS.org, name: 'Hotel A' }] }
    world.variants = [{ id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 }]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(0)
  })

  it('returns no proposals when the variant cannot be resolved', async () => {
    const world = baseWorld() // no variants seeded → getVariant returns null
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(0)
  })

  it('injects active operator Principles into provenance + reasoning', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 },
    ]
    world.stockLogs = burn2(IDS.varSugarA)
    world.principles = [
      { id: 'pr-1', body: 'Keep at least 2 weeks cover at every property', category: 'inventory-policy' },
    ]
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(1)
    const refs = result.proposals[0]?.provenance.filter((x) => x.kind === 'principle').map((x) => x.ref)
    expect(refs).toContain('pr-1')
    expect(result.proposals[0]?.reasoning).toContain('Honored operator principle')
  })

  it('omits principle provenance when none are active', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 },
    ]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    expect(result.proposals[0]?.provenance.some((x) => x.kind === 'principle')).toBe(false)
  })

  it('every proposal carries non-empty reasoning + provenance + valid confidence', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 },
    ]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    for (const p of result.proposals) {
      expect(p.reasoning.length).toBeGreaterThan(20)
      expect(p.provenance.length).toBeGreaterThan(0)
      expect(p.confidence).toBeGreaterThan(0)
      expect(p.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('trace captures every tool call with input + output', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varSugarA, hotel_id: IDS.hotelA, name: 'sugar', current_stock: 200, par_level: 50 },
      { id: IDS.varSugarB, hotel_id: IDS.hotelB, name: 'sugar', current_stock: 10, par_level: 100 },
    ]
    world.stockLogs = burn2(IDS.varSugarA)
    const agent = buildOverstockRebalancerAgent({ llm: scriptedLLM({ variantId: IDS.varSugarA, variantName: 'sugar' }), reader: makeReader(world) })
    const result = await agent.run(baseInput)
    const toolUses = result.trace.steps.filter((s) => s.type === 'llm_tool_use')
    const toolResponses = result.trace.steps.filter((s) => s.type === 'tool_response')
    expect(toolUses.length).toBe(toolResponses.length)
    expect(toolUses.length).toBeGreaterThanOrEqual(2)
  })
})
