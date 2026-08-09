import { describe, it, expect } from 'vitest'
import { ONTOLOGY_STATUSES, OBJECT_TYPE_STATUSES, STATUS_META, linkStatusFromEnds, statusChangeProblem } from './status'

describe('ontology status vocabulary', () => {
  it('is four values for every kind, and five for object types alone', () => {
    // "The status can take on one of five values" — and "The `promoted` status
    // applies only to object types. It is not available for properties, link
    // types, action types or interfaces." So the common list has four, and the
    // object type list extends it rather than the other way round.
    expect([...ONTOLOGY_STATUSES]).toEqual(['active', 'experimental', 'deprecated', 'example'])
    expect([...OBJECT_TYPE_STATUSES]).toEqual(['promoted', 'active', 'experimental', 'deprecated', 'example'])
  })

  it('lets only experimental be renamed, and refuses to delete what is in use', () => {
    const renamable = ONTOLOGY_STATUSES.filter((s) => STATUS_META[s].renamable)
    expect(renamable).toEqual(['experimental'])
    expect(STATUS_META.active.deletable).toBe(false)
    expect(STATUS_META.deprecated.deletable).toBe(true)
  })
})

describe('promoted', () => {
  it('inherits the protections of active', () => {
    // "Promoted object types inherit similar operational protections of the
    // active status, such as restrictions on deletion" — and for API names.
    expect(STATUS_META.promoted.deletable).toBe(false)
    expect(STATUS_META.promoted.renamable).toBe(false)
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
