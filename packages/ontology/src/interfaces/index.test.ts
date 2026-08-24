import { describe, expect, it } from 'vitest'
import { conformanceErrors, implementsInterface, typesConforming, validateInterfaceDraft, interfaceProperties, type InterfaceDef } from './index'
import { type ObjectTypeDef } from '../objectTypes/index'

const iface: InterfaceDef = {
  id: 'i1', apiName: 'serviceable', label: 'Serviceable', description: '',
  properties: [
    { key: 'room', label: 'Room', type: 'string' },
    { key: 'cost', label: 'Cost', type: 'integer' },
  ],
}

function type(label: string, props: ObjectTypeDef['properties']): ObjectTypeDef {
  return {
    id: label, apiName: label.toLowerCase(),
    label, icon: 'cube', description: '', properties: props,
    version: 1,
  }
}

const conforming = type('Maintenance Request', [
  { key: 'room', apiName: 'room', label: 'Room', type: 'string', required: true },
  { key: 'cost', apiName: 'cost', label: 'Cost', type: 'integer', required: false },
  { key: 'urgent', apiName: 'urgent', label: 'Urgent', type: 'boolean', required: false },  // extra is fine
])

describe('conformance', () => {
  it('accepts a type with the required shape, extra properties allowed', () => {
    expect(conformanceErrors(conforming, iface)).toEqual([])
    expect(implementsInterface(conforming, iface)).toBe(true)
  })

  it('rejects a type missing a required property', () => {
    const missing = type('Cleaning Task', [{ key: 'room', apiName: 'room', label: 'Room', type: 'string', required: true }])
    expect(conformanceErrors(missing, iface).join()).toContain('missing "Cost"')
  })

  it('rejects a type whose property is the wrong type — polymorphism must not lie', () => {
    const wrong = type('Inspection', [
      { key: 'room', apiName: 'room', label: 'Room', type: 'string', required: true },
      { key: 'cost', apiName: 'cost', label: 'Cost', type: 'string', required: false },
    ])
    expect(conformanceErrors(wrong, iface).join()).toContain('is string, but Serviceable requires integer')
  })

  it('filters a set to the types that genuinely conform', () => {
    const other = type('Room', [{ key: 'floor', apiName: 'floor', label: 'Floor', type: 'integer', required: false }])
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
    const dup = { ...iface, properties: [...iface.properties, { key: 'room', label: 'Room 2', type: 'string' as const }] }
    expect(validateInterfaceDraft(dup).join()).toContain('Duplicate property')
  })
})

describe('interfaceProperties', () => {
  it('exposes interface fields as properties a tool can target', () => {
    expect(interfaceProperties(iface).map((p) => p.key)).toEqual(['room', 'cost'])
  })
})
