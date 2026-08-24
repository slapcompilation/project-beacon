// Data Health — the platform-wide listing beside the per-dataset Health panel:
// "filter or sort datasets by their status or name… toggle to show only the
// datasets that you are watching" (data-health/overview.md). Rows group by
// dataset, worst status first, each carrying the same grammar as the panel.
import { useState } from 'react'
import { Card, Icon, InputGroup, Intent, NonIdealState, Spinner, Switch, Tag } from '@blueprintjs/core'
import {
  checkTypeLabel, useDataHealthListing, type ListedCheck, type ResultStatus,
} from '@/features/dataHealth/api'

const STATUS_INTENT: Record<ResultStatus, Intent> = {
  passed: Intent.SUCCESS, failed: Intent.DANGER, error: Intent.WARNING,
}
const STATUS_LABEL: Record<ResultStatus, string> = {
  passed: 'Passed', failed: 'Failed', error: 'Error',
}
// Worst first: a failure outranks an evaluator error outranks a pass.
const STATUS_RANK: Record<ResultStatus, number> = { failed: 0, error: 1, passed: 2 }

export default function DataHealthPage() {
  const { data: checks = [], isLoading } = useDataHealthListing()
  const [watchingOnly, setWatchingOnly] = useState(false)
  const [filter, setFilter] = useState('')

  const shown = checks.filter((c) =>
    (!watchingOnly || c.myWatch !== null)
    && c.datasetName.toLowerCase().includes(filter.toLowerCase()))

  const byDataset = new Map<string, ListedCheck[]>()
  for (const c of shown) {
    const list = byDataset.get(c.datasetName) ?? []
    list.push(c)
    byDataset.set(c.datasetName, list)
  }
  const datasets = [...byDataset.entries()].sort(([an, a], [bn, b]) =>
    worstRank(a) - worstRank(b) || an.localeCompare(bn))

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Data Health</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Every health check you can see, by dataset — stale data, shrunken row counts and
            schema drift surface here before a consumer notices them.
          </p>
        </header>

        <div className="flex items-center gap-4 flex-wrap">
          <InputGroup leftIcon="search" placeholder="Filter datasets…" value={filter}
            onChange={(e) => { setFilter(e.currentTarget.value) }} />
          <Switch checked={watchingOnly} label="Only datasets I am watching" className="!mb-0"
            onChange={(e) => { setWatchingOnly(e.currentTarget.checked) }} />
        </div>

        {isLoading ? (
          <Spinner />
        ) : datasets.length === 0 ? (
          <NonIdealState icon="pulse" title="No health checks"
            description={watchingOnly
              ? 'You are not watching any checks. Watch one from a dataset’s Health panel.'
              : 'Add a check from a dataset’s Health panel to start monitoring it.'} />
        ) : (
          datasets.map(([name, list]) => (
            <Card key={name} compact className="!p-0">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <Icon icon="th" size={12} className="text-violet-500" />
                <span className="text-xs font-semibold">{name}</span>
                <Tag minimal className="!text-[10px]">{list.length}</Tag>
              </div>
              <ul className="divide-y divide-border/30">
                {list.map((c) => {
                  const latest = c.results.at(0) ?? null
                  const column = typeof c.config.column === 'string' ? c.config.column : null
                  return (
                    <li key={c.id} className="flex items-center gap-2 px-3 py-1.5 text-xs flex-wrap">
                      <span className="font-medium">{checkTypeLabel(c.check_type)}</span>
                      {column !== null && <Tag minimal className="!text-[9px] font-mono">{column}</Tag>}
                      {c.paused_at !== null && <Tag minimal intent={Intent.WARNING} className="!text-[9px]">Paused</Tag>}
                      {c.myWatch !== null && c.myWatch !== 'nothing' && (
                        <Icon icon="eye-open" size={11} className="text-muted-foreground" title="Watching" />
                      )}
                      <span className="ml-auto flex items-center gap-2">
                        {latest === null ? (
                          <span className="text-[11px] text-muted-foreground">Not yet run</span>
                        ) : (
                          <>
                            <Tag minimal intent={STATUS_INTENT[latest.status]} className="!text-[9px]"
                              title={latest.detail ?? undefined}>
                              {latest.measured ?? STATUS_LABEL[latest.status]}
                            </Tag>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(latest.reported_at).toLocaleString()}
                            </span>
                          </>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

function worstRank(list: ListedCheck[]): number {
  return Math.min(...list.map((c) => {
    const s = c.results.at(0)?.status
    return s === undefined ? 3 : STATUS_RANK[s]
  }))
}
