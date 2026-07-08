// The canonical Object View skeleton (CLAUDE.md anatomy + AIP-UX-RESTRUCTURE
// §0.5, grounded in aip-reference/application-sidebar-object-view.png):
// header → metric strip → action bar → body sections | right rail.
// Every object page renders through this frame so the anatomy can't drift —
// pages fill slots, they don't rebuild the layout.

import type { ComponentProps, ReactNode } from 'react'
import { Icon } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import type { NodeType } from '@beacon/reality-graph'
import { ObjectHeaderBand } from './ObjectHeaderBand'
import { MetricStrip } from './MetricStrip'
import { AuditRail } from './AuditRail'

export function ObjectViewFrame({
  header, metrics, actions, rail, children,
}: {
  header: ComponentProps<typeof ObjectHeaderBand>
  /** <Metric …/> children for the strip; omit to skip the band. */
  metrics?: ReactNode
  /** Right-aligned action-bar buttons; omit to skip the band. */
  actions?: ReactNode
  /** Right rail — audit log last (§0.5); usually <AuditRail …/>. */
  rail?: ReactNode
  /** Body sections, rendered in the scrolling main column. */
  children: ReactNode
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ObjectHeaderBand {...header} />
      {metrics && <MetricStrip>{metrics}</MetricStrip>}
      {actions && (
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-b shrink-0 flex-wrap">
          {actions}
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-4 flex gap-4">
        <main className="flex-1 min-w-0 space-y-4">{children}</main>
        {rail}
      </div>
    </div>
  )
}

/** Grouped right rail (§0.5, mirroring Foundry's OV sidebar groups): optional
 *  groups on top — Pinned Actions, related lenses — with the audit log as the
 *  permanent last group. Use in the frame's `rail` slot instead of a bare
 *  <AuditRail/> when a page has rail content beyond audit. */
export function ObjectRail({ nodeType, nodeId, children }: {
  nodeType: NodeType
  nodeId: string
  children?: ReactNode
}) {
  return (
    <aside className="w-60 shrink-0 hidden lg:flex flex-col gap-4">
      {children}
      <AuditRail nodeType={nodeType} nodeId={nodeId} className="flex-1 min-h-0 flex flex-col" />
    </aside>
  )
}

export function RailGroup({ title, icon, children }: {
  title: string
  icon: IconName
  children: ReactNode
}) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-2">
        <Icon icon={icon} size={12} className="text-muted-foreground" />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </header>
      {children}
    </section>
  )
}
