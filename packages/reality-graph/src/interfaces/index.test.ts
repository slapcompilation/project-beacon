import { describe, expect, it } from 'vitest'
import { conformanceErrors, implementsInterface, typesConforming, validateInterfaceDraft, interfaceProperties, type InterfaceDef } from './index'
import { EMPTY_VIEW_CONFIG, type ObjectTypeDef } from '../objectTypes/index'

const iface: InterfaceDef = {
  id: 'i1', organizationId: 'o1', apiName: 'serviceable', label: 'Serviceable', description: '',
  properties: [
    { key: 'room', label: 'Room', type: 'text' },
    { key: 'cost', label: 'Cost', type: 'number' },
  ],
}

function type(label: string, props: ObjectTypeDef['properties']): ObjectTypeDef {
  return {
    id: label, organizationId: 'o1', hotelId: null, apiName: label.toLowerCase(),
    label, icon: 'cube', description: '', properties: props,
    computedProperties: [], viewConfig: EMPTY_VIEW_CONFIG, enabled: true, version: 1,
  }
}

const conforming = type('Maintenance Request', [
  { key: 'room', label: 'Room', type: 'text', required: true },
  { key: 'cost', label: 'Cost', type: 'number', required: false },
  { key: 'urgent', label: 'Urgent', type: 'boolean', required: false },  // extra is fine
])

describe('conformance', () => {
  it('accepts a type with the required shape, extra properties allowed', () => {
    expect(conformanceErrors(conforming, iface)).toEqual([])
    expect(implementsInterface(conforming, iface)).toBe(true)
  })

  it('rejects a type missing a required property', () => {
    const missing = type('Cleaning Task', [{ key: 'room', label: 'Room', type: 'text', required: true }])
    expect(conformanceErrors(missing, iface).join()).toContain('missing "Cost"')
  })

  it('rejects a type whose property is the wrong type — polymorphism must not lie', () => {
    const wrong = type('Inspection', [
      { key: 'room', label: 'Room', type: 'text', required: true },
      { key: 'cost', label: 'Cost', type: 'text', required: false },
    ])
    expect(conformanceErrors(wrong, iface).join()).toContain('is text, but Serviceable requires number')
  })

  it('filters a set to the types that genuinely conform', () => {
    const other = type('Room', [{ key: 'floor', label: 'Floor', type: 'number', required: false }])
    expect(typesConforming([conforming, other], iface).map((t) => t.label)).toEqual(['Maintenance Request'])
  })
})

describe('validateInterfaceDraft', () => {
  it('accepts a well-formed interface', () => {
    expect(validateInterfaceDraft(iface)).toEqual([])
  })

  it('rejects an interface that promises nothing', () => {
    expect(validateInterfaceDraft({ ...iface, properties: [] }).join()).toContain('promises nothing')
  })

  it('rejects duplicate property keys', () => {
    const dup = { ...iface, properties: [...iface.properties, { key: 'room', label: 'Room 2', type: 'text' as const }] }
    expect(validateInterfaceDraft(dup).join()).toContain('Duplicate property')
  })
})

describe('interfaceProperties', () => {
  it('exposes interface fields as properties a tool can target', () => {
    expect(interfaceProperties(iface).map((p) => p.key)).toEqual(['room', 'cost'])
  })
})
