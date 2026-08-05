// W7 — describing an application in a sentence.
//
// The generator PROPOSES. It emits a ModuleSpec, this file checks the spec
// against the real vocabulary, and only then does anything become rows — as a
// DRAFT the author reviews in the builder. Publishing is the approval, the same
// gate every other proposal in this system passes through.
//
// The whole bet rests on the target grammar being small and checkable: five
// widget types, six variable types, nine implemented effects, and an action
// registry that knows its own parameter names. Everything below is
// deterministic, so a wrong generation is caught before a write rather than
// discovered on screen.
//
// The spec refers to things by API NAME, never by id — a model cannot know a
// uuid, and asking it to invent one is asking it to hallucinate a foreign key.

import { getActionDescriptor, actionDescriptors } from '../actions/descriptors'
import {
  IMPLEMENTED_DEFINITION_KINDS, IMPLEMENTED_EFFECTS, MODULE_LAYOUT_TYPES,
  MODULE_TRIGGERS, MODULE_VARIABLE_TYPES, MODULE_WIDGET_TYPES, WIDGET_BINDING,
  type ModuleWidgetType,
} from '../modules/vocabulary'

// The vocabulary lives in one place now — see modules/vocabulary.ts for why.
export const WIDGET_TYPES = MODULE_WIDGET_TYPES
export const VARIABLE_TYPES = MODULE_VARIABLE_TYPES
export const LAYOUT_TYPES = MODULE_LAYOUT_TYPES
export const TRIGGERS = MODULE_TRIGGERS
/** A generator may only produce kinds and effects the runtime honours. */
export const DEFINITION_KINDS = IMPLEMENTED_DEFINITION_KINDS
export const EFFECT_TYPES = IMPLEMENTED_EFFECTS

// What each widget accepts comes from the shared vocabulary, so the validator
// and the renderer cannot disagree about what a valid module is.

const API_NAME = /^[a-z][a-zA-Z0-9_]*$/

export interface SpecVariable {
  apiName: string
  label: string
  varType: string
  definitionKind: string
  /** static: { value }. object_set_definition: { objectSet: <api name> }.
   *  function: { tool, output?, args: { <arg>: { source, variable?, value? } } }. */
  definition: Record<string, unknown>
}

export interface SpecLayout {
  apiName: string; title: string; layoutType: string
  parent?: string; position: number
}

export interface SpecWidget {
  apiName: string; widgetType: string; title: string
  layout?: string; variable?: string
  config: Record<string, unknown>
  position: number
}

export interface SpecEvent {
  widget: string; trigger: string; effectType: string
  config: Record<string, unknown>
  position: number
}

export interface ModuleSpec {
  apiName: string
  title: string
  description: string
  icon: string
  variables: SpecVariable[]
  layouts:   SpecLayout[]
  widgets:   SpecWidget[]
  events:    SpecEvent[]
}

/** What actually exists in this organization, so the check is against reality
 *  rather than against the grammar alone. */
export interface AuthoringCatalog {
  /** api_name → id. */
  objectSets: Record<string, string>
  toolNames:  string[]
}

/** Namespaced like every other failure here, so a caller can branch without
 *  reading prose. */
export interface SpecProblem {
  code: string
  message: string
  /** Which part of the spec it is about, for the review surface. */
  at?: string
}

const problem = (code: string, message: string, at?: string): SpecProblem => ({ code, message, at })

export function validateModuleSpec(
  spec: ModuleSpec, catalog: AuthoringCatalog,
): SpecProblem[] {
  const out: SpecProblem[] = []
  const varNames = new Set(spec.variables.map((v) => v.apiName))
  const layoutNames = new Set(spec.layouts.map((l) => l.apiName))
  const widgetNames = new Set(spec.widgets.map((w) => w.apiName))

  if (!API_NAME.test(spec.apiName)) {
    out.push(problem('Workshop:BadApiName',
      `"${spec.apiName}" is not a usable name — lowercase letter first, then letters, digits or underscores.`))
  }
  if (spec.title.trim() === '') {
    out.push(problem('Workshop:MissingTitle', 'The application needs a title.'))
  }

  for (const v of spec.variables) {
    const at = `variable ${v.apiName}`
    if (!API_NAME.test(v.apiName)) out.push(problem('Workshop:BadApiName', `"${v.apiName}" is not a usable variable name.`, at))
    if (!VARIABLE_TYPES.includes(v.varType as typeof VARIABLE_TYPES[number])) {
      out.push(problem('Workshop:UnknownVariableType', `There is no variable type "${v.varType}".`, at))
    }
    if (!DEFINITION_KINDS.includes(v.definitionKind as typeof DEFINITION_KINDS[number])) {
      out.push(problem('Workshop:UnsupportedDefinitionKind',
        `"${v.definitionKind}" is not a way a variable can get its value yet.`, at))
      continue
    }
    if (v.definitionKind === 'object_set_definition') {
      const name = v.definition.objectSet
      if (typeof name !== 'string' || !(name in catalog.objectSets)) {
        out.push(problem('Workshop:UnknownObjectSet',
          `There is no saved object set called "${String(name)}".`, at))
      }
      if (v.varType !== 'object_set') {
        out.push(problem('Workshop:TypeMismatch',
          'A variable defined by an object set must have type object_set.', at))
      }
    }
    if (v.definitionKind === 'function') {
      const tool = v.definition.tool
      if (typeof tool !== 'string' || !catalog.toolNames.includes(tool)) {
        out.push(problem('Workshop:UnknownTool', `There is no Logic Tool called "${String(tool)}".`, at))
      }
      const args = v.definition.args
      if (args && typeof args === 'object') {
        for (const [arg, binding] of Object.entries(args as Record<string, { variable?: string }>)) {
          if (binding.variable && !varNames.has(binding.variable)) {
            out.push(problem('Workshop:UnknownVariable',
              `Argument "${arg}" is bound to "${binding.variable}", which this application does not have.`, at))
          }
        }
      }
    }
  }

  for (const l of spec.layouts) {
    const at = `layout ${l.apiName}`
    if (!API_NAME.test(l.apiName)) out.push(problem('Workshop:BadApiName', `"${l.apiName}" is not a usable layout name.`, at))
    if (!LAYOUT_TYPES.includes(l.layoutType as typeof LAYOUT_TYPES[number])) {
      out.push(problem('Workshop:UnknownLayoutType', `There is no layout type "${l.layoutType}".`, at))
    }
    if (l.parent !== undefined && !layoutNames.has(l.parent)) {
      out.push(problem('Workshop:UnknownLayout', `Its container "${l.parent}" does not exist.`, at))
    }
    if (l.parent === l.apiName) {
      out.push(problem('Workshop:CircularLayout', 'A layout cannot contain itself.', at))
    }
  }

  for (const w of spec.widgets) {
    const at = `widget ${w.apiName}`
    if (!API_NAME.test(w.apiName)) out.push(problem('Workshop:BadApiName', `"${w.apiName}" is not a usable widget name.`, at))
    if (!WIDGET_TYPES.includes(w.widgetType as typeof WIDGET_TYPES[number])) {
      out.push(problem('Workshop:UnknownWidgetType',
        `There is no widget called "${w.widgetType}".`, at))
      continue
    }
    if (w.layout !== undefined && !layoutNames.has(w.layout)) {
      out.push(problem('Workshop:UnknownLayout', `Its container "${w.layout}" does not exist.`, at))
    }
    const binding = WIDGET_BINDING[w.widgetType as ModuleWidgetType]
    if (binding.needsVariable) {
      if (w.variable === undefined) {
        out.push(problem('Workshop:MissingBinding',
          `A ${w.widgetType} has to show something — give it a variable.`, at))
      } else if (!varNames.has(w.variable)) {
        out.push(problem('Workshop:UnknownVariable',
          `It shows "${w.variable}", which this application does not have.`, at))
      } else if (binding.accepts) {
        const bound = spec.variables.find((v) => v.apiName === w.variable)
        if (bound && !binding.accepts.includes(bound.varType as typeof binding.accepts[number])) {
          out.push(problem('Workshop:TypeMismatch',
            `A ${w.widgetType} shows ${binding.accepts.join(' or ')}, not ${bound.varType}.`, at))
        }
      }
    }
    if (w.widgetType === 'button_group') {
      out.push(...validateButtons(w, spec, varNames))
    }
  }

  for (const e of spec.events) {
    const at = `event on ${e.widget}`
    if (!widgetNames.has(e.widget)) {
      out.push(problem('Workshop:UnknownWidget', `"${e.widget}" is not a widget here.`, at))
    }
    if (!TRIGGERS.includes(e.trigger as typeof TRIGGERS[number])) {
      out.push(problem('Workshop:UnknownTrigger', `"${e.trigger}" is not something that happens.`, at))
    }
    if (!EFFECT_TYPES.includes(e.effectType as typeof EFFECT_TYPES[number])) {
      out.push(problem('Workshop:UnsupportedEffect',
        `"${e.effectType}" is not an effect this runtime performs.`, at))
      continue
    }
    const target = e.config.variable
    if (e.effectType.endsWith('_variable')) {
      if (typeof target !== 'string' || !varNames.has(target)) {
        out.push(problem('Workshop:UnknownVariable',
          `It acts on "${String(target)}", which this application does not have.`, at))
      }
    }
    const layout = e.config.layout
    if (['switch_tab', 'switch_page', 'toggle_section', 'open_overlay', 'close_overlay'].includes(e.effectType)) {
      if (typeof layout !== 'string' || !layoutNames.has(layout)) {
        out.push(problem('Workshop:UnknownLayout',
          `It acts on "${String(layout)}", which this application does not have.`, at))
      }
    }
  }

  return out
}

interface SpecButton {
  key?: string; label?: string
  action?: { type?: string; parameters?: Record<string, { source?: string; variable?: string; value?: unknown; visibility?: string }> }
}

/** The W3 lesson as a check: a binding naming a parameter the action does not
 *  have resolves cleanly and goes nowhere. It is the mistake a generator is most
 *  likely to make, so it is the one worth refusing before a write. */
function validateButtons(w: SpecWidget, _spec: ModuleSpec, varNames: Set<string>): SpecProblem[] {
  const out: SpecProblem[] = []
  const at = `widget ${w.apiName}`
  const buttons = Array.isArray(w.config.buttons) ? (w.config.buttons as SpecButton[]) : []

  for (const b of buttons) {
    if (!b.action?.type) continue
    const descriptor = getActionDescriptor(b.action.type)
    if (!descriptor) {
      out.push(problem('Workshop:UnknownAction', `There is no action called "${b.action.type}".`, at))
      continue
    }
    const known = new Set([...descriptor.fields.map((f) => f.name), ...descriptor.contextFields])
    for (const [name, binding] of Object.entries(b.action.parameters ?? {})) {
      if (!known.has(name)) {
        out.push(problem('Workshop:UnknownActionParameter',
          `${b.action.type} has no parameter called "${name}".`, at))
      }
      if (binding.variable && !varNames.has(binding.variable)) {
        out.push(problem('Workshop:UnknownVariable',
          `Parameter "${name}" reads "${binding.variable}", which this application does not have.`, at))
      }
    }
  }
  return out
}

// ── Spec → rows ──────────────────────────────────────────────────────────────

export interface RowPayloads {
  module:    Record<string, unknown>
  variables: Array<Record<string, unknown>>
  layouts:   Array<Record<string, unknown>>
  widgets:   Array<Record<string, unknown>>
  events:    Array<Record<string, unknown>>
}

/** Names in, rows out. Ids are resolved by the caller as it inserts, because
 *  only the database knows them — the spec's job is to be unambiguous about
 *  which name refers to what.
 *
 *  Always a DRAFT. A generated application that arrives published is a write
 *  nobody approved. */
export function moduleSpecToRows(spec: ModuleSpec): RowPayloads {
  return {
    module: {
      api_name: spec.apiName, title: spec.title,
      description: spec.description, icon: spec.icon || 'application',
      status: 'draft',
    },
    variables: spec.variables.map((v) => ({
      api_name: v.apiName, label: v.label, var_type: v.varType,
      definition_kind: v.definitionKind,
      definition: normaliseDefinition(v),
      recompute: 'automatic',
    })),
    layouts: spec.layouts.map((l) => ({
      api_name: l.apiName, title: l.title, layout_type: l.layoutType,
      _parent: l.parent ?? null, position: l.position,
    })),
    widgets: spec.widgets.map((w) => ({
      api_name: w.apiName, widget_type: w.widgetType, title: w.title,
      _layout: w.layout ?? null, _variable: w.variable ?? null,
      config: normaliseConfig(w), position: w.position,
    })),
    events: spec.events.map((e) => ({
      _widget: e.widget, trigger: e.trigger, effect_type: e.effectType,
      _config: e.config, position: e.position,
    })),
  }
}

/** The spec speaks names; the stored definition speaks the runtime's keys. */
function normaliseDefinition(v: SpecVariable): Record<string, unknown> {
  if (v.definitionKind === 'object_set_definition') {
    return { _objectSet: v.definition.objectSet }
  }
  if (v.definitionKind === 'function') {
    const args = (v.definition.args ?? {}) as Record<string, { source?: string; variable?: string; value?: unknown }>
    return {
      toolName: v.definition.tool,
      output: v.definition.output ?? '',
      args: Object.fromEntries(Object.entries(args).map(([k, b]) => [k,
        b.variable ? { source: 'variable', variableApiName: b.variable } : { source: 'static', value: b.value },
      ])),
    }
  }
  if (v.definitionKind === 'object_set_aggregation') {
    // Missing this fell through to the static branch below, flattening the whole
    // definition to `{ value: null }` — a generated aggregation arrived pointing
    // at no set, with no metric. It rendered an em dash and nothing said why.
    // check:modules found it on its first real run against a generated draft.
    return {
      objectSet: v.definition.objectSet,
      metric: v.definition.metric ?? 'count',
      ...(v.definition.property ? { property: v.definition.property } : {}),
    }
  }
  return { value: v.definition.value ?? null }
}

function normaliseConfig(w: SpecWidget): Record<string, unknown> {
  if (w.widgetType !== 'button_group') return w.config
  const buttons = Array.isArray(w.config.buttons) ? (w.config.buttons as SpecButton[]) : []
  return {
    buttons: buttons.map((b) => ({
      key: b.key ?? b.label?.toLowerCase().replace(/\W+/g, '_') ?? 'button',
      label: b.label ?? 'Button',
      ...(b.action?.type ? {
        action: {
          type: b.action.type,
          parameters: Object.fromEntries(Object.entries(b.action.parameters ?? {}).map(([name, p]) => [name,
            p.variable
              ? { source: 'variable', variableApiName: p.variable, visibility: p.visibility ?? 'visible' }
              : { source: p.source ?? 'static', value: p.value, visibility: p.visibility ?? 'visible' },
          ])),
        },
      } : {}),
    })),
  }
}

// ── The prompt ───────────────────────────────────────────────────────────────

/** What the model is allowed to say. Written as a contract rather than a
 *  description, because everything here is checked afterwards anyway — the
 *  prompt's job is to make a valid answer the easy one. */
export function buildAuthoringPrompt(catalog: AuthoringCatalog): string {
  // Every registered action type. This was four hard-coded inventory actions;
  // authored types come from the registry, so the list grows on its own.
  const actions = Object.entries(actionDescriptors)
    .map(([type, d]) =>
      `  ${type}: ${d.fields.map((f) => f.name).join(', ')} (the application supplies ${d.contextFields.join(', ')})`)
    .join('\n')

  return `You compose an operational screen from a request, and answer ONLY with JSON matching the shape below. Refer to everything you create by its apiName. Do not invent ids.

THE EXACT KEYS. Use these names, camelCase, nothing else:
{
  "apiName": "lower_snake_name", "title": "...", "description": "...", "icon": "inbox",
  "variables": [{ "apiName": "...", "label": "...", "varType": "...", "definitionKind": "...", "definition": {} }],
  "layouts":   [{ "apiName": "...", "title": "...", "layoutType": "...", "parent": "<optional apiName>", "position": 0 }],
  "widgets":   [{ "apiName": "...", "widgetType": "...", "title": "...", "layout": "<optional>", "variable": "<optional>", "config": {}, "position": 0 }],
  "events":    [{ "widget": "<apiName>", "trigger": "...", "effectType": "...", "config": {}, "position": 0 }]
}

WIDGETS: ${WIDGET_TYPES.join(', ')}
  object_table, metric_card and object_set_title must each name a variable in "variable".
  object_table and object_set_title can only show an object_set.
  markdown puts {{variableName}} in its config.body to show a value.
  button_group carries config.buttons: [{ key, label, action?: { type, parameters } }].

VARIABLE TYPES: ${VARIABLE_TYPES.join(', ')}
DEFINITION KINDS:
  static                  definition: { value }
  object_set_definition   definition: { objectSet: <name below> }, varType must be object_set
  function                definition: { tool: <name below>, output: <field of the result>, args: { <arg>: { variable } | { value } } }

LAYOUTS: ${LAYOUT_TYPES.join(', ')}. A row arranges its children side by side. Omit layouts entirely if the screen is a simple stack.

EVENTS: trigger ∈ ${TRIGGERS.join(', ')}, effectType ∈ ${EFFECT_TYPES.join(', ')}.
  Variable effects take config { variable: <name>, value? , fromProperty? }.
  Layout effects take config { layout: <name> }.
  Effects run in order but do NOT wait for each other, so never let one read what the previous one computed.

SAVED OBJECT SETS: ${Object.keys(catalog.objectSets).join(', ') || '(none)'}
LOGIC TOOLS: ${catalog.toolNames.join(', ') || '(none)'}
ACTIONS:
${actions}

Prefer the fewest widgets that answer the request. If the request needs data that no object set above provides, say so in "description" and leave the widgets that would have needed it out — a screen that admits a gap is better than one that invents a set.

Answer with: { apiName, title, description, icon, variables[], layouts[], widgets[], events[] }`
}

// ── Reading the model's answer ───────────────────────────────────────────────

/** Models wrap JSON in prose and fences more often than not, and omit arrays
 *  they consider empty. Lives here rather than in the edge function so the eval
 *  suite covers it — a parser nothing tests is where a generator quietly starts
 *  producing half a screen. */
export function parseModuleSpec(raw: string): ModuleSpec | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw)
  const text = (fenced ? fenced[1] : raw).trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const s = camelKeys(parsed as Record<string, unknown>)

  return {
    apiName: str(s.apiName), title: str(s.title),
    description: str(s.description), icon: str(s.icon) || 'application',
    variables: arr<SpecVariable>(s.variables),
    layouts:   arr<SpecLayout>(s.layouts),
    widgets:   arr<SpecWidget>(s.widgets),
    events:    arr<SpecEvent>(s.events),
  }
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (camelDeep(v) as T[]) : [])

/** Models answer in snake_case about a third of the time no matter how the
 *  prompt is written, and every key would then read `undefined` and every
 *  element would be refused. Forgiving the one predictable variation is cheaper
 *  than a re-ask, and `config` is left alone because its keys are the
 *  application's own, not ours. */
const PRESERVE = new Set(['config', 'definition', 'parameters', 'args'])

function camelKeys(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    const key = k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
    out[key] = PRESERVE.has(key) ? v : camelDeep(v)
  }
  return out
}

function camelDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(camelDeep)
  if (v && typeof v === 'object') return camelKeys(v as Record<string, unknown>)
  return v
}
