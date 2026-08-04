// What the builder knows how to configure.
//
// One registry entry per widget type, so adding a widget means adding an entry
// rather than editing the builder in five places. `needsVariable` mirrors the
// module_widgets_needs_binding CHECK — the constraint stays the authority, this
// is what stops the form offering an invalid save.

import type { ModuleVariableType, ModuleWidgetType } from '../api'

export type FieldKind = 'text' | 'textarea' | 'select' | 'csv'

export interface ConfigField {
  key:      string
  label:    string
  kind:     FieldKind
  options?: string[]
  help?:    string
}

export interface WidgetSpec {
  label:         string
  icon:          string
  needsVariable: boolean
  /** Which variable types this widget can bind to. */
  binds?:        ModuleVariableType[]
  fields:        ConfigField[]
  blurb:         string
}

export const WIDGET_SPECS: Record<ModuleWidgetType, WidgetSpec> = {
  object_table: {
    label: 'Object table', icon: 'th', needsVariable: true, binds: ['object_set'],
    blurb: 'Rows from an object set. Selecting a row can drive other widgets.',
    fields: [
      { key: 'columns', label: 'Columns', kind: 'csv',
        help: 'Property keys, comma separated. Leave blank to show the first six.' },
    ],
  },
  metric_card: {
    label: 'Metric card', icon: 'numerical', needsVariable: true,
    // Foundry's card displays a variable of the matching type; the aggregating
    // belongs to the variable. Binding a set here is what makes people keep a
    // second set per number.
    binds: ['string', 'numeric', 'boolean', 'date'],
    blurb: 'One value, from a variable. To show a number about a set, make an aggregation variable first.',
    fields: [],
  },
  object_set_title: {
    label: 'Set title', icon: 'header', needsVariable: true, binds: ['object_set'],
    blurb: 'A heading with the number of objects currently in the set.',
    fields: [],
  },
  markdown: {
    label: 'Text', icon: 'paragraph', needsVariable: false,
    blurb: 'Static text. {{variableName}} is replaced with the current value.',
    fields: [{ key: 'body', label: 'Body', kind: 'textarea' }],
  },
  button_group: {
    label: 'Buttons', icon: 'widget-button', needsVariable: false,
    blurb: 'Buttons that fire events, apply a typed Action, or both.',
    fields: [],
  },
  filter_list: {
    label: 'Filters', icon: 'filter', needsVariable: true, binds: ['object_set'],
    blurb: 'Lets an operator narrow a set. Everything reading that set narrows with it.',
    fields: [],
  },
  tabs: {
    label: 'Tabs', icon: 'application', needsVariable: false,
    blurb: 'Navigation. Each tab fires events; which one looks selected is worked out from where you already are.',
    fields: [{ key: 'direction', label: 'Direction', kind: 'select',
      options: ['horizontal', 'vertical'] }],
  },
  embedded_module: {
    label: 'Another application', icon: 'applications', needsVariable: false,
    blurb: 'Shows a published application inside this one. Variables you map are shared both ways.',
    fields: [],
  },
  chart_xy: {
    label: 'Chart', icon: 'timeline-bar-chart', needsVariable: true, binds: ['object_set'],
    blurb: 'A trend from a set. Group by one property, aggregate another.',
    fields: [
      { key: 'layerType', label: 'Type', kind: 'select', options: ['bar', 'line', 'scatter'] },
      { key: 'xKey', label: 'Group by', kind: 'text', help: 'Property on the X axis — one bar or point per distinct value.' },
      { key: 'metric', label: 'Measure', kind: 'select',
        options: ['count', 'sum', 'average', 'min', 'max', 'cardinality'] },
      { key: 'yKey', label: 'Measure property', kind: 'text',
        help: 'Which property to measure. Leave blank for count, which counts objects.' },
    ],
  },
  object_view: {
    label: 'Object detail', icon: 'cube', needsVariable: true, binds: ['object_set'],
    blurb: 'One object in full. The set says which — the first in it is shown.',
    fields: [{ key: 'header', label: 'Show header', kind: 'select', options: ['true', 'false'] }],
  },
  source_viewer: {
    label: 'Source document', icon: 'document-open', needsVariable: true, binds: ['object_set'],
    blurb: 'The source beside the thing citing it. Point it at a set holding one document.',
    fields: [
      { key: 'property', label: 'Media property', kind: 'text',
        help: 'The media reference property holding the file — storage_path on a document.' },
      { key: 'page', label: 'Page from variable', kind: 'text',
        help: 'A numeric variable. Shows only that page.' },
      { key: 'term', label: 'Search term from variable', kind: 'text',
        help: 'A string variable. Fills the search box and highlights matches.' },
    ],
  },
  inline_action: {
    label: 'Action form', icon: 'form', needsVariable: false,
    blurb: 'An always-open form. The same action, validation and audit entry as the modal.',
    fields: [
      { key: 'actionType', label: 'Action', kind: 'text', help: 'The BeaconAction type, e.g. ADJUST_STOCK.' },
    ],
  },
}

export const LAYOUT_KINDS = [
  { value: 'section', label: 'Section',  blurb: 'A titled, collapsible group.' },
  { value: 'row',     label: 'Row',      blurb: 'Arranges its children side by side.' },
  { value: 'column',  label: 'Column',   blurb: 'Stacks its children. Use inside a row.' },
  { value: 'tab',     label: 'Tab',      blurb: 'Its container draws a tab bar above.' },
  { value: 'overlay', label: 'Overlay',  blurb: 'A dialog, opened by an event.' },
  { value: 'loop',    label: 'One per object',
    blurb: 'Renders another application once for each object in a set.' },
  { value: 'page',    label: 'Page',     blurb: 'One of several screens; events switch between them.' },
] as const

export const VARIABLE_KINDS = [
  { value: 'static', label: 'A fixed value', enabled: true,
    blurb: 'Set once here; events can change it while the app runs.' },
  { value: 'object_set_definition', label: 'A saved object set', enabled: true,
    blurb: 'Resolves through the same path cohorts use.' },
  { value: 'function', label: 'A Logic Tool', enabled: true,
    blurb: 'Calls a registered tool and carries its basis and confidence.' },
  { value: 'object_set_aggregation', label: 'An aggregate over a set', enabled: true,
    blurb: 'Counts or measures another object-set variable. One set can back as many numbers as you need.' },
  { value: 'object_property', label: 'A property of one object', enabled: false,
    blurb: 'Not built yet — a row selection into a variable does this today.' },
  { value: 'variable_transformation', label: 'Derived from another variable', enabled: false,
    blurb: 'Not built yet.' },
] as const

/** Effects the runtime implements. The others are in the CHECK and reported on
 *  screen when wired, so the builder does not offer what it cannot honour. */
export interface EffectKind {
  value: string
  label: string
  /** What the effect needs pointed at before it does anything. */
  needs: ReadonlyArray<'variable' | 'layout'>
}

export const EFFECT_KINDS: ReadonlyArray<EffectKind> = [
  { value: 'set_variable',       label: 'Set a variable',   needs: ['variable'] },
  { value: 'reset_variable',     label: 'Reset a variable', needs: ['variable'] },
  { value: 'recompute_variable', label: 'Recompute a variable', needs: ['variable'] },
  { value: 'switch_tab',         label: 'Switch tab',       needs: ['layout'] },
  { value: 'switch_page',        label: 'Switch page',      needs: ['layout'] },
  { value: 'toggle_section',     label: 'Expand or collapse a section', needs: ['layout'] },
  { value: 'open_overlay',       label: 'Open an overlay',  needs: ['layout'] },
  { value: 'close_overlay',      label: 'Close an overlay', needs: ['layout'] },
  { value: 'refresh_module',     label: 'Refresh data',     needs: [] },
]

export const TRIGGERS = [
  { value: 'click',            label: 'a button is pressed' },
  { value: 'row_select',       label: 'a table row is selected' },
  { value: 'tab_change',       label: 'a tab is opened' },
  { value: 'on_load',          label: 'the application opens' },
] as const
