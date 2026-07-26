import { describe, it, expect } from 'vitest'
import { DEFAULT_ORG_POLICY, mergeOrgPolicy, orgPolicyToAutoExecPolicy, orgPolicyToCalibrationOptions, goalProgress, recommendGoalIntervention } from './index'
import { HONEST_LABEL_OPTIONS } from '../calibration/index'

describe('calibration scoring policy', () => {
  it('defaults match the HONEST_LABEL_OPTIONS constant they replaced', () => {
    const opts = orgPolicyToCalibrationOptions(mergeOrgPolicy({}))
    expect(opts.editPenalty).toBe(HONEST_LABEL_OPTIONS.editPenalty)
    expect(opts.halfLifeDays).toBe(HONEST_LABEL_OPTIONS.halfLifeDays)
  })

  it('merges + clamps operator overrides', () => {
    expect(mergeOrgPolicy({ calibration: { edit_penalty: 0.25 } }).calibration.edit_penalty).toBe(0.25)
    expect(mergeOrgPolicy({ calibration: { edit_penalty: 2 } }).calibration.edit_penalty).toBe(1)
    expect(mergeOrgPolicy({ calibration: { half_life_days: -5 } }).calibration.half_life_days).toBe(0)
    expect(mergeOrgPolicy({ calibration: { half_life_days: 30.6 } }).calibration.half_life_days).toBe(31)
  })

  it('draws minSamples from the trust-budget floor instead of duplicating it', () => {
    const p = mergeOrgPolicy({ auto_execution: { min_calibration_samples: 50 } })
    expect(orgPolicyToCalibrationOptions(p).minSamples).toBe(50)
  })
})

describe('goals', () => {
  it('merges goal overrides + clamps to 0..1', () => {
    expect(mergeOrgPolicy({ goals: { max_calibration_error: 0.05 } }).goals.max_calibration_error).toBe(0.05)
    expect(mergeOrgPolicy({ goals: { min_approval_rate: 1.5 } }).goals.min_approval_rate).toBe(1)
    expect(mergeOrgPolicy({}).goals).toEqual(DEFAULT_ORG_POLICY.goals)
  })
  it('goalProgress: lower-is-better met at/below target', () => {
    expect(goalProgress(0.1, 0.08, true)).toEqual({ met: true, pct: 100 })
    expect(goalProgress(0.1, 0.2, true)).toEqual({ met: false, pct: 50 })
    expect(goalProgress(0.1, null, true)).toEqual({ met: false, pct: 0 })
  })
  it('goalProgress: higher-is-better met at/above target', () => {
    expect(goalProgress(0.7, 0.7, false)).toEqual({ met: true, pct: 100 })
    expect(goalProgress(0.8, 0.4, false)).toEqual({ met: false, pct: 50 })
  })
})

describe('recommendGoalIntervention', () => {
  const base = mergeOrgPolicy({})  // defaults: ECE ceiling 0.1, approval floor 0.7, require_calibration false

  it('returns null when the goal is met', () => {
    expect(recommendGoalIntervention('calibration_error', 0.05, base)).toBeNull()
    expect(recommendGoalIntervention('approval_rate', 0.8, base)).toBeNull()
  })

  it('returns null when actual is unknown', () => {
    expect(recommendGoalIntervention('calibration_error', null, base)).toBeNull()
  })

  it('ECE off target → recommends requiring calibration + produces the next policy', () => {
    const rec = recommendGoalIntervention('calibration_error', 0.25, base)
    expect(rec?.goalKey).toBe('calibration_error')
    expect(rec?.next.auto_execution.require_calibration).toBe(true)
    // only that lever moved; other sections untouched
    expect(rec?.next.auto_execution.thresholds).toEqual(base.auto_execution.thresholds)
  })

  it('ECE off but calibration already required → no lever left', () => {
    const tightened = mergeOrgPolicy({ auto_execution: { require_calibration: true } })
    expect(recommendGoalIntervention('calibration_error', 0.25, tightened)).toBeNull()
  })

  it('approval off target → raises every floor by 5%', () => {
    const rec = recommendGoalIntervention('approval_rate', 0.4, base)
    expect(rec?.goalKey).toBe('approval_rate')
    expect(rec?.next.auto_execution.thresholds.REQUEST_RESTOCK).toBe(0.95)  // 0.9 → 0.95
    expect(rec?.next.auto_execution.require_calibration).toBe(false)        // untouched
  })

  it('approval off but floors already capped → no lever left', () => {
    const capped = mergeOrgPolicy({ auto_execution: { thresholds: { REQUEST_RESTOCK: 0.95 } } })
    expect(recommendGoalIntervention('approval_rate', 0.4, capped)).toBeNull()
  })
})

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

describe('orgPolicyToAutoExecPolicy', () => {
  it('extracts the per-action-type thresholds map', () => {
    const policy = mergeOrgPolicy({
      auto_execution: { thresholds: { REQUEST_RESTOCK: 0.85, TRANSFER_STOCK: 0.95 } },
    })
    const exec = orgPolicyToAutoExecPolicy(policy)
    expect(exec.thresholds.REQUEST_RESTOCK).toBe(0.85)
    expect(exec.thresholds.TRANSFER_STOCK).toBe(0.95)
  })

  it('copies the thresholds map — mutating the result does not affect the source', () => {
    const policy = mergeOrgPolicy({})
    const exec = orgPolicyToAutoExecPolicy(policy)
    exec.thresholds.WRITE_OFF = 0.99
    expect(policy.auto_execution.thresholds.WRITE_OFF).toBeUndefined()
  })
})

describe('agent_overrides (Phase E3)', () => {
  it('starts empty when override is missing', () => {
    expect(mergeOrgPolicy({}).auto_execution.agent_overrides).toEqual({})
  })

  it('accepts in-range floats per agent', () => {
    const merged = mergeOrgPolicy({
      auto_execution: { agent_overrides: { restock_advisor: 0.85, waste_triage: 0.95 } },
    })
    expect(merged.auto_execution.agent_overrides.restock_advisor).toBe(0.85)
    expect(merged.auto_execution.agent_overrides.waste_triage).toBe(0.95)
  })

  it('drops out-of-range + non-numeric override values', () => {
    const merged = mergeOrgPolicy({
      auto_execution: { agent_overrides: { good: 0.5, too_high: 1.5, too_low: -0.1, wrong_type: 'string' } },
    })
    expect(merged.auto_execution.agent_overrides.good).toBe(0.5)
    expect(merged.auto_execution.agent_overrides.too_high).toBeUndefined()
    expect(merged.auto_execution.agent_overrides.too_low).toBeUndefined()
    expect(merged.auto_execution.agent_overrides.wrong_type).toBeUndefined()
  })
})
