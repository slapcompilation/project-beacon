import { describe, expect, it } from 'vitest'
import { detectRemovalCategoryGaps, type RemovalReasonRow } from './index'

function reasons(...pairs: [string | null, number][]): RemovalReasonRow[] {
  const rows: RemovalReasonRow[] = []
  for (const [reason, n] of pairs) {
    for (let i = 0; i < n; i++) rows.push({ reason, removal_category: null })
  }
  return rows
}

describe('detectRemovalCategoryGaps', () => {
  it('proposes a typed category for a dominant free-text reason', () => {
    // Mirrors the real data: every removal is "pos: daily consumption", untyped.
    const gaps = detectRemovalCategoryGaps(reasons(['pos: daily consumption', 1820]))
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toMatchObject({
      kind: 'new_category',
      targetType: 'StockLog',
      targetField: 'removal_category',
      proposed: 'consumption',
    })
    expect(gaps[0].evidence.occurrences).toBe(1820)
    expect(gaps[0].evidence.coverage).toBe(1)
    expect(gaps[0].confidence).toBeGreaterThan(0.95)
  })

  it('maps varied phrasings into canonical categories and ranks by support', () => {
    const gaps = detectRemovalCategoryGaps(reasons(
      ['expired stock', 10],
      ['found mould on it', 4],     // → spoilage too
      ['broken bottle', 6],
      ['stolen from bar', 3],
    ))
    const byCat = Object.fromEntries(gaps.map((g) => [g.proposed, g.evidence.occurrences]))
    expect(byCat.spoilage).toBe(14)  // expired + mould
    expect(byCat.damage).toBe(6)
    expect(byCat.theft).toBe(3)
    expect(gaps[0].proposed).toBe('spoilage')  // highest support first
  })

  it('skips categories below the support floor', () => {
    const gaps = detectRemovalCategoryGaps(reasons(['expired', 2]), { minSupport: 3 })
    expect(gaps).toHaveLength(0)
  })

  it('never re-proposes a category the ontology already recognizes', () => {
    const gaps = detectRemovalCategoryGaps(
      reasons(['expired', 10], ['broken', 5]),
      { knownCategories: ['spoilage'] },
    )
    expect(gaps.map((g) => g.proposed)).toEqual(['damage'])
  })

  it('ignores rows already categorized + rows with no reason', () => {
    const rows: RemovalReasonRow[] = [
      ...reasons(['expired', 5]),
      { reason: 'expired', removal_category: 'spoilage' },  // already typed
      { reason: null, removal_category: null },             // no signal
      { reason: '   ', removal_category: null },             // blank
    ]
    const gaps = detectRemovalCategoryGaps(rows)
    expect(gaps).toHaveLength(1)
    expect(gaps[0].evidence.totalConsidered).toBe(5)  // only the 5 real ones
  })

  it('returns nothing when there is no uncategorized free text', () => {
    expect(detectRemovalCategoryGaps([])).toEqual([])
    expect(detectRemovalCategoryGaps([{ reason: 'x', removal_category: 'damage' }])).toEqual([])
  })

  it('caps the examples it keeps per gap', () => {
    const gaps = detectRemovalCategoryGaps(
      reasons(['expired a', 3], ['expired b', 3], ['expired c', 3], ['expired d', 3]),
      { maxExamples: 2 },
    )
    expect(gaps[0].evidence.examples).toHaveLength(2)
  })
})
