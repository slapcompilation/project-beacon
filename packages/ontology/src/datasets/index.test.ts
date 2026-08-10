import { describe, expect, it } from 'vitest'
import {
  FIELD_TYPES, NOT_A_BASE_TYPE, TRANSACTION_TYPES, TRANSACTION_STATUSES,
  describeField, validateDatasetSchema,
} from './index'
import type { DatasetField } from './index'

describe('the field type vocabulary', () => {
  it('is the fifteen from data-integration/datasets, and no more', () => {
    expect(FIELD_TYPES.map((t) => t.value)).toEqual([
      'BOOLEAN', 'BYTE', 'SHORT', 'INTEGER', 'LONG', 'FLOAT', 'DOUBLE',
      'DECIMAL', 'STRING', 'MAP', 'ARRAY', 'STRUCT', 'BINARY', 'DATE', 'TIMESTAMP',
    ])
  })

  // "All field types are valid base types except for Map and Binary types."
  it('excludes exactly Map and Binary from base types', () => {
    expect([...NOT_A_BASE_TYPE].sort()).toEqual(['BINARY', 'MAP'])
  })

  it('has the four transaction types and the three states', () => {
    expect(TRANSACTION_TYPES.map((t) => t.value)).toEqual(['SNAPSHOT', 'APPEND', 'UPDATE', 'DELETE'])
    expect(TRANSACTION_STATUSES.map((t) => t.value)).toEqual(['OPEN', 'COMMITTED', 'ABORTED'])
  })
})

describe('validateDatasetSchema', () => {
  it('accepts one column of every unparameterised type', () => {
    const fields: DatasetField[] = FIELD_TYPES
      .filter((t) => !['DECIMAL', 'ARRAY', 'MAP', 'STRUCT'].includes(t.value))
      .map((t) => ({ name: t.value.toLowerCase(), type: t.value }))
    expect(validateDatasetSchema(fields).ok).toBe(true)
  })

  it('accepts the four parameterised types when their parameters are present', () => {
    const r = validateDatasetSchema([
      { name: 'fare', type: 'DECIMAL', precision: 38, scale: 18 },
      { name: 'tags', type: 'ARRAY', arraySubType: { type: 'STRING' } },
      { name: 'meta', type: 'MAP', mapKeyType: { type: 'STRING' }, mapValueType: { type: 'LONG' } },
      { name: 'leg', type: 'STRUCT', subSchemas: [{ name: 'origin', type: 'STRING' }] },
    ])
    expect(r.errors).toEqual([])
    expect(r.ok).toBe(true)
  })

  // Each of these passed the first version of the SQL validator, because
  // jsonb_typeof of a missing key is NULL and `NOT NULL` is not true.
  it('rejects each parameterised type when its parameters are missing', () => {
    for (const f of [
      { name: 'a', type: 'DECIMAL' },
      { name: 'a', type: 'ARRAY' },
      { name: 'a', type: 'MAP', mapKeyType: { type: 'STRING' } },
      { name: 'a', type: 'STRUCT', subSchemas: [] },
    ] satisfies DatasetField[]) {
      expect(validateDatasetSchema([f]).ok, JSON.stringify(f)).toBe(false)
    }
  })

  it('rejects an unknown type, a bad name, and a duplicate', () => {
    expect(validateDatasetSchema([{ name: 'a', type: 'VARCHAR' as 'STRING' }]).ok).toBe(false)
    expect(validateDatasetSchema([{ name: 'A', type: 'STRING' }]).ok).toBe(false)
    expect(validateDatasetSchema([{ name: 'a', type: 'STRING' }, { name: 'a', type: 'LONG' }]).ok).toBe(false)
    expect(validateDatasetSchema([]).ok).toBe(false)
  })

  // "38 is the highest possible precision value", and a scale wider than the
  // precision is not a number the column can hold.
  it('bounds decimal precision at 38 and scale at the precision', () => {
    expect(validateDatasetSchema([{ name: 'a', type: 'DECIMAL', precision: 39, scale: 1 }]).ok).toBe(false)
    expect(validateDatasetSchema([{ name: 'a', type: 'DECIMAL', precision: 10, scale: 11 }]).ok).toBe(false)
    expect(validateDatasetSchema([{ name: 'a', type: 'DECIMAL', precision: 38, scale: 38 }]).ok).toBe(true)
  })

  it('validates nested types all the way down', () => {
    expect(validateDatasetSchema([
      { name: 'a', type: 'ARRAY', arraySubType: { type: 'DECIMAL', precision: 5 } },
    ]).ok).toBe(false)
    expect(validateDatasetSchema([
      { name: 'a', type: 'STRUCT', subSchemas: [{ name: 'b', type: 'MAP' }] },
    ]).ok).toBe(false)
  })
})

describe('describeField', () => {
  it('shows a parameterised type with its parameters, the way a column header does', () => {
    expect(describeField({ type: 'DECIMAL', precision: 38, scale: 18 })).toBe('Decimal(38,18)')
    expect(describeField({ type: 'ARRAY', arraySubType: { type: 'STRING' } })).toBe('Array<String>')
    expect(describeField({ type: 'MAP', mapKeyType: { type: 'STRING' }, mapValueType: { type: 'LONG' } }))
      .toBe('Map<String,Long>')
    expect(describeField({ type: 'STRUCT', subSchemas: [{ name: 'origin', type: 'STRING' }] }))
      .toBe('Struct{origin}')
    expect(describeField({ type: 'TIMESTAMP' })).toBe('Timestamp')
  })
})
