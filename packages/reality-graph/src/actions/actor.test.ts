import { describe, it, expect } from 'vitest'
import { SYSTEM_ACTOR, isSystemActor, resolveActor } from './actor'

describe('isSystemActor', () => {
  it('true for the sentinel, null, and undefined', () => {
    expect(isSystemActor(SYSTEM_ACTOR)).toBe(true)
    expect(isSystemActor(null)).toBe(true)
    expect(isSystemActor(undefined)).toBe(true)
  })
  it('false for a real user id', () => {
    expect(isSystemActor('bedebaae-a4b3-4026-a564-467d104a282d')).toBe(false)
  })
})

describe('resolveActor', () => {
  const OP = 'bedebaae-a4b3-4026-a564-467d104a282d'
  const EMBED = '11111111-1111-4111-8111-111111111111'

  it('prefers the dispatching operator over the embedded actor', () => {
    expect(resolveActor(OP, EMBED)).toBe(OP)
  })

  it('falls back to the embedded actor when no ctx actor', () => {
    expect(resolveActor(null, EMBED)).toBe(EMBED)
  })

  it('skips the sentinel in ctx and uses the embedded real actor', () => {
    // This is the live bug: an agent proposal carries SYSTEM_ACTOR; on approval
    // the operator must become the requestor.
    expect(resolveActor(OP, SYSTEM_ACTOR)).toBe(OP)
  })

  it('returns null when both are the sentinel — never the sentinel itself', () => {
    expect(resolveActor(SYSTEM_ACTOR, SYSTEM_ACTOR)).toBeNull()
  })

  it('returns null when both are absent', () => {
    expect(resolveActor(null, null)).toBeNull()
  })
})
