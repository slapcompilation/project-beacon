// The Builds application — "You can explore builds in Foundry using the
// Builds application" (data-integration/builds). A build's jobs and their
// seven documented states; live logs are recorded in the reading, not built.

import { useState } from 'react'
import { Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { useBuildJobs, useBuilds, type Build } from '@/features/builds/api'

// Builds speak the API vocabulary; the jobs below speak the prose one. The
// exact confusion CLAUDE.md's two-vocabularies table warns about sat here.
const BUILD_INTENT: Record<Build['status'], Intent> = {
  RUNNING: Intent.WARNING, SUCCEEDED: Intent.SUCCESS,
  FAILED: Intent.DANGER, CANCELED: Intent.NONE,
}

const JOB_INTENT: Record<string, Intent> = {
  COMPLETED: Intent.SUCCESS, FAILED: Intent.DANGER, ABORTED: Intent.NONE,
  RUNNING: Intent.WARNING, WAITING: Intent.NONE,
  RUN_PENDING: Intent.WARNING, ABORT_PENDING: Intent.WARNING,
}

export default function BuildsPage() {
  const { data: builds = [], isLoading } = useBuilds()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header>
          <h1 className="text-xl font-semibold">Builds</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            The mechanism that computes new versions of datasets: each build runs jobs,
            each job locks its output with a real transaction. Fresh outputs are skipped.
          </p>
        </header>

        {isLoading ? (
          <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size={SpinnerSize.SMALL} />Loading…
          </Card>
        ) : builds.length === 0 ? (
          <NonIdealState icon="play" title="No builds yet"
            description="Publish a JobSpec on a dataset — one SQL SELECT over its declared inputs — then Build. The run lands here." />
        ) : (
          <div className="space-y-2">
            {builds.map((b) => (
              <Card key={b.id} compact interactive
                onClick={() => { setOpenId(openId === b.id ? null : b.id) }}>
                <div className="flex items-center gap-2 text-xs">
                  <Icon icon="play" size={13} className="text-violet-500" />
                  <span className="font-mono text-[11px]">{b.id.slice(0, 8)}</span>
                  <Tag minimal intent={BUILD_INTENT[b.status]} className="!text-[10px]">{b.status}</Tag>
                  {b.force && <Tag minimal className="!text-[10px]" title="Staleness was ignored.">force</Tag>}
                  <span className="ml-auto text-muted-foreground">
                    {new Date(b.startedAt).toLocaleString()}
                    {b.finishedAt &&
                      ` · ${String(Math.round((new Date(b.finishedAt).getTime() - new Date(b.startedAt).getTime()) / 100) / 10)}s`}
                  </span>
                </div>
                {openId === b.id && <BuildJobs buildId={b.id} />}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BuildJobs({ buildId }: { buildId: string }) {
  const { data: jobs = [] } = useBuildJobs(buildId)
  return (
    <ul className="mt-2 divide-y divide-border/30 border-t border-border">
      {jobs.map((j) => (
        <li key={j.id} className="flex items-start gap-2 py-1.5 text-xs">
          <Tag minimal intent={JOB_INTENT[j.state] ?? Intent.NONE} className="!text-[9px] uppercase">{j.state}</Tag>
          <span className="font-medium">{j.outputDatasetName}</span>
          {j.error && <span className="text-muted-foreground flex-1">{j.error}</span>}
        </li>
      ))}
    </ul>
  )
}
