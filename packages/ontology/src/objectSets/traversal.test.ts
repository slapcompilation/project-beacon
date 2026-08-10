// The question the audit called the largest functional gap — "restock requests
// for variants supplied by Supplier X" — is the last test here. It crosses two
// link types and cannot be expressed by filtering.

import { describe, it, expect } from 'vitest'
import {
  MAX_TRAVERSAL_DEPTH, describeTraversals, searchAround, traverseOnce, validateTraversals,
  type LinkRow, type SetTraversal,
} from './traversal'

const links: LinkRow[] = [
  { edgeType: 'sourced_from', sourceId: 'v1', targetId: 's1' },
  { edgeType: 'sourced_from', sourceId: 'v2', targetId: 's1' },
  { edgeType: 'sourced_from', sourceId: 'v3', targetId: 's2' },
  { edgeType: 'restocks',     sourceId: 'v1', targetId: 'r1' },
  { edgeType: 'restocks',     sourceId: 'v1', targetId: 'r2' },
  { edgeType: 'restocks',     sourceId: 'v2', targetId: 'r3' },
  { edgeType: 'restocks',     sourceId: 'v3', targetId: 'r4' },
]

const declared = new Set(['sourced_from', 'restocks', 'consumes'])

describe('traverseOnce', () => {
  it('follows a link forward', () => {
    expect([...traverseOnce(new Set(['v1']), links, { edgeType: 'sourced_from', direction: 'forward' })]).toEqual(['s1'])
  })

  it('follows the other side of the same link type', () => {
    const r = traverseOnce(new Set(['s1']), links, { edgeType: 'sourced_from', direction: 'reverse' })
    expect([...r].sort()).toEqual(['v1', 'v2'])
  })

  it('returns a SET — two links onto one object make one member', () => {
    const r = traverseOnce(new Set(['v1', 'v2']), links, { edgeType: 'sourced_from', direction: 'forward' })
    expect(r.size).toBe(1)
  })

  it('ignores links of other types', () => {
    expect(traverseOnce(new Set(['v1']), links, { edgeType: 'consumes', direction: 'forward' }).size).toBe(0)
  })
})

describe('validateTraversals', () => {
  const hop = (edgeType: string) => ({ edgeType, direction: 'forward' as const })

  it('accepts a chain at the cap', () => {
    expect(validateTraversals([hop('sourced_from'), hop('restocks'), hop('consumes')], declared)).toEqual([])
  })

  it('refuses a chain past Foundry’s depth limit of 3', () => {
    const errs = validateTraversals(
      [hop('sourced_from'), hop('restocks'), hop('consumes'), hop('restocks')], declared)
    expect(errs[0]).toContain('at most 3')
    expect(MAX_TRAVERSAL_DEPTH).toBe(3)
  })

  it('refuses a link type nobody registered — an empty answer from a typo is indistinguishable from a true one', () => {
    expect(validateTraversals([hop('made_up_link')], declared)[0]).toContain('not a registered link type')
  })
})

describe('searchAround', () => {
  it('changes the type of the set at each hop', () => {
    const chain: SetTraversal[] = [
      { edgeType: 'sourced_from', direction: 'reverse', filters: [] },
      { edgeType: 'restocks',     direction: 'forward', filters: [] },
    ]
    const r = searchAround(new Set(['s1']), links, chain)
    expect([...r.members].sort()).toEqual(['r1', 'r2', 'r3'])
  })

  it('records where a chain collapsed, because that is the first question about an empty result', () => {
    const chain: SetTraversal[] = [
      { edgeType: 'consumes',  direction: 'forward', filters: [] },
      { edgeType: 'restocks',  direction: 'forward', filters: [] },
    ]
    const r = searchAround(new Set(['v1']), links, chain)
    expect(r.members.size).toBe(0)
    expect(r.steps).toHaveLength(1)             // stopped early
    expect(r.steps[0]).toMatchObject({ edgeType: 'consumes', from: 1, to: 0 })
  })

  it('never walks more than the cap even if handed more', () => {
    const hop = (edgeType: string): SetTraversal => ({ edgeType, direction: 'forward', filters: [] })
    const r = searchAround(new Set(['v1']), links, [hop('restocks'), hop('restocks'), hop('restocks'), hop('restocks')])
    expect(r.steps.length).toBeLessThanOrEqual(MAX_TRAVERSAL_DEPTH)
  })

  it('answers the audit’s question: restock requests for variants supplied by Supplier X', () => {
    const r = searchAround(new Set(['s1']), links, [
      { edgeType: 'sourced_from', direction: 'reverse', filters: [] },  // supplier -> its variants
      { edgeType: 'restocks',     direction: 'forward', filters: [] },  // variants -> their requests
    ])
    expect([...r.members].sort()).toEqual(['r1', 'r2', 'r3'])
    // s2's variant v3 has request r4, which must NOT appear.
    expect(r.members.has('r4')).toBe(false)
  })
})

describe('describeTraversals', () => {
  it('reads as a chain', () => {
    const chain: SetTraversal[] = [
      { edgeType: 'sourced_from', direction: 'reverse', filters: [] },
      { edgeType: 'restocks',     direction: 'forward', filters: [] },
    ]
    expect(describeTraversals(chain, (e) => e.replace('_', ' '))).toBe('sourced from → restocks')
  })
})
