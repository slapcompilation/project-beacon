// The two rules W2 copies from Foundry are behavioural, so they get a test.
// A comment saying "events do not wait" is not enforcement.

import { describe, it, expect } from 'vitest'
import {
  ROOT, applyEffects, effectsFor, initialState, interpolate, selectedTabKey,
  tabState, visibleVariableIds,
} from './runtime'
import type { ModuleDoc, ModuleEvent, ModuleLayout, ModuleVariable, ModuleWidget } from './api'

const v = (o: Partial<ModuleVariable> & { id: string }): ModuleVariable => ({
  apiName: o.id, label: o.id, varType: 'string', definitionKind: 'static',
  definition: {}, recompute: 'automatic', isInterface: false, ...o,
})
const l = (o: Partial<ModuleLayout> & { id: string }): ModuleLayout => ({
  apiName: o.id, title: o.id, layoutType: 'section', parentId: null, position: 0,
  config: {}, ...o,
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

// What makes a loop useful: the loop hands the child a whole object, so the
// child needs a way to read one property off it or a card can only print JSON.
describe('reaching into an object', () => {
  const row = { name: 'Tomatoes', current_stock: 4, supplier: { name: 'Rivendell Produce' } }
  const mod = doc({ variables: [v({ id: 'item', apiName: 'item', definition: { value: row } })] })
  const ui = initialState(mod)

  it('reads a property of the injected object', () => {
    expect(interpolate('{{item.name}} — {{item.current_stock}} left', mod, ui))
      .toBe('Tomatoes — 4 left')
  })

  it('follows a nested path', () => {
    expect(interpolate('{{item.supplier.name}}', mod, ui)).toBe('Rivendell Produce')
  })

  it('shows an em dash rather than throwing when the path is not there', () => {
    expect(interpolate('{{item.nope.deeper}}', mod, ui)).toBe('—')
  })

  it('still prints the whole value when no path is given', () => {
    expect(interpolate('{{item}}', mod, ui)).toContain('Tomatoes')
  })
})

// A loop consumes a variable from its config rather than through a widget
// binding. Missing that made a loop show "nothing in the set" forever.
describe('a loop is a consumer too', () => {
  const mod = doc({
    variables: [v({ id: 'set', apiName: 'items', varType: 'object_set' })],
    layouts: [l({ id: 'each', layoutType: 'loop', config: { variable: 'items', module: 'card', itemInto: 'item' } })],
  })

  it('resolves the set a visible loop walks, with no widget bound to it', () => {
    expect([...visibleVariableIds(mod, initialState(mod))]).toEqual(['set'])
  })

  it('leaves it alone when the loop sits inside a tab that is not showing', () => {
    const hidden = doc({
      variables: mod.variables,
      layouts: [
        l({ id: 'first', layoutType: 'tab', position: 0 }),
        l({ id: 'second', layoutType: 'tab', position: 1 }),
        l({ id: 'each', layoutType: 'loop', parentId: 'second',
            config: { variable: 'items', module: 'card', itemInto: 'item' } }),
      ],
    })
    expect(visibleVariableIds(hidden, initialState(hidden)).size).toBe(0)
  })
})

// Foundry's Tabs widget derives selection rather than holding it: a tab reads as
// selected when pressing it would change nothing. Nobody would invent that, so
// it is copied and tested.
describe('the Tabs widget derives its selection', () => {
  const mod = doc({
    layouts: [
      l({ id: 'first', apiName: 'first', layoutType: 'tab', position: 0 }),
      l({ id: 'second', apiName: 'second', layoutType: 'tab', position: 1 }),
    ],
    widgets: [w({ id: 'nav', widgetType: 'tabs' })],
    events: [
      e({ id: 'a', sourceWidgetId: 'nav', effectType: 'switch_tab',
          config: { button: 'now', layoutApiName: 'first' } }),
      e({ id: 'b', sourceWidgetId: 'nav', effectType: 'switch_tab',
          config: { button: 'all', layoutApiName: 'second' } }),
    ],
  })
  const tabs = [{ key: 'now', label: 'Now' }, { key: 'all', label: 'Everything' }]

  it('selects the tab whose event would do nothing', () => {
    expect(selectedTabKey(mod, initialState(mod), 'nav', tabs)).toBe('now')
  })

  it('follows the layout state rather than the press', () => {
    const onSecond = { ...initialState(mod), activeTabByParent: { [ROOT]: 'second' } }
    expect(selectedTabKey(mod, onSecond, 'nav', tabs)).toBe('all')
  })

  it('selects nothing when no tab describes where you are', () => {
    const orphan = doc({ widgets: [w({ id: 'nav', widgetType: 'tabs' })] })
    expect(selectedTabKey(orphan, initialState(orphan), 'nav', tabs)).toBeNull()
  })

  // "Set variable value events are not currently used to check for selected tab
  // state." Copied as a limit, not improved on.
  it('ignores set_variable events entirely', () => {
    const m = doc({
      variables: [v({ id: 'x', apiName: 'x' })],
      widgets: [w({ id: 'nav', widgetType: 'tabs' })],
      events: [e({ id: 's', sourceWidgetId: 'nav', effectType: 'set_variable',
        config: { button: 'now', variableId: 'x', value: 'anything' } })],
    })
    expect(selectedTabKey(m, initialState(m), 'nav', tabs)).toBeNull()
  })

  // "Preferring the earliest tab in the case of a tie."
  it('prefers the earliest tab when two describe the same state', () => {
    const m = doc({
      layouts: [l({ id: 'first', apiName: 'first', layoutType: 'tab', position: 0 })],
      widgets: [w({ id: 'nav', widgetType: 'tabs' })],
      events: [
        e({ id: 'a', sourceWidgetId: 'nav', effectType: 'switch_tab',
            config: { button: 'now', layoutApiName: 'first' } }),
        e({ id: 'b', sourceWidgetId: 'nav', effectType: 'switch_tab',
            config: { button: 'all', layoutApiName: 'first' } }),
      ],
    })
    expect(selectedTabKey(m, initialState(m), 'nav', tabs)).toBe('now')
  })
})

describe('a tab can be gated on a boolean', () => {
  const base = (over: Record<string, unknown>) => doc({
    variables: [v({ id: 'ok', apiName: 'ready', varType: 'boolean', definition: over }) ],
  })

  it('shows normally with no gate', () => {
    expect(tabState(doc({}), initialState(doc({})), { key: 'a' })).toBe('shown')
  })

  it('disables rather than hides by default', () => {
    const m = base({ value: false })
    expect(tabState(m, initialState(m), { key: 'a', visibleWhen: 'ready' })).toBe('disabled')
  })

  it('hides when the author asked for hidden', () => {
    const m = base({ value: false })
    expect(tabState(m, initialState(m), { key: 'a', visibleWhen: 'ready', whenFalse: 'hidden' }))
      .toBe('hidden')
  })

  it('shows once the variable is true', () => {
    const m = base({ value: true })
    expect(tabState(m, initialState(m), { key: 'a', visibleWhen: 'ready', whenFalse: 'hidden' }))
      .toBe('shown')
  })
})
