// AIP shell — the spine of the Mind module. A left-rail workspace split into
// Decisions (the daily inbox: queue / approvals / cases) and Studio, which is
// five APPLICATIONS over one ontology rather than a tab per noun — each showing
// its panels as a sub-nav. Mind opens on the Review Queue; Home (/briefing) is
// the single landing. Deep-linkable via ?aip=<panel>: the destination is derived
// from the panel, so old links resolve with no redirect table.

import { lazy, Suspense } from 'react'
import { Icon, Spinner, SpinnerSize, Intent, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { cn } from '@/lib/utils'
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary'
import { useAgentRunSummaries } from '@/features/agentStudio/hooks'
import { PrinciplesSection } from '@/features/principles/PrinciplesSection'
import { ConstraintsSection } from '@/features/constraints/ConstraintsSection'
import { PolicyTab } from './PolicyTab'

const CasesPage                 = lazy(() => import('@/pages/CasesPage'))
const AgentStudioPage           = lazy(() => import('@/pages/AgentStudioPage'))
const ToolsPage                 = lazy(() => import('@/pages/ToolsPage'))
const StudioLanding             = lazy(() => import('@/features/mind/StudioLanding'))
const DocumentsPage             = lazy(() => import('@/pages/DocumentsPage'))
const Cohorts                   = lazy(() => import('@/features/objectSets/Cohorts'))
const ApprovedAnswersPage       = lazy(() => import('@/pages/ApprovedAnswersPage'))
const ScenariosPage             = lazy(() => import('@/pages/ScenariosPage'))
const CopilotConfigPage         = lazy(() => import('@/pages/CopilotConfigPage'))
const ObjectTypesPage           = lazy(() => import('@/pages/ObjectTypesPage'))
const AutomationsPage           = lazy(() => import('@/pages/AutomationsPage'))

export type AipTab =
  | 'queue' | 'restock-approvals' | 'approvals' | 'cases'
  | 'agents' | 'system-map' | 'ontology' | 'object-types' | 'monitors' | 'automations'
  | 'documents' | 'entity-links' | 'answers' | 'principles' | 'constraints' | 'cohorts'
  | 'tools' | 'objectives' | 'forecast-lab' | 'calibration' | 'flywheel' | 'scenarios' | 'action-chains' | 'copilot' | 'policy'
  | 'studio'

// Two intents: Decisions is the daily operator inbox (each its own rail entry);
// Studio builds and configures the fabric, grouped into destinations below.
type Section = 'Decisions' | 'Studio'
const TABS: { id: AipTab; label: string; icon: IconName; section: Section; desc?: string; railHidden?: boolean }[] = [
  // Decisions — the daily driver
  { id: 'queue',        label: 'Review Queue',      icon: 'predictive-analysis', section: 'Decisions', desc: 'Agent proposals awaiting your decision' },
  { id: 'restock-approvals', label: 'Restock Approvals', icon: 'shopping-cart',  section: 'Decisions', desc: 'Approve, edit or reject restock requests' },
  { id: 'approvals',    label: 'Pending Approvals', icon: 'warning-sign',        section: 'Decisions', desc: 'Actions a soft constraint paused for sign-off' },
  { id: 'cases',        label: 'Cases',             icon: 'folder-open',         section: 'Decisions', desc: 'The trigger → trace → outcome envelope' },

  // Studio — build & configure the fabric
  { id: 'agents',       label: 'Agents',            icon: 'predictive-analysis', section: 'Studio', desc: 'Build, eval & release the typed agents' },
  { id: 'system-map',   label: 'System Map',        icon: 'graph',               section: 'Studio', desc: 'How nodes, tools & actions connect' },
  { id: 'ontology',     label: 'Ontology',          icon: 'diagram-tree',        section: 'Studio', desc: 'Typed concepts your data is missing' },
  { id: 'object-types', label: 'Object Types',      icon: 'cube',                section: 'Studio', desc: 'Author a new kind of thing + its records' },
  { id: 'tools',        label: 'Logic Tools',       icon: 'function',            section: 'Studio', desc: 'The typed, versioned tool registry' },
  { id: 'objectives',   label: 'Modeling Objectives', icon: 'chart',             section: 'Studio', desc: 'Trained adapters behind eval gates', railHidden: true },
  { id: 'forecast-lab', label: 'Forecast Lab',      icon: 'lab-test',            section: 'Studio', desc: 'Backtest + run the forecast adapters by cohort' },
  { id: 'calibration',  label: 'Calibration',       icon: 'timeline-line-chart', section: 'Studio', desc: 'Is stated confidence matching reality?' },
  { id: 'flywheel',     label: 'Flywheel',          icon: 'pulse',               section: 'Studio', desc: 'Is the system getting better — calibration + loop health' },
  { id: 'monitors',     label: 'Monitors',          icon: 'feed',                section: 'Studio', desc: 'Tunable triggers that fire proposals into Decisions' },
  { id: 'automations',  label: 'Automations',       icon: 'flows',               section: 'Studio', desc: 'Create a monitor without code — when → then → gate' },

  { id: 'cohorts',      label: 'Cohorts',           icon: 'group-objects',       section: 'Studio', desc: 'Named groups of records other things point at' },
  { id: 'documents',    label: 'Documents',         icon: 'document',            section: 'Studio', desc: 'Ingested sources with page provenance' },
  { id: 'entity-links', label: 'Entity Links',      icon: 'search-template',     section: 'Studio', desc: 'Review suggested links to entities' },
  { id: 'answers',      label: 'Approved Answers',  icon: 'bookmark',            section: 'Studio', desc: 'Curated Q&A served before the LLM' },
  { id: 'principles',   label: 'Principles',        icon: 'learning',            section: 'Studio', desc: 'Soft NL guidance injected into agents' },
  { id: 'constraints',  label: 'Constraints',       icon: 'shield',              section: 'Studio', desc: 'Hard gates at action submission' },

  { id: 'scenarios',    label: 'Scenarios',         icon: 'lab-test',            section: 'Studio', desc: 'Explore graph overlays, uncommitted', railHidden: true },
  { id: 'action-chains', label: 'Action Chains',    icon: 'link',                section: 'Studio', desc: 'Batch actions with a commit boundary', railHidden: true },
  { id: 'copilot',      label: 'Copilot Config',    icon: 'chat',                section: 'Studio', desc: 'Tune the operator copilot', railHidden: true },
  { id: 'policy',       label: 'Policy',            icon: 'cog',                 section: 'Studio', desc: 'Auto-execution thresholds & overrides' },
]

const DECISIONS_TABS = TABS.filter((t) => t.section === 'Decisions')
export const STUDIO_TABS = TABS.filter((t) => t.section === 'Studio')

// Studio is five APPLICATIONS over one ontology, not twenty nouns. Foundry keeps
// the ontology (types, properties, links, actions) separate from the apps that
// consume it, and has exactly one ontology editor; we had a tab per noun.
// See docs/STUDIO-RESTRUCTURE.md.
export interface StudioDestination {
  id: string
  label: string
  icon: IconName
  desc: string
  /** Panels in rail order. `railHidden` ones stay reachable by deep link. */
  panels: AipTab[]
}

export const DESTINATIONS: StudioDestination[] = [
  { id: 'ontology-manager', label: 'Ontology Manager', icon: 'diagram-tree',
    desc: 'The types, properties, links and interfaces everything else speaks',
    panels: ['object-types', 'ontology', 'system-map', 'scenarios'] },
  { id: 'explorer', label: 'Object Explorer', icon: 'search-template',
    desc: 'The records themselves — documents, principles, constraints, answers',
    panels: ['cohorts', 'documents', 'entity-links', 'answers', 'principles', 'constraints'] },
  { id: 'automate', label: 'Automate', icon: 'flows',
    desc: 'One entry point: when the ontology changes, propose an Action',
    panels: ['automations', 'monitors', 'action-chains'] },
  { id: 'logic', label: 'Logic & Evals', icon: 'predictive-analysis',
    desc: 'Author the agents and tools, then prove they work',
    panels: ['agents', 'tools', 'forecast-lab', 'calibration', 'flywheel', 'objectives', 'copilot'] },
  { id: 'policy', label: 'Policy', icon: 'cog',
    desc: 'Thresholds and overrides that govern unattended execution',
    panels: ['policy'] },
]

/** The destination a panel belongs to. Deriving it from the panel is why every
 *  existing `?aip=<tab>` link still resolves — there is no redirect table. */
function destinationOf(t: AipTab): StudioDestination | undefined {
  return DESTINATIONS.find((d) => d.panels.includes(t))
}

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
  // Two distinct surfaces, not one shared rail: Decisions (act on proposals) and
  // Studio (build/configure). The rail shows only the section you're in — you
  // switch between them via the sidebar, so they stop bleeding into each other.
  const activeSection: Section = isStudioTab(effTab) ? 'Studio' : 'Decisions'

  const activeDest = destinationOf(effTab)
  const byId = new Map(TABS.map((t) => [t.id, t]))
  // A hidden panel appears in the sub-nav only while it's the one you're on, so
  // a deep link never lands somewhere with no visible trace of where it is.
  const subNav = (activeDest?.panels ?? []).filter((p) => !byId.get(p)?.railHidden || p === effTab)

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-52 border-r shrink-0 overflow-y-auto bg-surface-1/30">
        <nav className="py-2">
          {/* Decisions — the daily inbox: only shown when you're deciding */}
          {activeSection === 'Decisions' && (
          <div className="mb-3">
            <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-foreground/80">
              Decisions
            </p>
            <p className="px-4 pb-2 text-[10px] text-muted-foreground leading-snug">Act on what the loop surfaced.</p>
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
          )}

          {/* Studio — build & configure: only shown when you're configuring */}
          {activeSection === 'Studio' && allowStudio && (
            <div className="mb-3">
              <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-widest text-foreground/80">
                Studio
              </p>
              <p className="px-4 pb-2 text-[10px] text-muted-foreground leading-snug">Build &amp; configure the fabric.</p>
              <RailButton
                icon="compass"
                label="Overview"
                title="What Studio is and how its surfaces feed each other"
                active={effTab === 'studio'}
                badgeIntent={Intent.NONE}
                onClick={() => { onTabChange('studio') }}
              />
              {DESTINATIONS.map((d) => (
                <RailButton
                  key={d.id}
                  icon={d.icon}
                  label={d.label}
                  title={d.desc}
                  active={d.id === activeDest?.id}
                  badge={d.panels.reduce((s, p) => s + (counts[p] ?? 0), 0)}
                  badgeIntent={Intent.NONE}
                  // Landing on a destination lands on its first panel.
                  onClick={() => { onTabChange(d.panels[0]) }}
                />
              ))}
            </div>
          )}
        </nav>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        {activeDest && subNav.length > 1 && (
          <div className="flex items-center gap-1 border-b px-4 py-1.5 shrink-0 overflow-x-auto">
            {subNav.map((p) => {
              const t = byId.get(p)
              if (!t) return null
              return (
                <button
                  key={p} type="button" title={t.desc}
                  onClick={() => { onTabChange(p) }}
                  className={cn(
                    'flex items-center gap-1.5 rounded px-2 py-1 text-xs whitespace-nowrap transition-colors',
                    p === effTab ? 'bg-surface-2 font-medium text-foreground' : 'text-muted-foreground hover:bg-surface-2/60 hover:text-foreground',
                  )}
                >
                  <Icon icon={t.icon} size={12} />
                  {t.label}
                  {(counts[p] ?? 0) > 0 && (
                    <Tag minimal intent={badgeIntent(p)} className="!text-[10px] !min-h-0 !py-0">
                      {(counts[p] ?? 0) > 99 ? '99+' : String(counts[p])}
                    </Tag>
                  )}
                </button>
              )
            })}
          </div>
        )}
        <PanelErrorBoundary name={`${activeDest?.label ?? activeSection} · ${effTab}`}>
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
    case 'cases':        return <CasesPage />
    case 'agents':       return <AgentStudioPage />
    case 'object-types': return <ObjectTypesPage />
    case 'documents':    return <DocumentsPage />
    case 'cohorts': return <Cohorts />
    case 'answers':      return <ApprovedAnswersPage />
    case 'principles':   return <SectionFrame><PrinciplesSection /></SectionFrame>
    case 'constraints':  return <SectionFrame><ConstraintsSection /></SectionFrame>
    case 'tools':        return <ToolsPage />
    case 'automations':  return <AutomationsPage />
    case 'scenarios':     return <ScenariosPage />
    case 'copilot':      return <CopilotConfigPage />
    case 'policy':       return <PolicyTab />
  }
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
  // Queue/approval/case counts came from the hospitality signal spine. Agent
  // pending counts survive because agent runs are ontology-side.
  const summaries = useAgentRunSummaries()
  const agentsPending = (summaries.data ?? []).reduce((s, r) => s + r.pending, 0)
  return { agents: agentsPending > 0 ? agentsPending : undefined }
}
