// Phase G1 — vertical release timeline for one agent. Reads the full history
// from get_agent_release_history() (migration 153). Each row is one promotion
// event: stage, version, eval pass-rate at the time, released → superseded
// window. Current rows render with an "active" tag; superseded rows render
// muted with the supersede date.

import { Callout, Card, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { useAgentReleaseHistory, type AgentReleaseHistoryRow, type AgentReleaseStage } from './hooks'

export function ReleaseTimeline({ agentName }: { agentName: string }) {
  const { data: rows = [], isLoading, isError, error } = useAgentReleaseHistory(agentName)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
        <Spinner size={SpinnerSize.SMALL} />Loading release history…
      </div>
    )
  }
  if (isError) {
    return <Callout intent={Intent.WARNING} icon="warning-sign">{error.message}</Callout>
  }
  if (rows.length === 0) {
    return (
      <Callout intent={Intent.NONE} icon="info-sign">
        No releases recorded yet. The first call to <code>promote_agent</code> seeds the timeline.
      </Callout>
    )
  }

  // Newest first — operators want the current state at a glance.
  const ordered = rows.slice().reverse()

  return (
    <div className="space-y-1.5">
      {ordered.map((row) => <ReleaseRow key={row.id} row={row} />)}
    </div>
  )
}

function ReleaseRow({ row }: { row: AgentReleaseHistoryRow }) {
  const stageIntent = stageIntentOf(row.stage)
  const released   = formatDistanceToNow(new Date(row.released_at), { addSuffix: true })
  const supersededAgo = row.superseded_at
    ? formatDistanceToNow(new Date(row.superseded_at), { addSuffix: true })
    : null

  return (
    <Card className={`flex items-start gap-3 ${row.is_current ? '' : 'opacity-60'}`}>
      <div className="flex flex-col items-center gap-1 pt-0.5">
        <Icon icon="flag" size={12} intent={row.is_current ? stageIntent : Intent.NONE} />
        {row.is_current
          ? <Tag minimal intent={Intent.SUCCESS} className="!text-[9px]">active</Tag>
          : <Tag minimal className="!text-[9px]">superseded</Tag>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={stageIntent} icon="flag">{row.stage}</Tag>
          <Tag minimal className="font-mono text-[10px]">@ {row.version}</Tag>
          {row.eval_pass_rate != null && (
            <Tag minimal intent={passRateIntent(row.eval_pass_rate)}>
              {Math.round(row.eval_pass_rate * 100)}% pass
              {row.eval_case_count != null && (
                <span className="opacity-60 ml-1">({row.eval_case_count})</span>
              )}
            </Tag>
          )}
        </div>
        {row.notes && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{row.notes}</p>
        )}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1.5">
          <span>released {released}</span>
          {supersededAgo && <span>superseded {supersededAgo}</span>}
        </div>
      </div>
    </Card>
  )
}

function stageIntentOf(stage: AgentReleaseStage): Intent {
  switch (stage) {
    case 'production': return Intent.SUCCESS
    case 'staging':    return Intent.WARNING
    case 'sandbox':    return Intent.NONE
  }
}

function passRateIntent(rate: number): Intent {
  if (rate >= 0.85) return Intent.SUCCESS
  if (rate >= 0.7)  return Intent.WARNING
  return Intent.DANGER
}
