// The two rules W2 copies from Foundry are behavioural, so they get a test.
// A comment saying "events do not wait" is not enforcement.

import { describe, it, expect } from 'vitest'
import {
  ROOT, applyEffects, effectsFor, initialState, interpolate, visibleVariableIds,
} from './runtime'
import type { ModuleDoc, ModuleEvent, ModuleLayout, ModuleVariable, ModuleWidget } from './api'

const v = (o: Partial<ModuleVariable> & { id: string }): ModuleVariable => ({
  apiName: o.id, label: o.id, varType: 'string', definitionKind: 'static',
  definition: {}, recompute: 'automatic', ...o,
})
const l = (o: Partial<ModuleLayout> & { id: string }): ModuleLayout => ({
  apiName: o.id, title: o.id, layoutType: 'section', parentId: null, position: 0, ...o,
})
const w = (o: Partial<ModuleWidget> & { id: string }): ModuleWidget => ({
  apiName: o.id, widgetType: 'metric_card', title: '', layoutId: null,
  variableId: null, config: {}, position: 0, ...o,
})
const e = (o: Partial<ModuleEvent> & { id: string }): ModuleEvent => ({
  sourceWidgetId: null, trigger: 'click', effectType: 'refresh_module',
  config: {}, position: 0, ...o,
})
const doc = (o: Partial<ModuleDoc>): ModuleDoc => ({
  id: 'm', apiName: 'm', title: 'M', description: '', icon: 'application',
  status: 'published', version: 1, hotelId: null,
  variables: [], layouts: [], widgets: [], events: [], ...o,
})

describe('lazy computation', () => {
  const mod = doc({
    variables: [v({ id: 'shown', varType: 'object_set' }), v({ id: 'hidden', varType: 'object_set' })],
    layouts: [
      l({ id: 'tab_a', layoutType: 'tab', position: 0 }),
      l({ id: 'tab_b', layoutType: 'tab', position: 1 }),
      l({ id: 'sheet', layoutType: 'overlay' }),
    ],
    widgets: [
      w({ id: 'w_a', layoutId: 'tab_a', variableId: 'shown' }),
      w({ id: 'w_b', layoutId: 'tab_b', variableId: 'hidden' }),
    ],
  })

  it('does not compute a variable behind an unselected tab', () => {
    const ids = visibleVariableIds(mod, initialState(mod))
    expect([...ids]).toEqual(['shown'])
  })

  it('computes it once its tab is selected', () => {
    const ui = { ...initialState(mod), activeTabByParent: { [ROOT]: 'tab_b' } }
    expect([...visibleVariableIds(mod, ui)]).toEqual(['hidden'])
  })

  it('does not compute a variable inside a closed overlay', () => {
    const m = doc({
      variables: [v({ id: 'deep', varType: 'object_set' })],
      layouts: [l({ id: 'sheet', layoutType: 'overlay' })],
      widgets: [w({ id: 'w', layoutId: 'sheet', variableId: 'deep' })],
    })
    expect(visibleVariableIds(m, initialState(m)).size).toBe(0)
    expect(visibleVariableIds(m, { ...initialState(m), openOverlays: ['sheet'] }).size).toBe(1)
  })

  it('DOES compute inside a collapsed section — Foundry lists pages, tabs and overlays, not sections', () => {
    const m = doc({
      variables: [v({ id: 'sec', varType: 'object_set' })],
      layouts: [l({ id: 'box', layoutType: 'section' })],
      widgets: [w({ id: 'w', layoutId: 'box', variableId: 'sec' })],
    })
    const ui = { ...initialState(m), collapsedSections: { box: true } }
    expect(visibleVariableIds(m, ui).size).toBe(1)
  })
})

describe('event dispatch', () => {
  const mod = doc({
    variables: [v({ id: 'sel' }), v({ id: 'count', varType: 'numeric', definition: { value: 7 } })],
    layouts: [l({ id: 'tab_a', layoutType: 'tab', position: 0 }), l({ id: 'tab_b', layoutType: 'tab', position: 1 })],
    widgets: [w({ id: 'btns', widgetType: 'button_group' }), w({ id: 'table', widgetType: 'object_table' })],
    events: [
      e({ id: 'e1', sourceWidgetId: 'btns', effectType: 'set_variable', position: 0,
          config: { button: 'go', variableId: 'sel', value: 'pressed' } }),
      e({ id: 'e2', sourceWidgetId: 'btns', effectType: 'switch_tab', position: 1,
          config: { button: 'go', layoutApiName: 'tab_b' } }),
      e({ id: 'e3', sourceWidgetId: 'btns', effectType: 'reset_variable', position: 2,
          config: { button: 'clear', variableId: 'sel' } }),
      e({ id: 'e4', sourceWidgetId: 'table', trigger: 'row_select', effectType: 'set_variable',
          config: { variableId: 'sel', fromProperty: 'name' } }),
    ],
  })

  it('fires only the effects bound to the button that was pressed', () => {
    expect(effectsFor(mod, 'btns', 'click', { button: 'go' }).map((x) => x.id)).toEqual(['e1', 'e2'])
    expect(effectsFor(mod, 'btns', 'click', { button: 'clear' }).map((x) => x.id)).toEqual(['e3'])
  })

  it('applies effects in position order', () => {
    const { state } = applyEffects(mod, initialState(mod),
      effectsFor(mod, 'btns', 'click', { button: 'go' }), { button: 'go' })
    expect(state.values.sel).toBe('pressed')
    expect(state.activeTabByParent[ROOT]).toBe('tab_b')
  })

  it('drives a variable from the selected row', () => {
    const ctx = { row: { name: 'Tomatoes', qty: 4 } }
    const { state } = applyEffects(mod, initialState(mod), effectsFor(mod, 'table', 'row_select', ctx), ctx)
    expect(state.values.sel).toBe('Tomatoes')
  })

  it('resets a variable to its static definition, not to undefined', () => {
    const started = { ...initialState(mod), values: { count: 99 } }
    const { state } = applyEffects(mod, started, [
      e({ id: 'r', effectType: 'reset_variable', config: { variableId: 'count' } }),
    ])
    expect(state.values.count).toBe(7)
  })

  // The rule, stated as a test: a run of effects folds over ONE state value.
  // Nothing in the run observes what a previous effect's recomputation produced,
  // because no recomputation has happened yet — it left as a side effect.
  it('does not wait for a previous effect to finish computing', () => {
    const m = doc({
      variables: [v({ id: 'set', varType: 'object_set' })],
      widgets: [w({ id: 'b', widgetType: 'button_group' })],
      events: [
        e({ id: 'a', sourceWidgetId: 'b', effectType: 'recompute_variable', position: 0,
            config: { variableId: 'set' } }),
        e({ id: 'c', sourceWidgetId: 'b', effectType: 'set_variable', position: 1,
            config: { variableId: 'set', value: 'read-before-recompute' } }),
      ],
    })
    const { state, sideEffects } = applyEffects(m, initialState(m), effectsFor(m, 'b', 'click'))
    expect(sideEffects).toEqual([{ kind: 'recompute', variableId: 'set' }])
    expect(state.values.set).toBe('read-before-recompute')
  })

  it('reports an effect the runtime does not implement instead of dropping it', () => {
    const { sideEffects } = applyEffects(doc({}), initialState(doc({})), [
      e({ id: 'x', effectType: 'open_object_view' }),
    ])
    expect(sideEffects).toEqual([{ kind: 'unsupported', effectType: 'open_object_view' }])
  })
})

describe('markdown interpolation', () => {
  const mod = doc({ variables: [v({ id: 'who', apiName: 'who', definition: { value: 'Valinor' } })] })
  it('reads module state and leaves unknown names alone', () => {
    const ui = initialState(mod)
    expect(interpolate('Property: {{who}} / {{nope}}', mod, ui)).toBe('Property: Valinor / {{nope}}')
  })
  it('shows an em dash for a variable with no value yet', () => {
    const m = doc({ variables: [v({ id: 'x', apiName: 'x' })] })
    expect(interpolate('{{x}}', m, initialState(m))).toBe('—')
  })
})
