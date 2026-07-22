import { describe, it, expect } from 'vitest'
import { formatDuration, stateDepths, isTerminal, toBottleneckReadings } from './analysis'
import type { ProcessState } from './api'

const st = (over: Partial<ProcessState>): ProcessState => ({
  state: 'pending', entered_count: 0, current_count: 0, exited_count: 0, avg_duration_s: null, ...over,
})

describe('formatDuration', () => {
  it('handles null / non-finite', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(Infinity)).toBe('—')
  })
  it('scales units', () => {
    expect(formatDuration(30)).toBe('30s')
    expect(formatDuration(120)).toBe('2m')
    expect(formatDuration(3 * 3600)).toBe('3.0h')
    expect(formatDuration(2 * 86400)).toBe('2.0d')
  })
})

describe('stateDepths', () => {
  it('orders restock states from initial to terminal', () => {
    const d = stateDepths('restock_request')
    expect(d.get('pending')).toBe(0)
    expect(d.get('approved') ?? 0).toBeGreaterThan(d.get('pending') ?? 0)
    expect(d.get('fulfilled') ?? 0).toBeGreaterThan(d.get('approved') ?? 0)
  })
  it('covers every lifecycle state', () => {
    const d = stateDepths('purchase_order')
    for (const s of ['draft', 'sent', 'confirmed', 'closed', 'cancelled']) {
      expect(d.get(s)).toBeTypeOf('number')
    }
  })
})

describe('isTerminal', () => {
  it('flags terminal vs non-terminal', () => {
    expect(isTerminal('restock_request', 'fulfilled')).toBe(true)
    expect(isTerminal('restock_request', 'pending')).toBe(false)
  })
})

describe('toBottleneckReadings', () => {
  it('maps mined states to readings with isTerminal resolved', () => {
    const readings = toBottleneckReadings('case', [
      st({ state: 'in_review', entered_count: 20, exited_count: 3, current_count: 17 }),
      st({ state: 'closed', entered_count: 5, exited_count: 0 }),
    ])
    expect(readings[0]).toMatchObject({ state: 'in_review', isTerminal: false, enteredCount: 20, exitedCount: 3, currentCount: 17 })
    expect(readings[1]).toMatchObject({ state: 'closed', isTerminal: true })
  })
})
