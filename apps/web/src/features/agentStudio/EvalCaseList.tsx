// Phase G3 — per-case drilldown for one (objective, version). Reads the
// latest agent_eval_case_runs rows via get_eval_case_runs(). Failed cases
// surface first; passing cases collapse to a count strip the operator can
// expand on demand.

import { useState } from 'react'
import { Callout, Card, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { useEvalCaseRuns, type EvalCaseRow } from './hooks'

export function EvalCaseList({ objectiveName, version }: { objectiveName: string; version: string }) {
  const { data: rows = [], isLoading, isError, error } = useEvalCaseRuns(objectiveName, version)
  const [showAllPassed, setShowAllPassed] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
        <Spinner size={SpinnerSize.SMALL} />Loading cases…
      </div>
    )
  }
  if (isError) {
    return <Callout intent={Intent.WARNING} icon="warning-sign">{error.message}</Callout>
  }
  if (rows.length === 0) {
    return (
      <Callout intent={Intent.NONE} icon="info-sign">
        No per-case results recorded for <code>@ {version}</code> yet. Older runs only stored the suite-level pass rate; cases land here after the next CI run with the G3 reporter.
      </Callout>
    )
  }

  const failed  = rows.filter((r) => r.state === 'failed')
  const skipped = rows.filter((r) => r.state === 'skipped' || r.state === 'pending')
  const passed  = rows.filter((r) => r.state === 'passed')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span><span className={failed.length  > 0 ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>{failed.length}</span> failed</span>
        <span>·</span>
        <span>{passed.length} passed</span>
        {skipped.length > 0 && <><span>·</span><span>{skipped.length} skipped</span></>}
      </div>

      {failed.map((r) => <CaseRow key={r.case_id} row={r} />)}
      {skipped.map((r) => <CaseRow key={r.case_id} row={r} />)}

      {passed.length > 0 && (
        <button
          type="button"
          onClick={() => { setShowAllPassed(!showAllPassed) }}
          className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          {showAllPassed ? 'Hide' : 'Show'} {passed.length} passing case{passed.length === 1 ? '' : 's'}
        </button>
      )}
      {showAllPassed && passed.map((r) => <CaseRow key={r.case_id} row={r} />)}
    </div>
  )
}

function CaseRow({ row }: { row: EvalCaseRow }) {
  return (
    <Card className="text-xs flex items-start gap-2 py-2">
      <Icon
        icon={iconOf(row.state)}
        intent={intentOf(row.state)}
        size={12}
        className="mt-0.5 shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Tag minimal intent={intentOf(row.state)} className="text-[10px]">{row.state}</Tag>
          <span className="font-mono text-[11px] truncate">{row.case_label}</span>
          {row.duration_ms != null && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{row.duration_ms}ms</span>
          )}
        </div>
        {row.state === 'failed' && row.error_message && (
          <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 leading-snug whitespace-pre-wrap">{row.error_message}</p>
        )}
        <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono truncate">{row.case_id}</p>
      </div>
    </Card>
  )
}

function iconOf(state: EvalCaseRow['state']) {
  switch (state) {
    case 'passed':  return 'tick-circle'
    case 'failed':  return 'cross-circle'
    case 'skipped': return 'minus'
    case 'pending': return 'time'
  }
}

function intentOf(state: EvalCaseRow['state']): Intent {
  switch (state) {
    case 'passed':  return Intent.SUCCESS
    case 'failed':  return Intent.DANGER
    case 'skipped': return Intent.NONE
    case 'pending': return Intent.WARNING
  }
}
