// Foundry's parameter model, as rules: three sources, three visibility states.

import { describe, it, expect } from 'vitest'
import { argsReady, resolveArgs, resolveParameters } from './bindings'
import { initialState } from './runtime'
import type { ModuleDoc, ModuleVariable } from './api'

const v = (o: Partial<ModuleVariable> & { id: string; apiName: string }): ModuleVariable => ({
  label: o.apiName, varType: 'string', definitionKind: 'static',
  definition: {}, recompute: 'automatic', isInterface: false, ...o,
})
const doc = (variables: ModuleVariable[]): ModuleDoc => ({
  id: 'm', apiName: 'm', title: 'M', description: '', icon: 'application',
  status: 'published', version: 1, hotelId: null,
  variables, layouts: [], widgets: [], events: [],
})

const mod = doc([
  v({ id: '1', apiName: 'selectedId', definition: { value: 'var-123' } }),
  v({ id: '2', apiName: 'gap', varType: 'numeric', definition: { value: 12 } }),
])
const ui = initialState(mod)

describe('action parameters', () => {
  it('routes hidden bindings to context and visible ones to prefilled values', () => {
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK',
      parameters: {
        variantId: { source: 'variable', variableApiName: 'selectedId', visibility: 'hidden' },
        quantityNeeded: { source: 'variable', variableApiName: 'gap' },
        urgency:   { source: 'static', value: 'high' },
      },
    }, { mod, ui })

    expect(r.context).toEqual({ variantId: 'var-123' })
    expect(r.initialValues).toEqual({ quantityNeeded: 12, urgency: 'high' })
    expect(r.disabled).toEqual([])
  })

  it('marks a disabled parameter read-only while still prefilling it', () => {
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK',
      parameters: { urgency: { source: 'static', value: 'high', visibility: 'disabled' } },
    }, { mod, ui })
    expect(r.initialValues.urgency).toBe('high')
    expect(r.disabled).toEqual(['urgency'])
  })

  it('leaves user_input parameters entirely to the form', () => {
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK', parameters: { reason: { source: 'user_input' } },
    }, { mod, ui })
    expect(r.context).toEqual({})
    expect(r.initialValues).toEqual({})
  })

  it('reads the CURRENT value of a variable, not its definition', () => {
    const moved = { ...ui, values: { ...ui.values, '1': 'var-999' } }
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK',
      parameters: { variantId: { source: 'variable', variableApiName: 'selectedId', visibility: 'hidden' } },
    }, { mod, ui: moved })
    expect(r.context.variantId).toBe('var-999')
  })

  // A function-defined variable's value lives in the resolved map, not in UI
  // state. Binding to one is how a Logic Tool's output becomes an action
  // parameter — the e2e caught this arriving empty.
  it('reads a value a Logic Tool computed', () => {
    const withFn = doc([...mod.variables,
      v({ id: '3', apiName: 'forecast7d', varType: 'numeric', definitionKind: 'function' })])
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK',
      parameters: { quantityNeeded: { source: 'variable', variableApiName: 'forecast7d' } },
    }, { mod: withFn, ui: initialState(withFn), computed: new Map([['3', 42]]) })
    expect(r.initialValues.quantityNeeded).toBe(42)
  })

  // A typo'd binding must not silently become a missing parameter the operator
  // has to reverse-engineer from a validation error.
  it('reports a binding that names a variable the module does not have', () => {
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK',
      parameters: { variantId: { source: 'variable', variableApiName: 'noSuchThing' } },
    }, { mod, ui })
    expect(r.unresolved).toEqual(['variantId'])
  })
})

describe('tool arguments', () => {
  it('binds from variables and statics', () => {
    const args = resolveArgs({
      variantId:    { source: 'variable', variableApiName: 'selectedId' },
      horizonDays:  { source: 'static', value: 7 },
    }, { mod, ui })
    expect(args).toEqual({ variantId: 'var-123', horizonDays: 7 })
  })

  it('is not ready while any argument is still unset', () => {
    expect(argsReady({ a: 1, b: 'x' })).toBe(true)
    expect(argsReady({ a: 1, b: undefined })).toBe(false)
    expect(argsReady({ a: 1, b: '' })).toBe(false)
  })
})

// Caught the first time a real module was authored: `quantity` bound cleanly,
// resolved to the right number, and went nowhere — the field is `quantityNeeded`.
describe('parameter names are checked against the action', () => {
  // Parameter checking needs a registered action to check against. No action
  // type ships in code now, so an unregistered type is reported as unknown by
  // the spec validator instead, and nothing is checked here.
  it('checks nothing when the action type is not registered', () => {
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK', parameters: { quantity: { source: 'static', value: 5 } },
    }, { mod, ui })
    expect(r.unknownParameters).toEqual([])
  })

  it('fills ambient context the author never binds', () => {
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK',
      parameters: { variantId: { source: 'static', value: 'v1', visibility: 'hidden' } },
    }, { mod, ui, ambient: { hotelId: 'h1', requestorId: 'u1' } })
    // Ambient fills the descriptor's contextFields; with no descriptor there
    // are none to fill, so only what the module bound comes through.
    expect(r.context).toEqual({ variantId: 'v1' })
  })

  it('never lets ambient context overwrite what the module bound', () => {
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK',
      parameters: { hotelId: { source: 'static', value: 'sister-property', visibility: 'hidden' } },
    }, { mod, ui, ambient: { hotelId: 'h1' } })
    expect(r.context.hotelId).toBe('sister-property')
  })

  it('accepts both visible fields and hidden context parameters', () => {
    const r = resolveParameters({
      type: 'REQUEST_RESTOCK',
      parameters: {
        quantityNeeded: { source: 'static', value: 5 },
        variantId: { source: 'static', value: 'x', visibility: 'hidden' },
      },
    }, { mod, ui })
    expect(r.unknownParameters).toEqual([])
  })
})
