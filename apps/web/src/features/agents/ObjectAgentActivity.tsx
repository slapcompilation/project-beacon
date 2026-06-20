// The AIP intelligence panel for an Object View: the agent's recent decisions
// on this object + (for a single variant) the open Case wrapping them. Same
// component on every object so intelligence is a uniform property of the
// ontology, not a bespoke per-page block.
//
// Keyed by variantId(s) because every BeaconAction carries variantId — the one
// link that always has data (supplier/PO payload links are 0% populated, see
// ROADMAP L1). So a Supplier/PO surfaces decisions across *its variants* (the
// items it supplies / the order's lines), which is the link that resolves.

import { Card, Icon, Intent, Tag } from '@blueprintjs/core'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { fetchOpenCaseForVariant } from '@/features/cases/api'

interface VariantProposalRow {
  id:          string
  agent_name:  string
  action_type: string
  confidence:  number
  reasoning:   string
  status:      'pending' | 'approved' | 'rejected' | 'superseded' | 'expired'
  created_at:  string
}

async function fetchProposalsForVariants(variantIds: string[]): Promise<VariantProposalRow[]> {
  if (variantIds.length === 0) return []
  // Every BeaconAction targeting a variant carries variantId in action_payload.
  const { data, error } = await supabase
    .from('proposals')
    .select('id, agent_name, action_type, confidence, reasoning, status, created_at')
    .in('action_payload->>variantId', variantIds)
    .order('created_at', { ascending: false })
    .limit(8) as unknown as { data: VariantProposalRow[] | null; error: { message: string } | null }
  if (error) throw new Error(error.message)
  return data ?? []
}

export function ObjectAgentActivity({
  variantIds, hotelId, emptyHint, title,
}: {
  /** One id (Variant/Restock) or many (a Supplier's items / a PO's lines). */
  variantIds: string[]
  hotelId?: string
  /** Shown when no proposals exist yet — tailor the nudge to the host object. */
  emptyHint?: string
  /** Header override; defaults to "Agent Decisions". */
  title?: string
}) {
  const ids = variantIds.filter(Boolean)
  // The open-Case link only makes sense for a single variant.
  const single = ids.length === 1 ? ids[0] : null

  const { data: proposals = [], isLoading } = useQuery({
    queryKey:  ['object-proposals', ids],
    queryFn:   () => fetchProposalsForVariants(ids),
    enabled:   ids.length > 0,
    staleTime: 30_000,
  })

  const { data: openCase } = useQuery({
    queryKey:  ['variant-open-case', single, hotelId],
    queryFn:   () => fetchOpenCaseForVariant(hotelId ?? '', single ?? ''),
    enabled:   !!single && !!hotelId,
    staleTime: 30_000,
  })

  if (isLoading) return null

  return (
    <Card compact className="!p-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title ?? 'Agent Decisions'} ({proposals.length})
        </span>
        <div className="flex items-center gap-3">
          {openCase && (
            <Link
              to={`/cases/${openCase.id}`}
              className="text-xs text-violet-500 hover:underline inline-flex items-center gap-1"
              title={openCase.title}
            >
              <Icon icon="folder-open" size={11} /> Open case →
            </Link>
          )}
          <Link to="/mind?aip=queue" className="text-xs text-primary hover:underline">
            Review queue →
          </Link>
        </div>
      </div>
      {proposals.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">
          {emptyHint ?? 'No agent decisions on this item yet. Once stock drops below its reorder point, the agent proposes here.'}
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {proposals.map((p) => <AgentDecisionRow key={p.id} p={p} />)}
        </div>
      )}
    </Card>
  )
}

function AgentDecisionRow({ p }: { p: VariantProposalRow }) {
  const dot =
    p.confidence >= 0.85 ? 'bg-emerald-500' :
    p.confidence >= 0.6  ? 'bg-amber-400'   : 'bg-red-500'
  const statusIntent: Record<VariantProposalRow['status'], Intent> = {
    pending:    Intent.WARNING,
    approved:   Intent.SUCCESS,
    rejected:   Intent.DANGER,
    superseded: Intent.NONE,
    expired:    Intent.NONE,
  }
  return (
    <Link to={`/proposals/${p.id}`} className="block px-3 py-2 text-xs hover:bg-surface-2 transition-colors">
      <div className="flex items-center gap-2">
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />
        <Tag minimal className="font-mono !text-[10px]">{p.action_type}</Tag>
        <span className="text-muted-foreground flex-1 truncate">{p.agent_name}</span>
        <span className="tabular-nums text-muted-foreground shrink-0">{Math.round(p.confidence * 100)}%</span>
        <Tag minimal intent={statusIntent[p.status]} className="!text-[10px]">{p.status}</Tag>
        <span className="text-[10px] text-muted-foreground/70 shrink-0">
          {formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}
        </span>
      </div>
      {p.reasoning && (
        <div className="mt-1 ml-3.5 text-[11px] text-muted-foreground/80 line-clamp-2">{p.reasoning}</div>
      )}
    </Link>
  )
}
