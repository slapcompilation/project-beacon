// AIP shell — the spine of the Mind module. A left-rail workspace split into
// Decisions (the daily inbox: queue / approvals / cases) and Studio (build &
// configure the fabric), with Studio's three groups shown as collapsible
// sections in the rail so the structure is visible without crowding the daily
// items. Mind opens on the Review Queue; Home (/briefing) is the single landing.
// Deep-linkable via ?aip=<tab>.

import { lazy, Suspense, useEffect, useState } from 'react'
import { Icon, Spinner, SpinnerSize, Intent, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { useAipSignalCounts } from '@/features/aipSignals/hooks'
import { useAgentRunSummaries } from '@/features/agentStudio/hooks'
import { PrinciplesSection } from '@/features/principles/PrinciplesSection'
import { ConstraintsSection } from '@/features/constraints/ConstraintsSection'
import { PolicyTab } from './PolicyTab'

const ReviewQueuePage           = lazy(() => import('@/pages/ReviewQueuePage'))
const RestockPage               = lazy(() => import('@/pages/RestockPage'))
const PendingApprovalsPage      = lazy(() => import('@/pages/PendingApprovalsPage'))
const CasesPage                 = lazy(() => import('@/pages/CasesPage'))
const AgentStudioPage           = lazy(() => import('@/pages/AgentStudioPage'))
const ToolsPage                 = lazy(() => import('@/pages/ToolsPage'))
const ModelingObjectivesPage    = lazy(() => import('@/pages/ModelingObjectivesPage'))
const DecisionCalibrationPage   = lazy(() => import('@/pages/DecisionCalibrationPage'))
const FlywheelPage              = lazy(() => import('@/pages/FlywheelPage'))
const StudioLanding             = lazy(() => import('@/features/mind/StudioLanding'))
const DocumentsPage             = lazy(() => import('@/pages/DocumentsPage'))
const EntityLinkSuggestionsPage = lazy(() => import('@/pages/EntityLinkSuggestionsPage'))
const ApprovedAnswersPage       = lazy(() => import('@/pages/ApprovedAnswersPage'))
const ActionChainsPage          = lazy(() => import('@/pages/ActionChainsPage'))
const ScenariosPage             = lazy(() => import('@/pages/ScenariosPage'))
const SystemMapPage             = lazy(() => import('@/pages/SystemMapPage'))
const CopilotConfigPage         = lazy(() => import('@/pages/CopilotConfigPage'))
const OntologyPage              = lazy(() => import('@/pages/OntologyPage'))
const MonitorsTab               = lazy(() => import('@/features/monitors/MonitorsTab'))
const ForecastLabPage           = lazy(() => import('@/pages/ForecastLabPage'))

export type AipTab =
  | 'queue' | 'restock-approvals' | 'approvals' | 'cases'
  | 'agents' | 'system-map' | 'ontology' | 'monitors'
  | 'documents' | 'entity-links' | 'answers' | 'principles' | 'constraints'
  | 'tools' | 'objectives' | 'forecast-lab' | 'calibration' | 'flywheel' | 'scenarios' | 'action-chains' | 'copilot' | 'policy'
  | 'studio'

// Two intents: Decisions is the daily operator inbox (each its own rail entry);
// Studio is where you build/configure the fabric, surfaced as three collapsible
// groups so the structure is discoverable without crowding the daily items.
type Section = 'Decisions' | 'Studio'
const TABS: { id: AipTab; label: string; icon: IconName; section: Section; group: string; desc?: string; railHidden?: boolean }[] = [
  // Decisions — the daily driver
  { id: 'queue',        label: 'Review Queue',      icon: 'predictive-analysis', section: 'Decisions', group: '', desc: 'Agent proposals awaiting your decision' },
  { id: 'restock-approvals', label: 'Restock Approvals', icon: 'shopping-cart',  section: 'Decisions', group: '', desc: 'Approve, edit or reject restock requests' },
  { id: 'approvals',    label: 'Pending Approvals', icon: 'warning-sign',        section: 'Decisions', group: '', desc: 'Actions a soft constraint paused for sign-off' },
  { id: 'cases',        label: 'Cases',             icon: 'folder-open',         section: 'Decisions', group: '', desc: 'The trigger → trace → outcome envelope' },

  // Studio — build & configure the fabric
  { id: 'agents',       label: 'Agents',            icon: 'predictive-analysis', section: 'Studio', group: 'Agents & compute', desc: 'Build, eval & release the typed agents' },
  { id: 'system-map',   label: 'System Map',        icon: 'graph',               section: 'Studio', group: 'Agents & compute', desc: 'How nodes, tools & actions connect' },
  { id: 'ontology',     label: 'Ontology',          icon: 'diagram-tree',        section: 'Studio', group: 'Agents & compute', desc: 'Typed concepts your data is missing' },
  { id: 'tools',        label: 'Logic Tools',       icon: 'function',            section: 'Studio', group: 'Agents & compute', desc: 'The typed, versioned tool registry' },
  { id: 'objectives',   label: 'Modeling Objectives', icon: 'chart',             section: 'Studio', group: 'Agents & compute', desc: 'Trained adapters behind eval gates', railHidden: true },
  { id: 'forecast-lab', label: 'Forecast Lab',      icon: 'lab-test',            section: 'Studio', group: 'Agents & compute', desc: 'Backtest + run the forecast adapters by cohort' },
  { id: 'calibration',  label: 'Calibration',       icon: 'timeline-line-chart', section: 'Studio', group: 'Agents & compute', desc: 'Is stated confidence matching reality?' },
  { id: 'flywheel',     label: 'Flywheel',          icon: 'pulse',               section: 'Studio', group: 'Agents & compute', desc: 'Is the system getting better — calibration + loop health' },
  { id: 'monitors',     label: 'Monitors',          icon: 'feed',                section: 'Studio', group: 'Agents & compute', desc: 'Tunable triggers that fire proposals into Decisions' },

  { id: 'documents',    label: 'Documents',         icon: 'document',            section: 'Studio', group: 'Knowledge', desc: 'Ingested sources with page provenance' },
  { id: 'entity-links', label: 'Entity Links',      icon: 'search-template',     section: 'Studio', group: 'Knowledge', desc: 'Review suggested links to entities' },
  { id: 'answers',      label: 'Approved Answers',  icon: 'bookmark',            section: 'Studio', group: 'Knowledge', desc: 'Curated Q&A served before the LLM' },
  { id: 'principles',   label: 'Principles',        icon: 'learning',            section: 'Studio', group: 'Knowledge', desc: 'Soft NL guidance injected into agents' },
  { id: 'constraints',  label: 'Constraints',       icon: 'shield',              section: 'Studio', group: 'Knowledge', desc: 'Hard gates at action submission' },

  { id: 'scenarios',    label: 'Scenarios',         icon: 'lab-test',            section: 'Studio', group: 'Sandbox & policy', desc: 'Explore graph overlays, uncommitted', railHidden: true },
  { id: 'action-chains', label: 'Action Chains',    icon: 'link',                section: 'Studio', group: 'Sandbox & policy', desc: 'Batch actions with a commit boundary', railHidden: true },
  { id: 'copilot',      label: 'Copilot Config',    icon: 'chat',                section: 'Studio', group: 'Sandbox & policy', desc: 'Tune the operator copilot', railHidden: true },
  { id: 'policy',       label: 'Policy',            icon: 'cog',                 section: 'Studio', group: 'Sandbox & policy', desc: 'Auto-execution thresholds & overrides' },
]

const DECISIONS_TABS = TABS.filter((t) => t.section === 'Decisions')
export const STUDIO_TABS = TABS.filter((t) => t.section === 'Studio')
// M3: thin tabs live in the landing's cards, not the rail (deep links still work)
const STUDIO_GROUPS   = groupTabs(STUDIO_TABS.filter((t) => !t.railHidden))

function isStudioTab(t: AipTab): boolean {
  return t === 'studio' || STUDIO_TABS.some((s) => s.id === t)
}

export function isAipTab(v: string | null | undefined): v is AipTab {
  return v === 'studio' || (!!v && TABS.some((t) => t.id === v))
}

export default function AIPShell({
  tab,
  onTabChange,
  allowStudio = true,
}: {
  tab: AipTab
  onTabChange: (t: AipTab) => void
  /** Studio (build/configure) — owner/admin only. */
  allowStudio?: boolean
}) {
  const counts = useAipCounts()
  // A manager who lands on a Studio tab (e.g. a stale URL) falls back to the queue.
  const effTab: AipTab = (!allowStudio && isStudioTab(tab)) ? 'queue' : tab

  // Auto-open the group containing the active Studio tab (deep links land expanded);
  // the operator can toggle the others. Collapsed by default keeps the rail short.
  const activeGroup = STUDIO_TABS.find((t) => t.id === effTab)?.group ?? null
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(activeGroup ? [activeGroup] : []))
  useEffect(() => {
    if (activeGroup) setOpenGroups((prev) => (prev.has(activeGroup) ? prev : new Set(prev).add(activeGroup)))
  }, [activeGroup])
  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-52 border-r shrink-0 overflow-y-auto bg-surface-1/30">
        <nav className="py-2">
          {/* Decisions — the daily inbox, each its own rail entry */}
          <div className="mb-3">
            <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-foreground/80">
              Decisions
            </p>
            {DECISIONS_TABS.map((t) => (
              <RailButton
                key={t.id}
                icon={t.icon}
                label={t.label}
                title={t.desc}
                active={t.id === effTab}
                badge={counts[t.id]}
                badgeIntent={badgeIntent(t.id)}
                onClick={() => { onTabChange(t.id) }}
              />
            ))}
          </div>

          {/* Studio — collapsible groups, surfaces inline (owner/admin only) */}
          {allowStudio && (
            <div className="mb-3">
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-foreground/80">
                Studio
              </p>
              <RailButton
                icon="compass"
                label="Overview"
                title="What Studio is and how its surfaces feed each other"
                active={effTab === 'studio'}
                badgeIntent={Intent.NONE}
                onClick={() => { onTabChange('studio') }}
              />
              {STUDIO_GROUPS.map((g) => {
                const open = openGroups.has(g.label)
                const groupBadge = g.tabs.reduce((s, t) => s + (counts[t.id] ?? 0), 0)
                return (
                  <div key={g.label}>
                    <button
                      type="button"
                      onClick={() => { toggleGroup(g.label) }}
                      className="flex w-full items-center gap-2 px-4 py-1.5 text-xs text-left text-muted-foreground hover:bg-surface-2 hover:text-foreground border-l-2 border-transparent transition-colors"
                    >
                      <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={12} />
                      <span className="flex-1 truncate font-medium">{g.label}</span>
                      {groupBadge > 0 && (
                        <Tag minimal className="!text-[10px] !min-h-0 !py-0">
                          {groupBadge > 99 ? '99+' : String(groupBadge)}
                        </Tag>
                      )}
                    </button>
                    {open && g.tabs.map((t) => (
                      <RailButton
                        key={t.id}
                        icon={t.icon}
                        label={t.label}
                        title={t.desc}
                        active={t.id === effTab}
                        badge={counts[t.id]}
                        badgeIntent={badgeIntent(t.id)}
                        onClick={() => { onTabChange(t.id) }}
                        indent
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
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

function renderTab(t: AipTab, onNavigate: (t: AipTab) => void) {
  switch (t) {
    case 'studio':       return <StudioLanding onNavigate={onNavigate} />
    case 'queue':        return <ReviewQueuePage />
    case 'restock-approvals': return <RestockPage />
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
    case 'forecast-lab': return <ForecastLabPage />
    case 'calibration':  return <DecisionCalibrationPage />
    case 'flywheel':     return <FlywheelPage />
    case 'monitors':     return <MonitorsTab />
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
  icon, label, title, active, badge, badgeIntent, onClick, indent,
}: {
  icon: IconName
  label: string
  title?: string
  active: boolean
  badge?: number
  badgeIntent: Intent
  onClick: () => void
  indent?: boolean
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 py-1.5 text-xs transition-colors text-left',
        indent ? 'pl-9 pr-4' : 'px-4',
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

function badgeIntent(t: AipTab): Intent {
  if (t === 'approvals' || t === 'entity-links') return Intent.WARNING
  if (t === 'queue') return Intent.PRIMARY
  return Intent.NONE
}

/** Live counts that make the rail itself intelligent — pending work per tab.
 *  The decision counts come from one server-aggregated RPC (shared with the
 *  topbar) instead of fetching full datasets just to take their length. */
function useAipCounts(): Partial<Record<AipTab, number>> {
  const signals   = useAipSignalCounts()
  const summaries = useAgentRunSummaries()

  const q = signals.data?.queue ?? 0
  const a = signals.data?.approvals ?? 0
  const c = signals.data?.casesOpen ?? 0
  const agentsPending = (summaries.data ?? []).reduce((s, r) => s + r.pending, 0)

  return {
    queue:          q,
    approvals:      a,
    cases:          c,
    'entity-links': signals.data?.entityLinks,
    agents:         agentsPending > 0 ? agentsPending : undefined,
  }
}
