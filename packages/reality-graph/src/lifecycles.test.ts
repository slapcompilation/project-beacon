import { describe, it, expect } from 'vitest'
import { LIFECYCLES, canTransition, legalNext, assertTransition } from './lifecycles'

describe('typed lifecycles (A8)', () => {
  it('every declared target state is itself a declared state', () => {
    for (const [node, map] of Object.entries(LIFECYCLES)) {
      for (const [from, targets] of Object.entries(map)) {
        for (const to of targets) {
          expect(map[to], `${node}: '${from}' → '${to}' points at an undeclared state`).toBeDefined()
        }
      }
    }
  })

  it('every lifecycle has at least one terminal state', () => {
    for (const [node, map] of Object.entries(LIFECYCLES)) {
      const terminals = Object.values(map).filter((t) => t.length === 0)
      expect(terminals.length, `${node} has no terminal state`).toBeGreaterThan(0)
    }
  })

  it('allows lawful moves and no-op same-state writes', () => {
    expect(canTransition('restock_request', 'pending', 'approved')).toBe(true)
    expect(canTransition('restock_request', 'approved', 'fulfilled')).toBe(true)
    expect(canTransition('purchase_order', 'sent', 'confirmed')).toBe(true)
    expect(canTransition('case', 'resolved', 'open')).toBe(true) // reopen
    expect(canTransition('proposal', 'pending', 'expired')).toBe(true)
    expect(canTransition('proposal', 'approved', 'approved')).toBe(true) // same-state
  })

  it('rejects unlawful moves, with derived context in the error', () => {
    expect(canTransition('restock_request', 'fulfilled', 'pending')).toBe(false)
    expect(canTransition('purchase_order', 'closed', 'sent')).toBe(false)
    expect(canTransition('proposal', 'rejected', 'approved')).toBe(false)
    expect(() => { assertTransition('restock_request', 'fulfilled', 'rejected') })
      .toThrow(/'fulfilled' is terminal/)
    expect(() => { assertTransition('restock_request', 'approved', 'rejected') })
      .toThrow(/only: fulfilled, cancelled/)
  })

  it('legalNext drives transition UIs', () => {
    expect(legalNext('case', 'open')).toEqual(['in_review', 'resolved', 'closed'])
    expect(legalNext('proposal', 'expired')).toEqual([])
  })
})
