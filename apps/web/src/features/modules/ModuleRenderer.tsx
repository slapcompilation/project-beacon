// Renders a module from its rows. The point of W1, still true in W2: this file
// does not know what any particular application looks like — it draws whatever
// the module's rows describe, so a new application is data, not a deploy.
//
// W2 adds the layout tree, event dispatch, and Foundry's lazy computation rule.
// Both copied semantics live in runtime.ts with a test; this file is the drawing.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import {
  Button, ButtonGroup, Callout, Card, Collapse, Dialog, DialogBody, Icon, Intent,
  InputGroup, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { useActiveHotelId } from '@/hooks/useActiveHotelId'
import { useAuthStore } from '@/stores/auth.store'
import { ActionFormModal } from '@/features/actions/ActionFormModal'
import type { BeaconAction } from '@beacon/reality-graph'
import {
  argsReady, resolveArgs, resolveParameters,
  type ActionSpec, type Binding, type ButtonSpec,
} from './bindings'
import {
  fetchModule, resolveFunctionVariable, resolveObjectSetVariable,
  type ModuleDoc, type ModuleEvent, type ModuleLayout, type ModuleVariable, type ModuleWidget,
} from './api'
import {
  ROOT, activeTabId, applyEffects, display, effectsFor, initialState, interpolate,
  aggregateSet, aggregationSource, applyObjectSetFilter, filterClauses,
  propertyValues, scalarValue, selectedTabKey, shouldCompute, tabState,
  visibleVariableIds,
  type AggregationMetric, type FilterClause, type ModuleUiState, type SideEffect,
  type TabSpec, type TriggerContext,
} from './runtime'
import { AdoptionPanel } from './AdoptionPanel'
import { PromoteDialog } from './PromoteDialog'
import { usePromotedApps } from './promotions'

export function useModule(apiName: string) {
  return useQuery({
    queryKey: ['module', apiName],
    queryFn:  () => fetchModule(apiName),
    staleTime: 60_000,
  })
}

type Resolved = {
  records: Record<string, unknown>[]
  loading: boolean
  /** Function variables: the tool's output, plus the basis/confidence every
   *  computed result in this system is required to carry. */
  value?: unknown
  basis?: string
  confidence?: number
  error?: string
}

/** Only variables on visible layouts resolve — Foundry's lazy rule, which W1
 *  could not implement because it had nowhere to hide a widget. */
function useResolvedVariables(
  mod: ModuleDoc | null | undefined,
  ui: ModuleUiState,
  triggered: ReadonlySet<string>,
  loaded: boolean,
) {
  const wanted = mod ? visibleVariableIds(mod, ui) : new Set<string>()
  const shown = (mod?.variables ?? []).filter((v) => wanted.has(v.id))
  const setVars = shown.filter((v) => v.varType === 'object_set')
  const fnVars  = shown.filter((v) => v.definitionKind === 'function')

  const setResults = useQueries({
    queries: setVars.map((v) => ({
      queryKey: ['module-variable', v.id],
      queryFn:  () => resolveObjectSetVariable(v),
      staleTime: 30_000,
    })),
  })

  // A tool called with an unset argument throws a schema error the operator
  // reads as a broken screen, so an incomplete binding stays unresolved instead.
  const fnArgs = fnVars.map((v) => mod
    ? resolveArgs((v.definition.args ?? {}) as Record<string, Binding>, { mod, ui })
    : {})

  const fnResults = useQueries({
    queries: fnVars.map((v, i) => ({
      queryKey: ['module-variable', v.id, fnArgs[i]],
      queryFn:  () => resolveFunctionVariable(v, fnArgs[i]),
      // Foundry's recompute contract, which this had been storing and ignoring:
      // `event` waits for a recompute event; `on_load_and_event` runs once.
      enabled:  argsReady(fnArgs[i]) && shouldCompute(v, triggered, loaded),
      staleTime: 30_000,
    })),
  })

  const byId = new Map<string, Resolved>()
  setVars.forEach((v, i) => {
    // Foundry: an object set "may be optionally filtered by property values or
    // FILTER VARIABLES". Applied once here, so the table, the loop and every
    // aggregation over this set all move together.
    const all = setResults[i]?.data ?? []
    const clauses = mod ? filterClauses(mod, ui, v.definition.filterVariable) : []
    byId.set(v.id, {
      records: clauses.length > 0 ? applyObjectSetFilter(all, clauses) : all,
      loading: setResults[i]?.isLoading ?? false,
    })
  })
  // An aggregation is derived, not fetched: it reads the records its source set
  // variable already resolved. One set can back a count, a sum and an average.
  for (const v of shown) {
    if (v.definitionKind !== 'object_set_aggregation' || !mod) continue
    if (!shouldCompute(v, triggered, loaded)) continue
    const src = aggregationSource(mod, v)
    const bound = src ? byId.get(src.id) : undefined
    const metric = (typeof v.definition.metric === 'string' ? v.definition.metric : 'count') as AggregationMetric
    const property = typeof v.definition.property === 'string' ? v.definition.property : null
    byId.set(v.id, {
      records: [],
      loading: bound?.loading ?? false,
      value: bound ? aggregateSet(bound.records, metric, property) ?? undefined : undefined,
      // Every computed value in this system carries where it came from.
      basis: src ? `${metric}${property ? ` of ${property}` : ''} over ${src.apiName}` : undefined,
      error: src ? undefined : `Workshop:UnknownObjectSet ${String(v.definition.objectSet)}`,
    })
  }

  fnVars.forEach((v, i) => {
    const r = fnResults[i]
    const out = r.data ?? null
    const key = typeof v.definition.output === 'string' ? v.definition.output : null
    byId.set(v.id, {
      records: [],
      loading: r.isLoading && argsReady(fnArgs[i]),
      value: out ? (key ? out[key] : out) : undefined,
      basis: typeof out?.basis === 'string' ? out.basis : undefined,
      confidence: typeof out?.confidence === 'number' ? out.confidence : undefined,
      error: r.error instanceof Error ? r.error.message : undefined,
    })
  })
  return byId
}

interface Ctx {
  mod:      ModuleDoc
  ui:       ModuleUiState
  resolved: Map<string, Resolved>
  dispatch: (widgetId: string, trigger: ModuleEvent['trigger'], tctx?: TriggerContext) => void
  setUi:    (fn: (s: ModuleUiState) => ModuleUiState) => void
  /** Opens the Action Registry's own form. A module is a new CALLER of
   *  dispatchAction, never a second write path. */
  openAction: (spec: ActionSpec) => void
  /** How deep this instance is embedded, and which modules are above it.
   *  Foundry documents neither a depth cap nor a self-embed rule; an uncapped
   *  recursive renderer is a tab that stops responding, so both live here. */
  depth: number
  ancestors: ReadonlyArray<string>
}

/** The same number searchAround uses. Stated as ours, not as Foundry's. */
const MAX_EMBED_DEPTH = 3
/** Foundry: "loop layouts are currently limited to paging through the first ten
 *  thousand objects." Copied rather than chosen. */
const LOOP_CEILING = 10_000

function ObjectTable({ widget, resolved, dispatch }: {
  widget: ModuleWidget; resolved: Resolved | undefined; dispatch: Ctx['dispatch']
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const records = resolved?.records ?? []

  // Columns from config when the author picked them, otherwise whatever the
  // first record has — a table that renders nothing because nobody chose
  // columns is worse than one that guesses and can be corrected.
  const configured = Array.isArray(widget.config.columns)
    ? (widget.config.columns as unknown[]).filter((c): c is string => typeof c === 'string')
    : []
  const cols = configured.length > 0 ? configured : Object.keys(records[0] ?? {}).slice(0, 6)

  return (
    <Card className="!p-0 overflow-hidden">
      {widget.title && <div className="px-3 py-2 border-b text-sm font-semibold">{widget.title}</div>}
      {resolved?.loading ? (
        <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
          <Spinner size={SpinnerSize.SMALL} /> Resolving the set…
        </div>
      ) : records.length === 0 ? (
        <div className="px-3 py-4 text-sm text-muted-foreground">
          The set resolved to no objects. That is an answer, not an error — the
          conditions may simply match nothing right now.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/40">
              <tr>{cols.map((c) => (
                <th key={c} className="px-3 py-1.5 text-left font-semibold">{c}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {records.slice(0, 100).map((r, i) => {
                const key = typeof r.id === 'string' ? r.id : String(i)
                return (
                  <tr key={key}
                      onClick={() => { setSelected(key); dispatch(widget.id, 'row_select', { row: r }) }}
                      className={cn('cursor-pointer hover:bg-muted/40', selected === key && 'bg-primary/10')}>
                    {cols.map((c) => (
                      <td key={c} className={cn('px-3 py-1.5', typeof r[c] === 'number' && 'tabular-nums')}>
                        {display(r[c])}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {records.length > 100 && (
            <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-t">
              showing 100 of {records.length}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function Widget({ widget, ctx }: { widget: ModuleWidget; ctx: Ctx }) {
  const { mod, ui, resolved, dispatch } = ctx
  const variable: ModuleVariable | undefined = widget.variableId
    ? mod.variables.find((v) => v.id === widget.variableId)
    : undefined
  const bound = widget.variableId ? resolved.get(widget.variableId) : undefined
  const records = bound?.records ?? []

  switch (widget.widgetType) {
    case 'markdown': {
      // Rendered as text, deliberately. Foundry's Markdown widget accepts rich
      // content; ours will too when somebody needs it — but interpreting
      // authored markup is an injection surface we don't need yet. `{{var}}`
      // interpolation is the one thing W2 does read.
      const body = typeof widget.config.body === 'string' ? widget.config.body : ''
      return <Card className="whitespace-pre-wrap text-sm leading-relaxed">{interpolate(body, mod, ui)}</Card>
    }

    case 'object_set_title':
      return (
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">{widget.title || variable?.label || 'Set'}</h2>
          {bound?.loading ? <Spinner size={SpinnerSize.SMALL} /> : <Tag minimal>{records.length}</Tag>}
        </div>
      )

    case 'metric_card': {
      // Foundry: "the value used to populate the metric must be backed by a
      // Workshop variable of the corresponding type". The card DISPLAYS; the
      // aggregating belongs to an object_set_aggregation variable. Binding a set
      // straight to a card is what makes people keep a second set per number.
      if (variable?.varType === 'object_set') {
        return (
          <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
            <strong>{widget.title || 'This metric'}</strong> is bound to a set rather
            than a value. Point it at an aggregation variable over{' '}
            <code>{variable.apiName}</code> instead — one set can back as many
            numbers as you need.
          </Callout>
        )
      }
      const raw: unknown = bound?.value ?? scalarValue(variable, ui)
      const shown = typeof raw === 'number' ? Math.round(raw * 100) / 100 : display(raw)

      // Every computed result carries its basis and confidence — a number an
      // operator cannot trace is a number they cannot act on.
      const footer = bound?.error ? bound.error
        : bound?.basis
          ? `${bound.basis}${bound.confidence === undefined ? '' : ` · ${Math.round(bound.confidence * 100)}% confidence`}`
          : variable?.label

      return (
        <Card className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {widget.title || variable?.label}
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {bound?.loading ? <Spinner size={SpinnerSize.SMALL} /> : shown}
          </div>
          <div className={cn('text-[11px]', bound?.error ? 'text-danger' : 'text-muted-foreground')}>
            {footer}
          </div>
        </Card>
      )
    }

    case 'object_table':
      return <ObjectTable widget={widget} resolved={bound} dispatch={dispatch} />

    case 'filter_list': {
      // Input is an object set; output is ONE object set filter variable that
      // "plays two roles": the live filter state, and the default applied on load.
      const outName = typeof widget.config.output === 'string' ? widget.config.output : null
      const outVar = outName
        ? mod.variables.find((v) => v.apiName === outName && v.varType === 'object_set_filter')
        : undefined
      const props = (Array.isArray(widget.config.properties)
        ? widget.config.properties : []) as Array<{ property: string; component?: string }>

      if (!outVar) {
        return (
          <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
            This filter has nowhere to put what the operator chooses. Point it at an
            object-set-filter variable, then let the set it filters read that variable.
          </Callout>
        )
      }

      const clauses = filterClauses(mod, ui, outName)
      const clauseFor = (p: string) => clauses.find((c) => c.property === p)
      const write = (next: FilterClause[]) => {
        ctx.setUi((st) => ({ ...st, values: { ...st.values, [outVar.id]: next } }))
      }
      const setClause = (property: string, patch: Partial<FilterClause> | null) => {
        const rest = clauses.filter((c) => c.property !== property)
        write(patch === null ? rest : [...rest, { property, op: 'IS', ...patch } as FilterClause])
      }

      // The values offered come from the set BEFORE its own filter narrows it,
      // or choosing one value would hide all the others.
      const unfiltered = records

      return (
        <Card className="space-y-3">
          {widget.title && <div className="text-sm font-semibold">{widget.title}</div>}
          {props.map((p) => {
            const current = clauseFor(p.property)
            if (p.component === 'keyword') {
              return (
                <div key={p.property} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {p.property}
                  </div>
                  <InputGroup size="small" placeholder="Starts with…"
                    value={typeof current?.value === 'string' ? current.value : ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setClause(p.property, v === '' ? null : { op: 'CONTAIN', value: v })
                    }} />
                </div>
              )
            }
            const chosen = Array.isArray(current?.value) ? current.value as string[] : []
            return (
              <div key={p.property} className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {p.property}
                </div>
                <div className="flex flex-wrap gap-1">
                  {propertyValues(unfiltered, p.property).map((val) => {
                    const on = chosen.includes(val)
                    return (
                      <Button key={val} size="small" active={on} text={val}
                        onClick={() => {
                          const next = on ? chosen.filter((x) => x !== val) : [...chosen, val]
                          setClause(p.property, next.length === 0 ? null : { op: 'IS', value: next })
                        }} />
                    )
                  })}
                </div>
              </div>
            )
          })}
          {clauses.length > 0 && (
            <Button size="small" variant="minimal" icon="filter-remove" text="Clear filters"
              onClick={() => { write([]) }} />
          )}
        </Card>
      )
    }

    case 'tabs': {
      // Foundry's Tabs widget owns no layouts — it fires events. Selection is
      // DERIVED: the tab whose own event would change nothing is the one you are
      // already on. See selectedTabKey.
      const tabs = (Array.isArray(widget.config.tabs) ? widget.config.tabs : []) as TabSpec[]
      const vertical = widget.config.direction === 'vertical'
      const active = selectedTabKey(mod, ui, widget.id, tabs)

      return (
        <div className={cn('flex gap-1', vertical ? 'flex-col items-stretch' : 'items-center border-b')}>
          {tabs.map((tab, i) => {
            const key = tab.key ?? String(i)
            const state = tabState(mod, ui, tab)
            if (state === 'hidden') return null
            // "Text via a string variable or a numeric value via a number
            // variable." This briefly also accepted an object set and showed its
            // count, because there was no other way to get one; an aggregation
            // variable is that way, so the divergence is withdrawn as promised.
            const badgeVar = tab.badge
              ? mod.variables.find((v) => v.apiName === tab.badge)
              : undefined
            const bound = badgeVar ? resolved.get(badgeVar.id) : undefined
            const badge = bound?.value ?? scalarValue(badgeVar, ui)

            return (
              <button key={key} type="button" disabled={state === 'disabled'}
                onClick={() => { dispatch(widget.id, 'click', { button: key }) }}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 text-sm',
                  vertical ? 'justify-start rounded' : 'border-b-2 -mb-px',
                  state === 'disabled' && 'opacity-40 cursor-not-allowed',
                  key === active
                    ? (vertical ? 'bg-primary/10 font-semibold' : 'border-primary font-semibold')
                    : (vertical ? 'hover:bg-muted/60' : 'border-transparent text-muted-foreground hover:text-foreground'))}>
                {tab.icon && <Icon icon={tab.icon as IconName} size={13} />}
                {tab.label ?? key}
                {badge !== undefined && badge !== null && badge !== '' && (
                  <Tag minimal round className="!text-[10px]">{display(badge)}</Tag>
                )}
              </button>
            )
          })}
        </div>
      )
    }

    case 'embedded_module': {
      // Foundry maps parent variables onto the child's INTERFACE variables and
      // shares them both ways: "any change to a variable value in either the
      // child or parent module will be reflected in all modules where the
      // variable is mapped."
      const childName = typeof widget.config.module === 'string' ? widget.config.module : null
      const mapping = (widget.config.mapping ?? {}) as Record<string, string>
      if (!childName) {
        return (
          <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
            This is meant to show another application, but none has been chosen.
          </Callout>
        )
      }
      const injected: Record<string, unknown> = {}
      for (const [childVar, parentVar] of Object.entries(mapping)) {
        const pv = mod.variables.find((v) => v.apiName === parentVar)
        injected[childVar] = pv ? (ctx.resolved.get(pv.id)?.value ?? scalarValue(pv, ui)) : undefined
      }
      return (
        <Embedded apiName={childName} ctx={ctx} injected={injected}
          onSharedChange={(childVar, value) => {
            const parentVar = mod.variables.find((v) => v.apiName === mapping[childVar])
            if (parentVar) ctx.setUi((st) => ({ ...st, values: { ...st.values, [parentVar.id]: value } }))
          }} />
      )
    }

    case 'button_group': {
      const buttons = (Array.isArray(widget.config.buttons) ? widget.config.buttons : []) as ButtonSpec[]
      return (
        <ButtonGroup>
          {buttons.map((btn, i) => (
            <Button key={btn.key ?? i} text={btn.label ?? btn.key ?? 'Button'}
              intent={btn.intent as Intent | undefined} size="small"
              icon={btn.action ? 'flash' : undefined}
              onClick={() => {
                // Foundry applies actions through WIDGET CONFIG, not an event
                // effect — so a button can do both, and events still fire.
                if (btn.action) ctx.openAction(btn.action)
                dispatch(widget.id, 'click', { button: btn.key })
              }} />
          ))}
        </ButtonGroup>
      )
    }

  }
}

/** The tab bar a container draws for its own tab children — Foundry's Tabs is a
 *  layout option on a section, "adds tabs to the top of a section", not a widget
 *  somebody places. */
function TabBar({ parentKey, ctx }: { parentKey: string; ctx: Ctx }) {
  const { mod, ui, dispatch } = ctx
  const tabs = mod.layouts
    .filter((l) => l.layoutType === 'tab' && (l.parentId ?? ROOT) === parentKey)
    .sort((a, b) => a.position - b.position)
  if (tabs.length === 0) return null
  const active = activeTabId(mod, ui, parentKey)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1 border-b">
        {tabs.map((t) => (
          <button key={t.id} type="button"
            onClick={() => {
              ctx.setUi((s) => ({ ...s, activeTabByParent: { ...s.activeTabByParent, [parentKey]: t.id } }))
              // A tab_change event belongs to the tab, not to a widget.
              dispatch(t.id, 'tab_change', { button: t.apiName })
            }}
            className={cn('px-3 py-1.5 text-sm border-b-2 -mb-px',
              t.id === active ? 'border-primary font-semibold'
                              : 'border-transparent text-muted-foreground hover:text-foreground')}>
            {t.title || t.apiName}
          </button>
        ))}
      </div>
      {active && <Children parentKey={active} ctx={ctx} />}
    </div>
  )
}

/** A module rendered inside another one — the Loop layout's per-item instance
 *  and the Embedded Module widget both land here.
 *
 *  Foundry: each instance "functions independently from other embedded module
 *  instances, and has its own variable scope and layout state". So this owns
 *  its state, and only the variables the parent MAPS are shared. */
function Embedded({ apiName, ctx, injected, onSharedChange }: {
  apiName: string
  ctx: Ctx
  /** Parent-supplied values, by the child's variable api name. */
  injected?: Record<string, unknown>
  /** Called when the child changes a mapped variable — the sharing is
   *  bidirectional, and the parent's definition is what backs it. */
  onSharedChange?: (variableApiName: string, value: unknown) => void
}) {
  if (ctx.ancestors.includes(apiName)) {
    return (
      <Callout intent={Intent.WARNING} icon="repeat" className="text-xs">
        <strong>{apiName}</strong> already contains this one. A module cannot embed
        itself, directly or through the chain {ctx.ancestors.join(' → ')}.
      </Callout>
    )
  }
  if (ctx.depth >= MAX_EMBED_DEPTH) {
    return (
      <Callout intent={Intent.WARNING} icon="layers" className="text-xs">
        Modules are nested {MAX_EMBED_DEPTH} deep here, which is as far as this
        runtime goes. Flatten the composition rather than nesting further.
      </Callout>
    )
  }
  return (
    <ModuleInstance apiName={apiName} depth={ctx.depth + 1}
      ancestors={[...ctx.ancestors, ctx.mod.apiName]}
      injected={injected} onSharedChange={onSharedChange} />
  )
}

/** Foundry's Loop layout: iterate an object set, render one embedded module per
 *  entry, and pass the entry in through a named interface variable of the child. */
function Loop({ layout, ctx }: { layout: ModuleLayout; ctx: Ctx }) {
  const [page, setPage] = useState(0)
  const cfg = layout.config
  const varName = typeof cfg.variable === 'string' ? cfg.variable : null
  const childName = typeof cfg.module === 'string' ? cfg.module : null
  const itemInto = typeof cfg.itemInto === 'string' ? cfg.itemInto : null

  if (!varName || !childName || !itemInto) {
    return (
      <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
        This loop is not finished — it needs a set to walk, a module to show for
        each entry, and the name of the variable in that module the entry goes into.
      </Callout>
    )
  }

  const variable = ctx.mod.variables.find((v) => v.apiName === varName)
  const bound = variable ? ctx.resolved.get(variable.id) : undefined
  if (bound?.loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner size={SpinnerSize.SMALL} /> Resolving the set…
    </div>
  }

  const all = (bound?.records ?? []).slice(0, LOOP_CEILING)
  const paging = (cfg.paging ?? {}) as { style?: string; size?: number }
  const size = typeof paging.size === 'number' && paging.size > 0 ? paging.size : 25
  const paged = paging.style === 'paged'
  const shown = paged ? all.slice(page * size, page * size + size) : all.slice(0, size)
  const display = (cfg.display ?? {}) as { mode?: string; columns?: number }
  const grid = display.mode === 'grid'

  if (all.length === 0) {
    return <div className="text-sm text-muted-foreground">
      Nothing in the set right now, so there is nothing to show one of.
    </div>
  }

  return (
    <div className="space-y-3">
      <div className={cn(grid
        ? `grid gap-3 grid-cols-1 sm:grid-cols-${String(display.columns ?? 2)}`
        : 'space-y-3')}>
        {shown.map((item, i) => (
          <Embedded key={typeof item.id === 'string' ? item.id : i}
            apiName={childName} ctx={ctx} injected={{ [itemInto]: item }} />
        ))}
      </div>
      {paged && all.length > size && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button size="small" variant="minimal" icon="chevron-left" aria-label="Previous page"
            disabled={page === 0} onClick={() => { setPage((p) => p - 1) }} />
          <span>{page * size + 1}–{Math.min((page + 1) * size, all.length)} of {all.length}</span>
          <Button size="small" variant="minimal" icon="chevron-right" aria-label="Next page"
            disabled={(page + 1) * size >= all.length} onClick={() => { setPage((p) => p + 1) }} />
        </div>
      )}
      {all.length === LOOP_CEILING && (
        <p className="text-[11px] text-muted-foreground">
          Showing the first {LOOP_CEILING.toLocaleString()} — a loop does not page past that.
        </p>
      )}
    </div>
  )
}

/** Widgets and child layouts of one parent, interleaved by position so an author
 *  can put a heading above a section without fighting the renderer.
 *
 *  A `row` lays its children out horizontally; everything else stacks. That is
 *  the whole of Foundry's arrangement model that we carry — rows and columns. */
function Children({ parentKey, ctx }: { parentKey: string; ctx: Ctx }) {
  const { mod } = ctx
  const container = mod.layouts.find((l) => l.id === parentKey)
  const horizontal = container?.layoutType === 'row'
  const items: Array<{ position: number; key: string; node: ReactNode }> = []

  for (const w of mod.widgets) {
    if ((w.layoutId ?? ROOT) !== parentKey) continue
    items.push({ position: w.position, key: `w${w.id}`, node: <Widget widget={w} ctx={ctx} /> })
  }
  for (const l of mod.layouts) {
    if ((l.parentId ?? ROOT) !== parentKey) continue
    // Tabs are drawn by their container's bar; overlays are dialogs at root.
    if (l.layoutType === 'tab' || l.layoutType === 'overlay') continue
    items.push({ position: l.position, key: `l${l.id}`, node: <Layout layout={l} ctx={ctx} /> })
  }

  items.sort((a, b) => a.position - b.position)
  return (
    <div className="space-y-4">
      {/* "Adds tabs to the TOP of a section" — and outside a row's flex, or the
          bar would become one more column. */}
      <TabBar parentKey={parentKey} ctx={ctx} />
      <div className={cn(horizontal ? 'flex items-start gap-4 [&>*]:flex-1 [&>*]:min-w-0' : 'space-y-4')}>
        {items.map((i) => <div key={i.key}>{i.node}</div>)}
      </div>
    </div>
  )
}

function Layout({ layout, ctx }: { layout: ModuleLayout; ctx: Ctx }) {
  const { mod, ui } = ctx

  if (layout.layoutType === 'loop') return <Loop layout={layout} ctx={ctx} />

  if (layout.layoutType === 'page') {
    const siblings = mod.layouts
      .filter((l) => l.layoutType === 'page' && l.parentId === layout.parentId)
      .sort((a, b) => a.position - b.position)
    const activeId = (siblings.find((p) => p.id === ui.activePageId) ?? siblings[0]).id
    if (layout.id !== activeId) return null
    return <Children parentKey={layout.id} ctx={ctx} />
  }

  if (layout.layoutType === 'section') {
    const collapsed = ui.collapsedSections[layout.id] ?? false
    return (
      <section className="space-y-2">
        <button type="button"
          onClick={() => { ctx.setUi((s) => ({
            ...s, collapsedSections: { ...s.collapsedSections, [layout.id]: !collapsed },
          })) }}
          className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground">
          <Icon icon={collapsed ? 'chevron-right' : 'chevron-down'} size={12} />
          {layout.title || layout.apiName}
        </button>
        <Collapse isOpen={!collapsed} keepChildrenMounted>
          <Children parentKey={layout.id} ctx={ctx} />
        </Collapse>
      </section>
    )
  }

  return <Children parentKey={layout.id} ctx={ctx} />
}

/** One running module: its own state, its own overlays, its own action form.
 *
 *  Split out of ModuleRenderer so it can render itself — a loop entry and an
 *  embedded module are both just another instance, and sharing the top-level
 *  chrome with them would put a page header inside a card. */
function ModuleInstance({ apiName, depth, ancestors, injected, onSharedChange, chrome }: {
  apiName: string
  depth: number
  ancestors: ReadonlyArray<string>
  injected?: Record<string, unknown>
  onSharedChange?: (variableApiName: string, value: unknown) => void
  /** The top-level renderer draws the header, promotion and adoption; an
   *  embedded instance draws none of it. */
  chrome?: (mod: ModuleDoc, body: ReactNode) => ReactNode
}) {
  const { data: mod, isLoading, isError, error } = useModule(apiName)
  const queryClient = useQueryClient()
  const [unsupported, setUnsupported] = useState<string[]>([])
  const [ui, setUi] = useState<ModuleUiState>({
    activePageId: null, activeTabByParent: {}, collapsedSections: {}, openOverlays: [], values: {},
  })
  const [pendingAction, setPendingAction] = useState<ActionSpec | null>(null)
  // Which variables a `recompute` effect has asked for, and whether the module's
  // first pass is done — both halves of the recompute contract.
  const [triggered, setTriggered] = useState<ReadonlySet<string>>(new Set())
  const [loaded, setLoaded] = useState(false)
  const injectedRef = useRef<Record<string, unknown>>({})
  const hotelId = useActiveHotelId()
  const actorId = useAuthStore((st) => st.session?.user.id ?? null)

  const perform = useCallback((effects: SideEffect[]) => {
    for (const e of effects) {
      if (e.kind === 'recompute') {
        setTriggered((t) => new Set(t).add(e.variableId))
        void queryClient.invalidateQueries({ queryKey: ['module-variable', e.variableId] })
      } else if (e.kind === 'refresh') {
        void queryClient.invalidateQueries({ queryKey: ['module-variable'] })
      } else {
        setUnsupported((u) => (u.includes(e.effectType) ? u : [...u, e.effectType]))
      }
    }
  }, [queryClient])

  // Static defaults land once the module arrives, then any on_load effects run.
  useEffect(() => {
    if (!mod) return
    const loads = mod.events.filter((e) => e.trigger === 'on_load')
    const { state, sideEffects } = applyEffects(mod, initialState(mod), [...loads].sort((a, b) => a.position - b.position))
    setUi(state)
    perform(sideEffects)
    // One tick later, so the first pass has already run with `loaded` false.
    queueMicrotask(() => { setLoaded(true) })
  }, [mod, perform])

  const dispatch = useCallback<Ctx['dispatch']>((widgetId, trigger, tctx = {}) => {
    if (!mod) return
    setUi((state) => {
      // Sequential dispatch, NOT sequential completion — see applyEffects.
      const { state: next, sideEffects } = applyEffects(
        mod, state, effectsFor(mod, widgetId, trigger, tctx), tctx)
      if (sideEffects.length > 0) queueMicrotask(() => { perform(sideEffects) })
      // A change to a mapped variable belongs to the parent, which owns it.
      if (onSharedChange) {
        for (const v of mod.variables) {
          if (!v.isInterface || !(v.id in injectedRef.current)) continue
          if (next.values[v.id] !== injectedRef.current[v.id]) {
            const value = next.values[v.id]
            queueMicrotask(() => { onSharedChange(v.apiName, value) })
          }
        }
      }
      return next
    })
  }, [mod, perform, onSharedChange])

  // A mapped variable is backed by the PARENT's definition, so the injected
  // value wins over anything local — Foundry: "default variable values of mapped
  // variables defined in the child module will not be used".
  const injectedById = new Map<string, unknown>()
  for (const [name, value] of Object.entries(injected ?? {})) {
    const v = mod?.variables.find((x) => x.apiName === name && x.isInterface)
    if (v) injectedById.set(v.id, value)
  }
  const effectiveUi = injectedById.size === 0 ? ui
    : { ...ui, values: { ...ui.values, ...Object.fromEntries(injectedById) } }

  const resolved = useResolvedVariables(mod, effectiveUi, triggered, loaded)

  // Deliberately not memoised: `resolved` is a fresh Map every render, so a memo
  // would freeze the context on the first (all-loading) one and the tables would
  // spin forever. Building the object is cheaper than that bug.
  const ctx: Ctx | null = mod
    ? { mod, ui: effectiveUi, resolved, dispatch, setUi, openAction: setPendingAction, depth, ancestors }
    : null

  // Function-variable results are values a binding can read, same as any other.
  const computed = new Map<string, unknown>()
  for (const [id, r] of resolved) if (r.value !== undefined) computed.set(id, r.value)

  const params = pendingAction && mod
    ? resolveParameters(pendingAction, {
        mod, ui, computed,
        // The module knows where it is running; the author binds neither.
        ambient: { hotelId, requestorId: actorId, actorId, userId: actorId },
      })
    : null

  if (isLoading) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  if (isError) {
    return <NonIdealState icon="error" title="Could not load this application"
             description={error instanceof Error ? error.message : undefined} />
  }
  if (!mod || !ctx) {
    return <NonIdealState icon="application" title="No such application"
             description={`Nothing named "${apiName}" is published in your scope.`} />
  }

  // Foundry embeds "the published version of the child module". We do not
  // snapshot module CONTENT per version — `version` is a pin, not a copy — so
  // the honest equivalent is that a draft may not be embedded at all. A parent
  // quietly showing a colleague's half-finished work is the failure that rule
  // exists to prevent.
  if (depth > 0 && mod.status !== 'published') {
    return (
      <Callout intent={Intent.WARNING} icon="document" className="text-xs">
        <strong>{mod.title}</strong> is still a {mod.status}. Only a published
        application can be shown inside another one.
      </Callout>
    )
  }

  const body = (
    <>
      {mod.widgets.length === 0 && mod.layouts.length === 0 ? (
        <NonIdealState icon="widget" title="Nothing on this application yet"
          description="It has been created but no widgets have been added. Add one to see it here." />
      ) : (
        <Children parentKey={ROOT} ctx={ctx} />
      )}

      {unsupported.length > 0 && (
        <Card className="text-xs text-muted-foreground">
          Wired but not implemented in this runtime yet: {unsupported.join(', ')}. The effect
          is stored on the module and starts working when the phase that owns it lands —
          reported here rather than silently doing nothing.
        </Card>
      )}

      {params && (params.unknownParameters.length > 0 || params.unresolved.length > 0) && (
        <Callout intent={Intent.WARNING} icon="warning-sign" className="text-xs">
          {params.unknownParameters.length > 0 && (
            <div>
              <strong>{pendingAction?.type}</strong> has no parameter named{' '}
              {params.unknownParameters.join(', ')} — that binding is being dropped.
            </div>
          )}
          {params.unresolved.length > 0 && (
            <div>Bound to a variable this module does not have: {params.unresolved.join(', ')}.</div>
          )}
        </Callout>
      )}
    </>
  )

  return (
    <>
      {chrome ? chrome(mod, body) : <div className="space-y-4">{body}</div>}

      {pendingAction && params && hotelId && (
        <ActionFormModal
          open
          onClose={() => { setPendingAction(null) }}
          actionType={pendingAction.type as BeaconAction['type']}
          context={params.context}
          initialValues={params.initialValues}
          disabledFields={params.disabled}
          dispatchContext={{ hotelId, actorId, triggeredBy: 'user' }}
          onSuccess={() => {
            setPendingAction(null)
            void queryClient.invalidateQueries({ queryKey: ['module-variable'] })
          }}
        />
      )}

      {mod.layouts.filter((l) => l.layoutType === 'overlay').map((o) => (
        <Dialog key={o.id} isOpen={ui.openOverlays.includes(o.id)} title={o.title || o.apiName}
          onClose={() => { setUi((s) => ({ ...s, openOverlays: s.openOverlays.filter((id) => id !== o.id) })) }}>
          <DialogBody>
            <Children parentKey={o.id} ctx={ctx} />
          </DialogBody>
        </Dialog>
      ))}
    </>
  )
}

/** The top-level surface: one instance, plus the page chrome only it should
 *  have — header, promotion, adoption. */
export function ModuleRenderer({ apiName }: { apiName: string }) {
  const [promoting, setPromoting] = useState(false)
  const role = useAuthStore((st) => st.role)
  const { data: promotedApps = [] } = usePromotedApps()
  const canPromote = role === 'owner' || role === 'admin'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-5xl">
        <ModuleInstance apiName={apiName} depth={0} ancestors={[]} chrome={(mod, body) => {
          const promotion = promotedApps.find((p) => p.moduleApiName === mod.apiName)
          return (
            <div className="space-y-4">
              <header className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold flex items-center gap-2">
                    <Icon icon="application" size={16} /> {mod.title}
                  </h1>
                  {mod.description && (
                    <p className="text-sm text-muted-foreground mt-0.5">{mod.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Tag minimal intent={mod.status === 'published' ? Intent.SUCCESS : Intent.NONE}>
                    {mod.status}
                  </Tag>
                  <Tag minimal>v{mod.version}</Tag>
                  {mod.hotelId === null && <Tag minimal icon="globe">org-wide</Tag>}
                  {promotion && (
                    <Tag minimal icon="application" intent={Intent.PRIMARY}>
                      in portal · v{promotion.publishedVersion}
                    </Tag>
                  )}
                  {canPromote && (
                    <>
                      <Button size="small" variant="minimal" icon="edit" text="Edit"
                        onClick={() => { window.location.assign(`/modules/${mod.apiName}/edit`) }} />
                      <Button size="small" variant="minimal" icon="share"
                        text={promotion ? 'Publication' : 'Publish'}
                        onClick={() => { setPromoting(true) }} />
                    </>
                  )}
                </div>
              </header>

              {body}

              {canPromote && <AdoptionPanel mod={mod} />}

              {promoting && (
                <PromoteDialog open onClose={() => { setPromoting(false) }}
                  mod={mod} existing={promotion} />
              )}
            </div>
          )
        }} />
      </div>
    </div>
  )
}
