import { describe, it, expect } from 'vitest'
import { splitOnTerm } from './splitOnTerm'

describe('splitOnTerm', () => {
  it('keeps the whole text when nothing is searched', () => {
    expect(splitOnTerm('a contract clause', '')).toEqual([{ text: 'a contract clause', match: false }])
  })

  it('marks every hit and leaves the rest intact', () => {
    // Rejoining the segments must give back the original — a viewer that drops
    // a character while highlighting is worse than one that does not highlight.
    const segs = splitOnTerm('the clause and the clause again', 'clause')
    expect(segs.filter((s) => s.match)).toHaveLength(2)
    expect(segs.map((s) => s.text).join('')).toBe('the clause and the clause again')
  })

  it('matches case-insensitively, like their search bar', () => {
    expect(splitOnTerm('Force Majeure applies', 'force majeure').filter((s) => s.match))
      .toEqual([{ text: 'Force Majeure', match: true }])
  })

  it('handles Greek, which is what the real contract is written in', () => {
    const segs = splitOnTerm('Ο προμηθευτής υποχρεούται', 'προμηθευτής')
    expect(segs.filter((s) => s.match)).toHaveLength(1)
    expect(segs.map((s) => s.text).join('')).toBe('Ο προμηθευτής υποχρεούται')
  })

  it('does not loop forever on an empty-ish term', () => {
    expect(splitOnTerm('abc', '   ')).toEqual([{ text: 'abc', match: false }])
  })
})
