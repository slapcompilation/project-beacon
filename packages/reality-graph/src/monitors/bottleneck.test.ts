import { describe, it, expect } from 'vitest'
import { selectBottleneckTriggers, bottleneckUrgency, type BottleneckReading } from './index'
import { DEFAULT_ORG_POLICY } from '../policy/index'

const RULE = DEFAULT_ORG_POLICY.monitors.bottleneck // enabled, min_entered 3, max_exit_ratio 0.4

const r = (over: Partial<BottleneckReading>): BottleneckReading => ({
  nodeType: 'restock_request', state: 'pending_manager', isTerminal: false,
  enteredCount: 0, exitedCount: 0, currentCount: 0, ...over,
})

describe('selectBottleneckTriggers', () => {
  it('fires a non-terminal state where entered ≫ exited', () => {
    const hits = selectBottleneckTriggers([r({ enteredCount: 40, exitedCount: 3, currentCount: 37 })], RULE)
    expect(hits).toHaveLength(1)
    expect(hits[0].exitRatio).toBeCloseTo(0.075)
    expect(hits[0].urgency).toBeGreaterThan(5)
  })

  it('ignores terminal states', () => {
    expect(selectBottleneckTriggers([r({ state: 'fulfilled', isTerminal: true, enteredCount: 40, exitedCount: 0 })], RULE)).toHaveLength(0)
  })

  it('ignores low-volume states (noise floor)', () => {
    expect(selectBottleneckTriggers([r({ enteredCount: 2, exitedCount: 0 })], RULE)).toHaveLength(0)
  })

  it('passes a healthy state that mostly drains', () => {
    expect(selectBottleneckTriggers([r({ enteredCount: 40, exitedCount: 38 })], RULE)).toHaveLength(0)
  })

  it('returns nothing when disabled', () => {
    expect(selectBottleneckTriggers([r({ enteredCount: 40, exitedCount: 1 })], { ...RULE, enabled: false })).toHaveLength(0)
  })

  it('sorts most-urgent first', () => {
    const hits = selectBottleneckTriggers([
      r({ state: 'a', enteredCount: 10, exitedCount: 3, currentCount: 7 }),   // ratio .30
      r({ state: 'b', enteredCount: 10, exitedCount: 1, currentCount: 9 }),   // ratio .10 (worse)
    ], RULE)
    expect(hits.map((h) => h.state)).toEqual(['b', 'a'])
  })

  it('respects a retuned threshold', () => {
    const loose = { ...RULE, max_exit_ratio: 0.2 }
    // ratio .30 no longer fires under a stricter 0.2 ceiling
    expect(selectBottleneckTriggers([r({ enteredCount: 10, exitedCount: 3 })], loose)).toHaveLength(0)
  })
})

describe('bottleneckUrgency', () => {
  it('scales from the edge to fully stuck', () => {
    expect(bottleneckUrgency(0, 0.4)).toBe(10)
    expect(bottleneckUrgency(0.4, 0.4)).toBe(1)
  })
})
