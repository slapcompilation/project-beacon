// Objects — the ontology's front door. One card per node type, live instance
// counts under the caller's RLS, each linking to that type's browsing surface.
// Replaces the deprecated variant-search GraphPage as the sidebar's Objects
// entry; the full filter/pivot object-set explorer (parity 4.3) supersedes
// this later.

import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import type { NodeType } from '@beacon/reality-graph'
import { OBJECT_PRESENTATION } from '@/lib/objectPresentation'
import { OBJECT_LIST } from '@/features/objects/objectList'
import { useObjectTypeCards, useOntologyTypes } from '@/features/objectTypes/hooks'
import { supabase } from '@/lib/supabase/client'

// One source of truth for the table per type — the same registry the instance
// list reads, so a tile's count can never disagree with the rows behind it.
async function fetchCounts(): Promise<Record<string, number>> {
  const entries = Object.entries(OBJECT_LIST)
  const results = await Promise.all(
    entries.map(async ([type, spec]) => {
      const { count, error } = await supabase.from(spec.table).select('id', { count: 'exact', head: true })
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
  const { data: customCards = [] } = useObjectTypeCards()

  // G3: registered built-ins with no bespoke presentation still get a card —
  // the ontology row is the source; hand-written entries are overrides.
  const { data: ontologyRows = [] } = useOntologyTypes()
  const derivedTypes = ontologyRows.filter((r) =>
    r.source_table !== null && !(r.api_name in OBJECT_PRESENTATION))
  const { data: derivedCounts } = useQuery({
    queryKey: ['object-type-counts-derived', derivedTypes.map((t) => t.api_name).join(',')],
    enabled: derivedTypes.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const results = await Promise.all(derivedTypes.map(async (t) => {
        const { count, error: err } = await supabase
          .from(t.source_table as string).select('id', { count: 'exact', head: true })
        return [t.api_name, err ? -1 : (count ?? 0)] as const
      }))
      return Object.fromEntries(results)
    },
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
                <Link key={type} to={`/objects/${type}`} className="no-underline">
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
            {derivedTypes.map((t) => {
              const n = derivedCounts?.[t.api_name]
              return (
                <Link key={t.id} to={`/objects/${t.api_name}`} className="no-underline">
                  <Card interactive compact className="h-full">
                    <div className="flex items-center gap-2">
                      <Icon icon={t.icon as IconName} size={14} className="text-violet-500" />
                      <span className="text-sm font-semibold">{t.label}</span>
                    </div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">
                      {n === undefined || n === -1 ? <span className="text-muted-foreground text-sm">—</span> : n.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">{t.api_name}</div>
                  </Card>
                </Link>
              )
            })}
            {customCards.map((c) => (
              <Link key={c.id} to={`/objects/${c.id}`} className="no-underline">
                <Card interactive compact className="h-full">
                  <div className="flex items-center gap-2">
                    <Icon icon={c.icon as IconName} size={14} className="text-violet-500" />
                    <span className="text-sm font-semibold">{c.label}</span>
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums">{c.count.toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">{c.apiName}</div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
