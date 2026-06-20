// AIP shell — the spine of the Mind module. A left-rail workspace split into
// Decisions (the daily inbox: queue / approvals / cases / portfolio) and a
// single Studio entry that opens a cards landing for the 13 builder surfaces,
// so config you touch monthly doesn't crowd the daily queue. Fronted by a
// Command landing. Deep-linkable via ?aip=<tab>.

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
const DecisionCalibrationPage   = lazy(() => import('@/pages/DecisionCalibrationPage'))
const DocumentsPage             = lazy(() => import('@/pages/DocumentsPage'))
const EntityLinkSuggestionsPage = lazy(() => import('@/pages/EntityLinkSuggestionsPage'))
const ApprovedAnswersPage       = lazy(() => import('@/pages/ApprovedAnswersPage'))
const ActionChainsPage          = lazy(() => import('@/pages/ActionChainsPage'))
const ScenariosPage             = lazy(() => import('@/pages/ScenariosPage'))
const SystemMapPage             = lazy(() => import('@/pages/SystemMapPage'))
const CopilotConfigPage         = lazy(() => import('@/pages/CopilotConfigPage'))
const OntologyPage              = lazy(() => import('@/pages/OntologyPage'))

export type AipTab =
  | 'command' | 'portfolio'
  | 'queue' | 'approvals' | 'cases'
  | 'studio'
  | 'agents' | 'system-map' | 'ontology'
  | 'documents' | 'entity-links' | 'answers' | 'principles' | 'constraints'
  | 'tools' | 'objectives' | 'calibration' | 'scenarios' | 'action-chains' | 'copilot' | 'policy'

// Two intents, not one interleaved loop: Decisions is the daily operator inbox,
// each a rail entry; Studio is where you build/configure the fabric (touched far
// less often), collapsed behind one rail entry + a cards landing so 13 builder
// surfaces don't crowd the daily ones. `desc` shows on the Studio landing cards.
type Section = 'Decisions' | 'Studio'
const TABS: { id: AipTab; label: string; icon: IconName; section: Section; group: string; desc?: string }[] = [
  // Decisions — the daily driver
  { id: 'queue',        label: 'Review Queue',      icon: 'predictive-analysis', section: 'Decisions', group: '' },
  { id: 'approvals',    label: 'Pending Approvals', icon: 'warning-sign',        section: 'Decisions', group: '' },
  { id: 'cases',        label: 'Cases',             icon: 'folder-open',         section: 'Decisions', group: '' },
  { id: 'portfolio',    label: 'Portfolio',         icon: 'office',              section: 'Decisions', group: '' },

  // Studio — build & configure the fabric
  { id: 'agents',       label: 'Agents',            icon: 'predictive-analysis', section: 'Studio', group: 'Agents & compute', desc: 'Build, eval & release the typed agents' },
  { id: 'system-map',   label: 'System Map',        icon: 'graph',               section: 'Studio', group: 'Agents & compute', desc: 'How nodes, tools & actions connect' },
  { id: 'ontology',     label: 'Ontology',          icon: 'diagram-tree',        section: 'Studio', group: 'Agents & compute', desc: 'Typed concepts your data is missing' },
  { id: 'tools',        label: 'Logic Tools',       icon: 'function',            section: 'Studio', group: 'Agents & compute', desc: 'The typed, versioned tool registry' },
  { id: 'objectives',   label: 'Modeling Objectives', icon: 'chart',             section: 'Studio', group: 'Agents & compute', desc: 'Trained adapters behind eval gates' },
  { id: 'calibration',  label: 'Calibration',       icon: 'timeline-line-chart', section: 'Studio', group: 'Agents & compute', desc: 'Is stated confidence matching reality?' },

  { id: 'documents',    label: 'Documents',         icon: 'document',            section: 'Studio', group: 'Knowledge', desc: 'Ingested sources with page provenance' },
  { id: 'entity-links', label: 'Entity Links',      icon: 'search-template',     section: 'Studio', group: 'Knowledge', desc: 'Review suggested links to entities' },
  { id: 'answers',      label: 'Approved Answers',  icon: 'bookmark',            section: 'Studio', group: 'Knowledge', desc: 'Curated Q&A served before the LLM' },
  { id: 'principles',   label: 'Principles',        icon: 'learning',            section: 'Studio', group: 'Knowledge', desc: 'Soft NL guidance injected into agents' },
  { id: 'constraints',  label: 'Constraints',       icon: 'shield',              section: 'Studio', group: 'Knowledge', desc: 'Hard gates at action submission' },

  { id: 'scenarios',    label: 'Scenarios',         icon: 'lab-test',            section: 'Studio', group: 'Sandbox & policy', desc: 'Explore graph overlays, uncommitted' },
  { id: 'action-chains', label: 'Action Chains',    icon: 'link',                section: 'Studio', group: 'Sandbox & policy', desc: 'Batch actions with a commit boundary' },
  { id: 'copilot',      label: 'Copilot Config',    icon: 'chat',                section: 'Studio', group: 'Sandbox & policy', desc: 'Tune the operator copilot' },
  { id: 'policy',       label: 'Policy',            icon: 'cog',                 section: 'Studio', group: 'Sandbox & policy', desc: 'Auto-execution thresholds & overrides' },
]

const DECISIONS_TABS = TABS.filter((t) => t.section === 'Decisions')
const STUDIO_TABS     = TABS.filter((t) => t.section === 'Studio')

function isStudioTab(t: AipTab): boolean {
  return STUDIO_TABS.some((s) => s.id === t)
}

export function isAipTab(v: string | null | undefined): v is AipTab {
  return !!v && (v === 'command' || v === 'studio' || TABS.some((t) => t.id === v))
}

export default function AIPShell({
  tab,
  onTabChange,
  allowStudio = true,
  allowOrg = true,
}: {
  tab: AipTab
  onTabChange: (t: AipTab) => void
  /** Studio (build/configure) — owner/admin only. */
  allowStudio?: boolean
  /** Org-scope surfaces (Portfolio) — owner/admin / org roles only. */
  allowOrg?: boolean
}) {
  const counts       = useAipCounts()
  const studioBadge  = STUDIO_TABS.reduce((s, t) => s + (counts[t.id] ?? 0), 0)
  // Role-scope: a manager who lands on a Studio/Portfolio tab (e.g. a stale URL)
  // falls back to the Decisions command home.
  const effTab: AipTab =
    (!allowStudio && (tab === 'studio' || isStudioTab(tab))) ? 'command'
    : (!allowOrg && tab === 'portfolio') ? 'command'
    : tab
  const decisionsTabs = allowOrg ? DECISIONS_TABS : DECISIONS_TABS.filter((t) => t.id !== 'portfolio')
  const studioActive = allowStudio && (effTab === 'studio' || isStudioTab(effTab))

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
              effTab === 'command'
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

          {/* Decisions — the daily inbox, each its own rail entry */}
          <div className="mb-3">
            <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-foreground/80">
              Decisions
            </p>
            {decisionsTabs.map((t) => (
              <RailButton
                key={t.id}
                icon={t.icon}
                label={t.label}
                active={t.id === effTab}
                badge={counts[t.id]}
                badgeIntent={badgeIntent(t.id)}
                onClick={() => { onTabChange(t.id) }}
              />
            ))}
          </div>

          {/* Studio — one entry into the builder landing (owner/admin only) */}
          {allowStudio && (
            <div className="mb-3">
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-foreground/80">
                Studio
              </p>
              <RailButton
                icon="build"
                label="Studio"
                active={studioActive}
                badge={studioBadge}
                badgeIntent={Intent.NONE}
                onClick={() => { onTabChange('studio') }}
              />
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        {isStudioTab(effTab) && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b shrink-0 text-xs bg-surface-1/30">
            <button
              type="button"
              onClick={() => { onTabChange('studio') }}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <Icon icon="chevron-left" size={12} /> Studio
            </button>
            <Icon icon="chevron-right" size={10} className="text-muted-foreground/40" />
            <span className="font-medium">{TABS.find((t) => t.id === effTab)?.label ?? effTab}</span>
          </div>
        )}
        <PanelErrorBoundary name={`Mind · ${effTab}`}>
          <Suspense fallback={<div className="flex flex-1 items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>}>
            {renderTab(effTab, onTabChange)}
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
    case 'studio':       return <StudioLanding onNavigate={onNavigate} />
    case 'queue':        return <ReviewQueuePage />
    case 'approvals':    return <PendingApprovalsPage />
    case 'cases':        return <CasesPage />
    case 'agents':       return <AgentStudioPage />
    case 'system-map':   return <SystemMapPage />
    case 'ontology':     return <OntologyPage />
    case 'documents':    return <DocumentsPage />
    case 'entity-links': return <EntityLinkSuggestionsPage />
    case 'answers':      return <ApprovedAnswersPage />
    case 'principles':   return <SectionFrame><PrinciplesSection /></SectionFrame>
    case 'constraints':  return <SectionFrame><ConstraintsSection /></SectionFrame>
    case 'tools':        return <ToolsPage />
    case 'objectives':   return <ModelingObjectivesPage />
    case 'calibration':  return <DecisionCalibrationPage />
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

function RailButton({
  icon, label, active, badge, badgeIntent, onClick,
}: {
  icon: IconName
  label: string
  active: boolean
  badge?: number
  badgeIntent: Intent
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-4 py-1.5 text-xs transition-colors text-left',
        active
          ? 'bg-surface-2 text-foreground font-semibold border-l-2 border-primary'
          : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground border-l-2 border-transparent',
      )}
    >
      <Icon icon={icon} size={12} />
      <span className="flex-1 truncate">{label}</span>
      {badge != null && badge > 0 && (
        <Tag minimal intent={badgeIntent} className="!text-[10px] !min-h-0 !py-0">
          {badge > 99 ? '99+' : String(badge)}
        </Tag>
      )}
    </button>
  )
}

// The Studio landing: cards for every builder surface, grouped, so the 13
// infrequent tabs live one click in instead of crowding the daily rail.
function StudioLanding({ onNavigate }: { onNavigate: (t: AipTab) => void }) {
  const counts = useAipCounts()
  const groups = groupTabs(STUDIO_TABS)
  return (
    <div className="flex-1 overflow-y-auto px-8 py-6">
      <h1 className="text-lg font-semibold">Studio</h1>
      <p className="text-sm text-muted-foreground mt-0.5 mb-5 max-w-2xl">
        Build and configure the fabric — the agents, compute, knowledge, sandbox and
        policy behind every decision. Touched far less often than the daily queue.
      </p>
      {groups.map((g) => (
        <div key={g.label} className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{g.label}</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.tabs.map((t) => {
              const badge = counts[t.id]
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { onNavigate(t.id) }}
                  className="text-left rounded-md border p-4 transition-all hover:border-muted-foreground/40 hover:bg-muted/40"
                >
                  <div className="flex items-center gap-2">
                    <Icon icon={t.icon} size={14} className="text-muted-foreground" />
                    <span className="text-sm font-medium">{t.label}</span>
                    {badge != null && badge > 0 && (
                      <Tag minimal intent={badgeIntent(t.id)} className="!text-[10px] ml-auto">
                        {badge > 99 ? '99+' : String(badge)}
                      </Tag>
                    )}
                  </div>
                  {t.desc && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{t.desc}</p>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
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
