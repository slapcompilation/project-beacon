// Renders a module from its rows. The whole point of W1: this file does not
// know what any particular application looks like — it draws whatever widgets
// the module's rows describe, so a new application is data, not a deploy.

import { useQuery, useQueries } from '@tanstack/react-query'
import { Card, Icon, NonIdealState, Spinner, SpinnerSize, Tag, Intent } from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { fetchModule, resolveObjectSetVariable, type ModuleDoc, type ModuleWidget, type ModuleVariable } from './api'

export function useModule(apiName: string) {
  return useQuery({
    queryKey: ['module', apiName],
    queryFn:  () => fetchModule(apiName),
    staleTime: 60_000,
  })
}

/** Object-set variables resolve to records; the rest carry their own value.
 *
 *  Foundry's lazy rule — "variables used in non-visible pages will not be
 *  computed until they are shown" — is not implemented in W1 because W1 has no
 *  pages to hide behind. It arrives with layouts in W2, and the `recompute`
 *  column already carries the contract so this does not need a migration then. */
function useResolvedVariables(mod: ModuleDoc | null | undefined) {
  const setVars = (mod?.variables ?? []).filter((v) => v.varType === 'object_set')
  const results = useQueries({
    queries: setVars.map((v) => ({
      queryKey: ['module-variable', v.id],
      queryFn:  () => resolveObjectSetVariable(v),
      staleTime: 30_000,
    })),
  })
  const byId = new Map<string, { records: Record<string, unknown>[]; loading: boolean }>()
  setVars.forEach((v, i) => {
    byId.set(v.id, { records: results[i]?.data ?? [], loading: results[i]?.isLoading ?? false })
  })
  return byId
}

/** A property can hold an object or an array; "[object Object]" in an operator's
 *  table is worse than JSON they can at least read. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(v)
}

function Widget({ widget, variable, resolved }: {
  widget:   ModuleWidget
  variable: ModuleVariable | undefined
  resolved: { records: Record<string, unknown>[]; loading: boolean } | undefined
}) {
  const records = resolved?.records ?? []

  switch (widget.widgetType) {
    case 'markdown': {
      // Rendered as text, deliberately. Foundry's Markdown widget accepts rich
      // content; ours will too when somebody needs it — but interpreting
      // authored markup is an injection surface and W1 does not need it.
      const body = typeof widget.config.body === 'string' ? widget.config.body : ''
      return (
        <Card className="whitespace-pre-wrap text-sm leading-relaxed">{body}</Card>
      )
    }

    case 'object_set_title':
      return (
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-semibold">{widget.title || variable?.label || 'Set'}</h2>
          {resolved?.loading
            ? <Spinner size={SpinnerSize.SMALL} />
            : <Tag minimal>{records.length}</Tag>}
        </div>
      )

    case 'metric_card': {
      // A metric over a set: count, or an aggregate of one numeric property.
      const prop = typeof widget.config.property === 'string' ? widget.config.property : null
      const agg  = typeof widget.config.aggregation === 'string' ? widget.config.aggregation : 'count'
      let value = records.length
      if (prop && agg !== 'count') {
        const nums = records.map((r) => Number(r[prop])).filter((n) => Number.isFinite(n))
        if (agg === 'sum') value = nums.reduce((a, b) => a + b, 0)
        else if (agg === 'avg') value = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
        else if (agg === 'min') value = nums.length ? Math.min(...nums) : 0
        else if (agg === 'max') value = nums.length ? Math.max(...nums) : 0
      }
      return (
        <Card className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {widget.title || variable?.label}
          </div>
          <div className="text-2xl font-semibold tabular-nums">
            {resolved?.loading ? <Spinner size={SpinnerSize.SMALL} /> : Math.round(value * 100) / 100}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {agg === 'count' ? 'objects in the set' : `${agg} of ${String(prop)}`}
          </div>
        </Card>
      )
    }

    case 'object_table': {
      // Columns from config when the author picked them, otherwise whatever the
      // first record has — a table that renders nothing because nobody chose
      // columns is worse than one that guesses and can be corrected.
      const configured = Array.isArray(widget.config.columns)
        ? (widget.config.columns as unknown[]).filter((c): c is string => typeof c === 'string')
        : []
      const cols = configured.length > 0
        ? configured
        : Object.keys(records[0] ?? {}).slice(0, 6)

      return (
        <Card className="!p-0 overflow-hidden">
          {widget.title && (
            <div className="px-3 py-2 border-b text-sm font-semibold">{widget.title}</div>
          )}
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
                  {records.slice(0, 100).map((r, i) => (
                    <tr key={typeof r.id === 'string' ? r.id : i}>
                      {cols.map((c) => (
                        <td key={c} className={cn('px-3 py-1.5',
                          typeof r[c] === 'number' && 'tabular-nums')}>
                          {cell(r[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
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
  }
}

export function ModuleRenderer({ apiName }: { apiName: string }) {
  const { data: mod, isLoading, isError, error } = useModule(apiName)
  const resolved = useResolvedVariables(mod)

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner /></div>
  }
  if (isError) {
    return <NonIdealState icon="error" title="Could not load this application"
             description={error instanceof Error ? error.message : undefined} />
  }
  if (!mod) {
    return <NonIdealState icon="application" title="No such application"
             description={`Nothing named "${apiName}" is published in your scope.`} />
  }

  const byVar = new Map(mod.variables.map((v) => [v.id, v]))
  const widgets = [...mod.widgets].sort((a, b) => a.position - b.position)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-5xl space-y-4">
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
          </div>
        </header>

        {widgets.length === 0 ? (
          <NonIdealState icon="widget" title="Nothing on this application yet"
            description="It has been created but no widgets have been added. Add one to see it here." />
        ) : (
          widgets.map((w) => (
            <Widget key={w.id} widget={w}
              variable={w.variableId ? byVar.get(w.variableId) : undefined}
              resolved={w.variableId ? resolved.get(w.variableId) : undefined} />
          ))
        )}
      </div>
    </div>
  )
}
