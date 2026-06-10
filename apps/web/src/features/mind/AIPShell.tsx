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

const ReviewQueuePage           = lazy(() => import('@/pages/ReviewQueuePage'))
const PendingApprovalsPage      = lazy(() => import('@/pages/PendingApprovalsPage'))
const CasesPage                 = lazy(() => import('@/pages/CasesPage'))
const AgentStudioPage           = lazy(() => import('@/pages/AgentStudioPage'))
const ToolsPage                 = lazy(() => import('@/pages/ToolsPage'))
const ModelingObjectivesPage    = lazy(() => import('@/pages/ModelingObjectivesPage'))
const DocumentsPage             = lazy(() => import('@/pages/DocumentsPage'))
const EntityLinkSuggestionsPage = lazy(() => import('@/pages/EntityLinkSuggestionsPage'))
const ApprovedAnswersPage       = lazy(() => import('@/pages/ApprovedAnswersPage'))
const ActionChainsPage          = lazy(() => import('@/pages/ActionChainsPage'))
const ScenariosPage             = lazy(() => import('@/pages/ScenariosPage'))
const SystemMapPage             = lazy(() => import('@/pages/SystemMapPage'))
const CopilotConfigPage         = lazy(() => import('@/pages/CopilotConfigPage'))

export type AipTab =
  | 'command' | 'portfolio'
  | 'queue' | 'approvals' | 'cases'
  | 'agents' | 'system-map'
  | 'documents' | 'entity-links' | 'answers' | 'principles' | 'constraints'
  | 'tools' | 'objectives' | 'scenarios' | 'action-chains' | 'copilot' | 'policy'

// Two intents, not one interleaved loop: Decisions is the daily operator inbox;
// Studio is where you build/configure the fabric (touched far less often). The
// `group` is a light sub-header inside Studio.
type Section = 'Decisions' | 'Studio'
const TABS: { id: AipTab; label: string; icon: IconName; section: Section; group: string }[] = [
  // Decisions — the daily driver
  { id: 'queue',        label: 'Review Queue',      icon: 'predictive-analysis', section: 'Decisions', group: '' },
  { id: 'approvals',    label: 'Pending Approvals', icon: 'warning-sign',        section: 'Decisions', group: '' },
  { id: 'cases',        label: 'Cases',             icon: 'folder-open',         section: 'Decisions', group: '' },
  { id: 'portfolio',    label: 'Portfolio',         icon: 'office',              section: 'Decisions', group: '' },

  // Studio — build & configure the fabric
  { id: 'agents',       label: 'Agents',            icon: 'predictive-analysis', section: 'Studio', group: 'Agents & compute' },
  { id: 'system-map',   label: 'System Map',        icon: 'graph',               section: 'Studio', group: 'Agents & compute' },
  { id: 'tools',        label: 'Logic Tools',       icon: 'function',            section: 'Studio', group: 'Agents & compute' },
  { id: 'objectives',   label: 'Modeling Objectives', icon: 'chart',             section: 'Studio', group: 'Agents & compute' },

  { id: 'documents',    label: 'Documents',         icon: 'document',            section: 'Studio', group: 'Knowledge' },
  { id: 'entity-links', label: 'Entity Links',      icon: 'search-template',     section: 'Studio', group: 'Knowledge' },
  { id: 'answers',      label: 'Approved Answers',  icon: 'bookmark',            section: 'Studio', group: 'Knowledge' },
  { id: 'principles',   label: 'Principles',        icon: 'learning',            section: 'Studio', group: 'Knowledge' },
  { id: 'constraints',  label: 'Constraints',       icon: 'shield',              section: 'Studio', group: 'Knowledge' },

  { id: 'scenarios',    label: 'Scenarios',         icon: 'lab-test',            section: 'Studio', group: 'Sandbox & policy' },
  { id: 'action-chains', label: 'Action Chains',    icon: 'link',                section: 'Studio', group: 'Sandbox & policy' },
  { id: 'copilot',      label: 'Copilot Config',    icon: 'chat',                section: 'Studio', group: 'Sandbox & policy' },
  { id: 'policy',       label: 'Policy',            icon: 'cog',                 section: 'Studio', group: 'Sandbox & policy' },
]

export function isAipTab(v: string | null | undefined): v is AipTab {
  return !!v && (v === 'command' || TABS.some((t) => t.id === v))
}

export default function AIPShell({
  tab,
  onTabChange,
}: {
  tab: AipTab
  onTabChange: (t: AipTab) => void
}) {
  const counts   = useAipCounts()
  const sections = sectionize(TABS)

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

          {sections.map((sec) => (
            <div key={sec.section} className="mb-3">
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-foreground/80">
                {sec.section}
              </p>
              {sec.groups.map((g) => (
                <div key={g.label || sec.section} className="mb-1">
                  {g.label && (
                    <p className="px-4 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                      {g.label}
                    </p>
                  )}
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
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        <PanelErrorBoundary name={`Mind · ${tab}`}>
          <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>}>
            {renderTab(tab, onTabChange)}
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

function renderTab(t: AipTab, onNavigate: (tab: AipTab) => void) {
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
    case 'scenarios':     return <ScenariosPage />
    case 'action-chains': return <ActionChainsPage />
    case 'copilot':      return <CopilotConfigPage />
    case 'policy':       return <PolicyTab />
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

function sectionize(tabs: typeof TABS) {
  const order: Section[] = ['Decisions', 'Studio']
  return order.map((section) => ({
    section,
    groups: groupTabs(tabs.filter((t) => t.section === section)),
  }))
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
