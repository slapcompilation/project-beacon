import { describe, expect, it } from 'vitest'
import { decideAutoExecution, DEFAULT_AUTO_EXEC_POLICY, type AutoExecutionPolicy } from './index'
import { computeCalibration } from '../calibration/index'
import type { BeaconAction } from '../actions/types'
import type { ConstraintViolation } from './index'

const HOTEL = '22222222-2222-4222-8222-222222222222'
const VAR   = '11111111-1111-4111-8111-111111111111'
const USER  = '33333333-3333-4333-8333-333333333333'

const restock: BeaconAction = {
  type: 'REQUEST_RESTOCK', variantId: VAR, quantityNeeded: 10, hotelId: HOTEL, requestorId: USER,
}
const transfer: BeaconAction = {
  type: 'TRANSFER_STOCK', fromHotelId: HOTEL, toHotelId: 'h2', variantId: VAR, quantity: 5, reason: 'x',
}

const hardViolation: ConstraintViolation = { constraintId: 'c1', body: 'cap', bucket: 'threshold', severity: 'hard', message: 'over cap' }
const softViolation: ConstraintViolation = { constraintId: 'c2', body: 'cap', bucket: 'threshold', severity: 'soft', message: 'near cap' }

// Most suites here exercise gates OTHER than the release gate (which is
// fail-closed, Gap C), so they opt out of it. The release-gate block below
// overrides with allowUnreleased: false, and the fail-closed test calls
// decideAutoExecution directly.
const decide = (args: Parameters<typeof decideAutoExecution>[0]) => {
  const merged = { allowUnreleased: true, ...args }
  return decideAutoExecution(merged)
}

describe('decideAutoExecution', () => {
  it('auto-executes an eligible action above its floor with no hard violations', () => {
    const d = decide({ action: restock, confidence: 0.92, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(true)
    expect(d.reason).toContain('0.92')
  })

  it('queues an action whose type is not in the policy (never eligible)', () => {
    const d = decide({ action: transfer, confidence: 0.99, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(false)
    expect(d.reason).toContain('not eligible')
  })

  it('queues when confidence is below the floor', () => {
    const d = decide({ action: restock, confidence: 0.85, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(false)
    expect(d.reason).toContain('below')
  })

  it('queues on a hard constraint violation even when confident', () => {
    const d = decide({ action: restock, confidence: 0.99, violations: [hardViolation], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(false)
    expect(d.reason).toContain('hard constraint')
  })

  it('allows auto-execution despite a soft violation (surfaced, not blocked)', () => {
    const d = decide({ action: restock, confidence: 0.95, violations: [softViolation], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(true)
  })

  it('honors a custom policy with additional eligible types', () => {
    const policy: AutoExecutionPolicy = { thresholds: { REQUEST_RESTOCK: 0.9, TRANSFER_STOCK: 0.95 } }
    expect(decide({ action: transfer, confidence: 0.96, violations: [], policy }).autoExecute).toBe(true)
    expect(decide({ action: transfer, confidence: 0.94, violations: [], policy }).autoExecute).toBe(false)
  })

  it('exactly at the floor auto-executes (>= is inclusive)', () => {
    const d = decide({ action: restock, confidence: 0.9, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(true)
  })

  describe('release gate (Phase C step 2b)', () => {
    const agent = { agentName: 'restock_advisor', agentVersion: '1.0.0' }

    it('fail-closed: queues when release context is omitted (Gap C)', () => {
      // A caller that forgets to wire agent/releases is denied, not silently auto-executed.
      const d = decideAutoExecution({ action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('release context')
    })

    it('fail-closed: queues when agent is set but releases are missing', () => {
      const d = decideAutoExecution({ action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY, agent })
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('release context')
    })

    it('allowUnreleased opts out of the release gate', () => {
      const d = decideAutoExecution({ action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY, allowUnreleased: true })
      expect(d.autoExecute).toBe(true)
    })

    it('refuses to auto-execute when agent has no production release in scope', () => {
      const d = decide({
        action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, releases: { production: [] }, allowUnreleased: false,
      })
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('no production release')
      expect(d.reason).toContain('restock_advisor')
    })

    it('auto-executes when the agent has a production release', () => {
      const d = decide({
        action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, releases: { production: [{ agentName: 'restock_advisor', version: '1.0.0' }] }, allowUnreleased: false,
      })
      expect(d.autoExecute).toBe(true)
    })

    it('matches by agent name only — version mismatch still allows auto-exec', () => {
      // V1 is permissive on version (operator can upgrade in-place); a stricter
      // version gate would belong on the promotion step, not the runtime gate.
      const d = decide({
        action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, releases: { production: [{ agentName: 'restock_advisor', version: '0.9.5' }] }, allowUnreleased: false,
      })
      expect(d.autoExecute).toBe(true)
    })

    it('release gate is independent — other gates still fire first', () => {
      const d = decide({
        action: restock, confidence: 0.5, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, releases: { production: [] }, allowUnreleased: false,
      })
      // Below floor wins (no point checking release if confidence already kills it).
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('below')
    })
  })

  describe('per-agent overrides (Phase E3)', () => {
    const agent = { agentName: 'restock_advisor', agentVersion: '1.0.0' }

    it('agent override tightens the floor for that agent only', () => {
      const d = decide({
        action: restock, confidence: 0.91, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, agentOverrides: { restock_advisor: 0.95 },
      })
      // 0.91 clears the 0.9 type floor but not the 0.95 agent override.
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('agent floor 0.95')
    })

    it('agent override loosens the floor below the type threshold', () => {
      const d = decide({
        action: restock, confidence: 0.82, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, agentOverrides: { restock_advisor: 0.8 },
      })
      // 0.82 would fail the 0.9 type floor but the 0.8 override lets it through.
      expect(d.autoExecute).toBe(true)
    })

    it('agent override does not bypass action-type eligibility', () => {
      const d = decide({
        action: transfer, confidence: 0.99, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, agentOverrides: { restock_advisor: 0.5 },
      })
      // TRANSFER_STOCK still not in thresholds → ineligible regardless of override.
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('not eligible')
    })

    it('an override for a different agent does not affect this run', () => {
      const d = decide({
        action: restock, confidence: 0.91, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, agentOverrides: { waste_triage: 0.95 },
      })
      // Override applies only to waste_triage; restock_advisor uses type floor 0.9.
      expect(d.autoExecute).toBe(true)
    })
  })

  describe('calibration trust budget (Phase P2)', () => {
    // A resolved population at one confidence level → a reliability report.
    const pop = (confidence: number, hits: number, misses: number) =>
      computeCalibration([
        ...Array.from({ length: hits },   () => ({ confidence, status: 'approved' as const })),
        ...Array.from({ length: misses }, () => ({ confidence, status: 'rejected' as const })),
      ], { minSamples: 20 })

    it('vetoes a proven-overconfident agent even above the static floor', () => {
      // Claims ~0.9 but its 0.9-band hit-rate is 0.5 → queued despite clearing 0.9.
      const calibration = pop(0.92, 20, 20)
      const d = decide({ action: restock, confidence: 0.92, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY, calibration })
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('overconfident')
    })

    it('lets a proven well-calibrated agent auto-execute', () => {
      const calibration = pop(0.92, 38, 2)  // 0.9-band hit-rate 0.95 ≥ floor
      const d = decide({ action: restock, confidence: 0.92, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY, calibration })
      expect(d.autoExecute).toBe(true)
    })

    it('ignores calibration when not proven (permissive default falls back to floor)', () => {
      const calibration = pop(0.92, 5, 0)  // one class, few samples → not proven
      const d = decide({ action: restock, confidence: 0.92, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY, calibration })
      expect(d.autoExecute).toBe(true)
    })

    it('requireCalibration queues when there is no proven calibration', () => {
      const d = decide({ action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY, requireCalibration: true })
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('requires proven calibration')
    })

    it('requireCalibration allows a proven, well-calibrated agent', () => {
      const calibration = pop(0.92, 38, 2)
      const d = decide({ action: restock, confidence: 0.92, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY, requireCalibration: true, calibration })
      expect(d.autoExecute).toBe(true)
    })

    it('static gates still fire before the calibration veto', () => {
      const calibration = pop(0.92, 20, 20)  // would veto, but confidence is already below floor
      const d = decide({ action: restock, confidence: 0.5, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY, calibration })
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('below')
    })
  })
})
