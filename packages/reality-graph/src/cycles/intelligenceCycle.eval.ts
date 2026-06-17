// Behavior eval (corrections #8): the calibration veto changes an agent-run
// outcome. The same confident, uncontested proposal auto-executes on its own but
// is QUEUED once the proposing agent's calibration proves it overconfident at
// that confidence — proving the trust budget is wired into the cycle, not just
// unit-tested on decideAutoExecution in isolation.

import { describe, expect, it, vi } from 'vitest'
import { runIntelligenceCycle, type IntelligenceCycleDeps, type CycleVariant } from './intelligenceCycle'
import { computeCalibration, type CalibrationReport } from '../calibration/index'
import type { AgentProposal } from '../agents/index'

const HOTEL = '21111111-1111-4111-8111-111111111111'
const USER  = '31111111-1111-4111-8111-111111111111'
const VAR: CycleVariant = { id: '41111111-1111-4111-8111-111111111111', name: 'Tomatoes' }

// A confident, uncontested restock that clears the 0.9 floor on its own.
function proposal(confidence = 0.95): AgentProposal {
  return {
    action: { type: 'REQUEST_RESTOCK', variantId: VAR.id, quantityNeeded: 10, hotelId: HOTEL, requestorId: USER },
    confidence, reasoning: 'test', provenance: [],
  }
}

// A resolved population at ~0.92 → a reliability report. 20/20 = overconfident
// (band hit-rate 0.5 < 0.9 floor); 38/2 = well-calibrated (0.95 ≥ floor).
function calib(hits: number, misses: number): CalibrationReport {
  return computeCalibration([
    ...Array.from({ length: hits },   () => ({ confidence: 0.92, status: 'approved' as const })),
    ...Array.from({ length: misses }, () => ({ confidence: 0.92, status: 'rejected' as const })),
  ], { minSamples: 20 })
}

function makeDeps(over: Partial<IntelligenceCycleDeps> = {}) {
  const dispatch = vi.fn(() => Promise.resolve(true))
  const markApproved = vi.fn(() => Promise.resolve())
  const deps: IntelligenceCycleDeps = {
    variants: [VAR],
    constraints: [],
    runAgent: () => Promise.resolve([proposal()]),
    persistProposal: () => Promise.resolve('p1'),
    dispatch,
    markApproved,
    now: () => new Date('2026-05-29T12:00:00Z'),
    ...over,
  }
  return { deps, dispatch, markApproved }
}

describe('intelligence cycle — calibration veto changes the outcome', () => {
  it('auto-executes the proposal with no calibration supplied (baseline)', async () => {
    const { deps, dispatch } = makeDeps()
    const result = await runIntelligenceCycle(deps)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ autoExecuted: 1, queued: 0 })
    expect(result.items[0].outcome).toBe('auto-executed')
  })

  it('QUEUES the same proposal once the agent is proven overconfident', async () => {
    const { deps, dispatch, markApproved } = makeDeps({ calibration: calib(20, 20) })
    const result = await runIntelligenceCycle(deps)
    expect(dispatch).not.toHaveBeenCalled()        // the behavior change
    expect(markApproved).not.toHaveBeenCalled()
    expect(result).toMatchObject({ autoExecuted: 0, queued: 1 })
    expect(result.items[0].outcome).toBe('queued')
    expect(result.items[0].reason).toContain('overconfident')
  })

  it('still auto-executes when the agent is proven well-calibrated', async () => {
    const { deps, dispatch } = makeDeps({ calibration: calib(38, 2) })
    const result = await runIntelligenceCycle(deps)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({ autoExecuted: 1, queued: 0 })
  })

  it('requireCalibration queues when there is no proven evidence yet', async () => {
    const { deps, dispatch } = makeDeps({ requireCalibration: true })
    const result = await runIntelligenceCycle(deps)
    expect(dispatch).not.toHaveBeenCalled()
    expect(result).toMatchObject({ autoExecuted: 0, queued: 1 })
    expect(result.items[0].reason).toContain('requires proven calibration')
  })
})
