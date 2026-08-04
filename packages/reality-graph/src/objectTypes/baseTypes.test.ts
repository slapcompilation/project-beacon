import { describe, it, expect } from 'vitest'
import {
  PROPERTY_TYPES, canBeTitleKey, coerceValue, validateRecord,
  type PropertyDef,
} from './index'

describe('media reference and vector base types', () => {
  it('are offered alongside the four originals', () => {
    expect(PROPERTY_TYPES.map((t) => t.value))
      .toEqual(['text', 'number', 'boolean', 'date', 'media_reference', 'vector'])
  })

  it('can title nothing — Foundry allows neither as a title key', () => {
    expect(canBeTitleKey('text')).toBe(true)
    expect(canBeTitleKey('date')).toBe(true)
    expect(canBeTitleKey('media_reference')).toBe(false)
    expect(canBeTitleKey('vector')).toBe(false)
  })
})

describe('coerceValue for the new types', () => {
  it('keeps a media reference as a pointer, not a copy', () => {
    expect(coerceValue('media_reference', 'documents/abc/scan.pdf')).toBe('documents/abc/scan.pdf')
  })

  it('refuses a media value that is not a bucket path', () => {
    expect(coerceValue('media_reference', 'scan.pdf')).toBeNull()
    expect(coerceValue('media_reference', 42)).toBeNull()
  })

  it('accepts a vector only as finite numbers', () => {
    expect(coerceValue('vector', [0.1, -0.2, 3])).toEqual([0.1, -0.2, 3])
    // A stray string in an embedding poisons the index silently; refuse it.
    expect(coerceValue('vector', [0.1, 'x'])).toBeNull()
    expect(coerceValue('vector', [0.1, Number.NaN])).toBeNull()
    expect(coerceValue('vector', 'not an array')).toBeNull()
  })
})

describe('validateRecord for the new types', () => {
  const props: PropertyDef[] = [
    { key: 'scan', label: 'Scan', type: 'media_reference', required: false },
    { key: 'emb',  label: 'Embedding', type: 'vector', required: false },
  ]

  it('accepts a well-formed record', () => {
    expect(validateRecord(props, { title: 'x', data: { scan: 'documents/a/b.pdf', emb: [1, 2] } }).ok)
      .toBe(true)
  })

  it('says what a media value should look like', () => {
    expect(validateRecord(props, { title: 'x', data: { scan: 'nope' } }).errors.join(' '))
      .toMatch(/bucket\/path/)
  })

  it('says an embedding is written by the pipeline, not entered', () => {
    expect(validateRecord(props, { title: 'x', data: { emb: '0.1,0.2' } }).errors.join(' '))
      .toMatch(/written by the pipeline/)
  })
})
