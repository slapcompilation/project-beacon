import { describe, expect, it } from 'vitest'
import {
  makeComputeDecisionCalibrationTool,
  type CalibrationReader,
  type CalibrationProposalRef,
} from './compute_decision_calibration'

const HOTEL = '00000000-0000-0000-0000-000000000000'

function readerOf(rows: CalibrationProposalRef[], capture?: (f: unknown) => void): CalibrationReader {
  return {
    getResolvedProposals: async (filter) => { capture?.(filter); return rows },
  }
}

describe('compute_decision_calibration tool', () => {
  it('is a versioned logic tool that never writes', () => {
    const t = makeComputeDecisionCalibrationTool(readerOf([]))
    expect(t.name).toBe('compute_decision_calibration')
    expect(t.category).toBe('logic')
    expect(t.version).toBe('1.0.0')
  })

  it('passes the scope filter through to the reader', async () => {
    let seen: unknown
    const t = makeComputeDecisionCalibrationTool(readerOf([], (f) => { seen = f }))
    await t.invoke({ hotelId: HOTEL, agentName: 'restock_advisor', windowDays: 30 })
    expect(seen).toMatchObject({ hotelId: HOTEL, agentName: 'restock_advisor', windowDays: 30 })
  })

  it('reports overconfidence and stamps the basis', async () => {
    const rows: CalibrationProposalRef[] = [
      ...Array.from({ length: 20 }, () => ({ confidence: 0.9, status: 'approved' as const })),
      ...Array.from({ length: 20 }, () => ({ confidence: 0.9, status: 'rejected' as const })),
    ]
    const out = await makeComputeDecisionCalibrationTool(readerOf(rows)).invoke({ hotelId: HOTEL, minSamples: 20 })
    expect(out.verdict).toBe('overconfident')
    expect(out.basis).toBe('reliability-bins-v1')
    expect(out.confidence).toBeGreaterThan(0)
    expect(out.accuracy).toBeCloseTo(0.5, 5)
  })

  it('returns insufficient-data honestly when there are no resolved proposals', async () => {
    const out = await makeComputeDecisionCalibrationTool(readerOf([])).invoke({ hotelId: HOTEL })
    expect(out.verdict).toBe('insufficient-data')
    expect(out.resolved).toBe(0)
  })
})
