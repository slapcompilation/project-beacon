import { describe, it, expect } from 'vitest'
import {
  resolveProperty, resolveProperties, attachProblem, usedBy, INHERITED_FIELDS,
  type SharedPropertyDef,
} from './sharedProperties'
import type { PropertyDef } from './index'

const cost: SharedPropertyDef = {
  id: 'sp1', apiName: 'cost', label: 'Cost',
  description: 'What it cost us, in the property currency.',
  baseType: 'integer', visibility: 'prominent',
}
const shared = new Map([['cost', cost]])

const attached: PropertyDef = {
  key: 'unit_cost', apiName: 'unit_cost', label: 'Unit cost', type: 'integer', required: true, sharedPropertyId: 'cost',
}
const loose: PropertyDef = {
  key: 'note', apiName: 'note', label: 'Note', type: 'string', required: false,
}

describe('resolveProperty', () => {
  it('never changes the api name — downstream workflows are bound to it', () => {
    // "the property ID and API name of the object-specific property will remain
    // unchanged so as to not break existing downstream workflows".
    expect(resolveProperty(attached, shared).key).toBe('unit_cost')
  })

  it('inherits the metadata the definition owns', () => {
    const r = resolveProperty(attached, shared)
    expect(r.label).toBe('Cost')
    expect(r.description).toBe(cost.description)
    expect(r.visibility).toBe('prominent')
    expect(r.type).toBe('integer')
  })

  it('keeps `required` per object type', () => {
    // A field can be mandatory on one type and optional on another; Foundry
    // keeps required-properties separate from the shared subset.
    expect(resolveProperty(attached, shared).required).toBe(true)
    expect(resolveProperty({ ...attached, required: false }, shared).required).toBe(false)
  })

  it('leaves an unattached property entirely alone', () => {
    const r = resolveProperty(loose, shared)
    expect(r).toMatchObject({ key: 'note', apiName: 'note', label: 'Note', type: 'string', sharedPropertyId: null })
    expect(r.visibility).toBe('normal')
  })

  it('falls back to the property when the definition is missing', () => {
    // The database refuses this, but a stale client read should render the
    // property rather than blank fields.
    const r = resolveProperty({ ...attached, sharedPropertyId: 'gone' }, shared)
    expect(r.label).toBe('Unit cost')
    expect(r.type).toBe('integer')
  })

  it('resolves a whole list', () => {
    expect(resolveProperties([attached, loose], shared).map((p) => p.label))
      .toEqual(['Cost', 'Note'])
  })
})

describe('attachProblem', () => {
  it('refuses a base type that does not match the column', () => {
    // "Base types... must match the column type in order to be applied."
    expect(attachProblem(loose, cost)).toMatch(/base types have to match/i)
    expect(attachProblem(attached, cost)).toBeNull()
  })
})

describe('usedBy', () => {
  it('finds every type inheriting from a definition', () => {
    const types = [
      { label: 'Variant', properties: [attached] },
      { label: 'Asset', properties: [loose] },
      { label: 'Order', properties: [loose, { ...attached, key: 'line_cost' }] },
    ]
    expect(usedBy('cost', types).map((t) => t.label)).toEqual(['Variant', 'Order'])
    expect(usedBy('nothing', types)).toEqual([])
  })
})

describe('INHERITED_FIELDS', () => {
  it('names exactly what the object type may no longer edit', () => {
    // "direct edits to property metadata that is inherited from the shared
    // property will be disabled" — key and required are not in the set.
    expect([...INHERITED_FIELDS]).toEqual(['label', 'type', 'description', 'visibility'])
    expect(INHERITED_FIELDS).not.toContain('key')
    expect(INHERITED_FIELDS).not.toContain('required')
  })
})
