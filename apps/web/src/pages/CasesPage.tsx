// Cases index — every case in the active hotel, filterable by status.
// Cases wrap an input → proposals → outcome workflow into one auditable unit.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Button, Card, Icon, Intent, NonIdealState, SegmentedControl, Spinner,
  SpinnerSize, Tag,
} from '@blueprintjs/core'
import { formatDistanceToNow } from 'date-fns'
import { useCases } from '@/features/cases/hooks'
import type { CaseRow, CaseStatus } from '@/features/cases/api'

type Filter = 'all' | CaseStatus

const FILTER_LABELS: Record<Filter, string> = {
  all:        'All',
  open:       'Open',
  in_review:  'In review',
  resolved:   'Resolved',
  closed:     'Closed',
}

export default function CasesPage() {
  const [filter, setFilter] = useState<Filter>('open')
  const { data: rows = [], isLoading, isError, refetch, isFetching } = useCases(filter === 'all' ? null : filter)

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Spinner size={SpinnerSize.STANDARD} intent={Intent.PRIMARY} /></div>
  }
  if (isError) {
    return (
      <NonIdealState
        icon="warning-sign"
        title="Failed to load cases"
        action={<Button intent={Intent.PRIMARY} icon="refresh" onClick={() => { void refetch() }}>Retry</Button>}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div>
          <h1 className="text-sm font-semibold flex items-center gap-2">
            Cases
            {rows.length > 0 && <Tag minimal>{String(rows.length)}</Tag>}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Workflow envelopes that tie one operator input to the proposals an agent emitted and the outcome the operator chose.
          </p>
        </div>
        <Button variant="minimal" size="small" icon="refresh" loading={isFetching} onClick={() => { void refetch() }}>Refresh</Button>
      </header>

      <div className="px-4 py-2 border-b shrink-0">
        <SegmentedControl
          size="small"
          value={filter}
          onValueChange={(v) => { setFilter(v as Filter) }}
          options={(['all', 'open', 'in_review', 'resolved', 'closed'] as Filter[]).map((f) => ({
            value: f, label: FILTER_LABELS[f],
          }))}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {rows.length === 0 ? (
          <NonIdealState
            icon={<Icon icon="folder-open" size={32} className="text-muted-foreground/40" />}
            title="No cases here"
            description={filter === 'all'
              ? 'Open a case from a Proposal page or click the + below.'
              : `No ${FILTER_LABELS[filter].toLowerCase()} cases.`}
          />
        ) : (
          rows.map((row) => <CaseRowCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  )
}

function CaseRowCard({ row }: { row: CaseRow }) {
  return (
    <Link to={`/cases/${row.id}`}>
      <Card interactive className="flex items-start gap-3 hover:bg-surface-2">
        <Tag minimal intent={statusIntent(row.status)} icon="folder-open">{row.status.replace('_', ' ')}</Tag>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{row.title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {row.proposal_ids.length} proposal{row.proposal_ids.length === 1 ? '' : 's'}
            {' · '}
            {row.input_refs.length} input{row.input_refs.length === 1 ? '' : 's'}
            {' · opened '}{formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
          </div>
        </div>
        {row.outcome && <Tag minimal intent={Intent.SUCCESS} icon="tick">{row.outcome.action_type}</Tag>}
      </Card>
    </Link>
  )
}

function statusIntent(status: CaseStatus): Intent {
  switch (status) {
    case 'open':      return Intent.WARNING
    case 'in_review': return Intent.PRIMARY
    case 'resolved':  return Intent.SUCCESS
    case 'closed':    return Intent.NONE
  }
}
