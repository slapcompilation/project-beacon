// Agent Studio (read-only) — every registered agent with its declared shape
// (blocks, tools, scope, cadence, stage) and live proposal stats. Dense cards:
// one inline meta line, run stats only when there are runs.

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
      <header className="px-6 py-3 border-b shrink-0">
        <h1 className="text-sm font-semibold">Agent Studio</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Every registered agent — shape (blocks · tools · scope · cadence · stage) and live proposal stats.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {agentDescriptors.length === 0 ? (
          <NonIdealState icon="predictive-analysis" title="No agents registered" />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 items-start">
            {agentDescriptors.map((agent) => (
              <AgentCard key={agent.name} agent={agent} summary={summaryByName.get(agent.name)} />
            ))}
          </div>
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

  const hasRuns = !!summary && summary.totalRuns > 0
  const lastRun = summary?.lastRunAt ? formatDistanceToNow(new Date(summary.lastRunAt), { addSuffix: true }) : 'never run'
  const dot =
    summary?.lastRunStatus === 'approved' ? 'bg-emerald-500' :
    summary?.lastRunStatus === 'pending'  ? 'bg-amber-500'   :
    summary?.lastRunStatus === 'rejected' ? 'bg-red-500'     :
    'bg-muted-foreground/40'

  return (
    <Link to={`/agent-studio/${agent.name}`} className="block">
      <Card interactive className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <Icon icon="predictive-analysis" intent={Intent.PRIMARY} size={13} className="shrink-0" />
          <span className="text-[13px] font-semibold truncate">{agent.name}</span>
          <Tag minimal className="font-mono !text-[10px]">v{agent.version}</Tag>
          <span className="flex-1" />
          <Tag minimal intent={stageIntent} className="!text-[10px]">{agent.releaseStage}</Tag>
        </div>

        <p className="text-[11px] leading-snug text-muted-foreground line-clamp-2">{agent.purpose}</p>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
          <Bit n={agent.blocks.length} unit="blocks" />
          <Dot />
          <Bit n={agent.toolset.length} unit="tools" />
          <Dot />
          <span>{agent.scope}</span>
          <Dot />
          <span>{agent.cadence}</span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-1.5 text-[11px]">
          {hasRuns ? (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 tabular-nums">
              <span><b className="font-semibold text-foreground">{summary.totalRuns}</b> <span className="text-muted-foreground">runs</span></span>
              {summary.pending  > 0 && <span className="text-amber-600 dark:text-amber-400"><b>{summary.pending}</b> pending</span>}
              {summary.approved > 0 && <span className="text-emerald-600 dark:text-emerald-400"><b>{summary.approved}</b> ok</span>}
              {summary.rejected > 0 && <span className="text-red-600 dark:text-red-400"><b>{summary.rejected}</b> rej</span>}
              <span className="text-muted-foreground">{Math.round(summary.avgConfidence * 100)}% conf</span>
            </div>
          ) : (
            <span className="text-muted-foreground">No runs yet</span>
          )}
          <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', dot)} />
            {lastRun}
          </span>
        </div>

        <p className="truncate text-[10px] text-muted-foreground/70">↳ {agent.invokeFrom}</p>
      </Card>
    </Link>
  )
}

function Bit({ n, unit }: { n: number; unit: string }) {
  return <span className="tabular-nums"><b className="font-semibold text-foreground">{n}</b> {unit}</span>
}
function Dot() {
  return <span className="opacity-40">·</span>
}
