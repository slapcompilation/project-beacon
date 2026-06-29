import { describe, expect, it } from 'vitest'
import { simulateCycleWithOverlay, diffSimulations } from './simulate'
import { DEFAULT_AUTO_EXEC_POLICY } from '../constraints/index'
import type { AgentProposal } from '../agents/index'

const variants = [
  { id: 'v1', name: 'tomatoes' },
  { id: 'v2', name: 'onions' },
]

const HOTEL = '11111111-1111-4111-8111-111111111111'
const USER  = '22222222-2222-4222-8222-222222222222'

function mockProposal(variantId: string, confidence: number): AgentProposal {
  return {
    action: { type: 'REQUEST_RESTOCK', variantId, quantityNeeded: 5, hotelId: HOTEL, requestorId: USER },
    confidence,
    reasoning: 'stub',
    provenance: [],
  }
}

describe('simulateCycleWithOverlay', () => {
  it('runs the cycle with no-op persistence — returns outcomes but never writes', async () => {
    const proposalsByVariant: Record<string, AgentProposal[]> = {
      v1: [mockProposal('v1', 0.95)],  // above the 0.9 floor → auto-exec
      v2: [mockProposal('v2', 0.85)],  // below the 0.9 floor → queued
    }
    const result = await simulateCycleWithOverlay({
      variants,
      constraints: [],
      policy: DEFAULT_AUTO_EXEC_POLICY,
      runAgent: (v) => Promise.resolve(proposalsByVariant[v.id] ?? []),
    })
    expect(result.scanned).toBe(2)
    expect(result.proposed).toBe(2)
    expect(result.autoExecuted).toBe(1)
    expect(result.queued).toBe(1)
    expect(result.items).toHaveLength(2)
  })

  it('synthetic proposal ids stay sim:* across multiple proposals', async () => {
    const result = await simulateCycleWithOverlay({
      variants,
      constraints: [],
      policy: DEFAULT_AUTO_EXEC_POLICY,
      runAgent: () => Promise.resolve([mockProposal('v1', 0.95)]),
    })
    for (const item of result.items) {
      if (item.proposalId) expect(item.proposalId.startsWith('sim:')).toBe(true)
    }
  })
})

describe('diffSimulations', () => {
  const ranAt = '2026-06-06T00:00:00Z'
  const baseline = {
    scanned: 2, proposed: 2, autoExecuted: 2, queued: 0, deduped: 0, ranAt,
    items: [
      { variantId: 'v1', variantName: 'tomatoes', outcome: 'auto-executed' as const },
      { variantId: 'v2', variantName: 'onions',   outcome: 'auto-executed' as const },
    ],
  }
  const overlay = {
    scanned: 2, proposed: 2, autoExecuted: 1, queued: 1, deduped: 0, ranAt,
    items: [
      { variantId: 'v1', variantName: 'tomatoes', outcome: 'auto-executed' as const },
      { variantId: 'v2', variantName: 'onions',   outcome: 'queued' as const },
    ],
  }

  it('counts the absolute delta on auto-exec + queued', () => {
    const delta = diffSimulations(baseline, overlay)
    expect(delta.autoExecutedDelta).toBe(-1)
    expect(delta.queuedDelta).toBe(1)
  })

  it('flips list only includes variants whose outcome changed', () => {
    const delta = diffSimulations(baseline, overlay)
    expect(delta.flips).toEqual([
      { variantId: 'v2', variantName: 'onions', baseline: 'auto-executed', overlay: 'queued' },
    ])
  })

  it('empty flips when nothing changed', () => {
    const delta = diffSimulations(baseline, baseline)
    expect(delta.flips).toEqual([])
    expect(delta.autoExecutedDelta).toBe(0)
    expect(delta.queuedDelta).toBe(0)
  })
})
