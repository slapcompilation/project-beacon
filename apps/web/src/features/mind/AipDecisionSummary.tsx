// The AIP "needs you now" decision summary: open Review Queue + Pending
// Approvals + Cases, with the single count that tells an operator whether the
// autonomous loop left anything for them. One component, two homes —
// Canvas/Briefing (owner cockpit, deep-links into Mind) and Mind → Command (the
// in-module landing). Keeps a single source of truth for "what needs me".

import { useMemo } from 'react'
import { Icon, Intent } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { usePendingProposals, bandByConfidence } from '@/features/agents/useReviewQueue'
import { usePendingApprovals } from '@/features/pendingApprovals/hooks'
import { useCases } from '@/features/cases/hooks'
import type { AipTab } from './AIPShell'

interface DecisionCard {
  tab: AipTab; label: string; icon: IconName; count: number; sub: string; intent: Intent
}

/** Shared computation so Canvas and Command can't drift on what "open" means. */
export function useAipDecisionCards(): { cards: DecisionCard[]; totalOpen: number } {
  const queue     = usePendingProposals()
  const approvals = usePendingApprovals()
  const cases     = useCases('open')

  const proposals = useMemo(() => queue.data ?? [], [queue.data])
  const bands     = useMemo(() => bandByConfidence(proposals), [proposals])

  const cards: DecisionCard[] = [
    {
      tab: 'queue', label: 'Review Queue', icon: 'predictive-analysis',
      count: proposals.length,
      sub: proposals.length === 0 ? 'No pending proposals'
        : `${String(bands.red.length)} red · ${String(bands.yellow.length)} yellow · ${String(bands.green.length)} green`,
      intent: bands.red.length > 0 ? Intent.DANGER : proposals.length > 0 ? Intent.PRIMARY : Intent.NONE,
    },
    {
      tab: 'approvals', label: 'Pending Approvals', icon: 'warning-sign',
      count: approvals.data?.length ?? 0,
      sub: (approvals.data?.length ?? 0) === 0 ? 'Nothing awaiting sign-off' : 'Awaiting your approval',
      intent: (approvals.data?.length ?? 0) > 0 ? Intent.WARNING : Intent.NONE,
    },
    {
      tab: 'cases', label: 'Open Cases', icon: 'folder-open',
      count: cases.data?.length ?? 0,
      sub: (cases.data?.length ?? 0) === 0 ? 'No open investigations' : 'In progress',
      intent: (cases.data?.length ?? 0) > 0 ? Intent.PRIMARY : Intent.NONE,
    },
  ]
  return { cards, totalOpen: cards.reduce((s, c) => s + c.count, 0) }
}

function accentClass(card: DecisionCard): string {
  if (card.count === 0) return ''
  if (card.intent === Intent.DANGER)  return 'border-l-2 border-l-red-500'
  if (card.intent === Intent.WARNING) return 'border-l-2 border-l-amber-400'
  if (card.intent === Intent.PRIMARY) return 'border-l-2 border-l-primary'
  return ''
}

function Tile({ card, onNavigate }: { card: DecisionCard; onNavigate?: (tab: AipTab) => void }) {
  const body = (
    <>
      <div className="flex items-center gap-2">
        <Icon icon={card.icon} size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium">{card.label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums mt-1">{card.count}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{card.sub}</p>
    </>
  )
  const cls = cn(
    'text-left rounded-md border p-4 transition-all hover:border-muted-foreground/40 hover:bg-muted/40 block',
    accentClass(card),
  )
  // In Mind we drive the rail directly; on Canvas we deep-link into the module.
  return onNavigate
    ? <button type="button" onClick={() => { onNavigate(card.tab) }} className={cls}>{body}</button>
    : <Link to={`/mind?aip=${card.tab}`} className={cls}>{body}</Link>
}

export function AipDecisionSummary({
  onNavigate, heading = true,
}: {
  /** When set, drives the Mind rail in place (Command). Absent ⇒ deep-links to Mind (Canvas). */
  onNavigate?: (tab: AipTab) => void
  heading?: boolean
}) {
  const { cards } = useAipDecisionCards()
  return (
    <section className="space-y-2">
      {heading && (
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Needs you now</h2>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((c) => <Tile key={c.tab} card={c} onNavigate={onNavigate} />)}
      </div>
    </section>
  )
}
