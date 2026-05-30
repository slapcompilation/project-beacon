// Mind Command — the intelligent landing for the AIP module.
// Answers "what needs me now?" before the operator hunts: ranked open
// decisions (queue + approvals + cases), what the autonomous loop has been
// doing, and live agent health. Every card jumps to the relevant rail tab.

import { useMemo } from 'react'
import { Button, Card, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePendingProposals, bandByConfidence } from '@/features/agents/useReviewQueue'
import { usePendingApprovals } from '@/features/pendingApprovals/hooks'
import { useCases } from '@/features/cases/hooks'
import { useCronHealthSummary, useAgentCycleHistory } from '@/features/monitor/hooks'
import { useAgentRunSummaries } from '@/features/agentStudio/hooks'
import { useRestockCycle, type CycleResult } from '@/features/agents/useRestockCycle'
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

  const cycle = useRestockCycle()
  const runCycle = () => {
    cycle.mutate(undefined, {
      onSuccess: (r) => {
        toast.success(`Cycle: ${String(r.scanned)} scanned · ${String(r.autoExecuted)} auto-executed · ${String(r.queued)} queued`)
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Command</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {totalOpen === 0
                ? 'All clear — no open decisions. The autonomous loop is running below.'
                : `${String(totalOpen)} item${totalOpen === 1 ? '' : 's'} need your attention.`}
            </p>
          </div>
          <Button
            icon="play"
            intent={Intent.PRIMARY}
            loading={cycle.isPending}
            onClick={runCycle}
            title="Scan at-risk stock, run the restock advisor on each, auto-execute confident proposals, queue the rest"
          >
            Run cycle
          </Button>
        </header>

        {cycle.data && <CycleSummary result={cycle.data} onNavigate={onNavigate} />}

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

        {/* Agent cycle history — what the cron did overnight */}
        <AgentCycleHistory onNavigate={onNavigate} />
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

function AgentCycleHistory({ onNavigate }: { onNavigate: (tab: AipTab) => void }) {
  const { data, isLoading, isError } = useAgentCycleHistory(5)

  if (isLoading) {
    return (
      <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading agent cycle history…
      </Card>
    )
  }
  if (isError || !data) {
    return (
      <Card compact className="text-xs text-muted-foreground">
        Agent cycle history unavailable for this role.
      </Card>
    )
  }

  const runs = data.runs
  const queuedTotal = runs.reduce((s, r) => s + r.queued, 0)

  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="history" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Agent cycles · last {String(runs.length || 5)}
          </span>
        </div>
        {queuedTotal > 0 ? (
          <button type="button" onClick={() => { onNavigate('queue') }} className="text-[11px] text-primary hover:underline">
            Review {queuedTotal} queued →
          </button>
        ) : (
          <Tag minimal>Daily · 07:00 UTC</Tag>
        )}
      </div>
      {runs.length === 0 ? (
        <div className="px-4 py-4 text-xs text-muted-foreground space-y-1">
          <p>No agent cycles recorded yet.</p>
          <p>The <code className="text-[10px]">beacon-agent-intelligence-cycle</code> cron runs daily at 07:00 UTC, scanning every hotel for at-risk stock and routing each proposal through <code className="text-[10px]">decideAutoExecution</code>.</p>
        </div>
      ) : (
        <ul className="divide-y">
          {runs.map((r) => (
            <li key={r.ran_at} className="px-4 py-2.5 text-xs flex items-center gap-3">
              <span className="text-muted-foreground tabular-nums shrink-0 w-32">
                {formatDistanceToNow(new Date(r.ran_at), { addSuffix: true })}
              </span>
              <span className="flex-1 flex items-center gap-3">
                <CycleStat icon="tick-circle" label="auto" value={r.auto_executed} intent={r.auto_executed > 0 ? 'success' : 'muted'} />
                <CycleStat icon="time" label="queued" value={r.queued} intent={r.queued > 0 ? 'warning' : 'muted'} />
                <span className="text-muted-foreground/70">
                  across {r.hotels.length} hotel{r.hotels.length === 1 ? '' : 's'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function CycleStat({ icon, label, value, intent }: { icon: IconName; label: string; value: number; intent: 'success' | 'warning' | 'muted' }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 tabular-nums',
      intent === 'success' && 'text-emerald-600 dark:text-emerald-400',
      intent === 'warning' && 'text-amber-600 dark:text-amber-400',
      intent === 'muted'   && 'text-muted-foreground',
    )}>
      <Icon icon={icon} size={11} />
      <span className="font-semibold">{value}</span>
      <span className="text-[10px] uppercase tracking-wide">{label}</span>
    </span>
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

function CycleSummary({ result, onNavigate }: { result: CycleResult; onNavigate: (tab: AipTab) => void }) {
  const acted = result.items.filter((i) => i.outcome === 'auto-executed' || i.outcome === 'queued')
  return (
    <Card compact className="!p-0 overflow-hidden border-l-2 border-l-primary">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="pulse" size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Last cycle · {formatDistanceToNow(new Date(result.ranAt), { addSuffix: true })}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {result.scanned} scanned · <span className="text-emerald-600 dark:text-emerald-400">{result.autoExecuted} auto</span> · <span className="text-amber-600 dark:text-amber-400">{result.queued} queued</span>
        </span>
      </div>
      {acted.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          No action needed — every scanned variant is adequately covered.
        </p>
      ) : (
        <div className="divide-y max-h-56 overflow-y-auto">
          {acted.map((i) => (
            <div key={`${i.variantId}-${i.proposalId ?? ''}`} className="flex items-center gap-2 px-4 py-2 text-xs">
              <Tag
                minimal
                intent={i.outcome === 'auto-executed' ? Intent.SUCCESS : Intent.WARNING}
                className="!text-[10px]"
              >
                {i.outcome === 'auto-executed' ? 'auto' : 'queued'}
              </Tag>
              <span className="flex-1 truncate">{i.variantName}</span>
              {i.actionType && <span className="font-mono text-[10px] text-muted-foreground">{i.actionType}</span>}
            </div>
          ))}
        </div>
      )}
      {result.queued > 0 && (
        <button
          type="button"
          onClick={() => { onNavigate('queue') }}
          className="w-full text-left px-4 py-2 text-[11px] text-primary hover:bg-muted/30 transition-colors border-t"
        >
          Review {result.queued} queued proposal{result.queued === 1 ? '' : 's'} →
        </button>
      )}
    </Card>
  )
}
