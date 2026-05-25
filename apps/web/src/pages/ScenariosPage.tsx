// Scenarios index. Exploratory branches the operator hasn't committed to
// real state yet. Default filter: draft (the only ones still actionable).

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Card, Icon, Intent, NonIdealState, SegmentedControl, Spinner,
  SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { useCreateScenario, useScenarios } from '@/features/scenarios/hooks'
import type { ScenarioRow, ScenarioStatus } from '@/features/scenarios/api'

type Filter = 'all' | ScenarioStatus

const FILTER_LABELS: Record<Filter, string> = {
  all:        'All',
  draft:      'Draft',
  committed:  'Committed',
  discarded:  'Discarded',
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
            Exploratory branches: try BeaconActions in a sandbox, see the delta vs. the base state, commit when you're sure or discard.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
          <Button
            intent={Intent.PRIMARY}
            icon="add"
            loading={create.isPending}
            onClick={() => {
              const title = `Untitled scenario — ${new Date().toLocaleString()}`
              create.mutate({ title })
            }}
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
          options={(['all', 'draft', 'committed', 'discarded'] as Filter[]).map((f) => ({
            value: f, label: FILTER_LABELS[f],
          }))}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {rows.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="lab-test" size={32} className="text-muted-foreground/40" />}
            title="No scenarios here"
            description={filter === 'all'
              ? 'Open one above, or click "Try in scenario" on any proposal.'
              : `No ${FILTER_LABELS[filter].toLowerCase()} scenarios.`}
          />
        ) : (
          rows.map((row) => <ScenarioRowCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  )
}

function ScenarioRowCard({ row }: { row: ScenarioRow }) {
  return (
    <Link to={`/scenarios/${row.id}`}>
      <Card interactive className="flex items-start gap-3 hover:bg-surface-2">
        <Tag minimal intent={statusIntent(row.status)} icon="lab-test">{row.status}</Tag>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{row.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {row.simulated_actions.length} action{row.simulated_actions.length === 1 ? '' : 's'}
            {row.base_proposal_id && ' · forked from proposal'}
            {' · opened '}{formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
            {row.committed_at && ` · committed ${formatDistanceToNow(new Date(row.committed_at), { addSuffix: true })}`}
          </div>
        </div>
      </Card>
    </Link>
  )
}

function statusIntent(status: ScenarioStatus): Intent {
  switch (status) {
    case 'draft':     return Intent.WARNING
    case 'committed': return Intent.SUCCESS
    case 'discarded': return Intent.NONE
  }
}
