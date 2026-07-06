// The canonical Object View skeleton (CLAUDE.md anatomy + AIP-UX-RESTRUCTURE
// §0.5, grounded in aip-reference/application-sidebar-object-view.png):
// header → metric strip → action bar → body sections | right rail.
// Every object page renders through this frame so the anatomy can't drift —
// pages fill slots, they don't rebuild the layout.

import type { ComponentProps, ReactNode } from 'react'
import { ObjectHeaderBand } from './ObjectHeaderBand'
import { MetricStrip } from './MetricStrip'

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
