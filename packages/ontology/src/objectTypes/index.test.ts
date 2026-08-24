import { describe, it, expect } from 'vitest'
import {
  validateObjectTypeDraft,
  objectTitle,
  validateRecord,
  coerceValue,
  toSlug,
  validateLinkTypeDraft,
  type PropertyDef,
  type ObjectTypeDraft,
  type LinkTypeDraft,
} from './index'

const props: PropertyDef[] = [
  { key: 'room', apiName: 'room', label: 'Room', type: 'string', required: true },
  { key: 'urgent', apiName: 'urgent', label: 'Urgent', type: 'boolean', required: false },
  { key: 'reported_on', apiName: 'reported_on', label: 'Reported on', type: 'date', required: false },
  { key: 'cost', apiName: 'cost', label: 'Cost', type: 'integer', required: false },
]

describe('validateObjectTypeDraft', () => {
  // A complete draft: the two keys designated, every property backed by a column.
  const complete = [
    { key: 'request_id', apiName: 'requestId', label: 'Request ID', type: 'string' as const,
      required: true, backingColumn: 'request_id', isPrimaryKey: true },
    { key: 'summary', apiName: 'summary', label: 'Summary', type: 'string' as const,
      required: false, backingColumn: 'summary', isTitleKey: true },
  ]
  const draft: ObjectTypeDraft = { apiName: 'MaintenanceRequest', label: 'Maintenance Request', properties: complete }

  it('accepts a well-formed type', () => {
    expect(validateObjectTypeDraft(draft).errors).toEqual([])
  })

  // "Begin with an uppercase character... written in PascalCase" for an object
  // type; "Begin with a lowercase character... written in camelCase" for a
  // property. The two are different rules, and we used to apply one to both.
  it('wants PascalCase on the type and camelCase on its properties', () => {
    expect(validateObjectTypeDraft({ ...draft, apiName: 'maintenance_request' }).ok).toBe(false)
    expect(validateObjectTypeDraft({ ...draft, apiName: 'Maintenance Request' }).ok).toBe(false)
    const r = validateObjectTypeDraft({
      ...draft, properties: [{ ...complete[0], apiName: 'RequestId' }, complete[1]],
    })
    expect(r.errors.join(' ')).toContain('camelCase')
  })

  it('rejects a reserved API name', () => {
    const r = validateObjectTypeDraft({
      ...draft, properties: [{ ...complete[0], apiName: 'rid' }, complete[1]],
    })
    expect(r.errors.join(' ')).toContain('reserved')
  })

  it('rejects duplicate property IDs', () => {
    const r = validateObjectTypeDraft({ ...draft, properties: [complete[0], { ...complete[0] }] })
    expect(r.errors.join(' ')).toContain('Duplicate')
  })

  // The completeness contract, which is stated over the type and its properties
  // as one list: "Property ID, Property display name, Backing column, Property
  // API name, Title key, Primary key".
  it('wants both keys, and a backing column for every column-sourced property', () => {
    expect(validateObjectTypeDraft({ ...draft, properties: [complete[1]] }).errors.join(' '))
      .toContain('primary key')
    expect(validateObjectTypeDraft({ ...draft, properties: [complete[0]] }).errors.join(' '))
      .toContain('title key')
    const noColumn = validateObjectTypeDraft({
      ...draft, properties: [complete[0], { ...complete[1], backingColumn: '' }],
    })
    expect(noColumn.errors.join(' ')).toContain('backing column')
    // ...unless it is not read from one at all. An edit-only property still
    // names a datasource: it escapes the column, not the permissioning.
    const byHand = validateObjectTypeDraft({
      ...draft,
      properties: [complete[0], {
        ...complete[1], backingColumn: null, source: 'user_input' as const,
        datasourceId: '00000000-0000-0000-0000-000000000545',
      }],
    })
    expect(byHand.errors).toEqual([])

    const unpermissioned = validateObjectTypeDraft({
      ...draft,
      properties: [complete[0], {
        ...complete[1], backingColumn: null, source: 'user_input' as const, datasourceId: null,
      }],
    })
    expect(unpermissioned.errors.join(' ')).toContain('permissioned')
  })

  it('refuses a nullable primary key', () => {
    const r = validateObjectTypeDraft({
      ...draft, properties: [{ ...complete[0], required: false }, complete[1]],
    })
    expect(r.errors.join(' ')).toContain('not a key')
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
    expect(coerceValue('integer', '42')).toBe(42)
    expect(coerceValue('integer', '')).toBeNull()
    expect(coerceValue('integer', 'nope')).toBeNull()
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

describe('toSlug', () => {
  it('slugifies a label', () => {
    expect(toSlug('Guest Complaint!')).toBe('guest_complaint')
    expect(toSlug('  Room 204 ')).toBe('room_204')
  })
})

describe('objectTitle', () => {
  it('uses the title key — the property Foundry says names the object', () => {
    expect(objectTitle({ properties: [{ key: 'po_number', apiName: 'po_number', label: 'T', type: 'string', required: false, isTitleKey: true }], label: 'Purchase order' },
      { id: 'abc', po_number: 'PO-1042' })).toBe('PO-1042')
  })

  it('titles on dates and numbers, not only text', () => {
    // A stock log has no name column; when it happened is the handle.
    expect(objectTitle({ properties: [{ key: 'timestamp', apiName: 'timestamp', label: 'T', type: 'string', required: false, isTitleKey: true }], label: 'Stock log' },
      { id: 'x', timestamp: '2026-08-04T09:00:00Z' })).toBe('2026-08-04T09:00:00Z')
    expect(objectTitle({ properties: [{ key: 'floor', apiName: 'floor', label: 'T', type: 'string', required: false, isTitleKey: true }], label: 'Room' }, { id: 'x', floor: 3 })).toBe('3')
  })

  it('falls back to the record title — authored records always carry one', () => {
    expect(objectTitle({ properties: [], label: 'Incident' },
      { id: 'abc12345678', title: 'Lift stuck on 4' })).toBe('Lift stuck on 4')
  })

  it('skips an empty title-key value rather than showing a blank name', () => {
    expect(objectTitle({ properties: [{ key: 'notes', apiName: 'notes', label: 'T', type: 'string', required: false, isTitleKey: true }], label: 'Line' },
      { id: 'abcdef1234', notes: '', title: 'from record' })).toBe('from record')
  })

  it('names the type and the id when nothing in the row names the row', () => {
    // The four relational line types reach here: parent id, variant id, numbers.
    expect(objectTitle({ properties: [], label: 'PO line' },
      { id: 'abcdef1234567', ordered_qty: 5 })).toBe('PO line abcdef12')
  })

  it('does not trail a bare space when the row has no id', () => {
    expect(objectTitle({ properties: [], label: 'PO line' }, {})).toBe('PO line')
  })

  it('never guesses a text property — the bug migration 346 removed', () => {
    // `supplier_name` is text and would have been picked by the old guess.
    expect(objectTitle({ properties: [], label: 'Line' },
      { id: 'aaaabbbbcccc', supplier_name: 'Ada Foods' })).toBe('Line aaaabbbb')
  })
})
