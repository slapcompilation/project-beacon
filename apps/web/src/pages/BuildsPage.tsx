// The Builds application — "allows you to view all builds occurring across
// Foundry and explore details about each build" (data-integration/
// application-reference). This is the list half; a row opens the report at
// /builds/:id, which readings/build-report.md walks off its capture.
//
// The row used to expand in place to a job list. The capture's breadcrumb is
// `Builds › Build of: …`, so a build is a PAGE, and the accordion was ours —
// SURFACE-BUILD-MAP §3.2 recorded it as unattested. It navigates now.

import { useNavigate } from 'react-router-dom'
import { Card, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { buildStatusLabel, useBuilds, type Build } from '@/features/builds/api'
import { duration } from '@/features/datasets/preview'

// Builds speak the API vocabulary; the jobs below speak the prose one. The
// exact confusion CLAUDE.md's two-vocabularies table warns about sat here.
const BUILD_INTENT: Record<Build['status'], Intent> = {
  RUNNING: Intent.WARNING, SUCCEEDED: Intent.SUCCESS,
  FAILED: Intent.DANGER, CANCELED: Intent.NONE,
}



export default function BuildsPage() {
  const { data: builds = [], isLoading } = useBuilds()
  const navigate = useNavigate()

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
                onClick={() => { void navigate(`/builds/${b.id}`) }}>
                <div className="flex items-center gap-2 text-xs">
                  <Icon icon="play" size={13} className="text-violet-500" />
                  <span className="font-mono text-[11px]">{b.id.slice(0, 8)}</span>
                  {/* Title-case on the screen, the API's token in the ledger. */}
                  <Tag minimal intent={BUILD_INTENT[b.status]} className="!text-[10px]">
                    {buildStatusLabel(b.status)}
                  </Tag>
                  {b.force && <Tag minimal className="!text-[10px]" title="Staleness was ignored.">force</Tag>}
                  <span className="ml-auto text-muted-foreground">
                    {new Date(b.startedAt).toLocaleString()} · {duration(b.startedAt, b.finishedAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

