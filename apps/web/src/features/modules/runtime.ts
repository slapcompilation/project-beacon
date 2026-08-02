// Module runtime: what is visible, and what an interaction does.
//
// Pure on purpose. Both rules W2 copies from Foundry are behavioural contracts
// that a comment cannot enforce, so they live here with a test beside them
// rather than tangled into the renderer.

import type { ModuleDoc, ModuleEvent, ModuleLayout, ModuleVariable } from './api'

export interface ModuleUiState {
  activePageId:      string | null
  /** parent layout id (or '__root__') → active tab id */
  activeTabByParent: Record<string, string>
  collapsedSections: Record<string, boolean>
  openOverlays:      string[]
  /** variable id → current value; absent means "still at its definition" */
  values:            Record<string, unknown>
}

/** Effects the renderer performs; the reducer stays pure. */
export type SideEffect =
  | { kind: 'recompute'; variableId: string }
  | { kind: 'refresh' }
  | { kind: 'unsupported'; effectType: string }

export const ROOT = '__root__'

export function initialState(mod: ModuleDoc): ModuleUiState {
  const values: Record<string, unknown> = {}
  for (const v of mod.variables) {
    if (v.definitionKind === 'static' && 'value' in v.definition) {
      values[v.id] = v.definition.value
    }
  }
  return { activePageId: null, activeTabByParent: {}, collapsedSections: {}, openOverlays: [], values }
}

function childrenOf(mod: ModuleDoc): Map<string, ModuleLayout[]> {
  const byParent = new Map<string, ModuleLayout[]>()
  for (const l of [...mod.layouts].sort((a, b) => a.position - b.position)) {
    const key = l.parentId ?? ROOT
    byParent.set(key, [...(byParent.get(key) ?? []), l])
  }
  return byParent
}

/** Which tab is showing under a parent — first one until an event says otherwise. */
export function activeTabId(mod: ModuleDoc, ui: ModuleUiState, parentId: string): string | null {
  const tabs = (childrenOf(mod).get(parentId) ?? []).filter((l) => l.layoutType === 'tab')
  if (tabs.length === 0) return null
  const chosen = tabs.find((t) => t.id === ui.activeTabByParent[parentId])
  return (chosen ?? tabs[0]).id
}

/** Foundry's lazy rule: "variables used in non-visible pages, tabs, overlays …
 *  will not be computed until they are shown."
 *
 *  Sections are deliberately NOT in that list, so a collapsed section still
 *  computes here. Copying the limit rather than improving on it — an operator
 *  expanding a section expects data, not a spinner. */
export function visibleLayoutIds(mod: ModuleDoc, ui: ModuleUiState): Set<string> {
  const byParent = childrenOf(mod)
  const out = new Set<string>()

  const walk = (parentKey: string) => {
    const kids = byParent.get(parentKey) ?? []
    const pages = kids.filter((l) => l.layoutType === 'page')
    const activePage = pages.length
      ? (pages.find((p) => p.id === ui.activePageId) ?? pages[0]).id
      : null
    const activeTab = activeTabId(mod, ui, parentKey)

    for (const l of kids) {
      if (l.layoutType === 'page' && l.id !== activePage) continue
      if (l.layoutType === 'tab' && l.id !== activeTab) continue
      if (l.layoutType === 'overlay' && !ui.openOverlays.includes(l.id)) continue
      out.add(l.id)
      walk(l.id)
    }
  }
  walk(ROOT)
  return out
}

/** Variables worth resolving right now — the lazy rule applied to the graph of
 *  widget bindings. A widget with no layout sits at module root and always shows. */
export function visibleVariableIds(mod: ModuleDoc, ui: ModuleUiState): Set<string> {
  const shown = visibleLayoutIds(mod, ui)
  const ids = new Set<string>()
  for (const w of mod.widgets) {
    if (w.variableId && (w.layoutId === null || shown.has(w.layoutId))) ids.add(w.variableId)
  }
  return ids
}

export interface TriggerContext {
  /** Button Group: which button was pressed. */
  button?: string
  /** Object Table: the row that was selected. */
  row?: Record<string, unknown>
}

/** Effects bound to one interaction, in dispatch order.
 *
 *  An effect that names a button only fires for that button; one that doesn't
 *  fires for the whole widget. */
export function effectsFor(
  mod: ModuleDoc, widgetId: string, trigger: ModuleEvent['trigger'], ctx: TriggerContext = {},
): ModuleEvent[] {
  return mod.events
    .filter((e) => e.sourceWidgetId === widgetId && e.trigger === trigger)
    .filter((e) => typeof e.config.button !== 'string' || e.config.button === ctx.button)
    .sort((a, b) => a.position - b.position)
}

const layoutByApiName = (mod: ModuleDoc, apiName: unknown): ModuleLayout | undefined =>
  typeof apiName === 'string' ? mod.layouts.find((l) => l.apiName === apiName) : undefined

/** Apply an ordered run of effects.
 *
 *  THE SEMANTIC, copied verbatim from Foundry: "events do not wait for the
 *  downstream computations of previous events to complete before executing."
 *  Nothing here awaits anything — effects fold over state in one synchronous
 *  pass, and recomputation is handed back as a side effect for the caller to
 *  kick off without blocking. So an effect that reads what the previous effect
 *  computed reads the OLD value. That is the documented behaviour, not a bug;
 *  the authoring fix is to split them into separate user-triggered events. */
export function applyEffects(
  mod: ModuleDoc, state: ModuleUiState, effects: ModuleEvent[], ctx: TriggerContext = {},
): { state: ModuleUiState; sideEffects: SideEffect[] } {
  let next = state
  const sideEffects: SideEffect[] = []

  for (const e of effects) {
    const cfg = e.config
    const target = layoutByApiName(mod, cfg.layoutApiName)

    switch (e.effectType) {
      case 'set_variable': {
        const id = typeof cfg.variableId === 'string' ? cfg.variableId : null
        if (!id) break
        const value = typeof cfg.fromProperty === 'string'
          ? ctx.row?.[cfg.fromProperty]
          : cfg.value
        next = { ...next, values: { ...next.values, [id]: value } }
        break
      }
      case 'reset_variable': {
        const id = typeof cfg.variableId === 'string' ? cfg.variableId : null
        if (!id) break
        const v = mod.variables.find((x) => x.id === id)
        const back = v?.definitionKind === 'static' && 'value' in v.definition
          ? { [id]: v.definition.value }
          : {}
        // Drop the override, then restore the static default if there is one.
        const { [id]: _dropped, ...rest } = next.values
        next = { ...next, values: { ...rest, ...back } }
        break
      }
      case 'recompute_variable':
        if (typeof cfg.variableId === 'string') sideEffects.push({ kind: 'recompute', variableId: cfg.variableId })
        break

      case 'switch_page':
        if (target) next = { ...next, activePageId: target.id }
        break
      case 'switch_tab':
        if (target) {
          next = { ...next, activeTabByParent: { ...next.activeTabByParent, [target.parentId ?? ROOT]: target.id } }
        }
        break
      case 'toggle_section':
        if (target) {
          next = { ...next, collapsedSections: { ...next.collapsedSections, [target.id]: !next.collapsedSections[target.id] } }
        }
        break

      case 'open_overlay':
        if (target && !next.openOverlays.includes(target.id)) {
          next = { ...next, openOverlays: [...next.openOverlays, target.id] }
        }
        break
      case 'close_overlay':
        if (target) next = { ...next, openOverlays: next.openOverlays.filter((id) => id !== target.id) }
        break

      case 'refresh_module':
        sideEffects.push({ kind: 'refresh' })
        break

      // In the CHECK constraint, not yet in the runtime. Reported rather than
      // dropped — an author who wires one should see that it did nothing.
      default:
        sideEffects.push({ kind: 'unsupported', effectType: e.effectType })
    }
  }
  return { state: next, sideEffects }
}

/** Current value of a scalar variable. */
export function scalarValue(v: ModuleVariable | undefined, ui: ModuleUiState): unknown {
  if (!v) return undefined
  if (v.id in ui.values) return ui.values[v.id]
  return v.definitionKind === 'static' ? v.definition.value : undefined
}

/** A property or variable can hold anything. "[object Object]" on an operator's
 *  screen is worse than JSON they can at least read. */
export function display(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return v.toString()
  if (typeof v === 'object') return JSON.stringify(v)
  return '—' // functions and symbols never arrive from JSON
}

/** `{{apiName}}` in Markdown reads module state — the smallest useful version of
 *  Foundry's variable interpolation. */
export function interpolate(body: string, mod: ModuleDoc, ui: ModuleUiState): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (whole, name: string) => {
    const v = mod.variables.find((x) => x.apiName === name)
    return v ? display(scalarValue(v, ui)) : whole
  })
}
