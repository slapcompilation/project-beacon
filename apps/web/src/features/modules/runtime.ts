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

/** Variables worth resolving right now — the lazy rule applied to everything
 *  that consumes one. A widget with no layout sits at module root and always shows.
 *
 *  A LOOP consumes a variable too, from its own config rather than a binding.
 *  Missing that made a loop render "nothing in the set" forever, because the set
 *  it walks was never resolved. */
export function visibleVariableIds(mod: ModuleDoc, ui: ModuleUiState): Set<string> {
  const shown = visibleLayoutIds(mod, ui)
  const ids = new Set<string>()
  for (const w of mod.widgets) {
    if (w.variableId && (w.layoutId === null || shown.has(w.layoutId))) ids.add(w.variableId)
  }
  for (const l of mod.layouts) {
    if (l.layoutType !== 'loop') continue
    if (l.parentId !== null && !shown.has(l.parentId)) continue
    const name = l.config.variable
    const v = typeof name === 'string' ? mod.variables.find((x) => x.apiName === name) : undefined
    if (v) ids.add(v.id)
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

/** `{{apiName}}` in Markdown reads module state, and `{{apiName.property}}`
 *  reaches inside it.
 *
 *  The dotted form is what makes a loop useful: the loop hands a whole object to
 *  the child's interface variable, and without a way to read one property off it
 *  a per-object card can only print JSON. */
export function interpolate(body: string, mod: ModuleDoc, ui: ModuleUiState): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)((?:\.[a-zA-Z0-9_]+)*)\s*\}\}/g,
    (whole, name: string, path: string) => {
      const v = mod.variables.find((x) => x.apiName === name)
      if (!v) return whole
      let value = scalarValue(v, ui)
      for (const key of path.split('.').filter(Boolean)) {
        if (value === null || value === undefined || typeof value !== 'object') return '—'
        value = (value as Record<string, unknown>)[key]
      }
      return display(value)
    })
}

// ── The Tabs widget ──────────────────────────────────────────────────────────

/** One tab of a Tabs widget. Its events are ordinary module_events keyed by
 *  `button`, exactly as a Button Group's are. */
export interface TabSpec {
  key?:     string
  label?:   string
  icon?:    string
  /** api name of a string or numeric variable shown to the right of the label. */
  badge?:   string
  /** api name of a boolean variable that controls this tab… */
  visibleWhen?: string
  /** …by disabling it when false, or hiding it entirely. */
  whenFalse?: 'disabled' | 'hidden'
}

/** Which tab reads as selected.
 *
 *  Copied, because it is the one part of this widget nobody would invent
 *  correctly: "the Tabs widget does not hold its own selection state. Instead,
 *  selection state is derived from events configured for the widget. Switch to
 *  tab and Switch to page events that lead to NO LAYOUT STATE CHANGE will be
 *  used to determine the selected tab."
 *
 *  So a tab is selected when pressing it would do nothing — its own event
 *  already describes where you are. Their tie-break comes with it: "the tab with
 *  the most no-layout-state-change events will be the selected tab, preferring
 *  the earliest tab in the case of a tie", and "set variable value events are
 *  not currently used to check for selected tab state". */
export function selectedTabKey(
  mod: ModuleDoc, ui: ModuleUiState, widgetId: string, tabs: ReadonlyArray<TabSpec>,
): string | null {
  let best: { key: string; score: number } | null = null

  for (const [i, tab] of tabs.entries()) {
    const key = tab.key ?? String(i)
    const events = mod.events.filter((e) =>
      e.sourceWidgetId === widgetId && e.config.button === key)

    let score = 0
    for (const e of events) {
      const target = typeof e.config.layoutApiName === 'string'
        ? mod.layouts.find((l) => l.apiName === e.config.layoutApiName)
        : undefined
      if (!target) continue
      if (e.effectType === 'switch_tab' && activeTabId(mod, ui, target.parentId ?? ROOT) === target.id) score += 1
      if (e.effectType === 'switch_page' && activePageId(mod, ui, target.parentId) === target.id) score += 1
    }
    // Strictly greater keeps the earliest tab on a tie.
    if (score > 0 && (best === null || score > best.score)) best = { key, score }
  }
  return best?.key ?? null
}

/** The page currently showing among siblings — the page equivalent of activeTabId. */
export function activePageId(mod: ModuleDoc, ui: ModuleUiState, parentId: string | null): string | null {
  const pages = mod.layouts
    .filter((l) => l.layoutType === 'page' && l.parentId === parentId)
    .sort((a, b) => a.position - b.position)
  if (pages.length === 0) return null
  return (pages.find((p) => p.id === ui.activePageId) ?? pages[0]).id
}

/** Hidden tabs are dropped; disabled ones are shown and not pressable. */
export function tabState(
  mod: ModuleDoc, ui: ModuleUiState, tab: TabSpec,
): 'shown' | 'disabled' | 'hidden' {
  if (!tab.visibleWhen) return 'shown'
  const v = mod.variables.find((x) => x.apiName === tab.visibleWhen)
  if (!v) return 'shown'
  const on = scalarValue(v, ui) === true || scalarValue(v, ui) === 'true'
  if (on) return 'shown'
  return tab.whenFalse === 'hidden' ? 'hidden' : 'disabled'
}
