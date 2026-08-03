// The two rules W2 copies from Foundry are behavioural, so they get a test.
// A comment saying "events do not wait" is not enforcement.

import { describe, it, expect } from 'vitest'
import {
  ROOT, aggregateSet, aggregationSource, applyEffects, applyObjectSetFilter,
  effectsFor, initialState, interpolate, propertyValues, selectedTabKey,
  shouldCompute, tabState, visibleVariableIds,
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

// Foundry's six metrics, from functions/api-object-sets. Named as they name them.
describe('aggregating an object set', () => {
  const rows = [
    { qty: 10, cat: 'dry', at: '2026-01-10T00:00:00Z' },
    { qty: 5,  cat: 'dry', at: '2026-01-20T00:00:00Z' },
    { qty: 15, cat: 'cold', at: '2026-01-30T00:00:00Z' },
  ]

  it('counts objects, not values, and needs no property', () => {
    expect(aggregateSet(rows, 'count')).toBe(3)
    expect(aggregateSet([], 'count')).toBe(0)
  })

  it('sums, averages, mins and maxes a numeric property', () => {
    expect(aggregateSet(rows, 'sum', 'qty')).toBe(30)
    expect(aggregateSet(rows, 'average', 'qty')).toBe(10)
    expect(aggregateSet(rows, 'min', 'qty')).toBe(5)
    expect(aggregateSet(rows, 'max', 'qty')).toBe(15)
  })

  // "The sum of values for the given NUMERIC property" — dates are not summable
  // and Foundry does not offer it.
  it('refuses to sum a date property while still ordering it', () => {
    expect(aggregateSet(rows, 'sum', 'at')).toBeNull()
    expect(aggregateSet(rows, 'min', 'at')).toBe('2026-01-10T00:00:00.000Z')
    expect(aggregateSet(rows, 'max', 'at')).toBe('2026-01-30T00:00:00.000Z')
    expect(aggregateSet(rows, 'average', 'at')).toBe('2026-01-20T00:00:00.000Z')
  })

  // Theirs is documented as APPROXIMATE because it runs over an index; ours is
  // exact because the objects are already in hand.
  it('counts distinct values exactly', () => {
    expect(aggregateSet(rows, 'cardinality', 'cat')).toBe(2)
  })

  it('answers null rather than zero when there is nothing to measure', () => {
    expect(aggregateSet(rows, 'sum', 'nope')).toBeNull()
    expect(aggregateSet([], 'average', 'qty')).toBeNull()
    expect(aggregateSet(rows, 'sum')).toBeNull()
  })

  it('ignores nulls instead of treating them as zero', () => {
    const sparse = [{ qty: 10 }, { qty: null }, { qty: 20 }]
    expect(aggregateSet(sparse, 'average', 'qty')).toBe(15)
    expect(aggregateSet(sparse, 'count')).toBe(3)
  })
})

// An aggregation names another VARIABLE, not a saved set — one set variable can
// back a count, a sum and an average without three near-identical sets.
describe('what an aggregation reads from', () => {
  const mod = doc({
    variables: [
      v({ id: 'set', apiName: 'lowStock', varType: 'object_set' }),
      v({ id: 'agg', apiName: 'lines', varType: 'numeric',
          definitionKind: 'object_set_aggregation',
          definition: { objectSet: 'lowStock', metric: 'count' } }),
    ],
    widgets: [w({ id: 'card', widgetType: 'metric_card', variableId: 'agg' })],
  })

  it('resolves the set behind a displayed aggregation', () => {
    // The card shows the aggregation; the SET is what has to be fetched.
    expect([...visibleVariableIds(mod, initialState(mod))].sort()).toEqual(['agg', 'set'])
  })

  it('leaves the set alone when the aggregation is behind a hidden tab', () => {
    const hidden = doc({
      variables: mod.variables,
      layouts: [
        l({ id: 'first', layoutType: 'tab', position: 0 }),
        l({ id: 'second', layoutType: 'tab', position: 1 }),
      ],
      widgets: [w({ id: 'card', widgetType: 'metric_card', variableId: 'agg', layoutId: 'second' })],
    })
    expect(visibleVariableIds(hidden, initialState(hidden)).size).toBe(0)
  })

  it('does not resolve a source that is not an object set', () => {
    const wrong = doc({
      variables: [
        v({ id: 'str', apiName: 'notASet' }),
        v({ id: 'agg', apiName: 'x', definitionKind: 'object_set_aggregation',
            definition: { objectSet: 'notASet', metric: 'count' } }),
      ],
    })
    expect(aggregationSource(wrong, wrong.variables[1])).toBeUndefined()
  })
})

// The same gap three times — a loop's set, a tab's badge, an embedded module's
// mapping. A binding is not the only way to consume a variable.
describe('variables named in widget config are consumers too', () => {
  it('resolves a badge variable, which no widget binds', () => {
    const mod = doc({
      variables: [v({ id: 'n', apiName: 'shortCount', varType: 'numeric' })],
      widgets: [w({ id: 'nav', widgetType: 'tabs',
        config: { tabs: [{ key: 'a', label: 'A', badge: 'shortCount' }] } })],
    })
    expect([...visibleVariableIds(mod, initialState(mod))]).toEqual(['n'])
  })

  it('resolves the boolean a tab is gated on', () => {
    const mod = doc({
      variables: [v({ id: 'b', apiName: 'ready', varType: 'boolean' })],
      widgets: [w({ id: 'nav', widgetType: 'tabs',
        config: { tabs: [{ key: 'a', visibleWhen: 'ready' }] } })],
    })
    expect([...visibleVariableIds(mod, initialState(mod))]).toEqual(['b'])
  })

  it('resolves what a parent maps into an embedded module', () => {
    const mod = doc({
      variables: [v({ id: 'p', apiName: 'picked' })],
      widgets: [w({ id: 'child', widgetType: 'embedded_module',
        config: { module: 'card', mapping: { item: 'picked' } } })],
    })
    expect([...visibleVariableIds(mod, initialState(mod))]).toEqual(['p'])
  })

  it('resolves a variable an action parameter reads', () => {
    const mod = doc({
      variables: [v({ id: 'q', apiName: 'gap', varType: 'numeric' })],
      widgets: [w({ id: 'btns', widgetType: 'button_group', config: { buttons: [
        { key: 'go', action: { type: 'REQUEST_RESTOCK',
          parameters: { quantityNeeded: { variable: 'gap' } } } },
      ] } })],
    })
    expect([...visibleVariableIds(mod, initialState(mod))]).toEqual(['q'])
  })

  it('still respects the lazy rule for all of them', () => {
    const mod = doc({
      variables: [v({ id: 'n', apiName: 'shortCount', varType: 'numeric' })],
      layouts: [
        l({ id: 'first', layoutType: 'tab', position: 0 }),
        l({ id: 'second', layoutType: 'tab', position: 1 }),
      ],
      widgets: [w({ id: 'nav', widgetType: 'tabs', layoutId: 'second',
        config: { tabs: [{ key: 'a', badge: 'shortCount' }] } })],
    })
    expect(visibleVariableIds(mod, initialState(mod)).size).toBe(0)
  })
})

// Foundry's three starting filters. CONTAIN is prefix-only, which a substring
// match would quietly turn into a different feature.
describe('filtering an object set', () => {
  const rows = [
    { name: 'Tomatoes', sku: 'id000123', status: 'open' },
    { name: 'Tomato paste', sku: 'id000456', status: 'closed' },
    { name: 'Olive oil', sku: 'ol000123', status: null },
  ]

  it('returns everything when nothing is set', () => {
    expect(applyObjectSetFilter(rows, [])).toHaveLength(3)
    expect(applyObjectSetFilter(rows, [{ property: 'status', op: 'IS', value: '' }])).toHaveLength(3)
  })

  it('IS matches exactly, and several values read as any-of', () => {
    expect(applyObjectSetFilter(rows, [{ property: 'status', op: 'IS', value: 'open' }])).toHaveLength(1)
    expect(applyObjectSetFilter(rows, [{ property: 'status', op: 'IS', value: ['open', 'closed'] }]))
      .toHaveLength(2)
  })

  it('NULL finds the ones with nothing there', () => {
    const out = applyObjectSetFilter(rows, [{ property: 'status', op: 'NULL' }])
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('Olive oil')
  })

  // Their example, verbatim: id000123 matches id0001 but NOT d0001.
  it('CONTAIN is a PREFIX, not a substring', () => {
    expect(applyObjectSetFilter(rows, [{ property: 'sku', op: 'CONTAIN', value: 'id0001' }]))
      .toHaveLength(1)
    expect(applyObjectSetFilter(rows, [{ property: 'sku', op: 'CONTAIN', value: 'd0001' }]))
      .toHaveLength(0)
  })

  it('narrows further with each clause', () => {
    expect(applyObjectSetFilter(rows, [
      { property: 'name', op: 'CONTAIN', value: 'Tomato' },
      { property: 'status', op: 'IS', value: 'open' },
    ])).toHaveLength(1)
  })

  it('offers the values actually present, sorted and without blanks', () => {
    expect(propertyValues(rows, 'status')).toEqual(['closed', 'open'])
  })
})

// The recompute contract was stored, typed and never read: every variable
// behaved as `automatic`, so an author choosing "only when triggered" silently
// got the opposite.
describe('recompute behaviour', () => {
  const none = new Set<string>()
  const fn = (recompute: ModuleVariable['recompute']) =>
    v({ id: 'f', apiName: 'f', definitionKind: 'function', recompute })

  it('automatic always computes', () => {
    expect(shouldCompute(fn('automatic'), none, false)).toBe(true)
    expect(shouldCompute(fn('automatic'), none, true)).toBe(true)
  })

  it('event waits for a recompute event, before and after load', () => {
    expect(shouldCompute(fn('event'), none, false)).toBe(false)
    expect(shouldCompute(fn('event'), none, true)).toBe(false)
    expect(shouldCompute(fn('event'), new Set(['f']), true)).toBe(true)
  })

  it('on_load_and_event computes once, then waits', () => {
    expect(shouldCompute(fn('on_load_and_event'), none, false)).toBe(true)
    expect(shouldCompute(fn('on_load_and_event'), none, true)).toBe(false)
    expect(shouldCompute(fn('on_load_and_event'), new Set(['f']), true)).toBe(true)
  })

  // "The Object set definition variable definition type does not offer recompute
  // behavior configuration, and functions similarly to Automatic." A set that
  // stopped refreshing because somebody set a mode on it would be unfindable.
  it('ignores the setting on an object set definition, as Foundry does', () => {
    const set = v({ id: 's', apiName: 's', varType: 'object_set',
      definitionKind: 'object_set_definition', recompute: 'event' })
    expect(shouldCompute(set, none, true)).toBe(true)
  })
})
