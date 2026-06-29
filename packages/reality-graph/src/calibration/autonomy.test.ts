import { describe, it, expect } from 'vitest'
import { recommendAutonomy, DEFAULT_AUTONOMY_CONFIG, type CalibrationReport } from './index'

function report(over: Partial<CalibrationReport> = {}): CalibrationReport {
  return {
    bins: [], resolved: 40, excluded: { expired: 0, pending: 0 },
    meanConfidence: 0.9, accuracy: 0.9, ece: 0.03, brier: 0.08,
    verdict: 'well-calibrated', sufficientData: true, confidence: 0.9,
    ...over,
  } as CalibrationReport
}

const C = DEFAULT_AUTONOMY_CONFIG

describe('recommendAutonomy', () => {
  it('loosens a well-calibrated agent from the baseline floor', () => {
    const recs = recommendAutonomy([{ key: 'restock_advisor', report: report() }], {})
    expect(recs).toHaveLength(1)
    expect(recs[0].kind).toBe('loosen')
    expect(recs[0].currentFloor).toBe(C.baselineFloor)        // 0.9
    expect(recs[0].proposedFloor).toBe(0.85)                  // 0.9 - step
  })

  it('tightens a proven-overconfident agent', () => {
    const recs = recommendAutonomy(
      [{ key: 'a', report: report({ verdict: 'overconfident', accuracy: 0.7, meanConfidence: 0.92 }) }],
      { a: 0.9 },
    )
    expect(recs[0].kind).toBe('tighten')
    expect(recs[0].proposedFloor).toBe(0.95)
  })

  it('respects an existing override as the current floor', () => {
    const recs = recommendAutonomy([{ key: 'a', report: report() }], { a: 0.8 })
    expect(recs[0].currentFloor).toBe(0.8)
    expect(recs[0].proposedFloor).toBe(0.75)
  })

  it('never loosens below floorMin', () => {
    const recs = recommendAutonomy([{ key: 'a', report: report() }], { a: C.floorMin })
    expect(recs).toHaveLength(0)   // already at the hard floor → no change
  })

  it('never tightens above floorMax', () => {
    const recs = recommendAutonomy(
      [{ key: 'a', report: report({ verdict: 'overconfident' }) }],
      { a: C.floorMax },
    )
    expect(recs).toHaveLength(0)
  })

  it('makes no recommendation without sufficient data', () => {
    expect(recommendAutonomy([{ key: 'a', report: report({ sufficientData: false }) }], {})).toHaveLength(0)
  })

  it('makes no recommendation below minSamples', () => {
    expect(recommendAutonomy([{ key: 'a', report: report({ resolved: 5 }) }], {})).toHaveLength(0)
  })

  it('leaves underconfident and insufficient-data agents alone', () => {
    expect(recommendAutonomy([{ key: 'a', report: report({ verdict: 'underconfident' }) }], {})).toHaveLength(0)
    expect(recommendAutonomy([{ key: 'a', report: report({ verdict: 'insufficient-data', sufficientData: false }) }], {})).toHaveLength(0)
  })

  it('carries metrics + rationale for the operator', () => {
    const [rec] = recommendAutonomy([{ key: 'restock_advisor', report: report({ resolved: 50 }) }], {})
    expect(rec.resolved).toBe(50)
    expect(rec.rationale).toContain('Well-calibrated')
  })

  describe('enabling a queue-only action type (agentContext)', () => {
    it('recommends ENABLE for a proven agent whose type is off but is in production', () => {
      const recs = recommendAutonomy(
        [{ key: 'waste_triage', report: report() }], {}, {},
        { waste_triage: { actionType: 'WRITE_OFF', enabled: false, hasProductionRelease: true } },
      )
      expect(recs).toHaveLength(1)
      expect(recs[0].kind).toBe('enable')
      expect(recs[0].actionType).toBe('WRITE_OFF')
      expect(recs[0].proposedFloor).toBe(C.baselineFloor)   // 0.9
      expect(recs[0].rationale).toContain('WRITE_OFF')
    })

    it('makes no recommendation to enable without a production release', () => {
      const recs = recommendAutonomy(
        [{ key: 'waste_triage', report: report() }], {}, {},
        { waste_triage: { actionType: 'WRITE_OFF', enabled: false, hasProductionRelease: false } },
      )
      expect(recs).toHaveLength(0)
    })

    it('loosens (not enables) once the type is already enabled', () => {
      const recs = recommendAutonomy(
        [{ key: 'waste_triage', report: report() }], {}, {},
        { waste_triage: { actionType: 'WRITE_OFF', enabled: true, hasProductionRelease: true } },
      )
      expect(recs[0].kind).toBe('loosen')
    })

    it('does not tighten a queue-only type even if overconfident', () => {
      const recs = recommendAutonomy(
        [{ key: 'waste_triage', report: report({ verdict: 'overconfident' }) }], { waste_triage: 0.9 }, {},
        { waste_triage: { actionType: 'WRITE_OFF', enabled: false, hasProductionRelease: true } },
      )
      expect(recs).toHaveLength(0)
    })
  })
})
