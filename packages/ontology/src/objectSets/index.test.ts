// The set had to behave identically for every consumer shape, because it was
// previously reimplemented inside each one.

import { describe, it, expect } from 'vitest'
import { EMPTY_VIEW_CONFIG, type ObjectTypeDef } from '../objectTypes/index'
import { isMember, selectObjectSet, validateSetDefinition, describeSetFilters } from './index'

const batchType: ObjectTypeDef = {
  id: 't1', 
  apiName: 'batch', label: 'Batch', icon: 'box', description: '', viewConfig: EMPTY_VIEW_CONFIG,
  enabled: true, version: 1,
  properties: [
    { key: 'lot', apiName: 'lot',    label: 'Lot',    type: 'string',   required: true },
    { key: 'units', apiName: 'units',  label: 'Units',  type: 'integer', required: false },
    { key: 'expiry', apiName: 'expiry', label: 'Expiry', type: 'string',   required: false },
  ],
  computedProperties: [],
}

const records = [
  { lot: 'A', units: 10, expiry: '2026-08-01' },
  { lot: 'B', units: 40, expiry: '2026-09-15' },
  { lot: 'C', units: 5,  expiry: '2026-07-20' },
]

describe('selectObjectSet', () => {
  it('with no filters the set is everything', () => {
    const s = selectObjectSet({ filters: [] }, [{ type: batchType, records }])
    expect(s.records).toHaveLength(3)
    expect(s.scanned).toBe(3)
  })

  it('narrows to matching members and reports what was scanned', () => {
    const s = selectObjectSet({ filters: [{ property: 'units', op: 'lt', value: 20 }] }, [{ type: batchType, records }])
    expect(s.records.map((r) => r.lot)).toEqual(['A', 'C'])
    expect(s.scanned).toBe(3)
  })

  it('compares dates as dates — the range that used to match nothing', () => {
    const s = selectObjectSet({ filters: [{ property: 'expiry', op: 'lt', value: '2026-08-15' }] }, [{ type: batchType, records }])
    expect(s.records.map((r) => r.lot)).toEqual(['A', 'C'])
  })

  it('pools members across types, and attributes each to its own type', () => {
    const other = { ...batchType, id: 't2', label: 'Crate' }
    const s = selectObjectSet({ filters: [{ property: 'units', op: 'lt', value: 20 }] }, [
      { type: batchType, records },
      { type: other, records: [{ lot: 'D', units: 1 }] },
    ])
    expect(s.records).toHaveLength(3)
    expect(s.scanned).toBe(4)
    expect(s.byType.map((b) => [b.label, b.matched, b.scanned])).toEqual([['Batch', 2, 3], ['Crate', 1, 1]])
  })

  it('resolves computed properties before filtering, so a set can select on one', () => {
    const withComputed = {
      ...batchType,
      computedProperties: [{ key: 'days_left', label: 'Days left', fn: 'days_until', inputs: ['expiry'] }],
    } as unknown as ObjectTypeDef
    // Every expiry above is in the past relative to no fixed clock, so assert the
    // ORDER the computed value implies rather than an absolute day count.
    const s = selectObjectSet({ filters: [] }, [{ type: withComputed, records }])
    const byLot = new Map(s.records.map((r) => [r.lot, r.days_left as number]))
    expect(byLot.get('C')).toBeLessThan(byLot.get('A') as number)
    expect(byLot.get('A')).toBeLessThan(byLot.get('B') as number)
  })
})

describe('isMember', () => {
  it('answers for a single record the way the set answers for many', () => {
    const filters = [{ property: 'units', op: 'lt' as const, value: 20 }]
    // Selection returns copies (computed values are merged in), so compare by
    // identity property rather than reference.
    const selected = new Set(selectObjectSet({ filters }, [{ type: batchType, records }]).records.map((r) => r.lot))
    for (const r of records) {
      expect(isMember(r, filters)).toBe(selected.has(r.lot))
    }
  })
})

describe('validateSetDefinition', () => {
  const base = { subjectTypeId: 't1', subjectInterfaceId: null, parameters: [], filters: [] }
  const subject = { kind: 'type' as const, type: batchType }

  it('accepts a well-formed set', () => {
    expect(validateSetDefinition(base, subject)).toEqual([])
  })

  it('rejects a filter on a property the subject does not have', () => {
    const errs = validateSetDefinition({ ...base, filters: [{ property: 'nope', op: 'eq', value: 1 }] }, subject)
    expect(errs[0]).toContain('not on Batch')
  })

  it('rejects a parameter no filter reads', () => {
    const errs = validateSetDefinition({
      ...base,
      parameters: [{ key: 'cutoff', label: 'Cutoff', type: 'integer', required: true }],
    }, subject)
    expect(errs[0]).toContain("isn't used by any filter")
  })

  it('reads neutrally for any consumer, not just tools', () => {
    expect(validateSetDefinition({ ...base, subjectInterfaceId: 'i1' }, subject))
      .toContain('Pick one object type or one interface, not both')
  })
})

describe('describeSetFilters', () => {
  it('is empty when the set is unfiltered, so a caller can prepend its own verb', () => {
    expect(describeSetFilters({ filters: [] })).toBe('')
  })

  it('renders a parameter as a placeholder — the set is the shape, not one answer', () => {
    const text = describeSetFilters(
      { filters: [{ property: 'units', op: 'lt', value: 20, param: 'cutoff' }] },
      { kind: 'type', type: batchType },
    )
    expect(text).toBe('Units is below {cutoff}')
  })
})
