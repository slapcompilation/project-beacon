import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Package, ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase/client'
import { useAppStore, type ObjectPanelEntity } from '@/stores/app.store'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { ENTITY_META, GRAPH_NODE_TYPE } from './EntityMeta'
import { EntitySummary } from './EntitySummary'

const GraphConnections = lazy(() =>
  import('@/components/GraphConnections').then((m) => ({ default: m.GraphConnections }))
)

function useObjectData(entityType: ObjectPanelEntity | null, entityId: string | null) {
  const meta = entityType ? ENTITY_META[entityType] : null
  return useQuery({
    queryKey: ['object-panel', entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(meta!.table)
        .select(meta!.select)
        .eq('id', entityId!)
        .single()
      if (error) throw new Error(error.message)
      return data as unknown as Record<string, unknown>
    },
    enabled: !!meta && !!entityId,
    staleTime: 30_000,
  })
}

export function DetailTabContent() {
  const contextEntity = useAppStore((s) => s.contextEntity)
  const setContextPanelOpen = useAppStore((s) => s.setContextPanelOpen)

  const entityType = contextEntity?.type ?? null
  const entityId   = contextEntity?.id ?? null
  const meta       = entityType ? ENTITY_META[entityType] : null

  const { data, isLoading, error } = useObjectData(entityType, entityId)

  if (!contextEntity) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Package className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">No entity selected</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Click any entity name in the app to inspect it here
        </p>
      </div>
    )
  }

  const Icon = meta?.icon ?? Package

  return (
    <div className="flex flex-col h-full">
      {/* Entity header */}
      <div className="px-4 pt-3 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/15 text-primary shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{meta?.label ?? 'Object'}</p>
            <p className="text-[10px] font-mono text-muted-foreground truncate">{entityId}</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="px-4 py-6 text-xs text-red-400">
            Failed to load: {(error as Error).message}
          </div>
        )}

        {data && entityType && (
          <div className="divide-y divide-border/50">
            <div className="px-4 py-3">
              <EntitySummary entityType={entityType} data={data} />
            </div>

            {GRAPH_NODE_TYPE[entityType] && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                  Graph Connections
                </p>
                <PanelErrorBoundary name="Graph Connections" className="min-h-[60px]">
                  <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}>
                    <GraphConnections
                      nodeType={GRAPH_NODE_TYPE[entityType] as 'variant'}
                      nodeId={entityId!}
                    />
                  </Suspense>
                </PanelErrorBoundary>
              </div>
            )}

            {(data.created_at != null || data.updated_at != null) && (
              <div className="px-4 py-3 space-y-1">
                {typeof data.created_at === 'string' && (
                  <div className="text-[10px] text-muted-foreground">
                    Created {formatDistanceToNow(new Date(data.created_at), { addSuffix: true })}
                  </div>
                )}
                {typeof data.updated_at === 'string' && (
                  <div className="text-[10px] text-muted-foreground">
                    Updated {formatDistanceToNow(new Date(data.updated_at), { addSuffix: true })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — link to full object page */}
      {meta && entityId && (
        <div className="border-t border-border px-4 py-2.5 shrink-0">
          <Button variant="outline" size="sm" className="w-full gap-2 text-xs" asChild>
            <Link to={`${meta.route}${entityId}`} onClick={() => { setContextPanelOpen(false) }}>
              <ExternalLink className="h-3 w-3" />
              Open full page
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
