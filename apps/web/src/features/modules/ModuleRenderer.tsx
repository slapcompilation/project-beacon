// Renders a module from its rows. The point of W1, still true in W2: this file
// does not know what any particular application looks like — it draws whatever
// the module's rows describe, so a new application is data, not a deploy.
//
// W2 adds the layout tree, event dispatch, and Foundry's lazy computation rule.
// Both copied semantics live in runtime.ts with a test; this file is the drawing.

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query'
import {
  Button, ButtonGroup, Card, Collapse, Dialog, DialogBody, Icon, Intent,
  NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import {
  fetchModule, resolveObjectSetVariable,
  type ModuleDoc, type ModuleEvent, type ModuleLayout, type ModuleVariable, type ModuleWidget,
} from './api'
import {
  ROOT, activeTabId, applyEffects, display, effectsFor, initialState, interpolate,
  scalarValue, visibleVariableIds,
  type ModuleUiState, type SideEffect, type TriggerContext,
} from './runtime'

export function useModule(apiName: string) {
  return useQuery({
    queryKey: ['module', apiName],
    queryFn:  () => fetchModule(apiName),
    staleTime: 60_000,
  })
}

type Resolved = { records: Record<string, unknown>[]; loading: boolean }

/** Only variables on visible layouts resolve — Foundry's lazy rule, which W1
 *  could not implement because it had nowhere to hide a widget. */
function useResolvedVariables(mod: ModuleDoc | null | undefined, ui: ModuleUiState) {
  const wanted = mod ? visibleVariableIds(mod, ui) : new Set<string>()
  const setVars = (mod?.variables ?? []).filter((v) => v.varType === 'object_set' && wanted.has(v.id))

  const results = useQueries({
    queries: setVars.map((v) => ({
      queryKey: ['module-variable', v.id],
      queryFn:  () => resolveObjectSetVariable(v),
      staleTime: 30_000,
    })),
  })

  const byId = new Map<string, Resolved>()
  setVars.forEach((v, i) => {
    byId.set(v.id, { records: results[i]?.data ?? [], loading: results[i]?.isLoading ?? false })
  })
  return byId
}

interface Ctx {
  mod:      ModuleDoc
  ui:       ModuleUiState
  resolved: Map<string, Resolved>
  dispatch: (widgetId: string, trigger: ModuleEvent['trigger'], tctx?: TriggerContext) => void
  setUi:    (fn: (s: ModuleUiState) => ModuleUiState) => void
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
      const raw: unknown = isSet ? aggregate(records, prop, agg) : scalarValue(variable, ui)
      const shown = typeof raw === 'number' ? Math.round(raw * 100) / 100 : display(raw)

      return (
        <Card className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {widget.title || variable?.label}
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {isSet && bound?.loading ? <Spinner size={SpinnerSize.SMALL} /> : shown}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {isSet ? (agg === 'count' ? 'objects in the set' : `${agg} of ${String(prop)}`) : variable?.label}
          </div>
        </Card>
      )
    }

    case 'object_table':
      return <ObjectTable widget={widget} resolved={bound} dispatch={dispatch} />

    case 'button_group': {
      const buttons = Array.isArray(widget.config.buttons) ? widget.config.buttons : []
      return (
        <ButtonGroup>
          {buttons.map((b, i) => {
            const btn = b as { key?: string; label?: string; intent?: Intent }
            return (
              <Button key={btn.key ?? i} text={btn.label ?? btn.key ?? 'Button'} intent={btn.intent}
                size="small"
                onClick={() => { dispatch(widget.id, 'click', { button: btn.key }) }} />
            )
          })}
        </ButtonGroup>
      )
    }

    case 'tabs': {
      // Foundry's Tabs widget surfaces the tab LAYOUTS of the layout it sits in
      // — the bar AND the selected tab's contents. Children skips tab layouts
      // precisely because they belong to this widget.
      const parentKey = widget.layoutId ?? ROOT
      const tabs = mod.layouts
        .filter((l) => l.layoutType === 'tab' && (l.parentId ?? ROOT) === parentKey)
        .sort((a, b) => a.position - b.position)
      const active = activeTabId(mod, ui, parentKey)

      return (
        <div className="space-y-4">
          <div className="flex items-center gap-1 border-b">
            {tabs.map((t) => (
              <button key={t.id} type="button"
                onClick={() => {
                  ctx.setUi((s) => ({ ...s, activeTabByParent: { ...s.activeTabByParent, [parentKey]: t.id } }))
                  dispatch(widget.id, 'tab_change', { button: t.apiName })
                }}
                className={cn('px-3 py-1.5 text-sm border-b-2 -mb-px',
                  t.id === active ? 'border-primary font-semibold'
                                  : 'border-transparent text-muted-foreground hover:text-foreground')}>
                {t.title || t.apiName}
              </button>
            ))}
          </div>
          {active && <div className="space-y-4"><Children parentKey={active} ctx={ctx} /></div>}
        </div>
      )
    }
  }
}

/** Widgets and child layouts of one parent, interleaved by position so an author
 *  can put a heading above a section without fighting the renderer. */
function Children({ parentKey, ctx }: { parentKey: string; ctx: Ctx }) {
  const { mod } = ctx
  const items: Array<{ position: number; key: string; node: ReactNode }> = []

  for (const w of mod.widgets) {
    if ((w.layoutId ?? ROOT) !== parentKey) continue
    items.push({ position: w.position, key: `w${w.id}`, node: <Widget widget={w} ctx={ctx} /> })
  }
  for (const l of mod.layouts) {
    if ((l.parentId ?? ROOT) !== parentKey) continue
    // Tabs are surfaced by the tabs widget; overlays render as dialogs at root.
    if (l.layoutType === 'tab' || l.layoutType === 'overlay') continue
    items.push({ position: l.position, key: `l${l.id}`, node: <Layout layout={l} ctx={ctx} /> })
  }

  items.sort((a, b) => a.position - b.position)
  return <>{items.map((i) => <div key={i.key}>{i.node}</div>)}</>
}

function Layout({ layout, ctx }: { layout: ModuleLayout; ctx: Ctx }) {
  const { mod, ui } = ctx

  if (layout.layoutType === 'page') {
    const siblings = mod.layouts
      .filter((l) => l.layoutType === 'page' && l.parentId === layout.parentId)
      .sort((a, b) => a.position - b.position)
    const activeId = (siblings.find((p) => p.id === ui.activePageId) ?? siblings[0]).id
    if (layout.id !== activeId) return null
    return <div className="space-y-4"><Children parentKey={layout.id} ctx={ctx} /></div>
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
          <div className="space-y-4"><Children parentKey={layout.id} ctx={ctx} /></div>
        </Collapse>
      </section>
    )
  }

  return <div className="space-y-4"><Children parentKey={layout.id} ctx={ctx} /></div>
}

export function ModuleRenderer({ apiName }: { apiName: string }) {
  const { data: mod, isLoading, isError, error } = useModule(apiName)
  const queryClient = useQueryClient()
  const [unsupported, setUnsupported] = useState<string[]>([])
  const [ui, setUi] = useState<ModuleUiState>({
    activePageId: null, activeTabByParent: {}, collapsedSections: {}, openOverlays: [], values: {},
  })

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
  const ctx: Ctx | null = mod ? { mod, ui, resolved, dispatch, setUi } : null

  if (isLoading) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  if (isError) {
    return <NonIdealState icon="error" title="Could not load this application"
             description={error instanceof Error ? error.message : undefined} />
  }
  if (!mod || !ctx) {
    return <NonIdealState icon="application" title="No such application"
             description={`Nothing named "${apiName}" is published in your scope.`} />
  }

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
          </div>
        </header>

        {mod.widgets.length === 0 ? (
          <NonIdealState icon="widget" title="Nothing on this application yet"
            description="It has been created but no widgets have been added. Add one to see it here." />
        ) : (
          <div className="space-y-4"><Children parentKey={ROOT} ctx={ctx} /></div>
        )}

        {unsupported.length > 0 && (
          <Card className="text-xs text-muted-foreground">
            Wired but not implemented in this runtime yet: {unsupported.join(', ')}. The effect
            is stored on the module and starts working when the phase that owns it lands —
            reported here rather than silently doing nothing.
          </Card>
        )}
      </div>

      {mod.layouts.filter((l) => l.layoutType === 'overlay').map((o) => (
        <Dialog key={o.id} isOpen={ui.openOverlays.includes(o.id)} title={o.title || o.apiName}
          onClose={() => { setUi((s) => ({ ...s, openOverlays: s.openOverlays.filter((id) => id !== o.id) })) }}>
          <DialogBody>
            <div className="space-y-4"><Children parentKey={o.id} ctx={ctx} /></div>
          </DialogBody>
        </Dialog>
      ))}
    </div>
  )
}
