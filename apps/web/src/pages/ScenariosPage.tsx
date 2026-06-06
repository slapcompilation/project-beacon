// Scenarios index (H3). AIP-shaped sandbox branches: a graph_overlay the
// operator (and, in H4, the LLM) co-edits, simulated against the cycle with
// no persistence. Distinct from Action Chains — Scenarios explore "what if
// the rules were different"; chains batch real actions.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Card, Icon, Intent, NonIdealState, SegmentedControl, Spinner,
  SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { useScenarios, useCreateScenario } from '@/features/scenarios/hooks'
import type { ScenarioRow, ScenarioStatus } from '@/features/scenarios/api'

type Filter = 'all' | ScenarioStatus

const FILTER_LABELS: Record<Filter, string> = {
  all:      'All',
  draft:    'Draft',
  archived: 'Archived',
  promoted: 'Promoted',
}

export default function ScenariosPage() {
  const [filter, setFilter] = useState<Filter>('draft')
  const { data: rows = [], isLoading, isError, refetch, isFetching } = useScenarios(filter === 'all' ? null : filter)
  const create = useCreateScenario()

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (isError) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to load scenarios"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Scenarios
            {rows.length > 0 && <Tag minimal>{String(rows.length)}</Tag>}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sandbox graph branches. Overlay hypothetical policy / par / constraints, simulate the cycle against them, see the delta — nothing touches real state until you promote.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
          <Button
            intent={Intent.PRIMARY}
            icon="add"
            loading={create.isPending}
            onClick={() => { create.mutate({ title: `Untitled scenario — ${new Date().toLocaleString()}` }) }}
          >
            New scenario
          </Button>
        </div>
      </header>

      <div className="px-4 py-2 border-b shrink-0">
        <SegmentedControl
          size="small"
          value={filter}
          onValueChange={(v) => { setFilter(v as Filter) }}
          options={(['all', 'draft', 'archived', 'promoted'] as Filter[]).map((f) => ({ value: f, label: FILTER_LABELS[f] }))}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {rows.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="lab-test" size={32} className="text-muted-foreground/40" />}
            title="No scenarios here"
            description={filter === 'all' ? 'Click "New scenario" to open a sandbox branch.' : `No ${FILTER_LABELS[filter].toLowerCase()} scenarios.`}
          />
        ) : (
          rows.map((row) => <ScenarioRowCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  )
}

function ScenarioRowCard({ row }: { row: ScenarioRow }) {
  const sim = row.last_simulation
  return (
    <Link to={`/scenarios/${row.id}`}>
      <Card interactive className="flex items-start gap-3 hover:bg-surface-2">
        <Tag minimal intent={statusIntent(row.status)} icon="lab-test">{row.status}</Tag>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{row.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {overlaySummary(row)}
            {' · edited '}{formatDistanceToNow(new Date(row.updated_at), { addSuffix: true })}
          </div>
        </div>
        {sim && (
          <div className="text-right text-[11px] text-muted-foreground shrink-0">
            <div><span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{sim.result.autoExecuted}</span> auto · <span className="font-semibold tabular-nums text-amber-600 dark:text-amber-400">{sim.result.queued}</span> queued</div>
            <div>simulated {formatDistanceToNow(new Date(sim.ran_at), { addSuffix: true })}</div>
          </div>
        )}
      </Card>
    </Link>
  )
}

function overlaySummary(row: ScenarioRow): string {
  const o = row.graph_overlay
  const parts: string[] = []
  if (o.policy) parts.push('policy')
  if (o.variants && Object.keys(o.variants).length > 0) parts.push(`${String(Object.keys(o.variants).length)} variant${Object.keys(o.variants).length === 1 ? '' : 's'}`)
  if (o.constraints && ((o.constraints.disabled?.length ?? 0) > 0 || (o.constraints.added?.length ?? 0) > 0)) parts.push('constraints')
  if (o.actions && o.actions.length > 0) parts.push(`${String(o.actions.length)} action${o.actions.length === 1 ? '' : 's'}`)
  return parts.length === 0 ? 'empty overlay' : `overlay: ${parts.join(', ')}`
}

function statusIntent(status: ScenarioStatus): Intent {
  switch (status) {
    case 'draft':    return Intent.WARNING
    case 'promoted': return Intent.SUCCESS
    case 'archived': return Intent.NONE
  }
}
