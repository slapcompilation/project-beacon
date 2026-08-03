// Eval suite for W7 — the generator proposes, this decides whether it is fit to
// become a draft.
//
// Every case is a spec a model plausibly returns, graded on STRUCTURE rather
// than prose: does the validator accept what is right, and refuse what is wrong
// with a code a caller can branch on? No model runs here, matching every other
// eval in this repo — the LLM is glue, and what needs proving is the layer that
// catches it.
//
// The refusals are the point. A generator that is trusted because nothing checks
// it is the failure this whole phase is designed around.

import { describe, expect, it } from 'vitest'
import {
  buildAuthoringPrompt, moduleSpecToRows, parseModuleSpec, validateModuleSpec,
  DEFINITION_KINDS, EFFECT_TYPES, LAYOUT_TYPES, WIDGET_TYPES,
  type AuthoringCatalog, type ModuleSpec, type SpecVariable,
} from './moduleSpec'

const catalog: AuthoringCatalog = {
  objectSets: { low_stock: 'set-1', all_variants: 'set-2' },
  toolNames: ['forecast_consumption', 'compute_reorder_point'],
}

const base = (over: Partial<ModuleSpec> = {}): ModuleSpec => ({
  apiName: 'probe', title: 'Probe', description: '', icon: 'inbox',
  variables: [], layouts: [], widgets: [], events: [], ...over,
})

const setVar = {
  apiName: 'lowStock', label: 'Low stock', varType: 'object_set',
  definitionKind: 'object_set_definition', definition: { objectSet: 'low_stock' },
}
const codes = (s: ModuleSpec) => validateModuleSpec(s, catalog).map((p) => p.code)

describe('a spec that should be accepted', () => {
  it('1. a table over a saved set', () => {
    expect(codes(base({
      variables: [setVar],
      widgets: [{ apiName: 'items', widgetType: 'object_table', title: 'Items',
        variable: 'lowStock', config: { columns: ['name'] }, position: 0 }],
    }))).toEqual([])
  })

  // Two numbers off ONE set, which is the shape #478 established: the card
  // displays a variable, and the aggregating belongs to the variable. This case
  // previously bound both cards straight to the set and asserted that was fine —
  // the eval suite was certifying a shape the renderer had stopped accepting.
  it('2. a row arranging two metric cards over one set', () => {
    expect(codes(base({
      variables: [setVar,
        { apiName: 'lines', label: 'Lines', varType: 'numeric',
          definitionKind: 'object_set_aggregation',
          definition: { objectSet: 'lowStock', metric: 'count' } },
        { apiName: 'onHand', label: 'On hand', varType: 'numeric',
          definitionKind: 'object_set_aggregation',
          definition: { objectSet: 'lowStock', metric: 'sum', property: 'current_stock' } }],
      layouts: [{ apiName: 'top', title: 'Top', layoutType: 'row', position: 0 }],
      widgets: [
        { apiName: 'a', widgetType: 'metric_card', title: 'Count', layout: 'top',
          variable: 'lines', config: {}, position: 0 },
        { apiName: 'b', widgetType: 'metric_card', title: 'Stock', layout: 'top',
          variable: 'onHand', config: {}, position: 1 },
      ],
    }))).toEqual([])
  })

  it('2b. refuses a metric card bound straight to a set, as the renderer does', () => {
    expect(codes(base({
      variables: [setVar],
      widgets: [{ apiName: 'a', widgetType: 'metric_card', title: 'Count',
        variable: 'lowStock', config: {}, position: 0 }],
    }))).toEqual(['Workshop:TypeMismatch'])
  })

  it('3. a row selection driving a scalar, then shown in text', () => {
    expect(codes(base({
      variables: [setVar,
        { apiName: 'picked', label: 'Picked', varType: 'string',
          definitionKind: 'static', definition: { value: null } }],
      widgets: [
        { apiName: 'items', widgetType: 'object_table', title: '', variable: 'lowStock', config: {}, position: 0 },
        { apiName: 'note', widgetType: 'markdown', title: '', config: { body: 'Picked {{picked}}' }, position: 1 },
      ],
      events: [{ widget: 'items', trigger: 'row_select', effectType: 'set_variable',
        config: { variable: 'picked', fromProperty: 'name' }, position: 0 }],
    }))).toEqual([])
  })

  it('4. a Logic Tool bound to another variable', () => {
    expect(codes(base({
      variables: [
        { apiName: 'variantId', label: 'Variant', varType: 'string',
          definitionKind: 'static', definition: { value: null } },
        { apiName: 'forecast', label: 'Projected use', varType: 'numeric',
          definitionKind: 'function', definition: {
            tool: 'forecast_consumption', output: 'projectedUnits',
            args: { variantId: { variable: 'variantId' }, horizonDays: { value: 7 } },
          } },
      ],
      widgets: [{ apiName: 'card', widgetType: 'metric_card', title: 'Projected',
        variable: 'forecast', config: {}, position: 0 }],
    }))).toEqual([])
  })

  it('5. a button applying a typed action with real parameter names', () => {
    expect(codes(base({
      variables: [{ apiName: 'variantId', label: 'Variant', varType: 'string',
        definitionKind: 'static', definition: { value: null } }],
      widgets: [{ apiName: 'actions', widgetType: 'button_group', title: '', position: 0,
        config: { buttons: [{ key: 'restock', label: 'Request restock', action: {
          type: 'REQUEST_RESTOCK',
          parameters: {
            variantId: { variable: 'variantId', visibility: 'hidden' },
            quantityNeeded: { value: 10 },
          },
        } }] } }],
    }))).toEqual([])
  })

  it('6. tabs with a hidden set behind one of them', () => {
    expect(codes(base({
      variables: [setVar],
      layouts: [
        { apiName: 'first', title: 'Now', layoutType: 'tab', position: 0 },
        { apiName: 'second', title: 'All', layoutType: 'tab', position: 1 },
      ],
      widgets: [{ apiName: 'items', widgetType: 'object_table', title: '',
        layout: 'second', variable: 'lowStock', config: {}, position: 0 }],
      events: [{ widget: 'items', trigger: 'tab_change', effectType: 'refresh_module',
        config: {}, position: 0 }],
    }))).toEqual([])
  })
})

describe('a spec that must be refused', () => {
  it('7. a widget type nobody built', () => {
    expect(codes(base({
      widgets: [{ apiName: 'chart', widgetType: 'chart_xy', title: 'Trend', config: {}, position: 0 }],
    }))).toEqual(['Workshop:UnknownWidgetType'])
  })

  it('8. an object set that does not exist', () => {
    expect(codes(base({
      variables: [{ ...setVar, definition: { objectSet: 'expiring_soon' } }],
    }))).toEqual(['Workshop:UnknownObjectSet'])
  })

  it('9. a table bound to nothing — the CHECK would reject the row anyway', () => {
    expect(codes(base({
      widgets: [{ apiName: 'items', widgetType: 'object_table', title: '', config: {}, position: 0 }],
    }))).toEqual(['Workshop:MissingBinding'])
  })

  it('10. a table bound to a scalar instead of a set', () => {
    expect(codes(base({
      variables: [{ apiName: 'n', label: 'N', varType: 'numeric',
        definitionKind: 'static', definition: { value: 1 } }],
      widgets: [{ apiName: 'items', widgetType: 'object_table', title: '',
        variable: 'n', config: {}, position: 0 }],
    }))).toEqual(['Workshop:TypeMismatch'])
  })

  // The W3 defect, as the thing a generator is most likely to reproduce.
  it('11. an action parameter the action does not have', () => {
    expect(codes(base({
      widgets: [{ apiName: 'actions', widgetType: 'button_group', title: '', position: 0,
        config: { buttons: [{ label: 'Restock', action: {
          type: 'REQUEST_RESTOCK', parameters: { quantity: { value: 10 } },
        } }] } }],
    }))).toEqual(['Workshop:UnknownActionParameter'])
  })

  it('12. an effect on a variable that was never declared', () => {
    expect(codes(base({
      variables: [setVar],
      widgets: [{ apiName: 'items', widgetType: 'object_table', title: '',
        variable: 'lowStock', config: {}, position: 0 }],
      events: [{ widget: 'items', trigger: 'row_select', effectType: 'set_variable',
        config: { variable: 'chosen' }, position: 0 }],
    }))).toEqual(['Workshop:UnknownVariable'])
  })

  it('13. an effect the runtime does not perform', () => {
    expect(codes(base({
      widgets: [{ apiName: 'b', widgetType: 'button_group', title: '', config: {}, position: 0 }],
      events: [{ widget: 'b', trigger: 'click', effectType: 'stream_llm_into_variable',
        config: {}, position: 0 }],
    }))).toEqual(['Workshop:UnsupportedEffect'])
  })

  it('14. a tool nobody registered', () => {
    expect(codes(base({
      variables: [{ apiName: 'f', label: 'F', varType: 'numeric', definitionKind: 'function',
        definition: { tool: 'predict_the_future', args: {} } }],
    }))).toEqual(['Workshop:UnknownTool'])
  })

  it('15. a layout that contains itself', () => {
    expect(codes(base({
      layouts: [{ apiName: 'loop', title: 'Loop', layoutType: 'section', parent: 'loop', position: 0 }],
    }))).toEqual(['Workshop:CircularLayout'])
  })

  it('16. a name the database would reject', () => {
    expect(codes(base({ apiName: '2-morning report' })))
      .toEqual(['Workshop:BadApiName'])
  })

  it('reports every problem at once, not just the first', () => {
    const found = codes(base({
      apiName: '!!',
      widgets: [{ apiName: 'x', widgetType: 'gantt', title: '', config: {}, position: 0 }],
    }))
    expect(found).toContain('Workshop:BadApiName')
    expect(found).toContain('Workshop:UnknownWidgetType')
  })
})

describe('turning an accepted spec into rows', () => {
  it('always lands as a draft — a generated application nobody approved must not be live', () => {
    expect(moduleSpecToRows(base()).module.status).toBe('draft')
  })

  it('keeps references by name for the caller to resolve', () => {
    const rows = moduleSpecToRows(base({
      variables: [setVar],
      widgets: [{ apiName: 'items', widgetType: 'object_table', title: '',
        variable: 'lowStock', config: {}, position: 0 }],
    }))
    expect(rows.variables[0].definition).toEqual({ _objectSet: 'low_stock' })
    expect(rows.widgets[0]._variable).toBe('lowStock')
  })

  it('rewrites a function variable into the runtime binding grammar', () => {
    const rows = moduleSpecToRows(base({
      variables: [{ apiName: 'f', label: 'F', varType: 'numeric', definitionKind: 'function',
        definition: { tool: 'forecast_consumption', output: 'projectedUnits',
          args: { variantId: { variable: 'picked' }, horizonDays: { value: 7 } } } }],
    }))
    expect(rows.variables[0].definition).toEqual({
      toolName: 'forecast_consumption', output: 'projectedUnits',
      args: {
        variantId: { source: 'variable', variableApiName: 'picked' },
        horizonDays: { source: 'static', value: 7 },
      },
    })
  })
})

describe('the prompt', () => {
  it('names only what actually exists, so the model cannot cite a set we do not have', () => {
    const p = buildAuthoringPrompt(catalog)
    expect(p).toContain('low_stock')
    expect(p).toContain('forecast_consumption')
    expect(p).toContain('quantityNeeded')
    expect(p).not.toContain('chart_xy')
  })

  it('carries the non-blocking dispatch rule, which is the one an author cannot guess', () => {
    expect(buildAuthoringPrompt(catalog)).toContain('do NOT wait for each other')
  })
})

describe('reading what the model actually sends back', () => {
  const minimal = '{"apiName":"a","title":"A","widgets":[]}'

  it('17. accepts a bare JSON object', () => {
    expect(parseModuleSpec(minimal)?.title).toBe('A')
  })

  it('18. unwraps a fenced block, which is what most answers look like', () => {
    expect(parseModuleSpec('Here you go:\n```json\n' + minimal + '\n```\nHope that helps.')?.apiName).toBe('a')
  })

  it('19. defaults the arrays a model omits when it considers them empty', () => {
    const spec = parseModuleSpec(minimal)
    expect(spec?.variables).toEqual([])
    expect(spec?.events).toEqual([])
    expect(spec?.icon).toBe('application')
  })

  it('20. returns null rather than half a screen when the answer is not JSON', () => {
    expect(parseModuleSpec('I could build that for you — what data do you have?')).toBeNull()
    expect(parseModuleSpec('{ this is not json }')).toBeNull()
    expect(parseModuleSpec('[1,2,3]')).toBeNull()
  })

  // Parsing is not approval: an answer that reads fine still has to survive the
  // validator before it becomes rows.
  it('21. a parsed spec still goes through validation', () => {
    const spec = parseModuleSpec('{"apiName":"a","title":"A","widgets":[{"apiName":"w","widgetType":"pie","title":"","config":{},"position":0}]}')
    expect(spec).not.toBeNull()
    expect(validateModuleSpec(spec!, catalog).map((p) => p.code)).toEqual(['Workshop:UnknownWidgetType'])
  })
})

// Found live: the first real generation came back entirely in snake_case, so
// every key read undefined and every element was refused. The validator did its
// job; the prompt had simply never named the keys.
describe('a snake_case answer, which is what models actually send', () => {
  const snake = JSON.stringify({
    api_name: 'par_check', title: 'Par check', description: '', icon: 'inbox',
    variables: [{ api_name: 'lowStock', label: 'Low', var_type: 'object_set',
      definition_kind: 'object_set_definition', definition: { objectSet: 'low_stock' } }],
    layouts: [{ api_name: 'top', title: 'Top', layout_type: 'row', position: 0 }],
    widgets: [{ api_name: 'items', widget_type: 'object_table', title: '',
      layout: 'top', variable: 'lowStock', config: { columns: ['name'] }, position: 0 }],
    events: [{ widget: 'items', trigger: 'row_select', effect_type: 'refresh_module',
      config: {}, position: 0 }],
  })

  it('22. is read rather than refused', () => {
    const spec = parseModuleSpec(snake)
    expect(spec?.apiName).toBe('par_check')
    expect(spec?.widgets[0].widgetType).toBe('object_table')
    expect(spec?.variables[0].definitionKind).toBe('object_set_definition')
    expect(spec?.events[0].effectType).toBe('refresh_module')
    expect(validateModuleSpec(spec!, catalog)).toEqual([])
  })

  it('23. leaves config keys alone — those belong to the application, not to us', () => {
    const spec = parseModuleSpec(JSON.stringify({
      api_name: 'a', title: 'A',
      widgets: [{ api_name: 'w', widget_type: 'markdown', title: '',
        config: { body: 'x', low_stock_threshold: 4 }, position: 0 }],
    }))
    expect(spec?.widgets[0].config).toEqual({ body: 'x', low_stock_threshold: 4 })
  })
})

// The grammar and the runtime used to be written twice and drifted within days.
// These hold the single definition to what the database actually allows.
describe('the grammar covers what the runtime can do', () => {
  it('offers every widget the renderer draws', () => {
    for (const w of ['tabs', 'embedded_module', 'filter_list']) {
      expect(WIDGET_TYPES as readonly string[]).toContain(w)
    }
  })

  it('offers the loop layout, so a generator can compose one', () => {
    expect(LAYOUT_TYPES as readonly string[]).toContain('loop')
  })

  it('offers the aggregation kind, which is how a number comes off a set', () => {
    expect(DEFINITION_KINDS as readonly string[]).toContain('object_set_aggregation')
  })

  // The two Foundry names we have not built stay OUT of the generator's grammar:
  // a spec naming them is refused rather than becoming a variable that never
  // computes.
  it('refuses the definition kinds nothing implements', () => {
    for (const kind of ['object_property', 'variable_transformation']) {
      const spec = base({ variables: [{ apiName: 'x', label: 'X', varType: 'string',
        definitionKind: kind, definition: {} }] })
      expect(codes(spec)).toEqual(['Workshop:UnsupportedDefinitionKind'])
    }
  })

  it('refuses an effect the runtime would not perform', () => {
    expect(EFFECT_TYPES as readonly string[]).not.toContain('stream_llm_into_variable')
    expect(EFFECT_TYPES as readonly string[]).not.toContain('open_object_view')
  })
})

// A generated aggregation used to fall through to the static branch and arrive
// as `{ value: null }` — pointing at no set, with no metric, rendering an em
// dash. Every definition kind the grammar accepts must survive conversion.
describe('every accepted definition kind survives becoming rows', () => {
  // Row payloads are Record<string, unknown>, so the definition arrives unknown.
  const kindOf = (v: SpecVariable): Record<string, unknown> =>
    moduleSpecToRows(base({ variables: [v] })).variables[0].definition as Record<string, unknown>

  it('keeps an aggregation whole', () => {
    expect(kindOf({ apiName: 'n', label: 'N', varType: 'numeric',
      definitionKind: 'object_set_aggregation',
      definition: { objectSet: 'lowStock', metric: 'sum', property: 'current_stock' } }))
      .toEqual({ objectSet: 'lowStock', metric: 'sum', property: 'current_stock' })
  })

  it('defaults an aggregation with no metric to a count', () => {
    expect(kindOf({ apiName: 'n', label: 'N', varType: 'numeric',
      definitionKind: 'object_set_aggregation', definition: { objectSet: 'items' } }))
      .toEqual({ objectSet: 'items', metric: 'count' })
  })

  // The general form of the bug: the grammar and the converter are two lists
  // that have to agree, and only one of them was being checked. Naming the kinds
  // that came out empty is what makes a failure here readable.
  it('loses nothing for any kind the grammar accepts', () => {
    const emptied = DEFINITION_KINDS.filter((kind) => {
      const def = kindOf({ apiName: 'v', label: 'V', varType: 'string',
        definitionKind: kind, definition: { value: 'x', objectSet: 's', tool: 't' } })
      return Object.keys(def).length === 0
    })
    // Compared as a string so a failure names the kinds rather than showing
    // two arrays.
    expect(emptied.join(', ')).toBe('')
  })
})
