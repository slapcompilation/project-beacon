import { describe, expect, it } from 'vitest'
import { mergePolicyOverlay, mergeConstraintOverlay, applyVariantOverlay } from './index'
import { DEFAULT_ORG_POLICY } from '../policy/index'
import type { ConstraintRecord } from '../constraints/index'

describe('mergePolicyOverlay', () => {
  it('returns base when overlay is undefined', () => {
    const merged = mergePolicyOverlay(DEFAULT_ORG_POLICY, undefined)
    expect(merged).toEqual(DEFAULT_ORG_POLICY)
  })

  it('deep-merges thresholds — overlay extends, never replaces the map', () => {
    const merged = mergePolicyOverlay(DEFAULT_ORG_POLICY, {
      auto_execution: { thresholds: { TRANSFER_STOCK: 0.95 } },
    })
    expect(merged.auto_execution.thresholds.REQUEST_RESTOCK).toBe(0.9)
    expect(merged.auto_execution.thresholds.TRANSFER_STOCK).toBe(0.95)
  })

  it('merges agent_overrides additively', () => {
    const merged = mergePolicyOverlay(
      { ...DEFAULT_ORG_POLICY, auto_execution: { ...DEFAULT_ORG_POLICY.auto_execution, thresholds: { REQUEST_RESTOCK: 0.9 }, agent_overrides: { existing_agent: 0.8 } } },
      { auto_execution: { agent_overrides: { restock_advisor: 0.95 } } },
    )
    expect(merged.auto_execution.agent_overrides.existing_agent).toBe(0.8)
    expect(merged.auto_execution.agent_overrides.restock_advisor).toBe(0.95)
  })

  it('overlay leaf values replace base leaf values', () => {
    const merged = mergePolicyOverlay(DEFAULT_ORG_POLICY, { overstock: { factor: 3 } })
    expect(merged.overstock.factor).toBe(3)
    expect(merged.par.service_level).toBe(DEFAULT_ORG_POLICY.par.service_level)
  })
})

describe('mergeConstraintOverlay', () => {
  const c1: ConstraintRecord = {
    id: 'c1', body: 'cap A', bucket: 'threshold', severity: 'hard',
    typedRule: { bucket: 'threshold', field: 'quantity', max: 100 },
    appliesToActionTypes: [], active: true,
  }
  const c2: ConstraintRecord = {
    id: 'c2', body: 'cap B', bucket: 'threshold', severity: 'soft',
    typedRule: { bucket: 'threshold', field: 'quantity', max: 50 },
    appliesToActionTypes: [], active: true,
  }
  const cAdded: ConstraintRecord = {
    id: 'c-added', body: 'hypothetical cap', bucket: 'threshold', severity: 'hard',
    typedRule: { bucket: 'threshold', field: 'quantity', max: 30 },
    appliesToActionTypes: [], active: true,
  }

  it('returns a copy of base when overlay is undefined', () => {
    const merged = mergeConstraintOverlay([c1, c2], undefined)
    expect(merged).toEqual([c1, c2])
    expect(merged).not.toBe(c1)  // copy
  })

  it('filters out disabled ids', () => {
    const merged = mergeConstraintOverlay([c1, c2], { disabled: ['c2'] })
    expect(merged).toEqual([c1])
  })

  it('appends added constraints', () => {
    const merged = mergeConstraintOverlay([c1], { added: [cAdded] })
    expect(merged).toEqual([c1, cAdded])
  })

  it('combines disabled + added in one pass', () => {
    const merged = mergeConstraintOverlay([c1, c2], { disabled: ['c1'], added: [cAdded] })
    expect(merged).toEqual([c2, cAdded])
  })
})

describe('applyVariantOverlay', () => {
  const variant = { id: 'v1', current_stock: 50, par_level: 20 }

  it('returns the variant unchanged when overlay is undefined', () => {
    expect(applyVariantOverlay(variant, undefined)).toEqual(variant)
  })

  it('returns the variant unchanged when no override matches its id', () => {
    expect(applyVariantOverlay(variant, { 'other-id': { current_stock: 999 } })).toEqual(variant)
  })

  it('overrides only the fields the overlay specifies', () => {
    const out = applyVariantOverlay(variant, { v1: { current_stock: 10 } })
    expect(out).toEqual({ id: 'v1', current_stock: 10, par_level: 20 })
  })

  it('overrides par_level alone leaves current_stock', () => {
    const out = applyVariantOverlay(variant, { v1: { par_level: 80 } })
    expect(out).toEqual({ id: 'v1', current_stock: 50, par_level: 80 })
  })
})
