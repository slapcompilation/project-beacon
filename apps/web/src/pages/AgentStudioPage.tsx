// Agent Studio (read-only) — lists every registered agent with its declared
// scope, cadence, toolset count, block count, release stage, and operational
// stats from the proposals table.

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Card, Icon, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { agentDescriptors, type AgentDescriptor } from '@/features/agentStudio/registry'
import { useAgentRunSummaries, type AgentRecentRunsSummary } from '@/features/agentStudio/hooks'

export default function AgentStudioPage() {
  const { data: summaries = [] } = useAgentRunSummaries()
  const summaryByName = useMemo(() => {
    const m = new Map<string, AgentRecentRunsSummary>()
    for (const s of summaries) m.set(s.agentName, s)
    return m
  }, [summaries])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-4 border-b shrink-0">
        <h1 className="text-sm font-semibold">Agent Studio</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every registered agent — scope, cadence, toolset, blocks, release stage, and live operational stats from the proposals table.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        {agentDescriptors.length === 0 ? (
          <NonIdealState icon="predictive-analysis" title="No agents registered" />
        ) : (
          agentDescriptors.map((agent) => (
            <AgentCard
              key={agent.name}
              agent={agent}
              summary={summaryByName.get(agent.name)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function AgentCard({ agent, summary }: { agent: AgentDescriptor; summary?: AgentRecentRunsSummary }) {
  const stageIntent =
    agent.releaseStage === 'production' ? Intent.SUCCESS :
    agent.releaseStage === 'staging'    ? Intent.WARNING :
    Intent.NONE

  return (
    <Link to={`/agent-studio/${agent.name}`} className="block">
      <Card interactive className="flex flex-col gap-3 h-full">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon icon="predictive-analysis" intent={Intent.PRIMARY} size={14} />
            <span className="text-sm font-semibold">{agent.name}</span>
            <Tag minimal className="font-mono text-xs">@ {agent.version}</Tag>
          </div>
          <Tag minimal intent={stageIntent} icon="flag">{agent.releaseStage}</Tag>
        </header>

        <p className="text-xs text-muted-foreground leading-relaxed">{agent.purpose}</p>

        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat label="Blocks"  value={agent.blocks.length} />
          <Stat label="Tools"   value={agent.toolset.length} />
          <Stat label="Scope"   value={agent.scope} />
          <Stat label="Cadence" value={agent.cadence} />
        </div>

        <div className="border-t border-border/40 pt-2 grid grid-cols-5 gap-2 text-center">
          <Stat label="Runs"      value={summary?.totalRuns    ?? '—'} />
          <Stat label="Pending"   value={summary?.pending      ?? '—'} intent={summary?.pending ? Intent.WARNING : undefined} />
          <Stat label="Approved"  value={summary?.approved     ?? '—'} intent={summary?.approved ? Intent.SUCCESS : undefined} />
          <Stat label="Rejected"  value={summary?.rejected     ?? '—'} />
          <Stat label="Avg conf." value={summary && summary.totalRuns > 0 ? `${String(Math.round(summary.avgConfidence * 100))}%` : '—'} />
        </div>

        <CycleStrip agent={agent} summary={summary} />

        <footer className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Icon icon="cube" size={10} />
          <span>Invoked from: {agent.invokeFrom}</span>
        </footer>
      </Card>
    </Link>
  )
}

function CycleStrip({ agent, summary }: { agent: AgentDescriptor; summary?: AgentRecentRunsSummary }) {
  const lastRun = summary?.lastRunAt
    ? formatDistanceToNow(new Date(summary.lastRunAt), { addSuffix: true })
    : 'no runs yet'
  const dot =
    !summary?.lastRunStatus     ? 'bg-muted-foreground/40' :
    summary.lastRunStatus === 'approved'  ? 'bg-emerald-500' :
    summary.lastRunStatus === 'pending'   ? 'bg-amber-500'   :
    summary.lastRunStatus === 'rejected'  ? 'bg-red-500'     :
    'bg-muted-foreground/40'
  return (
    <div className="flex items-center gap-2 text-[11px] border-y border-border/40 py-1.5">
      <Icon icon="time" size={11} className="text-muted-foreground" />
      <span className="text-muted-foreground">Cadence</span>
      <Tag minimal className="font-mono">{agent.cadence}</Tag>
      <span className="flex-1" />
      <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
      <span className="text-muted-foreground">Last run {lastRun}</span>
    </div>
  )
}

function Stat({ label, value, intent }: { label: string; value: string | number; intent?: Intent }) {
  return (
    <div className={cn('flex flex-col')}>
      <span className={cn(
        'text-sm font-semibold tabular-nums',
        intent === Intent.SUCCESS && 'text-emerald-600 dark:text-emerald-400',
        intent === Intent.WARNING && 'text-amber-600 dark:text-amber-400',
        intent === Intent.DANGER  && 'text-red-600 dark:text-red-400',
      )}>{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  )
}
