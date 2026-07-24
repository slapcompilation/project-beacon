import { describe, it, expect } from 'vitest'
import {
  validateObjectTypeDraft,
  validateRecord,
  coerceValue,
  toSlug,
  validateLinkTypeDraft,
  evaluateComputed,
  validateComputedProperty,
  resolveViewConfig,
  validateViewConfig,
  type PropertyDef,
  type ObjectTypeDraft,
  type LinkTypeDraft,
  type ComputedPropertyDef,
} from './index'

const props: PropertyDef[] = [
  { key: 'room', label: 'Room', type: 'text', required: true },
  { key: 'urgent', label: 'Urgent', type: 'boolean', required: false },
  { key: 'reported_on', label: 'Reported on', type: 'date', required: false },
  { key: 'cost', label: 'Cost', type: 'number', required: false },
]

describe('validateObjectTypeDraft', () => {
  const draft: ObjectTypeDraft = { apiName: 'maintenance_request', label: 'Maintenance Request', properties: props }

  it('accepts a well-formed type', () => {
    expect(validateObjectTypeDraft(draft).ok).toBe(true)
  })
  it('rejects a non-slug api name', () => {
    expect(validateObjectTypeDraft({ ...draft, apiName: 'Maintenance Request' }).ok).toBe(false)
  })
  it('rejects a reserved property key', () => {
    const r = validateObjectTypeDraft({ ...draft, properties: [{ key: 'id', label: 'Id', type: 'text', required: false }] })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('reserved')
  })
  it('rejects duplicate property keys', () => {
    const r = validateObjectTypeDraft({ ...draft, properties: [props[0], { ...props[0] }] })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('Duplicate')
  })
  it('rejects an empty label', () => {
    expect(validateObjectTypeDraft({ ...draft, label: '  ' }).ok).toBe(false)
  })
})

describe('validateRecord', () => {
  it('accepts a record with the required field set', () => {
    expect(validateRecord(props, { title: 'Leaky tap', data: { room: '204' } }).ok).toBe(true)
  })
  it('flags a missing required property', () => {
    const r = validateRecord(props, { title: 'x', data: {} })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('Room is required')
  })
  it('flags a wrong-typed value', () => {
    const r = validateRecord(props, { title: 'x', data: { room: '204', cost: 'lots' } })
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('Cost must be a number')
  })
  it('requires a title', () => {
    expect(validateRecord(props, { title: '', data: { room: '204' } }).ok).toBe(false)
  })
})

describe('coerceValue', () => {
  it('coerces number strings, blanks to null, keeps booleans', () => {
    expect(coerceValue('number', '42')).toBe(42)
    expect(coerceValue('number', '')).toBeNull()
    expect(coerceValue('number', 'nope')).toBeNull()
    expect(coerceValue('boolean', 'true')).toBe(true)
    expect(coerceValue('date', '2026-07-24')).toBe('2026-07-24')
    expect(coerceValue('date', 'not-a-date')).toBeNull()
  })
})

describe('validateLinkTypeDraft', () => {
  const draft: LinkTypeDraft = { apiName: 'belongs_to_room', label: 'Belongs to room', sourceTypeId: 's1', targetTypeId: 't1' }
  it('accepts a well-formed link type', () => {
    expect(validateLinkTypeDraft(draft).ok).toBe(true)
  })
  it('requires both a source and target type', () => {
    expect(validateLinkTypeDraft({ ...draft, targetTypeId: '' }).ok).toBe(false)
    expect(validateLinkTypeDraft({ ...draft, sourceTypeId: '' }).ok).toBe(false)
  })
  it('rejects a non-slug api name', () => {
    expect(validateLinkTypeDraft({ ...draft, apiName: 'Belongs To' }).ok).toBe(false)
  })
})

describe('evaluateComputed', () => {
  const now = new Date('2026-07-24T00:00:00Z')
  it('sums and multiplies number inputs', () => {
    expect(evaluateComputed({ key: 'total', label: 'Total', fn: 'sum', inputs: ['a', 'b'] }, { a: 3, b: 4 })).toBe(7)
    expect(evaluateComputed({ key: 'p', label: 'P', fn: 'product', inputs: ['a', 'b'] }, { a: 3, b: 4 })).toBe(12)
  })
  it('computes a difference and returns null on missing inputs', () => {
    expect(evaluateComputed({ key: 'd', label: 'D', fn: 'difference', inputs: ['a', 'b'] }, { a: 10, b: 4 })).toBe(6)
    expect(evaluateComputed({ key: 'd', label: 'D', fn: 'difference', inputs: ['a', 'b'] }, { a: 10 })).toBeNull()
  })
  it('computes days since / until a date', () => {
    expect(evaluateComputed({ key: 's', label: 'S', fn: 'days_since', inputs: ['when'] }, { when: '2026-07-20' }, now)).toBe(4)
    expect(evaluateComputed({ key: 'u', label: 'U', fn: 'days_until', inputs: ['when'] }, { when: '2026-07-27' }, now)).toBe(3)
    expect(evaluateComputed({ key: 's', label: 'S', fn: 'days_since', inputs: ['when'] }, { when: 'nope' }, now)).toBeNull()
  })
})

describe('validateComputedProperty', () => {
  const props: PropertyDef[] = [
    { key: 'a', label: 'A', type: 'number', required: false },
    { key: 'b', label: 'B', type: 'number', required: false },
    { key: 'when', label: 'When', type: 'date', required: false },
  ]
  const ok: ComputedPropertyDef = { key: 'total', label: 'Total', fn: 'sum', inputs: ['a', 'b'] }
  it('accepts a valid computed property', () => {
    expect(validateComputedProperty(ok, props).ok).toBe(true)
  })
  it('rejects a difference without exactly two inputs', () => {
    expect(validateComputedProperty({ ...ok, fn: 'difference', inputs: ['a'] }, props).ok).toBe(false)
  })
  it('rejects a number fn fed a date input', () => {
    const r = validateComputedProperty({ ...ok, inputs: ['when'] }, props)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('number inputs')
  })
  it('rejects an input that is not a property', () => {
    expect(validateComputedProperty({ ...ok, inputs: ['nope'] }, props).ok).toBe(false)
  })
})

describe('resolveViewConfig', () => {
  const type = {
    properties: props,   // room, urgent, reported_on, cost
    computedProperties: [{ key: 'days_open', label: 'Days open', fn: 'days_since', inputs: ['reported_on'] }] as ComputedPropertyDef[],
  }
  it('derives a standard view when no config: everything in one section', () => {
    const v = resolveViewConfig(type, null)
    expect(v.prominent).toEqual([])
    expect(v.sections).toHaveLength(1)
    expect(v.sections[0].title).toBe('Properties')
    expect(new Set(v.sections[0].keys)).toEqual(new Set(['room', 'urgent', 'reported_on', 'cost', 'days_open']))
  })
  it('keeps configured placement and sweeps the rest into Details', () => {
    const v = resolveViewConfig(type, { prominent: ['days_open', 'cost'], sections: [{ title: 'Where', keys: ['room'] }] })
    expect(v.prominent).toEqual(['days_open', 'cost'])
    expect(v.sections[0]).toEqual({ title: 'Where', keys: ['room'] })
    expect(v.sections[1].title).toBe('Details')
    expect(new Set(v.sections[1].keys)).toEqual(new Set(['urgent', 'reported_on', 'cost', 'days_open']))
  })
  it('drops keys that no longer exist on the type', () => {
    const v = resolveViewConfig(type, { prominent: ['ghost'], sections: [{ title: 'X', keys: ['ghost'] }] })
    expect(v.prominent).toEqual([])
    expect(v.sections).toHaveLength(1) // only the sweep section
  })
})

describe('validateViewConfig', () => {
  const type = { properties: props, computedProperties: [] as ComputedPropertyDef[] }
  it('accepts valid config', () => {
    expect(validateViewConfig({ prominent: ['cost'], sections: [{ title: 'Where', keys: ['room'] }] }, type).ok).toBe(true)
  })
  it('rejects unknown keys and duplicate placement', () => {
    const r = validateViewConfig({ prominent: ['nope'], sections: [{ title: 'A', keys: ['room'] }, { title: 'B', keys: ['room'] }] }, type)
    expect(r.ok).toBe(false)
    expect(r.errors.join(' ')).toContain('nope')
    expect(r.errors.join(' ')).toContain('more than one section')
  })
})

describe('toSlug', () => {
  it('slugifies a label', () => {
    expect(toSlug('Guest Complaint!')).toBe('guest_complaint')
    expect(toSlug('  Room 204 ')).toBe('room_204')
  })
})
