import { Suspense, lazy } from 'react'
import { Icon, Intent, Spinner, SpinnerSize } from '@blueprintjs/core'
import { useAppStore } from '@/stores/app.store'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { GRAPH_NODE_TYPE } from './EntityMeta'

const GraphConnections = lazy(() =>
  import('@/components/GraphConnections').then((m) => ({ default: m.GraphConnections }))
)

export function GraphTabContent() {
  const contextEntity = useAppStore((s) => s.contextEntity)
  const entityType = contextEntity?.type ?? null
  const entityId   = contextEntity?.id ?? null
  const nodeType   = entityType ? GRAPH_NODE_TYPE[entityType] : null

  if (!contextEntity || !nodeType) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <Icon icon="git-branch" size={32} className="text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Graph View</p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Select an entity to view its graph connections
        </p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3 overflow-y-auto h-full">
      <PanelErrorBoundary name="Graph View" className="min-h-[100px]">
        <Suspense fallback={
          <div className="flex items-center justify-center py-12">
            <Spinner size={SpinnerSize.SMALL} intent={Intent.PRIMARY} />
          </div>
        }>
          <GraphConnections nodeType={nodeType as 'variant'} nodeId={entityId ?? ''} />
        </Suspense>
      </PanelErrorBoundary>
    </div>
  )
}
