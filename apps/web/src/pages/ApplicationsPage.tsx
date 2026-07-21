// Applications portal — Foundry's "Applications": one discoverable index of every
// surface in Beacon, grouped by layer, role-gated to what the operator can open.
// The bottom dock + Cmd+K stay the fast paths; this is the "show me everything"
// map. Decision surfaces carry live pending counts so the portal is intelligent,
// not a static menu.

import { Link } from 'react-router-dom'
import { Icon, Tag, Intent } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useAuthStore } from '@/stores/auth.store'
import { useAipSignalCounts } from '@/features/aipSignals/hooks'

type Access = 'all' | 'manager' | 'admin'
type BadgeKey = 'queue' | 'approvals' | 'cases' | 'entityLinks'

interface Surface {
  label: string
  path: string
  icon: IconName
  desc: string
  badge?: BadgeKey
}
interface Section {
  layer: string
  icon: IconName
  blurb: string
  access: Access
  surfaces: Surface[]
}

const SECTIONS: Section[] = [
  {
    layer: 'Floor', icon: 'barcode', access: 'all',
    blurb: 'Count, scan and keep stock honest on the ground.',
    surfaces: [
      { label: 'Stock',     path: '/floor?panel=stock',     icon: 'cube',        desc: 'Live counts, adjust + write-off' },
      { label: 'Scan',      path: '/scan',                  icon: 'barcode',     desc: 'Barcode capture into the graph' },
      { label: 'Expiry',    path: '/floor?panel=expiry',    icon: 'calendar',    desc: 'Batches approaching their date' },
      { label: 'Alerts',    path: '/floor?panel=alerts',    icon: 'warning-sign',desc: 'Low-stock + threshold breaches' },
      { label: 'Stocktake', path: '/floor?panel=stocktake', icon: 'clipboard',   desc: 'Guided count sessions' },
      { label: 'Labels',    path: '/labels',                icon: 'tag',         desc: 'Print shelf + bin labels' },
      { label: 'Par Optimizer', path: '/floor?panel=par',   icon: 'chart',       desc: 'Tune reorder points from usage' },
    ],
  },
  {
    layer: 'Flow', icon: 'swap-horizontal', access: 'manager',
    blurb: 'Move stock in and between properties.',
    surfaces: [
      { label: 'Overview',  path: '/flow',                  icon: 'swap-horizontal', desc: 'Movement at a glance' },
      { label: 'Receive',   path: '/flow?panel=receive',    icon: 'confirm',         desc: 'Book deliveries against POs' },
      { label: 'Audit Log', path: '/audit',                 icon: 'history',         desc: 'Every stock movement, immutable' },
    ],
  },
  {
    layer: 'Insights', icon: 'eye-open', access: 'manager',
    blurb: 'See risk, waste and performance before it bites.',
    surfaces: [
      { label: 'Signals',      path: '/eye?panel=signals',     icon: 'eye-open', desc: 'The live signal feed' },
      { label: 'Incidents',    path: '/eye?panel=incidents',   icon: 'issue',    desc: 'What went wrong + why' },
      { label: 'Waste Radar',  path: '/eye?panel=waste',       icon: 'trash',    desc: 'Where margin is leaking' },
      { label: 'Risk Matrix',  path: '/eye?panel=risk',        icon: 'grid',     desc: 'Likelihood × impact map' },
      { label: 'Performance',  path: '/eye?panel=performance', icon: 'chart',    desc: 'Finance + ops KPIs' },
      { label: 'Occupancy',    path: '/eye?panel=occupancy',   icon: 'people',   desc: 'Demand driver for forecasts' },
      { label: 'Reality Graph',path: '/objects',               icon: 'graph',    desc: 'Explore nodes + typed edges' },
    ],
  },
  {
    layer: 'Decisions', icon: 'inbox', access: 'manager',
    blurb: 'The daily operator inbox — proposals, approvals, cases.',
    surfaces: [
      { label: 'Review Queue',      path: '/mind?aip=queue',             icon: 'predictive-analysis', desc: 'Agent proposals awaiting you', badge: 'queue' },
      { label: 'Restock Approvals', path: '/mind?aip=restock-approvals', icon: 'shopping-cart',       desc: 'Approve, edit or reject restocks' },
      { label: 'Pending Approvals', path: '/mind?aip=approvals',         icon: 'warning-sign',        desc: 'Actions a soft constraint paused', badge: 'approvals' },
      { label: 'Cases',             path: '/mind?aip=cases',             icon: 'folder-open',         desc: 'Trigger → trace → outcome', badge: 'cases' },
    ],
  },
  {
    layer: 'Studio · Agents & compute', icon: 'build', access: 'admin',
    blurb: 'Build, eval and release the agents + compute.',
    surfaces: [
      { label: 'Agents',              path: '/mind?aip=agents',       icon: 'predictive-analysis', desc: 'Build, eval & release the agents' },
      { label: 'System Map',          path: '/mind?aip=system-map',   icon: 'graph',               desc: 'How nodes, tools & actions connect' },
      { label: 'Ontology',            path: '/mind?aip=ontology',     icon: 'diagram-tree',        desc: 'Typed concepts your data is missing' },
      { label: 'Logic Tools',         path: '/mind?aip=tools',        icon: 'function',            desc: 'The typed, versioned tool registry' },
      { label: 'Modeling Objectives', path: '/mind?aip=objectives',   icon: 'chart',               desc: 'Trained adapters behind eval gates' },
      { label: 'Forecast Lab',        path: '/mind?aip=forecast-lab', icon: 'lab-test',            desc: 'Backtest the forecast adapters' },
      { label: 'Calibration',         path: '/mind?aip=calibration',  icon: 'timeline-line-chart', desc: 'Is stated confidence matching reality?' },
      { label: 'Flywheel',            path: '/mind?aip=flywheel',     icon: 'pulse',               desc: 'Is the system getting better?' },
      { label: 'Monitors',            path: '/mind?aip=monitors',     icon: 'feed',                desc: 'Tunable triggers that fire proposals' },
    ],
  },
  {
    layer: 'Studio · Knowledge', icon: 'book', access: 'admin',
    blurb: 'The context the agents reason over.',
    surfaces: [
      { label: 'Documents',       path: '/mind?aip=documents',    icon: 'document',        desc: 'Ingested sources with provenance' },
      { label: 'Entity Links',    path: '/mind?aip=entity-links', icon: 'search-template', desc: 'Review suggested links', badge: 'entityLinks' },
      { label: 'Approved Answers',path: '/mind?aip=answers',      icon: 'bookmark',        desc: 'Curated Q&A served before the LLM' },
      { label: 'Principles',      path: '/mind?aip=principles',   icon: 'learning',        desc: 'Soft NL guidance for agents' },
      { label: 'Constraints',     path: '/mind?aip=constraints',  icon: 'shield',          desc: 'Hard gates at action submission' },
    ],
  },
  {
    layer: 'Studio · Sandbox & policy', icon: 'lab-test', access: 'admin',
    blurb: 'Explore, batch and govern before committing.',
    surfaces: [
      { label: 'Scenarios',     path: '/mind?aip=scenarios',     icon: 'lab-test', desc: 'Explore graph overlays, uncommitted' },
      { label: 'Action Chains', path: '/mind?aip=action-chains', icon: 'link',     desc: 'Batch actions with a commit boundary' },
      { label: 'Copilot Config',path: '/mind?aip=copilot',       icon: 'chat',     desc: 'Tune the operator copilot' },
      { label: 'Policy',        path: '/mind?aip=policy',        icon: 'cog',      desc: 'Auto-execution thresholds & overrides' },
    ],
  },
  {
    layer: 'Procurement', icon: 'shop', access: 'admin',
    blurb: 'Source, order and reconcile with suppliers.',
    surfaces: [
      { label: 'Triage',      path: '/operations?panel=triage',      icon: 'shop',         desc: 'What needs procurement now' },
      { label: 'Suppliers',   path: '/operations?panel=suppliers',   icon: 'truck',        desc: 'Reliability + lead times' },
      { label: 'PO Builder',  path: '/operations?panel=procurement', icon: 'shopping-cart',desc: 'Assemble purchase orders' },
      { label: 'PO Dispatch', path: '/operations?panel=dispatch',    icon: 'send-message', desc: 'Send + track open POs' },
      { label: 'Contracts',   path: '/operations?panel=contracts',   icon: 'document',     desc: 'Terms with page provenance' },
      { label: 'Finance',     path: '/operations?panel=finance',     icon: 'bank-account', desc: 'Invoice + spend reconciliation' },
      { label: 'GL Export',   path: '/operations?panel=gl',          icon: 'th',           desc: 'Map + export to the ledger' },
      { label: 'Strategy',    path: '/operations?panel=strategy',    icon: 'chart',        desc: 'Leverage + negotiation prep' },
    ],
  },
  {
    layer: 'Workspace', icon: 'home', access: 'all',
    blurb: 'Home, alerts and account.',
    surfaces: [
      { label: 'Home',          path: '/briefing',             icon: 'home',          desc: 'What the loop left you today' },
      { label: 'Notifications', path: '/notifications',        icon: 'notifications', desc: 'Alerts with inline response' },
      { label: "What's New",    path: '/whats-new',            icon: 'star',          desc: 'Recent releases + improvements' },
      { label: 'Forecast Lab', path: '/mind?aip=forecast-lab', icon: 'lab-test',      desc: 'Backtest + run the forecast adapters' },
      { label: 'Team',          path: '/settings?section=team',icon: 'people',        desc: 'Members, roles + scope' },
      { label: 'Settings',      path: '/settings',             icon: 'cog',           desc: 'Org + property configuration' },
      { label: 'Account',       path: '/account',              icon: 'user',          desc: 'Your profile + sign-out' },
    ],
  },
]

export default function ApplicationsPage() {
  const role = useAuthStore((s) => s.role)
  const { data: counts } = useAipSignalCounts()

  const isManager      = !!role && role !== 'limited_access' && role !== 'team_member'
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const canSee = (a: Access) => a === 'all' || (a === 'manager' && isManager) || (a === 'admin' && isOwnerOrAdmin)

  const badgeValue = (k?: BadgeKey): number => {
    if (!k || !counts) return 0
    switch (k) {
      case 'queue':       return counts.queue
      case 'approvals':   return counts.approvals
      case 'entityLinks': return counts.entityLinks
      case 'cases':       return counts.casesOpen
    }
  }

  const sections = SECTIONS.filter((s) => canSee(s.access))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-8 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Applications</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every surface, grouped by layer. The dock + <code className="text-[11px]">⌘K</code> stay the fast paths — this is the map.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-6xl space-y-8">
          {sections.map((section) => (
            <section key={section.layer}>
              <div className="flex items-center gap-2 mb-3">
                <Icon icon={section.icon} size={14} className="text-muted-foreground" />
                <h2 className="text-sm font-semibold">{section.layer}</h2>
                <span className="text-xs text-muted-foreground">· {section.blurb}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.surfaces.map((s) => {
                  const badge = badgeValue(s.badge)
                  return (
                    <Link
                      key={s.path}
                      to={s.path}
                      className="group rounded-md border p-4 transition-all hover:border-muted-foreground/40 hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <Icon icon={s.icon} size={14} className="text-muted-foreground group-hover:text-foreground" />
                        <span className="text-sm font-medium">{s.label}</span>
                        {badge > 0 && (
                          <Tag minimal intent={s.badge === 'approvals' || s.badge === 'entityLinks' ? Intent.WARNING : Intent.PRIMARY} className="!text-[10px] ml-auto">
                            {badge > 99 ? '99+' : String(badge)}
                          </Tag>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{s.desc}</p>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
