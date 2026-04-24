// Shared UI for workspace group-selector + sub-tab navigation.
// Used by FloorWorkspace, FlowWorkspace, and EyeWorkspace to eliminate
// JSX duplication and guarantee consistent keyboard/scroll behaviour.
// Single bg-surface-1 block with group pills on top, sub-tabs below.

import { cn } from '@/lib/utils'
import { DataFreshness } from '@/components/DataFreshness'

export interface WorkspaceTab<T extends string> {
  id:    T
  label: string
}

export interface WorkspaceGroup<T extends string> {
  id:    string
  label: string
  tabs:  T[]
}

interface Props<T extends string> {
  tabs:          readonly WorkspaceTab<T>[]
  groups:        WorkspaceGroup<T>[]
  activePanel:   T
  onPanelChange: (panel: T) => void
  /** Data freshness timestamp (from useQuery's dataUpdatedAt) */
  dataUpdatedAt?: number
  /** Whether the active panel's data is being refetched */
  isFetching?: boolean
}

export function WorkspaceTabs<T extends string>({
  tabs,
  groups,
  activePanel,
  onPanelChange,
  dataUpdatedAt,
  isFetching,
}: Props<T>) {
  const activeGroup = groups.find((g) => g.tabs.includes(activePanel)) ?? groups[0]

  return (
    <div className="shrink-0 bg-surface-1 border-b border-border">
      {/* Group selector row */}
      <div className="flex items-center gap-1.5 px-4 pt-2 pb-1.5 overflow-x-auto">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => { onPanelChange(g.tabs[0]) }}
            className={cn(
              'shrink-0 px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap',
              g.id === activeGroup.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-2',
            )}
          >
            {g.label}
          </button>
        ))}
        {/* Data freshness — right-aligned */}
        {dataUpdatedAt != null && (
          <div className="ml-auto flex-shrink-0 pl-2">
            <DataFreshness updatedAt={dataUpdatedAt} isFetching={isFetching} />
          </div>
        )}
      </div>

      {/* Sub-tabs for the active group */}
      <div className="flex px-4 overflow-x-auto">
        {activeGroup.tabs.map((tabId) => {
          const tab = tabs.find((t) => t.id === tabId)
          if (!tab) return null
          return (
            <button
              key={tabId}
              type="button"
              onClick={() => { onPanelChange(tabId) }}
              className={cn(
                'shrink-0 px-3 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap',
                activePanel === tabId
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Panel-level loading fallback ─────────────────────────────────────────────
// Lighter than the full-page PageLoader — sits inside the workspace content area.

export function PanelLoader() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}
