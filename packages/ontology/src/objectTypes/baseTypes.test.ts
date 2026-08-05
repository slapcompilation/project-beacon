import { describe, it, expect } from 'vitest'
import {
  PROPERTY_TYPES, canBeTitleKey, coerceValue, validateRecord,
  parseGeopoint, formatGeopoint,
  type PropertyDef,
} from './index'

describe('the advanced base types', () => {
  it('are offered alongside the four originals', () => {
    expect(PROPERTY_TYPES.map((t) => t.value))
      .toEqual(['text', 'number', 'boolean', 'date', 'media_reference', 'vector', 'geopoint'])
  })

  it('title only where Foundry allows it — geopoint may, the other two may not', () => {
    expect(canBeTitleKey('text')).toBe(true)
    expect(canBeTitleKey('date')).toBe(true)
    expect(canBeTitleKey('geopoint')).toBe(true)
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

  it('stores a geopoint in Foundry\'s comma-separated format', () => {
    // Their own example: "57.64911,10.40744".
    expect(coerceValue('geopoint', '57.64911,10.40744')).toBe('57.64911,10.40744')
    expect(coerceValue('geopoint', ' 37.9838 , 23.7275 ')).toBe('37.9838,23.7275')
  })

  it('refuses coordinates that are not on the globe', () => {
    expect(coerceValue('geopoint', '91,0')).toBeNull()
    expect(coerceValue('geopoint', '0,181')).toBeNull()
    // lat,lng — never lng,lat, and never a third component.
    expect(coerceValue('geopoint', '1,2,3')).toBeNull()
    expect(coerceValue('geopoint', '37.9838')).toBeNull()
    expect(coerceValue('geopoint', 'Athens')).toBeNull()
  })
})

describe('parseGeopoint', () => {
  it('round-trips through format', () => {
    const p = parseGeopoint('37.9838,23.7275')
    expect(p).toEqual({ lat: 37.9838, lng: 23.7275 })
    expect(formatGeopoint(p!.lat, p!.lng)).toBe('37.9838,23.7275')
  })

  it('reads latitude first — the order the map depends on', () => {
    // Valinor is at lat 37.98 / lng 23.73. Swapped, the pin lands in Somalia.
    expect(parseGeopoint('37.9838,23.7275')?.lat).toBe(37.9838)
  })

  it('is null for anything it cannot trust', () => {
    for (const v of ['', '1,', ',2', 'a,b', '1,2,3', null, undefined, 42, { lat: 1, lng: 2 }]) {
      expect(parseGeopoint(v)).toBeNull()
    }
  })

  it('accepts the negative hemispheres', () => {
    expect(parseGeopoint('-33.8688,-151.2093')).toEqual({ lat: -33.8688, lng: -151.2093 })
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
