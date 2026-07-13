// Objects — the ontology's front door. One card per node type, live instance
// counts under the caller's RLS, each linking to that type's browsing surface.
// Replaces the deprecated variant-search GraphPage as the sidebar's Objects
// entry; the full filter/pivot object-set explorer (parity 4.3) supersedes
// this later.

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize } from '@blueprintjs/core'
import type { NodeType } from '@beacon/reality-graph'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'
import { supabase } from '@/lib/supabase/client'

const TABLES: Record<keyof typeof OBJECT_PRESENTATION, string> = {
  variant:         'product_variants',
  product:         'products',
  supplier:        'suppliers',
  purchase_order:  'purchase_orders',
  restock_request: 'restock_requests',
  stock_log:       'stock_logs',
  alert:           'notifications',
  proposal:        'proposals',
  case:            'cases',
  document:        'documents',
  constraint:      'constraints',
  principle:       'principles',
  action_chain:    'action_chains',
}

async function fetchCounts(): Promise<Record<string, number>> {
  const entries = Object.entries(TABLES)
  const results = await Promise.all(
    entries.map(async ([type, table]) => {
      const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true })
      return [type, error ? -1 : (count ?? 0)] as const
    }),
  )
  return Object.fromEntries(results)
}

export default function ObjectsPage() {
  const { data: counts, isLoading, isError, error } = useQuery({
    queryKey: ['object-type-counts'],
    queryFn: fetchCounts,
    staleTime: 60_000,
  })

  if (isError) {
    return <NonIdealState icon="warning-sign" title="Failed to load object types" description={error instanceof Error ? error.message : undefined} />
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <h1 className="text-sm font-semibold">Objects</h1>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Every node type the ontology speaks, with what you can see of each. Pick a type to
          browse its instances; every instance opens as a full Object View.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading || !counts ? (
          <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(Object.entries(OBJECT_PRESENTATION) as [keyof typeof OBJECT_PRESENTATION, (typeof OBJECT_PRESENTATION)[keyof typeof OBJECT_PRESENTATION]][]).map(([type, p]) => {
              const n = counts[type]
              return (
                <Link key={type} to={p.home.to} className="no-underline">
                  <Card interactive compact className="h-full">
                    <div className="flex items-center gap-2">
                      <Icon icon={p.icon} size={14} className="text-violet-500" />
                      <span className="text-sm font-semibold">{p.label}</span>
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                      {n === -1 ? <span className="text-muted-foreground text-sm">—</span> : n.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{type as NodeType}</div>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
