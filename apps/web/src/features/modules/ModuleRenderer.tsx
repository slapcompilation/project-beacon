// Renders a module from its rows. The point of W1, still true in W2: this file
// does not know what any particular application looks like — it draws whatever
// the module's rows describe, so a new application is data, not a deploy.
//
// W2 adds the layout tree, event dispatch, and Foundry's lazy computation rule.
// Both copied semantics live in runtime.ts with a test; this file is the drawing.

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import {
  Button, ButtonGroup, Callout, Card, Collapse, Dialog, DialogBody, Icon, Intent,
  NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
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
  scalarValue, visibleVariableIds,
  type ModuleUiState, type SideEffect, type TriggerContext,
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
function useResolvedVariables(mod: ModuleDoc | null | undefined, ui: ModuleUiState) {
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
      enabled:  argsReady(fnArgs[i]),
      staleTime: 30_000,
    })),
  })

  const byId = new Map<string, Resolved>()
  setVars.forEach((v, i) => {
    byId.set(v.id, { records: setResults[i]?.data ?? [], loading: setResults[i]?.isLoading ?? false })
  })
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
}

function aggregate(records: Record<string, unknown>[], prop: string | null, agg: string): number {
  if (!prop || agg === 'count') return records.length
  const nums = records.map((r) => Number(r[prop])).filter((n) => Number.isFinite(n))
  if (agg === 'sum') return nums.reduce((a, b) => a + b, 0)
  if (agg === 'avg') return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
  if (agg === 'min') return nums.length ? Math.min(...nums) : 0
  if (agg === 'max') return nums.length ? Math.max(...nums) : 0
  return records.length
}

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
      // Over a set: count or an aggregate of one numeric property. Over a scalar
      // variable: the value itself — which is how a row selection drives a card.
      const prop = typeof widget.config.property === 'string' ? widget.config.property : null
      const agg  = typeof widget.config.aggregation === 'string' ? widget.config.aggregation : 'count'
      const isSet = variable?.varType === 'object_set'
      const isFn  = variable?.definitionKind === 'function'
      const raw: unknown = isSet ? aggregate(records, prop, agg)
        : isFn ? bound?.value
        : scalarValue(variable, ui)
      const shown = typeof raw === 'number' ? Math.round(raw * 100) / 100 : display(raw)

      // Every computed result carries its basis and confidence — a number an
      // operator cannot trace is a number they cannot act on.
      const footer = bound?.error ? bound.error
        : isFn && bound?.basis ? `${bound.basis}${bound.confidence === undefined ? '' : ` · ${Math.round(bound.confidence * 100)}% confidence`}`
        : isSet ? (agg === 'count' ? 'objects in the set' : `${agg} of ${String(prop)}`)
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

export function ModuleRenderer({ apiName }: { apiName: string }) {
  const { data: mod, isLoading, isError, error } = useModule(apiName)
  const queryClient = useQueryClient()
  const [unsupported, setUnsupported] = useState<string[]>([])
  const [ui, setUi] = useState<ModuleUiState>({
    activePageId: null, activeTabByParent: {}, collapsedSections: {}, openOverlays: [], values: {},
  })
  const [pendingAction, setPendingAction] = useState<ActionSpec | null>(null)
  const [promoting, setPromoting] = useState(false)
  const hotelId = useActiveHotelId()
  const actorId = useAuthStore((st) => st.session?.user.id ?? null)
  const role    = useAuthStore((st) => st.role)
  const { data: promotedApps = [] } = usePromotedApps()

  const perform = useCallback((effects: SideEffect[]) => {
    for (const e of effects) {
      if (e.kind === 'recompute') {
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
  }, [mod, perform])

  const dispatch = useCallback<Ctx['dispatch']>((widgetId, trigger, tctx = {}) => {
    if (!mod) return
    setUi((state) => {
      // Sequential dispatch, NOT sequential completion — see applyEffects.
      const { state: next, sideEffects } = applyEffects(
        mod, state, effectsFor(mod, widgetId, trigger, tctx), tctx)
      if (sideEffects.length > 0) queueMicrotask(() => { perform(sideEffects) })
      return next
    })
  }, [mod, perform])

  const resolved = useResolvedVariables(mod, ui)

  // Deliberately not memoised: `resolved` is a fresh Map every render, so a memo
  // would freeze the context on the first (all-loading) one and the tables would
  // spin forever. Building the object is cheaper than that bug.
  const ctx: Ctx | null = mod
    ? { mod, ui, resolved, dispatch, setUi, openAction: setPendingAction }
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

  const promotion = promotedApps.find((p) => p.moduleApiName === mod.apiName)
  const canPromote = role === 'owner' || role === 'admin'

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-5xl space-y-4">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Icon icon="application" size={16} /> {mod.title}
            </h1>
            {mod.description && <p className="text-sm text-muted-foreground mt-0.5">{mod.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Tag minimal intent={mod.status === 'published' ? Intent.SUCCESS : Intent.NONE}>{mod.status}</Tag>
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

        {mod.widgets.length === 0 ? (
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

        {canPromote && <AdoptionPanel mod={mod} />}

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
      </div>

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

      {promoting && (
        <PromoteDialog open onClose={() => { setPromoting(false) }} mod={mod} existing={promotion} />
      )}

      {mod.layouts.filter((l) => l.layoutType === 'overlay').map((o) => (
        <Dialog key={o.id} isOpen={ui.openOverlays.includes(o.id)} title={o.title || o.apiName}
          onClose={() => { setUi((s) => ({ ...s, openOverlays: s.openOverlays.filter((id) => id !== o.id) })) }}>
          <DialogBody>
            <Children parentKey={o.id} ctx={ctx} />
          </DialogBody>
        </Dialog>
      ))}
    </div>
  )
}
