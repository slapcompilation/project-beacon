import { describe, it, expect } from 'vitest'
import {
  selectExpiryTriggers,
  expiryUrgency,
  expiryHitToWriteOff,
  parseExpiryTuning,
  type ExpiryBatch,
} from './index'
import { DEFAULT_ORG_POLICY } from '../policy/index'

const RULE = DEFAULT_ORG_POLICY.monitors.expiry // enabled, 7d, €0, no auto-propose

function batch(over: Partial<ExpiryBatch> = {}): ExpiryBatch {
  return {
    variantId: 'v1',
    variantLabel: 'Milk · 1L',
    quantity: 10,
    daysUntilExpiry: 3,
    costAtRisk: 40,
    hotelId: 'h1',
    ...over,
  }
}

describe('selectExpiryTriggers', () => {
  it('fires when days_until_expiry ≤ threshold', () => {
    const hits = selectExpiryTriggers([batch({ daysUntilExpiry: 3 })], RULE)
    expect(hits).toHaveLength(1)
  })

  it('does not fire outside the threshold window', () => {
    expect(selectExpiryTriggers([batch({ daysUntilExpiry: 20 })], RULE)).toHaveLength(0)
  })

  it('threshold is tunable — widening it captures more', () => {
    const wide = { ...RULE, threshold_days: 30 }
    expect(selectExpiryTriggers([batch({ daysUntilExpiry: 20 })], wide)).toHaveLength(1)
  })

  it('respects min_cost_at_risk', () => {
    const rule = { ...RULE, min_cost_at_risk: 50 }
    expect(selectExpiryTriggers([batch({ costAtRisk: 40 })], rule)).toHaveLength(0)
    expect(selectExpiryTriggers([batch({ costAtRisk: 60 })], rule)).toHaveLength(1)
  })

  it('disabled rule emits nothing', () => {
    expect(selectExpiryTriggers([batch()], { ...RULE, enabled: false })).toHaveLength(0)
  })

  it('skips zero/negative quantity', () => {
    expect(selectExpiryTriggers([batch({ quantity: 0 })], RULE)).toHaveLength(0)
  })

  it('sorts most-urgent first, then most-valuable', () => {
    const hits = selectExpiryTriggers([
      batch({ variantId: 'a', daysUntilExpiry: 6, costAtRisk: 10 }),
      batch({ variantId: 'b', daysUntilExpiry: 0, costAtRisk: 5 }),
      batch({ variantId: 'c', daysUntilExpiry: 6, costAtRisk: 99 }),
    ], RULE)
    expect(hits.map((h) => h.variantId)).toEqual(['b', 'c', 'a'])
  })
})

describe('expiryUrgency', () => {
  it('expired is max urgency', () => {
    expect(expiryUrgency(0, 7)).toBe(10)
    expect(expiryUrgency(-2, 7)).toBe(10)
  })
  it('near the threshold edge is low', () => {
    expect(expiryUrgency(7, 7)).toBe(1)
  })
  it('rises as expiry approaches', () => {
    expect(expiryUrgency(1, 7)).toBeGreaterThan(expiryUrgency(5, 7))
  })
})

describe('expiryHitToWriteOff', () => {
  it('builds a typed WRITE_OFF carrying the batch + category', () => {
    const [hit] = selectExpiryTriggers([batch({ daysUntilExpiry: 2, quantity: 8 })], RULE)
    const action = expiryHitToWriteOff(hit, 'user-1')
    expect(action.type).toBe('WRITE_OFF')
    expect(action.quantity).toBe(8)
    expect(action.variantId).toBe('v1')
    expect(action.hotelId).toBe('h1')
    expect(action.userId).toBe('user-1')
    expect(action.removalCategory).toBe('expiry')
    expect(action.wasteReason).toContain('Milk')
  })
})

describe('parseExpiryTuning', () => {
  it('parses a day threshold', () => {
    const r = parseExpiryTuning('set expiry alert to 10 days', RULE)
    expect(r.understood).toBe(true)
    expect(r.rule.threshold_days).toBe(10)
  })
  it('clamps absurd day values', () => {
    expect(parseExpiryTuning('alert 9999 days before', RULE).rule.threshold_days).toBe(365)
  })
  it('disables and enables', () => {
    expect(parseExpiryTuning('disable the expiry monitor', RULE).rule.enabled).toBe(false)
    expect(parseExpiryTuning('turn on the monitor', { ...RULE, enabled: false }).rule.enabled).toBe(true)
  })
  it('parses min cost only when the sentence is about value', () => {
    expect(parseExpiryTuning('ignore anything under €50 at risk', RULE).rule.min_cost_at_risk).toBe(50)
    // "5 days" must not be read as a cost
    expect(parseExpiryTuning('5 days', RULE).rule.min_cost_at_risk).toBe(0)
  })
  it('toggles auto-propose both ways', () => {
    expect(parseExpiryTuning('automatically propose write-offs', RULE).rule.auto_propose).toBe(true)
    expect(parseExpiryTuning("don't auto-propose write offs", { ...RULE, auto_propose: true }).rule.auto_propose).toBe(false)
  })
  it('reports not-understood when nothing matches', () => {
    const r = parseExpiryTuning('make it better please', RULE)
    expect(r.understood).toBe(false)
    expect(r.changed).toHaveLength(0)
  })
})
