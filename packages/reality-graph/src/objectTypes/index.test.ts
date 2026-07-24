import { describe, it, expect } from 'vitest'
import {
  validateObjectTypeDraft,
  validateRecord,
  coerceValue,
  toSlug,
  type PropertyDef,
  type ObjectTypeDraft,
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

describe('toSlug', () => {
  it('slugifies a label', () => {
    expect(toSlug('Guest Complaint!')).toBe('guest_complaint')
    expect(toSlug('  Room 204 ')).toBe('room_204')
  })
})
