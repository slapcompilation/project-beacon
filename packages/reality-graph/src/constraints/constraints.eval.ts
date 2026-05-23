// Eval suite for the constraint evaluator.
// Pure function; deterministic; covers all four buckets + isAutoExecutable.

import { describe, expect, it } from 'vitest'
import { evaluateConstraints, isAutoExecutable, type ConstraintRecord } from './index'
import type { BeaconAction } from '../actions/types'

const baseRestock: BeaconAction = {
  type: 'REQUEST_RESTOCK',
  variantId: '11111111-1111-4111-8111-111111111111',
  quantityNeeded: 100,
  hotelId: '22222222-2222-4222-8222-222222222222',
  requestorId: '33333333-3333-4333-8333-333333333333',
}

function constraint(partial: Partial<ConstraintRecord> & Pick<ConstraintRecord, 'typedRule'>): ConstraintRecord {
  const { typedRule, ...rest } = partial
  return {
    id: 'c-' + Math.random().toString(36).slice(2, 8),
    body: 'test rule',
    bucket: typedRule.bucket,
    severity: 'hard',
    appliesToActionTypes: [],
    active: true,
    ...rest,
    typedRule,
  }
}

describe('evaluateConstraints', () => {
  it('returns no violations when no constraints apply', () => {
    expect(evaluateConstraints(baseRestock, [])).toEqual([])
  })

  it('skips inactive constraints', () => {
    const c = constraint({
      typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 50 },
      active: false,
    })
    expect(evaluateConstraints(baseRestock, [c])).toEqual([])
  })

  it('skips constraints not applicable to action type', () => {
    const c = constraint({
      typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 50 },
      appliesToActionTypes: ['WRITE_OFF'],
    })
    expect(evaluateConstraints(baseRestock, [c])).toEqual([])
  })

  it('threshold: violation when value exceeds max', () => {
    const c = constraint({ typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 50 } })
    const v = evaluateConstraints(baseRestock, [c])
    expect(v).toHaveLength(1)
    expect(v[0].bucket).toBe('threshold')
    expect(v[0].message).toContain('exceeds max 50')
  })

  it('threshold: no violation when value within bounds', () => {
    const c = constraint({ typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 500 } })
    expect(evaluateConstraints(baseRestock, [c])).toEqual([])
  })

  it('threshold: violation when value below min', () => {
    const c = constraint({ typedRule: { bucket: 'threshold', field: 'quantityNeeded', min: 200 } })
    const v = evaluateConstraints(baseRestock, [c])
    expect(v[0].message).toContain('below min 200')
  })

  it('scope: violation when hotel not in allowed set', () => {
    const c = constraint({
      typedRule: {
        bucket: 'scope',
        allowedHotelIds: ['99999999-9999-4999-8999-999999999999'],
      },
    })
    const v = evaluateConstraints(baseRestock, [c])
    expect(v).toHaveLength(1)
    expect(v[0].bucket).toBe('scope')
  })

  it('time-window: violation when current time outside window', () => {
    const c = constraint({ typedRule: { bucket: 'time-window', startHour: 9, endHour: 17 } })
    const v = evaluateConstraints(baseRestock, [c], { now: new Date('2026-01-01T20:00:00Z') })
    expect(v).toHaveLength(1)
    expect(v[0].bucket).toBe('time-window')
  })

  it('time-window: no violation when current time inside window', () => {
    const c = constraint({ typedRule: { bucket: 'time-window', startHour: 9, endHour: 17 } })
    expect(evaluateConstraints(baseRestock, [c], { now: new Date('2026-01-01T12:00:00Z') })).toEqual([])
  })

  it('actor-role: violation when role not in allowed set', () => {
    const c = constraint({
      typedRule: { bucket: 'actor-role', allowedRoles: ['admin', 'owner'] },
    })
    const v = evaluateConstraints(baseRestock, [c], { actorRole: 'team_member' })
    expect(v).toHaveLength(1)
    expect(v[0].bucket).toBe('actor-role')
  })

  it('actor-role: no violation when role matches', () => {
    const c = constraint({
      typedRule: { bucket: 'actor-role', allowedRoles: ['admin'] },
    })
    expect(evaluateConstraints(baseRestock, [c], { actorRole: 'admin' })).toEqual([])
  })

  it('aggregates violations across multiple constraints', () => {
    const cs = [
      constraint({ typedRule: { bucket: 'threshold', field: 'quantityNeeded', max: 50 } }),
      constraint({
        typedRule: { bucket: 'actor-role', allowedRoles: ['owner'] },
        severity: 'soft',
      }),
    ]
    const v = evaluateConstraints(baseRestock, cs, { actorRole: 'team_member' })
    expect(v).toHaveLength(2)
    expect(v.map((x) => x.severity).sort()).toEqual(['hard', 'soft'])
  })
})

describe('isAutoExecutable', () => {
  it('returns false when confidence below threshold', () => {
    expect(isAutoExecutable({ confidence: 0.8, threshold: 0.9, violations: [] })).toBe(false)
  })

  it('returns true when confidence ≥ threshold and no violations', () => {
    expect(isAutoExecutable({ confidence: 0.95, threshold: 0.9, violations: [] })).toBe(true)
  })

  it('returns false when any hard violation present', () => {
    const v = [{ constraintId: 'x', body: 'x', severity: 'hard' as const, bucket: 'threshold' as const, message: 'over' }]
    expect(isAutoExecutable({ confidence: 0.99, threshold: 0.9, violations: v })).toBe(false)
  })

  it('returns true when only soft violations are present', () => {
    const v = [{ constraintId: 'x', body: 'x', severity: 'soft' as const, bucket: 'threshold' as const, message: 'soft' }]
    expect(isAutoExecutable({ confidence: 0.95, threshold: 0.9, violations: v })).toBe(true)
  })
})
