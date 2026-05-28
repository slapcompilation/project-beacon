// Eval suite for restock_advisor v1.0.0.
// 10 historical cases covering the decision branches of the numbered procedure.
// Run: `pnpm --filter @beacon/reality-graph test`

import { describe, expect, it } from 'vitest'
import { buildRestockAdvisorAgent } from '../index'
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
  prompt: 'tomatoes running low',
  userId: IDS.user,
  scope: { hotelId: IDS.hotelA, organizationId: IDS.org },
}

describe('restock_advisor v1.0.0', () => {
  it('no gap when stock + open requests cover projected consumption', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 1000, par_level: 200 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(0)
    expect(result.paused).toBeUndefined()
  })

  it('skips proposal when an open restock request already covers the gap', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 20, par_level: 200 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })
    world.restockRequests = [
      {
        id: 'req-cover', variant_id: IDS.varTomatoesA, hotel_id: IDS.hotelA,
        quantity_needed: 500, status: 'pending',
        created_at: new Date().toISOString(),
      },
    ]
    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(0)
  })

  it('prefers TRANSFER_STOCK when a sister has ≥40% of the gap', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
      { id: IDS.varTomatoesB, hotel_id: IDS.hotelB, name: 'tomatoes', current_stock: 60, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    expect(result.proposals.length).toBeGreaterThanOrEqual(1)
    expect(result.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    if (result.proposals[0]?.action.type === 'TRANSFER_STOCK') {
      expect(result.proposals[0].action.fromHotelId).toBe(IDS.hotelB)
      expect(result.proposals[0].action.toHotelId).toBe(IDS.hotelA)
    }
  })

  it('picks the sister with the largest available stock when multiple qualify', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
      { id: IDS.varTomatoesB, hotel_id: IDS.hotelB, name: 'tomatoes', current_stock: 50, par_level: 100 },
      { id: IDS.varTomatoesC, hotel_id: IDS.hotelC, name: 'tomatoes', current_stock: 90, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    expect(result.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    if (result.proposals[0]?.action.type === 'TRANSFER_STOCK') {
      expect(result.proposals[0].action.fromHotelId).toBe(IDS.hotelC)
    }
  })

  it('combines TRANSFER_STOCK + REQUEST_RESTOCK when sister covers only part of the gap', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 200 },
      { id: IDS.varTomatoesB, hotel_id: IDS.hotelB, name: 'tomatoes', current_stock: 40, par_level: 200 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 14 })
    world.suppliers = [
      { id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 },
    ]

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(2)
    expect(result.proposals[0]?.action.type).toBe('TRANSFER_STOCK')
    expect(result.proposals[1]?.action.type).toBe('REQUEST_RESTOCK')
  })

  it('falls back to REQUEST_RESTOCK when no sister qualifies', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
      { id: IDS.varTomatoesB, hotel_id: IDS.hotelB, name: 'tomatoes', current_stock: 5, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })
    world.suppliers = [
      { id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 },
    ]

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0]?.action.type).toBe('REQUEST_RESTOCK')
  })

  it('picks the highest-scoring supplier when ranking multiple', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })
    world.suppliers = [
      { id: IDS.supplierSlow, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'BudgetCo', lead_time_days: 6, on_time_pct: 70, cost_variance_pct: 15 },
      { id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 },
    ]

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    const action = result.proposals[0]?.action
    expect(action?.type).toBe('REQUEST_RESTOCK')
    if (action?.type === 'REQUEST_RESTOCK') {
      expect(action.supplier).toBe('Sysco')
    }
  })

  it('marks urgency=high when remaining gap exceeds 60% of projected consumption', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 15 })
    world.suppliers = [
      { id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 },
    ]

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    const action = result.proposals[0]?.action
    if (action?.type === 'REQUEST_RESTOCK') {
      expect(action.urgency).toBe('high')
    }
  })

  it('every proposal carries non-empty reasoning + provenance', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })
    world.suppliers = [
      { id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 },
    ]
    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
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
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })
    world.suppliers = [
      { id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 },
    ]
    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    const toolUses = result.trace.steps.filter((s) => s.type === 'llm_tool_use')
    const toolResponses = result.trace.steps.filter((s) => s.type === 'tool_response')
    expect(toolUses.length).toBe(toolResponses.length)
    expect(toolUses.length).toBeGreaterThanOrEqual(3)
    for (const r of toolResponses) {
      expect(r.durationMs).toBeDefined()
      expect(r.toolName).toBeDefined()
    }
  })

  it('injects active operator Principles into proposal provenance + reasoning', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })
    world.suppliers = [
      { id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 },
    ]
    world.principles = [
      { id: 'pr-hotelwide', body: 'Prefer lateral transfers before external orders', category: 'inventory-policy' },
      { id: 'pr-scoped', body: 'Never over-order tomatoes past par x1.5', category: 'inventory-policy', appliesToNodeIds: [IDS.varTomatoesA] },
      { id: 'pr-other', body: 'Dairy: Sysco only', category: 'supplier-preference', appliesToNodeIds: ['some-other-variant'] },
    ]

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    expect(result.proposals.length).toBeGreaterThanOrEqual(1)

    for (const p of result.proposals) {
      const principleRefs = p.provenance.filter((x) => x.kind === 'principle').map((x) => x.ref)
      // hotel-wide + variant-scoped apply; the other-variant principle does not.
      expect(principleRefs).toContain('pr-hotelwide')
      expect(principleRefs).toContain('pr-scoped')
      expect(principleRefs).not.toContain('pr-other')
      expect(p.reasoning).toContain('Honored operator principle')
    }
  })

  it('omits principle provenance when none are active (unchanged behavior)', async () => {
    const world = baseWorld()
    world.variants = [
      { id: IDS.varTomatoesA, hotel_id: IDS.hotelA, name: 'tomatoes', current_stock: 0, par_level: 100 },
    ]
    world.stockLogs = dailyConsumptionLogs({ variantId: IDS.varTomatoesA, hotelId: IDS.hotelA, dailyUnits: 10 })
    world.suppliers = [
      { id: IDS.supplierFast, hotel_id: IDS.hotelA, organization_id: IDS.org, name: 'Sysco', lead_time_days: 2, on_time_pct: 95, cost_variance_pct: 3 },
    ]
    // world.principles left empty

    const agent = buildRestockAdvisorAgent({
      llm: scriptedLLM({ variantId: IDS.varTomatoesA, variantName: 'tomatoes' }),
      reader: makeReader(world),
    })
    const result = await agent.run(baseInput)
    for (const p of result.proposals) {
      expect(p.provenance.some((x) => x.kind === 'principle')).toBe(false)
      expect(p.reasoning).not.toContain('Honored operator principle')
    }
  })
})
