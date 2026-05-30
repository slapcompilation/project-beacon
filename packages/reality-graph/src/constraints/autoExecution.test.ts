import { describe, expect, it } from 'vitest'
import { decideAutoExecution, DEFAULT_AUTO_EXEC_POLICY, type AutoExecutionPolicy } from './index'
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

describe('decideAutoExecution', () => {
  it('auto-executes an eligible action above its floor with no hard violations', () => {
    const d = decideAutoExecution({ action: restock, confidence: 0.92, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(true)
    expect(d.reason).toContain('0.92')
  })

  it('queues an action whose type is not in the policy (never eligible)', () => {
    const d = decideAutoExecution({ action: transfer, confidence: 0.99, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(false)
    expect(d.reason).toContain('not eligible')
  })

  it('queues when confidence is below the floor', () => {
    const d = decideAutoExecution({ action: restock, confidence: 0.85, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(false)
    expect(d.reason).toContain('below')
  })

  it('queues on a hard constraint violation even when confident', () => {
    const d = decideAutoExecution({ action: restock, confidence: 0.99, violations: [hardViolation], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(false)
    expect(d.reason).toContain('hard constraint')
  })

  it('allows auto-execution despite a soft violation (surfaced, not blocked)', () => {
    const d = decideAutoExecution({ action: restock, confidence: 0.95, violations: [softViolation], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(true)
  })

  it('honors a custom policy with additional eligible types', () => {
    const policy: AutoExecutionPolicy = { thresholds: { REQUEST_RESTOCK: 0.9, TRANSFER_STOCK: 0.95 } }
    expect(decideAutoExecution({ action: transfer, confidence: 0.96, violations: [], policy }).autoExecute).toBe(true)
    expect(decideAutoExecution({ action: transfer, confidence: 0.94, violations: [], policy }).autoExecute).toBe(false)
  })

  it('exactly at the floor auto-executes (>= is inclusive)', () => {
    const d = decideAutoExecution({ action: restock, confidence: 0.9, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
    expect(d.autoExecute).toBe(true)
  })

  describe('release gate (Phase C step 2b)', () => {
    const agent = { agentName: 'restock_advisor', agentVersion: '1.0.0' }

    it('skipped when release context omitted (backward compat)', () => {
      const d = decideAutoExecution({ action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY })
      expect(d.autoExecute).toBe(true)
    })

    it('refuses to auto-execute when agent has no production release in scope', () => {
      const d = decideAutoExecution({
        action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, releases: { production: [] },
      })
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('no production release')
      expect(d.reason).toContain('restock_advisor')
    })

    it('auto-executes when the agent has a production release', () => {
      const d = decideAutoExecution({
        action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, releases: { production: [{ agentName: 'restock_advisor', version: '1.0.0' }] },
      })
      expect(d.autoExecute).toBe(true)
    })

    it('matches by agent name only — version mismatch still allows auto-exec', () => {
      // V1 is permissive on version (operator can upgrade in-place); a stricter
      // version gate would belong on the promotion step, not the runtime gate.
      const d = decideAutoExecution({
        action: restock, confidence: 0.95, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, releases: { production: [{ agentName: 'restock_advisor', version: '0.9.5' }] },
      })
      expect(d.autoExecute).toBe(true)
    })

    it('release gate is independent — other gates still fire first', () => {
      const d = decideAutoExecution({
        action: restock, confidence: 0.5, violations: [], policy: DEFAULT_AUTO_EXEC_POLICY,
        agent, releases: { production: [] },
      })
      // Below floor wins (no point checking release if confidence already kills it).
      expect(d.autoExecute).toBe(false)
      expect(d.reason).toContain('below')
    })
  })
})
