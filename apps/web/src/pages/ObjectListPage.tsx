// One node type's instances — the list behind an /objects card. Reads the type's
// table under the caller's RLS (no hotel filter, so the row count matches the
// /objects tile), and every row opens that type's full Object View. Scope-agnostic
// by design: it never depends on an active hotel the way the operational surfaces do.

import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useParams } from 'react-router-dom'
import { Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { OBJECT_PRESENTATION, type ObjectPresentation } from '@/lib/objectPresentation'
import { OBJECT_LIST, type ObjectListSpec } from '@/features/objects/objectList'
import { supabase } from '@/lib/supabase/client'

const LIMIT = 200
type Row = Record<string, unknown>

export default function ObjectListPage() {
  const { type = '' } = useParams<{ type: string }>()
  const spec = (OBJECT_LIST as Record<string, ObjectListSpec | undefined>)[type]
  const p = (OBJECT_PRESENTATION as Record<string, ObjectPresentation | undefined>)[type]

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['object-list', type],
    enabled: !!spec,
    staleTime: 60_000,
    queryFn: async () => {
      if (!spec) return { rows: [] as Row[], total: 0 }
      let q = supabase.from(spec.table).select(spec.select, { count: 'exact' }).limit(LIMIT)
      if (spec.orderBy) q = q.order(spec.orderBy.column, { ascending: spec.orderBy.ascending ?? false })
      const { data: rows, count, error: err } = await q
      if (err) throw new Error(err.message)
      return { rows: rows as unknown as Row[], total: count ?? 0 }
    },
  })

  if (!spec || !p) return <Navigate to="/objects" replace />

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Link to="/objects" className="hover:underline">Objects</Link>
          <Icon icon="chevron-right" size={10} />
          <span className="font-mono">{type}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Icon icon={p.icon} size={16} className="text-violet-500" />
          <h1 className="text-sm font-semibold">{p.label}</h1>
          {data && (
            <Tag minimal round className="tabular-nums">
              {data.total}{data.total > LIMIT ? ` · showing ${String(LIMIT)}` : ''}
            </Tag>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isError ? (
          <NonIdealState icon="warning-sign" title="Failed to load instances" description={error instanceof Error ? error.message : undefined} />
        ) : isLoading || !data ? (
          <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
        ) : data.rows.length === 0 ? (
          <NonIdealState icon={p.icon} title={`No ${p.label.toLowerCase()} instances in your scope`} />
        ) : (
          <Card compact className="!p-0 overflow-hidden divide-y divide-border max-w-3xl">
            {data.rows.map((r) => {
              const id = String(r.id)
              const sub = spec.subtitle?.(r)
              return (
                <Link key={id} to={`${p.route}${id}`} className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-muted/50">
                  <Icon icon={p.icon} size={14} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{spec.title(r)}</p>
                    {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
                  </div>
                  <Icon icon="chevron-right" size={14} className="text-muted-foreground shrink-0" />
                </Link>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}
