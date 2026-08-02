// How a module supplies values to an Action's parameters and a Logic Tool's
// arguments. Pure, so the rules are testable without a browser.
//
// Foundry's model (workshop/actions-use), adopted by name: an action parameter
// takes its value from a VARIABLE, from a STATIC default, or from USER INPUT in
// the form, and each parameter is VISIBLE, HIDDEN or DISABLED.
//
// Their fourth source is the "active object" from an Object Table — which in
// their model is itself a module variable, and in ours is one too: a row_select
// event sets a string variable from the row's property (W2). So `variable`
// covers it, and there is no fourth source to invent.

import { getActionDescriptor, type BeaconAction } from '@beacon/reality-graph'
import type { ModuleDoc } from './api'
import { scalarValue, type ModuleUiState } from './runtime'

export type BindingSource = 'variable' | 'static' | 'user_input'
export type Visibility = 'visible' | 'hidden' | 'disabled'

export interface Binding {
  source?: BindingSource
  /** `variable` — which one, by api name. */
  variableApiName?: string
  /** `static` — the literal. */
  value?: unknown
  /** Defaults to `visible`, matching Foundry: a prefilled value the operator may still edit. */
  visibility?: Visibility
}

export interface ActionSpec {
  type: string
  parameters?: Record<string, Binding>
}

export interface ButtonSpec {
  key?: string
  label?: string
  intent?: 'none' | 'primary' | 'success' | 'warning' | 'danger'
  /** Present = this button applies an Action. Absent = it only fires events. */
  action?: ActionSpec
}

/** Values that are computed rather than held in UI state — function-defined
 *  variables, keyed by variable id. Foundry's `variable` source covers every
 *  variable, so a binding must be able to read one a Logic Tool produced. */
export type ComputedValues = ReadonlyMap<string, unknown>

export interface ResolveContext {
  mod: ModuleDoc
  ui:  ModuleUiState
  /** Values a Logic Tool produced, by variable id. */
  computed?: ComputedValues
  /** Context every action needs and no author should have to bind — the active
   *  hotel, the signed-in user. Fills `contextFields` the module left unbound.
   *  Without this a module's action fails validation on a field that is never
   *  rendered, so the error has nowhere to appear. */
  ambient?: Record<string, unknown>
}

function bound(b: Binding, c: ResolveContext): unknown {
  const source = b.source ?? (b.variableApiName ? 'variable' : 'static')
  if (source === 'user_input') return undefined
  if (source === 'static') return b.value
  const v = c.mod.variables.find((x) => x.apiName === b.variableApiName)
  if (v && c.computed?.has(v.id)) return c.computed.get(v.id) ?? b.value
  return scalarValue(v, c.ui) ?? b.value
}

export interface ResolvedParameters {
  /** Hidden bindings — never rendered, passed straight into the action. */
  context: Record<string, unknown>
  /** Prefilled values the operator sees, and may edit unless disabled. */
  initialValues: Record<string, unknown>
  /** Parameter names rendered read-only. */
  disabled: string[]
  /** Bindings that name a variable the module does not have. Surfaced rather
   *  than silently sent as undefined — a typo'd binding must not become a
   *  missing action parameter the operator has to debug from a validation error. */
  unresolved: string[]
  /** Bindings that name a parameter the ACTION does not have. Caught the first
   *  time a real module was authored: `quantity` instead of `quantityNeeded`
   *  bound cleanly, resolved to the right number, and went nowhere. Foundry
   *  validates this when the module is built; we validate it when it resolves. */
  unknownParameters: string[]
}

export function resolveParameters(spec: ActionSpec, c: ResolveContext): ResolvedParameters {
  const out: ResolvedParameters = {
    context: {}, initialValues: {}, disabled: [], unresolved: [], unknownParameters: [],
  }
  const descriptor = describe(spec.type)
  const known = descriptor
    ? new Set([...descriptor.fields.map((f) => f.name), ...descriptor.contextFields])
    : null

  for (const [name, b] of Object.entries(spec.parameters ?? {})) {
    if (known && !known.has(name)) out.unknownParameters.push(name)
    if ((b.source ?? 'static') === 'variable' || b.variableApiName) {
      if (!c.mod.variables.some((v) => v.apiName === b.variableApiName)) out.unresolved.push(name)
    }
    if (b.source === 'user_input') continue // the form asks for it

    const value = bound(b, c)
    if ((b.visibility ?? 'visible') === 'hidden') out.context[name] = value
    else {
      out.initialValues[name] = value
      if (b.visibility === 'disabled') out.disabled.push(name)
    }
  }

  // Ambient context the author never binds — and never should.
  for (const field of descriptor?.contextFields ?? []) {
    if (field in out.context) continue
    if (c.ambient && field in c.ambient) out.context[field] = c.ambient[field]
  }
  return out
}

/** The action's descriptor, or null when the type isn't in the registry. */
function describe(type: string) {
  try { return getActionDescriptor(type as BeaconAction['type']) } catch { return null }
}

/** Arguments for a `function`-defined variable — same binding grammar, but a
 *  tool takes every argument up front, so there is nothing to hide or disable. */
export function resolveArgs(
  args: Record<string, Binding>, c: ResolveContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [name, b] of Object.entries(args)) out[name] = bound(b, c)
  return out
}

/** A function variable is only worth calling once every argument has a value —
 *  a tool invoked with an undefined variantId throws a schema error the operator
 *  reads as a broken screen. */
export function argsReady(args: Record<string, unknown>): boolean {
  return Object.values(args).every((v) => v !== undefined && v !== null && v !== '')
}
