// Mind Command — the intelligent landing for the AIP module.
// Answers "what needs me now?" before the operator hunts: ranked open
// decisions (queue + approvals + cases), what the autonomous loop has been
// doing, and live agent health. Every card jumps to the relevant rail tab.

import { useMemo } from 'react'
import { Card, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { usePendingProposals, bandByConfidence } from '@/features/agents/useReviewQueue'
import { usePendingApprovals } from '@/features/pendingApprovals/hooks'
import { useCases } from '@/features/cases/hooks'
import { useCronHealthSummary } from '@/features/monitor/hooks'
import { useAgentRunSummaries } from '@/features/agentStudio/hooks'
import type { AipTab } from './AIPShell'

export function CommandHome({ onNavigate }: { onNavigate: (tab: AipTab) => void }) {
  const queue     = usePendingProposals()
  const approvals = usePendingApprovals()
  const cases     = useCases('open')

  const proposals = useMemo(() => queue.data ?? [], [queue.data])
  const bands = useMemo(() => bandByConfidence(proposals), [proposals])

  const decisionCards: {
    tab: AipTab; label: string; icon: IconName; count: number; sub: string; intent: Intent
  }[] = [
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

  const totalOpen = decisionCards.reduce((s, c) => s + c.count, 0)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Command</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalOpen === 0
              ? 'All clear — no open decisions. The autonomous loop is running below.'
              : `${String(totalOpen)} item${totalOpen === 1 ? '' : 's'} need your attention.`}
          </p>
        </header>

        {/* What needs you now */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Needs you now</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {decisionCards.map((c) => (
              <button
                key={c.tab}
                type="button"
                onClick={() => { onNavigate(c.tab) }}
                className={cn(
                  'text-left rounded-md border p-4 transition-all hover:border-muted-foreground/40 hover:bg-muted/40',
                  c.count > 0 && c.intent === Intent.DANGER  && 'border-l-2 border-l-red-500',
                  c.count > 0 && c.intent === Intent.WARNING && 'border-l-2 border-l-amber-400',
                  c.count > 0 && c.intent === Intent.PRIMARY && 'border-l-2 border-l-primary',
                )}
              >
                <div className="flex items-center gap-2">
                  <Icon icon={c.icon} size={14} className="text-muted-foreground" />
                  <span className="text-xs font-medium">{c.label}</span>
                </div>
                <p className="text-2xl font-bold tabular-nums mt-1">{c.count}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{c.sub}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Top of the queue — the highest-leverage open decisions */}
        {proposals.length > 0 && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top of the queue</h2>
              <button type="button" onClick={() => { onNavigate('queue') }} className="text-[11px] text-primary hover:underline">
                Open queue →
              </button>
            </div>
            <Card compact className="!p-0 divide-y">
              {[...bands.red, ...bands.yellow, ...bands.green].slice(0, 5).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onNavigate('queue') }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
                >
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    p.confidence >= 0.85 ? 'bg-emerald-500' : p.confidence >= 0.6 ? 'bg-amber-400' : 'bg-red-500',
                  )} />
                  <Tag minimal className="font-mono !text-[10px]">{p.action_type}</Tag>
                  <span className="text-xs text-muted-foreground flex-1 truncate">{p.agent_name}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">{Math.round(p.confidence * 100)}%</span>
                  <span className="text-[10px] text-muted-foreground/70 shrink-0">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</span>
                </button>
              ))}
            </Card>
          </section>
        )}

        {/* Autonomous loop — the system's pulse */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AutonomousPulse />
          <AgentHealth onNavigate={onNavigate} />
        </section>
      </div>
    </div>
  )
}

function AutonomousPulse() {
  const { data, isLoading, isError } = useCronHealthSummary()

  if (isLoading) {
    return (
      <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Checking autonomous loop…
      </Card>
    )
  }
  if (isError || !data) {
    return (
      <Card compact className="text-xs text-muted-foreground">
        Autonomous-loop status unavailable for this role.
      </Card>
    )
  }

  const cycle = data.jobs.find((j) => j.jobname === 'beacon-intelligence-cycle')
  const failing = data.jobs.filter((j) => j.consecutive_failures >= 2)
  const healthy = failing.length === 0 && data.open_critical === 0
  const lastRun = cycle?.last_run_at ? new Date(cycle.last_run_at) : null

  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="pulse" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Autonomous loop</span>
        </div>
        <Tag minimal intent={healthy ? Intent.SUCCESS : failing.length > 0 ? Intent.DANGER : Intent.WARNING}>
          {healthy ? 'Healthy' : failing.length > 0 ? `${String(failing.length)} failing` : 'Attention'}
        </Tag>
      </div>
      <div className="px-4 py-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Intelligence cycle</span>
          <span className="tabular-nums">{lastRun ? `ran ${formatDistanceToNow(lastRun, { addSuffix: true })}` : 'no runs yet'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Jobs tracked</span>
          <span className="tabular-nums">{data.jobs.length}</span>
        </div>
        {data.open_critical > 0 && (
          <div className="flex items-center justify-between text-red-600 dark:text-red-400">
            <span>Unacknowledged critical</span>
            <span className="tabular-nums font-semibold">{data.open_critical}</span>
          </div>
        )}
      </div>
    </Card>
  )
}

function AgentHealth({ onNavigate }: { onNavigate: (tab: AipTab) => void }) {
  const { data: summaries = [], isLoading } = useAgentRunSummaries()

  return (
    <Card compact className="!p-0 overflow-hidden">
      <button
        type="button"
        onClick={() => { onNavigate('agents') }}
        className="flex w-full items-center justify-between px-4 py-2.5 border-b bg-muted/20 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon icon="predictive-analysis" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Agent activity</span>
        </div>
        <Icon icon="chevron-right" size={12} className="text-muted-foreground" />
      </button>
      <div className="px-4 py-3 space-y-1.5 text-xs">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Spinner size={SpinnerSize.SMALL} />Loading…</div>
        ) : summaries.length === 0 ? (
          <p className="text-muted-foreground">No agent runs yet. Invoke one from a Variant page.</p>
        ) : (
          summaries.map((s) => (
            <div key={s.agentName} className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground flex-1 truncate">{s.agentName}</span>
              {s.pending > 0 && <Tag minimal intent={Intent.WARNING} className="!text-[10px]">{s.pending} pending</Tag>}
              <span className="tabular-nums text-muted-foreground/70">{s.totalRuns} run{s.totalRuns === 1 ? '' : 's'}</span>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
