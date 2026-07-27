// Agent Studio — agents you authored first, then every shipped agent with its
// declared shape (blocks, tools, scope, cadence, stage) and live proposal stats.
// Dense cards: one inline meta line, run stats only when there are runs.
//
// An authored agent is the same shape expressed as data. It compiles to the same
// prompts, runs on the same runtime, and passes the same gates.

import { useMemo, useState } from 'react'
import { Button, Icon, Intent, NonIdealState, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { EntityCard, Bit, Dot } from '@/components/EntityCard'
import { agentDescriptors, type AgentDescriptor } from '@/features/agentStudio/registry'
import { useAgentRunSummaries, type AgentRecentRunsSummary } from '@/features/agentStudio/hooks'
import AgentComposer from '@/features/userAgents/AgentComposer'
import AuthoredAgents from '@/features/userAgents/AuthoredAgents'

export default function AgentStudioPage() {
  const [composing, setComposing] = useState(false)
  const { data: summaries = [] } = useAgentRunSummaries()
  const summaryByName = useMemo(() => {
    const m = new Map<string, AgentRecentRunsSummary>()
    for (const s of summaries) m.set(s.agentName, s)
    return m
  }, [summaries])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="px-6 py-3 border-b shrink-0 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-sm font-semibold">Agent Studio</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agents you authored, then every shipped agent — shape (blocks · tools · scope · cadence · stage) and live proposal stats.
          </p>
        </div>
        <Button size="small" intent={Intent.PRIMARY} icon="add" onClick={() => { setComposing(true) }}>New agent</Button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {composing && <AgentComposer onDone={() => { setComposing(false) }} />}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Icon icon="build" size={12} /> Your agents
          </h2>
          <AuthoredAgents onCompose={() => { setComposing(true) }} />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Icon icon="cube" size={12} /> Shipped agents
          </h2>
        {agentDescriptors.length === 0 ? (
          <NonIdealState icon="predictive-analysis" title="No agents registered" />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3 items-start">
            {agentDescriptors.map((agent) => (
              <AgentCard key={agent.name} agent={agent} summary={summaryByName.get(agent.name)} />
            ))}
          </div>
        )}
        </section>
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
    <EntityCard
      to={`/agent-studio/${agent.name}`}
      icon="predictive-analysis"
      iconIntent={Intent.PRIMARY}
      title={agent.name}
      titleTag={<Tag minimal className="font-mono !text-[10px]">v{agent.version}</Tag>}
      stageTag={<Tag minimal intent={stageIntent} className="!text-[10px]">{agent.releaseStage}</Tag>}
      purpose={agent.purpose}
      meta={
        <>
          <Bit n={agent.blocks.length} unit="blocks" />
          <Dot />
          <Bit n={agent.toolset.length} unit="tools" />
          <Dot />
          <span>{agent.scope}</span>
          <Dot />
          <span>{agent.cadence}</span>
        </>
      }
      stats={
        <>
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
        </>
      }
      footer={<>↳ {agent.invokeFrom}</>}
    />
  )
}
