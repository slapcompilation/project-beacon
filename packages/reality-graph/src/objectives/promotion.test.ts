import { describe, expect, it } from 'vitest'
import { recommendAdapterPromotion } from './promotion'

const e = (name: string, value: number, version = '1.0.0') => ({ name, version, value })
/** Same adapter measured over `runs` independent eval runs. */
const runs = (name: string, values: number[], version = '1.0.0') =>
  values.map((value, i) => ({ name, version, value, runAt: `2026-07-0${String(i + 1)}` }))

// These cases exercise the ranking/margin logic, not the evidence gate, so they
// opt out of it with minRuns: 1. The gate has its own block below.
const RANK = { minRuns: 1 }

describe('recommendAdapterPromotion', () => {
  it('holds when there are no eval runs', () => {
    expect(recommendAdapterPromotion([], null).action).toBe('hold')
  })

  it('promotes the best adapter when nothing is in production', () => {
    const r = recommendAdapterPromotion([e('ewma-v1', 0.2), e('holt-linear-v1', 0.14)], null, RANK)
    expect(r.action).toBe('promote')
    expect(r.winner?.name).toBe('holt-linear-v1')
  })

  it('holds when production already runs the best adapter', () => {
    const r = recommendAdapterPromotion([e('holt-linear-v1', 0.14), e('ewma-v1', 0.2)], { name: 'holt-linear-v1', version: '1.0.0' })
    expect(r.action).toBe('hold')
  })

  it('promotes when a challenger clearly beats production', () => {
    const r = recommendAdapterPromotion([e('ewma-v1', 0.30), e('holt-linear-v1', 0.14)], { name: 'ewma-v1', version: '1.0.0' }, RANK)
    expect(r.action).toBe('promote')
    expect(r.winner?.name).toBe('holt-linear-v1')
  })

  it('holds when production is within the margin of the best (no churn)', () => {
    const r = recommendAdapterPromotion([e('ewma-v1', 0.205), e('holt-linear-v1', 0.20)], { name: 'ewma-v1', version: '1.0.0' }, RANK)
    expect(r.action).toBe('hold')   // 0.20 is only ~2.5% better than 0.205, under the 5% margin
  })

  describe('evidence gate', () => {
    it('refuses to promote on a single eval run', () => {
      // A single-window backtest ranked occupancy-v1 first; moving the cutoff one
      // day made it last. One reading is not evidence.
      const r = recommendAdapterPromotion([e('ewma-v1', 0.30), e('holt-linear-v1', 0.14)], { name: 'ewma-v1', version: '1.0.0' })
      expect(r.action).toBe('hold')
      expect(r.reason).toContain('needs 3')
      expect(r.winner?.name).toBe('holt-linear-v1')   // still names the leader
    })

    it('promotes once the winner has been measured enough times', () => {
      const r = recommendAdapterPromotion(
        [...runs('ewma-v1', [0.30, 0.31, 0.29]), ...runs('holt-linear-v1', [0.14, 0.15, 0.13])],
        { name: 'ewma-v1', version: '1.0.0' },
      )
      expect(r.action).toBe('promote')
      expect(r.reason).toContain('3 runs')
    })

    it('ranks on the MEAN across runs, so one lucky run cannot win it', () => {
      // holt wins a single run outright (0.05) but is worse on average.
      const r = recommendAdapterPromotion(
        [...runs('ewma-v1', [0.20, 0.20, 0.20]), ...runs('holt-linear-v1', [0.05, 0.40, 0.40])],
        null,
      )
      expect(r.winner?.name).toBe('ewma-v1')
      expect(r.winner?.value).toBeCloseTo(0.2, 3)
    })

    it('counts distinct runs, not rows — cohort slices are not extra evidence', () => {
      // Three rows from ONE run (e.g. overall + two cohort subsets) is still one run.
      const oneRun = [
        { name: 'holt-linear-v1', version: '1.0.0', value: 0.14, runAt: '2026-07-01' },
        { name: 'holt-linear-v1', version: '1.0.0', value: 0.13, runAt: '2026-07-01' },
        { name: 'holt-linear-v1', version: '1.0.0', value: 0.15, runAt: '2026-07-01' },
      ]
      const r = recommendAdapterPromotion(oneRun, { name: 'ewma-v1', version: '1.0.0' })
      expect(r.action).toBe('hold')
      expect(r.reason).toContain('1 eval run')
    })

    it('accepts a bare margin as the third arg (back-compat)', () => {
      const r = recommendAdapterPromotion([e('ewma-v1', 0.205), e('holt-linear-v1', 0.20)], { name: 'ewma-v1', version: '1.0.0' }, 0.5)
      expect(r.action).toBe('hold')   // margin 50% → not worth churning
    })
  })
})
