// AIP shell — the spine of the Mind module. A left-rail workspace organized
// by the operator's decision loop (Act → Observe → Know → Shape), fronted by
// a Command landing and backed by the demoted hospitality Operations panel.
// Deep-linkable via ?aip=<tab>; legacy ?panel=<x> resolves to Operations.

import { lazy, Suspense } from 'react'
import { Icon, Spinner, SpinnerSize, Intent, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { usePendingProposals } from '@/features/agents/useReviewQueue'
import { usePendingApprovals } from '@/features/pendingApprovals/hooks'
import { useCases } from '@/features/cases/hooks'
import { usePendingEntityLinkSuggestions } from '@/features/entityLinks/hooks'
import { useAgentRunSummaries } from '@/features/agentStudio/hooks'
import { PrinciplesSection } from '@/features/principles/PrinciplesSection'
import { ConstraintsSection } from '@/features/constraints/ConstraintsSection'
import { CommandHome } from './CommandHome'
import { PortfolioCommandHome } from './PortfolioCommandHome'
import { PolicyTab } from './PolicyTab'
import { OperationsPanel } from './OperationsPanel'

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
  | 'command' | 'portfolio'
  | 'queue' | 'approvals' | 'cases'
  | 'agents' | 'system-map'
  | 'documents' | 'entity-links' | 'answers' | 'principles' | 'constraints'
  | 'tools' | 'objectives' | 'scenarios' | 'copilot' | 'policy'
  | 'operations'

// Rail organized by the AIP decision loop, not by artifact type.
const TABS: { id: AipTab; label: string; icon: IconName; group: string }[] = [
  { id: 'portfolio',    label: 'Portfolio',         icon: 'office',              group: 'Observe' },
  { id: 'queue',        label: 'Review Queue',      icon: 'predictive-analysis', group: 'Act' },
  { id: 'approvals',    label: 'Pending Approvals', icon: 'warning-sign',        group: 'Act' },
  { id: 'cases',        label: 'Cases',             icon: 'folder-open',         group: 'Act' },

  { id: 'agents',       label: 'Agents',            icon: 'predictive-analysis', group: 'Observe' },
  { id: 'system-map',   label: 'System Map',        icon: 'graph',               group: 'Observe' },

  { id: 'documents',    label: 'Documents',         icon: 'document',            group: 'Know' },
  { id: 'entity-links', label: 'Entity Links',      icon: 'search-template',     group: 'Know' },
  { id: 'answers',      label: 'Approved Answers',  icon: 'bookmark',            group: 'Know' },
  { id: 'principles',   label: 'Principles',        icon: 'learning',            group: 'Know' },
  { id: 'constraints',  label: 'Constraints',       icon: 'shield',              group: 'Know' },

  { id: 'tools',        label: 'Logic Tools',       icon: 'function',            group: 'Shape' },
  { id: 'objectives',   label: 'Modeling Objectives', icon: 'chart',             group: 'Shape' },
  { id: 'scenarios',    label: 'Scenarios',         icon: 'lab-test',            group: 'Shape' },
  { id: 'copilot',      label: 'Copilot Config',    icon: 'chat',                group: 'Shape' },
  { id: 'policy',       label: 'Policy',            icon: 'cog',                 group: 'Shape' },

  { id: 'operations',   label: 'Operations',        icon: 'shop',                group: 'Operations' },
]

export function isAipTab(v: string | null | undefined): v is AipTab {
  return !!v && (v === 'command' || TABS.some((t) => t.id === v))
}

export default function AIPShell({
  tab,
  onTabChange,
  operationsInitialPanel,
}: {
  tab: AipTab
  onTabChange: (t: AipTab) => void
  /** Legacy ?panel= value forwarded to OperationsPanel for sub-tab seeding. */
  operationsInitialPanel?: string
}) {
  const counts = useAipCounts()
  const groups = groupTabs(TABS)

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-52 border-r shrink-0 overflow-y-auto bg-surface-1/30">
        <nav className="py-2">
          {/* Command — the home, above the loop groups */}
          <button
            type="button"
            onClick={() => { onTabChange('command') }}
            className={cn(
              'flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors text-left mb-1',
              tab === 'command'
                ? 'bg-surface-2 text-foreground font-semibold border-l-2 border-primary'
                : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground border-l-2 border-transparent',
            )}
          >
            <Icon icon="dashboard" size={13} />
            <span className="flex-1">Command</span>
            {counts.command != null && counts.command > 0 && (
              <Tag minimal intent={Intent.PRIMARY} className="!text-[10px] !min-h-0 !py-0">
                {counts.command > 99 ? '99+' : String(counts.command)}
              </Tag>
            )}
          </button>

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
        <PanelErrorBoundary name={`Mind · ${tab}`}>
          <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>}>
            {renderTab(tab, onTabChange, operationsInitialPanel)}
          </Suspense>
        </PanelErrorBoundary>
      </main>
    </div>
  )
}

// Section components (Principles/Constraints) are built for the Settings
// two-column layout; wrap them in a scrollable padded container here.
function SectionFrame({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl">{children}</div>
}

function renderTab(t: AipTab, onNavigate: (tab: AipTab) => void, operationsInitialPanel?: string) {
  switch (t) {
    case 'command':      return <CommandHome onNavigate={onNavigate} />
    case 'portfolio':    return <PortfolioCommandHome onNavigate={onNavigate} />
    case 'queue':        return <ReviewQueuePage />
    case 'approvals':    return <PendingApprovalsPage />
    case 'cases':        return <CasesPage />
    case 'agents':       return <AgentStudioPage />
    case 'system-map':   return <SystemMapPage />
    case 'documents':    return <DocumentsPage />
    case 'entity-links': return <EntityLinkSuggestionsPage />
    case 'answers':      return <ApprovedAnswersPage />
    case 'principles':   return <SectionFrame><PrinciplesSection /></SectionFrame>
    case 'constraints':  return <SectionFrame><ConstraintsSection /></SectionFrame>
    case 'tools':        return <ToolsPage />
    case 'objectives':   return <ModelingObjectivesPage />
    case 'scenarios':    return <ScenariosPage />
    case 'copilot':      return <CopilotConfigPage />
    case 'policy':       return <PolicyTab />
    case 'operations':   return <OperationsPanel initialPanel={operationsInitialPanel} />
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

/** Live counts that make the rail itself intelligent — pending work per tab. */
function useAipCounts(): Partial<Record<AipTab, number>> {
  const queue       = usePendingProposals()
  const approvals   = usePendingApprovals()
  const cases       = useCases('open')
  const entityLinks = usePendingEntityLinkSuggestions()
  const summaries   = useAgentRunSummaries()

  const q = queue.data?.length ?? 0
  const a = approvals.data?.length ?? 0
  const c = cases.data?.length ?? 0
  const agentsPending = (summaries.data ?? []).reduce((s, r) => s + r.pending, 0)

  return {
    command:        q + a + c,        // Command badge = total open decisions
    queue:          q,
    approvals:      a,
    cases:          c,
    'entity-links': entityLinks.data?.length,
    agents:         agentsPending > 0 ? agentsPending : undefined,
  }
}
