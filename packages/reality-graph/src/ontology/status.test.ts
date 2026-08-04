import { describe, it, expect } from 'vitest'
import { ONTOLOGY_STATUSES, STATUS_META, linkStatusFromEnds, statusChangeProblem } from './status'
import { RESOURCE_STATUSES, PROMOTABLE_KINDS, promotionEffects } from './promotion'

describe('ontology status vocabulary', () => {
  it('carries developmental state only — promotion is a different axis', () => {
    expect([...ONTOLOGY_STATUSES]).toEqual(['active', 'experimental', 'deprecated', 'example'])
    // `promoted` looked like a fifth value and is Compass's. Keeping it here made
    // it exclusive with `active`, so promoting meant no longer saying it was
    // in use. See migration 327.
    expect(ONTOLOGY_STATUSES).not.toContain('promoted')
  })

  it('lets only experimental be renamed, and refuses to delete what is in use', () => {
    const renamable = ONTOLOGY_STATUSES.filter((s) => STATUS_META[s].renamable)
    expect(renamable).toEqual(['experimental'])
    expect(STATUS_META.active.deletable).toBe(false)
    expect(STATUS_META.deprecated.deletable).toBe(true)
  })
})

describe('resource status', () => {
  it('has exactly one value, which is theirs', () => {
    // "Currently, the only available status is Promoted." Absence is the
    // default state, so there is no 'none' to model.
    expect([...RESOURCE_STATUSES]).toEqual(['promoted'])
  })

  it('names all three effects at the point of decision', () => {
    for (const kind of PROMOTABLE_KINDS) {
      const effects = promotionEffects(kind)
      expect(effects).toHaveLength(3)
      expect(effects.join(' ')).toMatch(/search/i)
      expect(effects.join(' ')).toMatch(/checkmark/i)
      expect(effects.join(' ')).toMatch(/catalog/i)
    }
  })
})

describe('linkStatusFromEnds', () => {
  it('takes the weaker end, deprecated beating everything', () => {
    expect(linkStatusFromEnds('active', 'experimental', 'active')).toBe('experimental')
    // "deprecated only" — the corner their table settles.
    expect(linkStatusFromEnds('deprecated', 'experimental', 'active')).toBe('deprecated')
    expect(linkStatusFromEnds('example', 'active', 'active')).toBe('example')
  })

  it('calls a link between an example end and an experimental one experimental', () => {
    // Ours: their table has no example column. `example` asserts provenance, and
    // a link with a non-example end was not installed as an example either.
    expect(linkStatusFromEnds('example', 'experimental', 'active')).toBe('experimental')
    expect(linkStatusFromEnds('example', 'example', 'active')).toBe('example')
  })

  it('never restores a link upward when both ends are healthy', () => {
    // A link somebody deliberately marked experimental stays that way.
    expect(linkStatusFromEnds('active', 'active', 'experimental')).toBe('experimental')
    expect(linkStatusFromEnds('active', 'active', 'active')).toBe('active')
  })
})

describe('statusChangeProblem', () => {
  const full = { reason: 'Superseded', deadline: '2026-12-01', replacedBy: 'ticket' }

  it('requires a reason and a deadline to deprecate', () => {
    expect(statusChangeProblem('active', 'deprecated', null)).toMatch(/reason/)
    expect(statusChangeProblem('active', 'deprecated', { ...full, reason: '  ' })).toMatch(/reason/)
    expect(statusChangeProblem('active', 'deprecated', { ...full, deadline: '' })).toMatch(/deadline/)
    expect(statusChangeProblem('active', 'deprecated', full)).toBeNull()
  })

  it('does not require a replacement — sometimes nothing takes its place', () => {
    expect(statusChangeProblem('active', 'deprecated', { ...full, replacedBy: null })).toBeNull()
  })

  it('refuses a no-op', () => {
    expect(statusChangeProblem('active', 'active', null)).toMatch(/Already/)
  })
})
