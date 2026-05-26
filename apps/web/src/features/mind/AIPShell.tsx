// AIP shell — left-rail tabbed surface that bundles every AIP page under one roof.
// Lives inside Mind workspace as the default panel; deep-linkable via ?aip=<tab>.

import { lazy, Suspense } from 'react'
import { Icon, Spinner, SpinnerSize, Intent, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { usePendingProposals } from '@/features/agents/useReviewQueue'
import { usePendingApprovals } from '@/features/pendingApprovals/hooks'
import { useCases } from '@/features/cases/hooks'
import { usePendingEntityLinkSuggestions } from '@/features/entityLinks/hooks'

const ReviewQueuePage           = lazy(() => import('@/pages/ReviewQueuePage'))
const PendingApprovalsPage      = lazy(() => import('@/pages/PendingApprovalsPage'))
const CasesPage                 = lazy(() => import('@/pages/CasesPage'))
const AgentStudioPage           = lazy(() => import('@/pages/AgentStudioPage'))
const ToolsPage                 = lazy(() => import('@/pages/ToolsPage'))
const ModelingObjectivesPage    = lazy(() => import('@/pages/ModelingObjectivesPage'))
const DocumentsPage             = lazy(() => import('@/pages/DocumentsPage'))
const EntityLinkSuggestionsPage = lazy(() => import('@/pages/EntityLinkSuggestionsPage'))
const ApprovedAnswersPage       = lazy(() => import('@/pages/ApprovedAnswersPage'))
const ScenariosPage             = lazy(() => import('@/pages/ScenariosPage'))
const SystemMapPage             = lazy(() => import('@/pages/SystemMapPage'))
const CopilotConfigPage         = lazy(() => import('@/pages/CopilotConfigPage'))

export type AipTab =
  | 'queue' | 'approvals' | 'cases'
  | 'agents' | 'tools' | 'objectives'
  | 'documents' | 'entity-links' | 'answers'
  | 'scenarios' | 'system-map'
  | 'copilot'

const TABS: { id: AipTab; label: string; icon: IconName; group: string }[] = [
  { id: 'queue',        label: 'Review Queue',        icon: 'predictive-analysis', group: 'Decide' },
  { id: 'approvals',    label: 'Pending Approvals',   icon: 'warning-sign',        group: 'Decide' },
  { id: 'cases',        label: 'Cases',               icon: 'folder-open',         group: 'Decide' },

  { id: 'agents',       label: 'Agents',              icon: 'predictive-analysis', group: 'Build' },
  { id: 'tools',        label: 'Logic Tools',         icon: 'function',            group: 'Build' },
  { id: 'objectives',   label: 'Modeling Objectives', icon: 'chart',               group: 'Build' },

  { id: 'documents',    label: 'Documents',           icon: 'document',            group: 'Knowledge' },
  { id: 'entity-links', label: 'Entity Link Suggestions', icon: 'search-template', group: 'Knowledge' },
  { id: 'answers',      label: 'Approved Answers',    icon: 'bookmark',            group: 'Knowledge' },

  { id: 'scenarios',    label: 'Scenarios',           icon: 'lab-test',            group: 'Plan' },
  { id: 'system-map',   label: 'System Map',          icon: 'graph',               group: 'Plan' },

  { id: 'copilot',      label: 'Copilot Config',      icon: 'chat',                group: 'Configure' },
]

export function isAipTab(v: string | null | undefined): v is AipTab {
  return !!v && TABS.some((t) => t.id === v)
}

export default function AIPShell({ tab, onTabChange }: { tab: AipTab; onTabChange: (t: AipTab) => void }) {
  const counts = useAipCounts()
  const groups = groupTabs(TABS)

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-52 border-r shrink-0 overflow-y-auto bg-surface-1/30">
        <nav className="py-2">
          {groups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="px-4 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {g.label}
              </p>
              {g.tabs.map((t) => {
                const active = t.id === tab
                const badge  = counts[t.id]
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { onTabChange(t.id) }}
                    className={cn(
                      'flex w-full items-center gap-2 px-4 py-1.5 text-xs transition-colors text-left',
                      active
                        ? 'bg-surface-2 text-foreground font-semibold border-l-2 border-primary'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground border-l-2 border-transparent',
                    )}
                  >
                    <Icon icon={t.icon} size={12} />
                    <span className="flex-1 truncate">{t.label}</span>
                    {badge != null && badge > 0 && (
                      <Tag minimal intent={badgeIntent(t.id)} className="!text-[10px] !min-h-0 !py-0">
                        {badge > 99 ? '99+' : String(badge)}
                      </Tag>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        <PanelErrorBoundary name={`Mind · AIP · ${tab}`}>
          <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>}>
            {renderTab(tab)}
          </Suspense>
        </PanelErrorBoundary>
      </main>
    </div>
  )
}

function renderTab(t: AipTab) {
  switch (t) {
    case 'queue':        return <ReviewQueuePage />
    case 'approvals':    return <PendingApprovalsPage />
    case 'cases':        return <CasesPage />
    case 'agents':       return <AgentStudioPage />
    case 'tools':        return <ToolsPage />
    case 'objectives':   return <ModelingObjectivesPage />
    case 'documents':    return <DocumentsPage />
    case 'entity-links': return <EntityLinkSuggestionsPage />
    case 'answers':      return <ApprovedAnswersPage />
    case 'scenarios':    return <ScenariosPage />
    case 'system-map':   return <SystemMapPage />
    case 'copilot':      return <CopilotConfigPage />
  }
}

function groupTabs(tabs: typeof TABS) {
  const order: string[] = []
  const map = new Map<string, typeof TABS>()
  for (const t of tabs) {
    let bucket = map.get(t.group)
    if (!bucket) {
      bucket = []
      map.set(t.group, bucket)
      order.push(t.group)
    }
    bucket.push(t)
  }
  return order.map((label) => ({ label, tabs: map.get(label) ?? [] }))
}

function badgeIntent(t: AipTab): Intent {
  if (t === 'approvals' || t === 'entity-links') return Intent.WARNING
  if (t === 'queue') return Intent.PRIMARY
  return Intent.NONE
}

/** Pending counts for the tabs that have a queue semantic. */
function useAipCounts(): Partial<Record<AipTab, number>> {
  const queue       = usePendingProposals()
  const approvals   = usePendingApprovals()
  const cases       = useCases('open')
  const entityLinks = usePendingEntityLinkSuggestions()
  return {
    queue:          queue.data?.length,
    approvals:      approvals.data?.length,
    cases:          cases.data?.length,
    'entity-links': entityLinks.data?.length,
  }
}
