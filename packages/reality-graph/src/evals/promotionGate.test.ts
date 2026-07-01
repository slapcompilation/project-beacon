import { describe, expect, it } from 'vitest'
import { evaluatePromotion } from './promotionGate'
import type { VersionDiff } from './versionDiff'

// A clean 2-version diff: llm ties the deterministic baseline, regresses nothing.
function baseDiff(overrides: Partial<VersionDiff> = {}): VersionDiff {
  return {
    baseline: 'deterministic',
    rows: [],
    summary: [
      { version: 'deterministic', passRate: 1, meanScore: 1 },
      { version: 'llm', passRate: 1, meanScore: 1 },
    ],
    deltas: [{ version: 'llm', regressions: [], improvements: [] }],
    cohorts: [],
    ...overrides,
  }
}

describe('evaluatePromotion', () => {
  it('promotes a challenger that meets the floor and regresses nothing', () => {
    const d = evaluatePromotion(baseDiff())
    expect(d.promotable).toBe(true)
    expect(d.challenger).toBe('llm')
    expect(d.blockers).toEqual([])
  })

  it('blocks when the challenger regresses a case the baseline passed', () => {
    const d = evaluatePromotion(baseDiff({ deltas: [{ version: 'llm', regressions: ['lateral before external'], improvements: [] }] }))
    expect(d.promotable).toBe(false)
    expect(d.blockers.some((b) => /regresses/.test(b))).toBe(true)
  })

  it('blocks when the pass rate is below the floor', () => {
    const d = evaluatePromotion(baseDiff({
      summary: [
        { version: 'deterministic', passRate: 1, meanScore: 1 },
        { version: 'llm', passRate: 0.5, meanScore: 0.5 },
      ],
    }))
    expect(d.promotable).toBe(false)
    expect(d.blockers.some((b) => /below floor/.test(b))).toBe(true)
  })

  it('blocks a hidden cohort regression even when the aggregate passes', () => {
    const d = evaluatePromotion(baseDiff({
      cohorts: [{
        cohort: 'rivendell',
        summary: [
          { version: 'deterministic', passRate: 1, meanScore: 1 },
          { version: 'llm', passRate: 0, meanScore: 0 },
        ],
        deltas: [{ version: 'llm', regressions: ['case-r'], improvements: [] }],
      }],
    }))
    expect(d.promotable).toBe(false)
    expect(d.blockers.some((b) => /cohort 'rivendell'/.test(b))).toBe(true)
  })

  it('respects a relaxed policy that allows regressions', () => {
    const d = evaluatePromotion(
      baseDiff({ deltas: [{ version: 'llm', regressions: ['x'], improvements: [] }] }),
      { requireNoRegression: false },
    )
    expect(d.promotable).toBe(true)
  })
})
