// P1 of the AIP-native OPERATE arc: the inline affordance that puts the agent's
// take ON a list row. Aggregates the per-variant signals for a row's variants
// (a product has several) and, on click, opens that item's intelligence in the
// ContextPanel slide-over — inline, no navigation. Renders nothing when the row
// has no signal, so a quiet list stays quiet.

import { Icon, Intent, Tag } from '@blueprintjs/core'
import { useAppStore } from '@/stores/app.store'
import type { VariantSignalMap } from './useVariantSignals'

export function AipRowBadge({ signalMap, variantIds }: { signalMap: VariantSignalMap; variantIds: string[] }) {
  const openEntityContext = useAppStore((s) => s.openEntityContext)

  let proposals = 0
  let approvals = 0
  let hasCase = false
  let openVid: string | null = null       // the variant to inspect on click
  for (const id of variantIds) {
    const s = signalMap.get(id)
    if (!s?.hasSignal) continue
    proposals += s.openProposals
    approvals += s.pendingApprovals
    hasCase = hasCase || s.openCaseId != null
    // prefer to open the one with a proposal; else the first signalled
    if (!openVid || s.openProposals > 0) openVid = id
  }
  if (!openVid) return null

  const vid = openVid
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); openEntityContext('variant', vid) }}
      className="inline-flex items-center gap-1"
      title="The agent has a take on this item — open its intelligence"
    >
      {proposals > 0 && (
        <Tag minimal intent={Intent.PRIMARY} icon="predictive-analysis" interactive className="!text-[10px]">
          {proposals} proposal{proposals === 1 ? '' : 's'}
        </Tag>
      )}
      {approvals > 0 && (
        <Tag minimal intent={Intent.WARNING} icon="warning-sign" interactive className="!text-[10px]">
          {approvals} awaiting you
        </Tag>
      )}
      {hasCase && proposals === 0 && approvals === 0 && (
        <Tag minimal icon="folder-open" interactive className="!text-[10px]">case open</Tag>
      )}
      <Icon icon="chevron-right" size={10} className="text-muted-foreground/50" />
    </button>
  )
}
