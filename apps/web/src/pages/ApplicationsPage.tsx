// Applications — Foundry's "Applications": the purpose-built apps you work in, not
// a launcher for every panel and setting. Split operational vs analytics (Foundry's
// own split), plus where you build them. System utilities (Home, Notifications,
// Settings, Account) are NOT apps — they live in the sidebar / user menu. The dock
// + Cmd+K stay the fast path to any individual surface; this is the app portfolio.
//
// W4: the built-in apps above are code, and always will be. Below them the portal
// lists PROMOTED MODULES — collections as sections, tags as filters — so an
// application somebody assembled is as findable as one we shipped.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Icon, Tag, Intent } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { useAuthStore } from '@/stores/auth.store'
import { useAipSignalCounts } from '@/features/aipSignals/hooks'
import { usePromotedApps, type PromotedApp } from '@/features/modules/promotions'

type Access = 'all' | 'manager' | 'admin'

interface App {
  label: string
  path: string
  icon: IconName
  desc: string
  access: Access
  /** Show the pending-decisions count on this tile. */
  decisionsBadge?: boolean
}
interface Category {
  title: string
  blurb: string
  apps: App[]
}

const CATEGORIES: Category[] = [
  {
    title: 'Operational apps',
    blurb: 'Run the day — count and move stock, source from suppliers, and act on what the agents propose.',
    apps: [
      { label: 'Floor',      path: '/floor',          icon: 'barcode',         access: 'all',     desc: 'Count, scan, and keep stock honest on the ground.' },
      { label: 'Flow',       path: '/flow',           icon: 'swap-horizontal', access: 'manager', desc: 'Receive deliveries and move stock between properties.' },
      { label: 'Operations', path: '/operations',     icon: 'shop',            access: 'admin',   desc: 'Source, order, and reconcile with suppliers.' },
      { label: 'Decisions',  path: '/mind?aip=queue', icon: 'inbox',           access: 'manager', desc: 'The operator inbox — proposals, approvals, and cases.', decisionsBadge: true },
    ],
  },
  {
    title: 'Analytics apps',
    blurb: 'Read the operation — risk, waste, and performance, and the ontology behind them.',
    apps: [
      { label: 'Insights', path: '/eye',     icon: 'eye-open', access: 'manager', desc: 'Signals, waste, risk, occupancy, and finance lenses.' },
      { label: 'Objects',  path: '/objects', icon: 'cube',     access: 'manager', desc: 'Browse the ontology — every node type and its instances.' },
    ],
  },
  {
    title: 'Build & configure',
    blurb: 'Shape what the system does — build the agents directly, or follow the guided path.',
    apps: [
      { label: 'Studio',            path: '/mind?aip=studio', icon: 'build', access: 'admin', desc: 'Build, govern, and prove the intelligence fabric.' },
      { label: 'Create a workflow', path: '/create-workflow', icon: 'path',  access: 'admin', desc: 'Guided path from an idea to a gated, running agent.' },
    ],
  },
]

export default function ApplicationsPage() {
  const role = useAuthStore((s) => s.role)
  const { data: counts } = useAipSignalCounts()
  const { data: promoted = [] } = usePromotedApps()
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const isManager      = !!role && role !== 'limited_access' && role !== 'team_member'
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const canSee = (a: Access) => a === 'all' || (a === 'manager' && isManager) || (a === 'admin' && isOwnerOrAdmin)

  const pendingDecisions = (counts?.queue ?? 0) + (counts?.approvals ?? 0)

  const categories = CATEGORIES
    .map((c) => ({ ...c, apps: c.apps.filter((a) => canSee(a.access)) }))
    .filter((c) => c.apps.length > 0)

  // Tags filter the cards; collections section them. Two different jobs, which
  // is why Foundry keeps them apart and so do we.
  const allTags = [...new Set(promoted.flatMap((a) => a.tags))].sort()
  const shown = tagFilter ? promoted.filter((a) => a.tags.includes(tagFilter)) : promoted
  const collections = [...new Map(shown.map((a) =>
    [a.collectionApiName, { title: a.collectionTitle, position: a.collectionPosition }])).entries()]
    .sort((a, b) => a[1].position - b[1].position || a[1].title.localeCompare(b[1].title))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b px-8 py-4 shrink-0">
        <h1 className="text-xl font-semibold">Applications</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          The apps you work in — operational and analytics — plus where you build them. Home,
          notifications, and settings live in the sidebar; <code className="text-[11px]">⌘K</code> jumps to any surface.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-5xl space-y-8">
          {categories.map((cat) => (
            <section key={cat.title}>
              <div className="mb-3">
                <h2 className="text-sm font-semibold">{cat.title}</h2>
                <span className="text-xs text-muted-foreground">{cat.blurb}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cat.apps.map((a) => (
                  <Link
                    key={a.path}
                    to={a.path}
                    className="group rounded-md border p-4 transition-all hover:border-muted-foreground/40 hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2">
                      <Icon icon={a.icon} size={15} className="text-muted-foreground group-hover:text-foreground" />
                      <span className="text-sm font-medium">{a.label}</span>
                      {a.decisionsBadge && pendingDecisions > 0 && (
                        <Tag minimal intent={Intent.PRIMARY} className="!text-[10px] ml-auto">
                          {pendingDecisions > 99 ? '99+' : String(pendingDecisions)}
                        </Tag>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{a.desc}</p>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          {promoted.length > 0 && (
            <div className="pt-2 border-t space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">Built here</h2>
                  <span className="text-xs text-muted-foreground">
                    Applications assembled in this organization and published to the portal.
                  </span>
                </div>
                {allTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 justify-end">
                    {allTags.map((t) => (
                      <Button key={t} size="small" variant="minimal"
                        active={tagFilter === t} text={t}
                        onClick={() => { setTagFilter(tagFilter === t ? null : t) }} />
                    ))}
                  </div>
                )}
              </div>

              {collections.map(([apiName, meta]) => (
                <section key={apiName}>
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {meta.title}
                  </h3>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {shown.filter((a) => a.collectionApiName === apiName)
                      .map((a) => <PromotedCard key={a.promotionId} app={a} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PromotedCard({ app }: { app: PromotedApp }) {
  // The portal serves the PINNED version. When the module has moved past it that
  // is worth seeing — a promotion is a release, and a stale one is a decision
  // nobody has made yet.
  const behind = app.moduleVersion > app.publishedVersion

  return (
    <Link to={`/modules/${app.moduleApiName}`}
      className="group rounded-md border p-4 transition-all hover:border-muted-foreground/40 hover:bg-muted/40">
      <div className="flex items-center gap-2">
        <Icon icon={app.icon as IconName} size={15}
          className="text-muted-foreground group-hover:text-foreground" />
        <span className="text-sm font-medium">{app.name}</span>
        <Tag minimal className="!text-[10px] ml-auto">v{app.publishedVersion}</Tag>
      </div>
      {app.description && (
        <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{app.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-1 mt-2">
        {app.tags.map((t) => <Tag key={t} minimal className="!text-[10px]">{t}</Tag>)}
        {behind && (
          <Tag minimal intent={Intent.WARNING} className="!text-[10px]">
            v{app.moduleVersion} unpublished
          </Tag>
        )}
      </div>
      {app.ownerEmail && (
        <p className="text-[10px] text-muted-foreground mt-2">owner {app.ownerEmail}</p>
      )}
    </Link>
  )
}
