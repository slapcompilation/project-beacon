// Agent detail — blocks (with system prompts + I/O schema), declared toolset,
// numbered task prompt, recent run history. Read-only inspection surface.

import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Callout, Card, Icon, Intent, NonIdealState, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { ConfidenceBadge } from '@/features/agents/ConfidenceBadge'
import {
  describeSchema,
  getAgentDescriptor,
  getToolDescriptor,
  type AgentDescriptor,
  type SchemaField,
} from '@/features/agentStudio/registry'
import { useRecentProposalsForAgent, useCurrentAgentReleases, highestStageFor, type CurrentAgentRelease } from '@/features/agentStudio/hooks'
import type { BlockDef } from '@beacon/reality-graph'

export default function AgentDetailPage() {
  const { agentName = '' } = useParams<{ agentName: string }>()
  const navigate = useNavigate()
  const agent    = getAgentDescriptor(agentName)
  const { data: recent = [] } = useRecentProposalsForAgent(agentName, 10)
  const { data: releases = [] } = useCurrentAgentReleases()

  if (!agent) {
    return (
      <NonIdealState
        icon="search-template"
        title="Agent not found"
        description={`No descriptor registered for "${agentName}".`}
        action={<Button onClick={() => { void navigate('/agent-studio') }}>Back to Agent Studio</Button>}
      />
    )
  }

  const lastRun = recent.length > 0 ? recent[0] : null
  const dbRelease = highestStageFor(releases, agentName)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header agent={agent} dbRelease={dbRelease} lastRunAt={lastRun ? lastRun.created_at : null} lastRunStatus={lastRun ? lastRun.status : null} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <BlocksSection agent={agent} />
        <ToolsetSection agent={agent} />
        <TaskPromptSection prompt={agent.taskPrompt} />
        <RecentRunsSection agentName={agentName} rows={recent} />
        <EvalSection agent={agent} />
      </div>
    </div>
  )
}

function Header({ agent, dbRelease, lastRunAt, lastRunStatus }: { agent: AgentDescriptor; dbRelease: CurrentAgentRelease | undefined; lastRunAt: string | null; lastRunStatus: string | null }) {
  // DB ledger is the source of truth; the registry's static value is a default.
  const stage = dbRelease?.stage ?? agent.releaseStage
  const version = dbRelease?.version ?? agent.version
  const stageIntent =
    stage === 'production' ? Intent.SUCCESS :
    stage === 'staging'    ? Intent.WARNING :
    Intent.NONE
  const versionDrift = dbRelease != null && dbRelease.version !== agent.version

  const dot =
    !lastRunStatus              ? 'bg-muted-foreground/40' :
    lastRunStatus === 'approved' ? 'bg-emerald-500' :
    lastRunStatus === 'pending'  ? 'bg-amber-500'   :
    lastRunStatus === 'rejected' ? 'bg-red-500'     :
    'bg-muted-foreground/40'

  return (
    <header className="px-6 py-4 border-b shrink-0">
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <Link to="/agent-studio" className="text-xs text-muted-foreground hover:text-foreground">Agent Studio</Link>
        <Icon icon="chevron-right" size={10} className="text-muted-foreground" />
        <Icon icon="predictive-analysis" intent={Intent.PRIMARY} size={14} />
        <h1 className="text-sm font-semibold">{agent.name}</h1>
        <Tag minimal className="font-mono text-xs">@ {version}</Tag>
        <Tag minimal intent={stageIntent} icon="flag">{stage}</Tag>
        {versionDrift && (
          <Tag minimal intent={Intent.WARNING} icon="warning-sign" title={`Registry has v${agent.version} but the production release is v${dbRelease.version}`}>
            registry drift
          </Tag>
        )}
        <Tag minimal icon="people">{agent.scope}</Tag>
        <Tag minimal icon="time">{agent.cadence}</Tag>
        <Tag minimal icon="confirm">{agent.approvalBoundary}</Tag>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{agent.purpose}</p>
      <div className="flex items-center gap-4 mt-1 text-[11px] text-muted-foreground">
        <span>
          <Icon icon="cube" size={10} className="mr-1" />
          Invoked from: <span className="font-medium">{agent.invokeFrom}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          Last run {lastRunAt ? formatDistanceToNow(new Date(lastRunAt), { addSuffix: true }) : 'no runs yet'}
        </span>
      </div>
    </header>
  )
}

function BlocksSection({ agent }: { agent: AgentDescriptor }) {
  return (
    <Section title="Blocks" icon="layers" subtitle={`${String(agent.blocks.length)} sub-LLM block(s); execute in order`}>
      <div className="space-y-3">
        {agent.blocks.map((block, idx) => (
          <BlockCard key={block.name} block={block} idx={idx + 1} />
        ))}
      </div>
    </Section>
  )
}

function BlockCard({ block, idx }: { block: BlockDef<unknown, unknown>; idx: number }) {
  const inputs:  SchemaField[] = describeSchema(block.inputSchema)
  const outputs: SchemaField[] = describeSchema(block.outputSchema)
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <Tag minimal>{String(idx)}</Tag>
        <span className="text-sm font-semibold font-mono">{block.name}</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{block.systemPrompt}</p>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <SchemaList title="Input"  fields={inputs}  emptyHint="(no schema)" />
        <SchemaList title="Output" fields={outputs} emptyHint="(no schema)" />
      </div>
    </Card>
  )
}

function SchemaList({ title, fields, emptyHint }: { title: string; fields: SchemaField[]; emptyHint: string }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">{title}</h4>
      {fields.length === 0 ? (
        <span className="text-xs italic text-muted-foreground">{emptyHint}</span>
      ) : (
        <ul className="space-y-0.5">
          {fields.map((f) => (
            <li key={f.name} className="text-xs font-mono flex items-baseline gap-2">
              <span className="font-medium">{f.name}</span>
              <span className="text-muted-foreground">{f.type}{f.optional ? '?' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ToolsetSection({ agent }: { agent: AgentDescriptor }) {
  return (
    <Section title="Toolset" icon="function" subtitle={`${String(agent.toolset.length)} Logic Tool(s) the agent's blocks may invoke`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {agent.toolset.map((name) => {
          const tool = getToolDescriptor(name)
          return (
            <Link key={name} to={`/tools/${name}`}>
              <Card interactive className="flex flex-col gap-1 hover:bg-surface-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon icon="function" size={12} className="text-muted-foreground" />
                  <span className="text-xs font-mono font-semibold">{name}</span>
                  {tool && <Tag minimal intent={categoryIntent(tool.category)} className="text-[10px]">{tool.category}</Tag>}
                  {tool && <Tag minimal className="font-mono text-[10px]">@ {tool.version}</Tag>}
                </div>
                {tool && <p className="text-[11px] text-muted-foreground leading-snug">{tool.description}</p>}
                {!tool && <p className="text-[11px] italic text-muted-foreground">descriptor not found</p>}
              </Card>
            </Link>
          )
        })}
      </div>
    </Section>
  )
}

function TaskPromptSection({ prompt }: { prompt: string }) {
  return (
    <Section title="Task prompt" icon="manual" subtitle="The numbered procedure the reasoning block follows">
      <pre className="text-xs leading-relaxed whitespace-pre-wrap font-mono bg-surface-2 rounded p-3 border border-border/40">{prompt}</pre>
    </Section>
  )
}

function RecentRunsSection({ agentName, rows }: { agentName: string; rows: ReturnType<typeof useRecentProposalsForAgent>['data'] }) {
  return (
    <Section title="Recent runs" icon="history" subtitle="Last 10 proposals from this agent in the active hotel">
      {!rows || rows.length === 0 ? (
        <Callout intent={Intent.NONE} icon="info-sign">
          No proposals yet from <span className="font-mono">{agentName}</span> in this hotel. Trigger one from the variant page.
        </Callout>
      ) : (
        <div className="space-y-1.5">
          {rows.map((row) => (
            <Link key={row.id} to="/review-queue" className="block">
              <div className="flex items-center gap-3 p-2 rounded hover:bg-surface-2 border border-border/40">
                <Tag minimal intent={Intent.PRIMARY} className="font-mono text-[10px]">{row.action_type}</Tag>
                <ConfidenceBadge confidence={row.confidence} />
                <Tag minimal intent={statusIntent(row.status)} className="text-[10px]">{row.status}</Tag>
                <span className="flex-1 text-[11px] text-muted-foreground truncate">{row.reasoning}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  )
}

function EvalSection({ agent }: { agent: AgentDescriptor }) {
  return (
    <Section title="Evaluation" icon="confirm" subtitle="Vitest case file colocated with the agent">
      <Card className="text-xs space-y-2">
        <div className="font-mono text-[11px] text-muted-foreground">{agent.evalFile}</div>
        <div className="text-muted-foreground">
          Run locally with <code className="bg-surface-2 px-1 py-0.5 rounded">pnpm --filter @beacon/reality-graph test</code>.
          The promotion gate (block <span className="font-mono">production</span> stage on red eval) lands with the Modeling Objectives Studio.
        </div>
      </Card>
    </Section>
  )
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function Section({ title, icon, subtitle, children }: { title: string; icon: 'layers' | 'function' | 'manual' | 'history' | 'confirm'; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-1.5 ml-6">{subtitle}</p>
      {children}
    </section>
  )
}

function categoryIntent(category: string): Intent {
  switch (category) {
    case 'data':       return Intent.PRIMARY
    case 'logic':      return Intent.SUCCESS
    case 'search':     return Intent.WARNING
    case 'mutation':   return Intent.DANGER
    case 'predefined': return Intent.NONE
    case 'utility':    return Intent.NONE
    case 'ui-control': return Intent.NONE
    default:           return Intent.NONE
  }
}

function statusIntent(status: string): Intent {
  switch (status) {
    case 'pending':    return Intent.WARNING
    case 'approved':   return Intent.SUCCESS
    case 'rejected':   return Intent.DANGER
    case 'superseded': return Intent.NONE
    default:           return Intent.NONE
  }
}
