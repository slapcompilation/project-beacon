import { describe, it, expect } from 'vitest'
import { selectBudgetTriggers, selectCporTrigger, type BudgetReading } from './index'
import { DEFAULT_ORG_POLICY } from '../policy/index'

const BUDGET = DEFAULT_ORG_POLICY.monitors.budget // over_budget_pct 100, min_spend 0
const CPOR = DEFAULT_ORG_POLICY.monitors.cpor      // rise_pct 10

const b = (over: Partial<BudgetReading>): BudgetReading => ({
  categoryId: 'c1', categoryName: 'F&B', spendPct: null, actual: 0, ...over,
})

describe('selectBudgetTriggers', () => {
  it('fires an over-budget category', () => {
    const hits = selectBudgetTriggers([b({ spendPct: 118, actual: 4200 })], BUDGET)
    expect(hits).toHaveLength(1)
    expect(hits[0].overPct).toBe(18)
  })
  it('ignores under-budget + unbudgeted', () => {
    expect(selectBudgetTriggers([b({ spendPct: 80, actual: 1000 })], BUDGET)).toHaveLength(0)
    expect(selectBudgetTriggers([b({ spendPct: null, actual: 1000 })], BUDGET)).toHaveLength(0)
  })
  it('respects the spend floor', () => {
    const rule = { ...BUDGET, min_spend: 500 }
    expect(selectBudgetTriggers([b({ spendPct: 130, actual: 100 })], rule)).toHaveLength(0)
  })
  it('respects a retuned ceiling', () => {
    const loose = { ...BUDGET, over_budget_pct: 120 }
    expect(selectBudgetTriggers([b({ spendPct: 110, actual: 999 })], loose)).toHaveLength(0)
  })
  it('is disabled when off', () => {
    expect(selectBudgetTriggers([b({ spendPct: 200, actual: 999 })], { ...BUDGET, enabled: false })).toHaveLength(0)
  })
  it('sorts worst first', () => {
    const hits = selectBudgetTriggers([
      b({ categoryName: 'a', spendPct: 110, actual: 100 }),
      b({ categoryName: 'z', spendPct: 150, actual: 100 }),
    ], BUDGET)
    expect(hits.map((h) => h.categoryName)).toEqual(['z', 'a'])
  })
})

describe('selectCporTrigger', () => {
  it('fires when CPOR rose past the threshold', () => {
    const hit = selectCporTrigger({ periodLabel: 'Mar 2026', cpor: 42, changePct: 18 }, CPOR)
    expect(hit?.changePct).toBe(18)
  })
  it('ignores a small or negative change', () => {
    expect(selectCporTrigger({ periodLabel: 'x', cpor: 42, changePct: 3 }, CPOR)).toBeNull()
    expect(selectCporTrigger({ periodLabel: 'x', cpor: 42, changePct: -20 }, CPOR)).toBeNull()
  })
  it('ignores missing data + disabled', () => {
    expect(selectCporTrigger({ periodLabel: 'x', cpor: null, changePct: 30 }, CPOR)).toBeNull()
    expect(selectCporTrigger(null, CPOR)).toBeNull()
    expect(selectCporTrigger({ periodLabel: 'x', cpor: 42, changePct: 30 }, { ...CPOR, enabled: false })).toBeNull()
  })
})
