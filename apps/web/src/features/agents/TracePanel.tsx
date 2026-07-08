// Renders an AgentRunTrace. Same component for dev debugging and operator slide-over.
// A proposal without a viewable trace is a defect.

import { useState } from 'react'
import { Icon, type IconName, Intent, Tag } from '@blueprintjs/core'
import type { AgentRunTrace, AgentRunStep } from '@beacon/reality-graph'
import { cn } from '@/lib/utils'

interface TracePanelProps {
  trace: AgentRunTrace
  className?: string
}

export function TracePanel({ trace, className }: TracePanelProps) {
  const durationMs = trace.endedAt.getTime() - trace.startedAt.getTime()
  return (
    <div className={cn('flex flex-col gap-3 text-xs', className)}>
      <header className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Icon icon="diagram-tree" size={14} className="text-muted-foreground" />
          <span className="font-semibold">{trace.agentName}</span>
          <Tag minimal>v{trace.agentVersion}</Tag>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{trace.steps.length} steps</span>
          <span>{String(trace.totalTokensUsed)} tokens</span>
          <span>{String(durationMs)}ms</span>
        </div>
      </header>

      <ol className="flex flex-col gap-1.5">
        {groupByBlock(trace.steps).map(({ blockName, steps }) => (
          <BlockGroup key={blockName + String(steps[0]?.index ?? 0)} blockName={blockName} steps={steps} />
        ))}
      </ol>
    </div>
  )
}

interface BlockGroupProps {
  blockName: string
  steps: AgentRunStep[]
}

function BlockGroup({ blockName, steps }: BlockGroupProps) {
  return (
    <li className="rounded border border-border/60 bg-surface-1">
      <div className="border-b border-border/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {blockName}
      </div>
      <ul className="divide-y divide-border/30">
        {steps.map((s) => (
          <StepRow key={s.index} step={s} />
        ))}
      </ul>
    </li>
  )
}

function StepRow({ step }: { step: AgentRunStep }) {
  const [open, setOpen] = useState(false)
  const hasDetail = step.input !== undefined || step.output !== undefined || step.thought !== undefined
  const { icon, label, intent } = describeStep(step)

  return (
    <li>
      <button
        type="button"
        onClick={() => { if (hasDetail) setOpen((v) => !v) }}
        className={cn(
          'flex w-full items-center gap-2 px-2 py-1 text-left transition-colors',
          hasDetail && 'hover:bg-surface-2 cursor-pointer',
          !hasDetail && 'cursor-default',
        )}
      >
        <span className="w-6 font-mono text-[10px] text-muted-foreground/60">
          {String(step.index).padStart(2, '0')}
        </span>
        <Icon icon={icon} size={12} intent={intent} />
        <span className="flex-1 truncate">{label}</span>
        {step.durationMs !== undefined && (
          <span className="text-[10px] text-muted-foreground/60">{fmtDuration(step.durationMs)}</span>
        )}
        {hasDetail && (
          <Icon icon={open ? 'chevron-down' : 'chevron-right'} size={10} className="text-muted-foreground/50" />
        )}
      </button>

      {/* AIP-debugger signature: the tool-use step shows its Thought and the
          running token budget inline, no expansion needed. */}
      {step.type === 'llm_tool_use' && (step.thought ?? step.tokens) && (
        <div className="px-8 pb-1.5 space-y-1">
          {step.thought && !open && (
            <p className="text-[10px] text-muted-foreground line-clamp-2">Thought: {step.thought}</p>
          )}
          {step.tokens && <TokenBudget used={step.tokens.used} window={step.tokens.window} />}
        </div>
      )}

      {open && hasDetail && (
        <div className="space-y-1 border-t border-border/30 bg-surface-0 px-3 py-2 text-[10px]">
          {step.thought && (
            <DetailRow label="thought" value={step.thought} />
          )}
          {step.input !== undefined && (
            <DetailRow label="input" value={formatJson(step.input)} />
          )}
          {step.output !== undefined && (
            <DetailRow label="output" value={formatJson(step.output)} />
          )}
        </div>
      )}
    </li>
  )
}

function TokenBudget({ used, window: win }: { used: number; window: number }) {
  const pct = Math.min(100, (used / win) * 100)
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] tabular-nums text-muted-foreground/70">
        {used.toLocaleString()} of {win.toLocaleString()} tokens
      </span>
      <div className="h-1 w-24 rounded-full bg-border overflow-hidden">
        <div
          className={cn('h-full rounded-full', pct < 70 ? 'bg-emerald-500' : pct < 90 ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${String(pct)}%` }}
        />
      </div>
    </div>
  )
}

function fmtDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${String(ms)}ms`
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-12 flex-shrink-0 font-semibold uppercase text-muted-foreground/60">{label}</span>
      <pre className="flex-1 whitespace-pre-wrap break-words font-mono text-muted-foreground">{value}</pre>
    </div>
  )
}

function describeStep(step: AgentRunStep): { icon: IconName; label: string; intent: Intent } {
  switch (step.type) {
    case 'system_prompt':
      return { icon: 'cog', label: 'System prompt', intent: Intent.NONE }
    case 'task_prompt':
      return { icon: 'document', label: 'Task prompt', intent: Intent.NONE }
    case 'llm_tool_use':
      return { icon: 'play', label: `→ ${step.toolName ?? 'tool'}`, intent: Intent.PRIMARY }
    case 'tool_response':
      return { icon: 'tick-circle', label: `← ${step.toolName ?? 'tool'}`, intent: Intent.SUCCESS }
    case 'llm_output':
      return { icon: 'comment', label: 'Block output', intent: Intent.NONE }
    case 'exited_block':
      return { icon: 'arrow-right', label: `Exited block → ${step.blockName}`, intent: Intent.NONE }
    case 'request_clarification':
      return { icon: 'help', label: 'Clarification requested', intent: Intent.WARNING }
  }
}

function groupByBlock(steps: ReadonlyArray<AgentRunStep>): { blockName: string; steps: AgentRunStep[] }[] {
  const groups: { blockName: string; steps: AgentRunStep[] }[] = []
  for (const step of steps) {
    const last = groups.length > 0 ? groups[groups.length - 1] : undefined
    if (last && last.blockName === step.blockName) {
      last.steps.push(step)
    } else {
      groups.push({ blockName: step.blockName, steps: [step] })
    }
  }
  return groups
}

function formatJson(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}
