import { describe, it, expect } from 'vitest'
import { DEFAULT_ORG_POLICY, mergeOrgPolicy } from './index'

describe('mergeOrgPolicy', () => {
  it('returns defaults when override is null / undefined / non-object', () => {
    expect(mergeOrgPolicy(null)).toEqual(DEFAULT_ORG_POLICY)
    expect(mergeOrgPolicy(undefined)).toEqual(DEFAULT_ORG_POLICY)
    expect(mergeOrgPolicy('not an object')).toEqual(DEFAULT_ORG_POLICY)
    expect(mergeOrgPolicy([])).toEqual(DEFAULT_ORG_POLICY)
  })

  it('returns defaults when override is an empty object', () => {
    expect(mergeOrgPolicy({})).toEqual(DEFAULT_ORG_POLICY)
  })

  it('overrides a single section, leaves others at default', () => {
    const merged = mergeOrgPolicy({ overstock: { factor: 3 } })
    expect(merged.overstock.factor).toBe(3)
    expect(merged.promotion.production_pass_rate_floor).toBe(DEFAULT_ORG_POLICY.promotion.production_pass_rate_floor)
    expect(merged.caps.max_variants_per_cycle).toBe(DEFAULT_ORG_POLICY.caps.max_variants_per_cycle)
  })

  it('deep-merges auto_execution.thresholds — extends, not replaces', () => {
    const merged = mergeOrgPolicy({ auto_execution: { thresholds: { TRANSFER_STOCK: 0.95 } } })
    expect(merged.auto_execution.thresholds.REQUEST_RESTOCK).toBe(0.9)  // default kept
    expect(merged.auto_execution.thresholds.TRANSFER_STOCK).toBe(0.95)  // new added
  })

  it('rejects out-of-range threshold values silently (keeps default)', () => {
    const merged = mergeOrgPolicy({ auto_execution: { thresholds: { REQUEST_RESTOCK: 1.5 } } })
    expect(merged.auto_execution.thresholds.REQUEST_RESTOCK).toBe(0.9)
  })

  it('rounds integer fields (window_days, caps)', () => {
    const merged = mergeOrgPolicy({
      par:  { window_days: 90.6 },
      caps: { max_variants_per_cycle: 12.3, max_proposals_per_sweep: 17.9 },
    })
    expect(merged.par.window_days).toBe(91)
    expect(merged.caps.max_variants_per_cycle).toBe(12)
    expect(merged.caps.max_proposals_per_sweep).toBe(18)
  })

  it('ignores unknown keys + non-numeric values', () => {
    const merged = mergeOrgPolicy({
      something_unknown: 42,
      overstock: { factor: 'two' },  // wrong type → default kept
    })
    expect(merged.overstock.factor).toBe(DEFAULT_ORG_POLICY.overstock.factor)
  })
})
