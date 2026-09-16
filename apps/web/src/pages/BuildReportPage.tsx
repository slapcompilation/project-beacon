// The build report — the page a build gets, built to its capture.
//
// `data-integration/images/builds.png` is the annotated one: a header with the
// breadcrumb and the actions, `Build info` and `Build schedule` down the left,
// and `Build progress` — a Gantt over the jobs, the legend, and the Datasets
// table — filling the right. readings/build-report.md walks it.
//
// Not rendered, each for want of an engine: the log viewer whole, `Spark
// details`, `Cancel build`, `Actions ▾`, `Progress details`, `Critical path`,
// `Metrics` on the schedule card, and the header's three-count pill — whose
// meaning the reading shows the captures themselves rule out. `Estimated` is
// absent by decision 5: its only honest input is the median already on the row.

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, HTMLSelect, Icon, InputGroup, Intent, NonIdealState, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import {
  buildStatusLabel, jobDisplay, useBuild, useJobSpecMedians, useReportJobs, useScheduleRuns,
  type JobDisplay, type ReportJob, type ScheduleTrigger,
} from '@/features/builds/api'
import { duration, formatSeconds, historyTime } from '@/features/datasets/preview'

const JOB_COLOUR: Record<JobDisplay, string> = {
  Queued: '#8f99a8', Waiting: '#8f6bd5', Running: '#2d72d2',
  Succeeded: '#238551', Failed: '#cd4246', Canceled: '#8f99a8',
}
const LEGEND: JobDisplay[] = ['Queued', 'Waiting', 'Running', 'Succeeded', 'Failed', 'Canceled']

const when = (iso: string | null): string =>
  iso === null ? '--' : new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export default function BuildReportPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: build, isLoading } = useBuild(id ?? null)
  const { data: jobs = [] } = useReportJobs(id ?? null)
  const { data: medians } = useJobSpecMedians(jobs.map((j) => j.jobSpecId))
  const [statusFilter, setStatusFilter] = useState('')
  const [pathQuery, setPathQuery] = useState('')

  const shown = jobs.filter((j) =>
    (statusFilter === '' || jobDisplay(j.state) === statusFilter)
    && (pathQuery === '' || `${j.outputDatasetName} ${j.path}`.toLowerCase().includes(pathQuery.toLowerCase())))

  if (isLoading) {
    return <div className="flex items-center gap-2 px-8 py-6 text-sm text-muted-foreground">
      <Spinner size={SpinnerSize.SMALL} />Loading…</div>
  }
  if (!build) {
    return <NonIdealState icon="build" title="No such build"
      description="It may belong to an organization you cannot see." />
  }

  const succeeded = jobs.filter((j) => j.state === 'COMPLETED').length
  // "Build of: region and 3 more" — the first output names the build.
  const subject = jobs.length === 0 ? 'nothing'
    : jobs.length === 1 ? jobs[0].outputDatasetName
      : `${jobs[0].outputDatasetName} and ${String(jobs.length - 1)} more`

  return (
    <div className="br">
      <header className="br-header">
        <nav className="dsv-crumbs" aria-label="Build">
          <Link to="/builds" className="crumb">Builds</Link>
          <span className="crumb-sep">›</span>
          <span className="crumb">Build of:</span>
          <Icon icon="th" size={13} className="text-violet-500" />
          <span className="crumb-self">{subject}</span>
        </nav>
        <span className="ml-auto flex items-center gap-2">
          {jobs.length > 0 && (
            <Button size="small" variant="outlined" icon="data-lineage"
              onClick={() => { void navigate(`/lineage/dataset/${jobs[0].outputDatasetId}`) }}>
              Explore lineage
            </Button>
          )}
        </span>
      </header>

      <div className="br-body">
        <aside className="br-side">
          <div className="br-side-head">Build info</div>
          <dl className="dsv-about">
            <dt>Status</dt>
            <dd className="flex items-center gap-1.5">
              <Icon icon={build.status === 'RUNNING' ? 'refresh' : build.status === 'SUCCEEDED' ? 'tick-circle'
                : build.status === 'FAILED' ? 'error' : 'ban-circle'}
                intent={build.status === 'SUCCEEDED' ? Intent.SUCCESS : build.status === 'FAILED' ? Intent.DANGER
                  : build.status === 'RUNNING' ? Intent.PRIMARY : Intent.NONE} size={13} />
              {buildStatusLabel(build.status)}
            </dd>
            <dt>Duration</dt><dd>{duration(build.startedAt, build.finishedAt)}</dd>
            <dt>Started</dt><dd>{when(build.startedAt)}</dd>
            <dt>Ended</dt><dd>{when(build.finishedAt)}</dd>
            {/* "Started by: Build schedule" — else it was a person's Build. */}
            <dt>Started by</dt>
            <dd>{build.scheduleName === null ? 'Manual build' : 'Build schedule'}</dd>
            <dt>Progress</dt>
            <dd>{succeeded} of {jobs.length} job{jobs.length === 1 ? '' : 's'} succeeded</dd>
            <dt>Build ID</dt>
            <dd className="flex items-center gap-1 min-w-0">
              <span className="font-mono truncate">{build.id}</span>
              <Button variant="minimal" size="small" icon="clipboard" aria-label="Copy build ID"
                onClick={() => {
                  void navigator.clipboard.writeText(build.id).then(() => { toast.success('Build ID copied') })
                }} />
            </dd>
            {build.force && <><dt>Force</dt><dd>Staleness ignored</dd></>}
          </dl>

          {build.scheduleId !== null && (
            <ScheduleCard name={build.scheduleName ?? ''} trigger={build.scheduleTrigger}
              updatedAt={build.scheduleUpdatedAt} scheduleId={build.scheduleId} />
          )}
        </aside>

        <main className="br-main">
          <div className="br-progress-head">
            <span className="text-sm font-semibold">Build progress</span>
            <span className="ml-auto flex items-center gap-2">
              <HTMLSelect minimal value={statusFilter}
                onChange={(e) => { setStatusFilter(e.currentTarget.value) }}>
                <option value="">Job status</option>
                {LEGEND.map((l) => <option key={l} value={l}>{l}</option>)}
              </HTMLSelect>
              <InputGroup size="small" leftIcon="search" placeholder="Dataset path…" value={pathQuery}
                onChange={(e) => { setPathQuery(e.currentTarget.value) }} />
            </span>
          </div>

          <Gantt jobs={shown} />

          <div className="br-legend">
            {LEGEND.map((l) => (
              <span key={l}><i style={{ background: JOB_COLOUR[l] }} />{l}</span>
            ))}
          </div>

          <table className="br-table">
            <thead>
              <tr><th>Datasets</th><th>Start time</th><th>Duration</th><th>Status</th></tr>
            </thead>
            <tbody>
              {shown.map((j) => <JobRow key={j.id} job={j} median={medians?.get(j.jobSpecId)} />)}
            </tbody>
          </table>
          {shown.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {jobs.length === 0 ? 'This build ran no jobs.' : 'No job matches.'}
            </p>
          )}
        </main>
      </div>
    </div>
  )
}

/** One bar per job over the build's own span, which is what the capture's axis
 *  is — it starts at the first job and ends at the last. */
function Gantt({ jobs }: { jobs: ReportJob[] }) {
  const span = useMemo(() => {
    const times = jobs.flatMap((j) => [
      j.startedAt === null ? null : new Date(j.startedAt).getTime(),
      j.finishedAt === null ? Date.now() : new Date(j.finishedAt).getTime(),
    ]).filter((t): t is number => t !== null)
    if (times.length === 0) return null
    const from = Math.min(...times); const to = Math.max(...times)
    return { from, to: to === from ? from + 1000 : to }
  }, [jobs])

  if (span === null) return <p className="px-3 py-4 text-xs text-muted-foreground">No job has started yet.</p>

  return (
    <div className="br-gantt">
      {jobs.map((j) => {
        const s = j.startedAt === null ? null : new Date(j.startedAt).getTime()
        const e = j.finishedAt === null ? Date.now() : new Date(j.finishedAt).getTime()
        const total = span.to - span.from
        const left = s === null ? 0 : ((s - span.from) / total) * 100
        const width = s === null ? 0 : Math.max(0.5, ((e - s) / total) * 100)
        return (
          <div key={j.id} className="br-gantt-row">
            <span className="br-gantt-label" title={j.path}>{j.outputDatasetName}</span>
            <span className="br-gantt-track">
              {s !== null && (
                <span className="br-gantt-bar"
                  style={{ left: `${String(left)}%`, width: `${String(width)}%`,
                    background: JOB_COLOUR[jobDisplay(j.state)] }} />
              )}
            </span>
          </div>
        )
      })}
      <div className="br-gantt-axis">
        <span>{new Date(span.from).toLocaleTimeString()}</span>
        <span>{new Date(span.to).toLocaleTimeString()}</span>
      </div>
    </div>
  )
}

function JobRow({ job, median }: { job: ReportJob; median: number | undefined }) {
  const [open, setOpen] = useState(false)
  const display = jobDisplay(job.state)
  const running = display === 'Running' || display === 'Queued' || display === 'Waiting'

  return (
    <>
      <tr className="br-row" onClick={() => { setOpen(!open) }}>
        <td>
          <Link to={`/datasets/${job.outputDatasetId}`} className="br-ds"
            onClick={(e) => { e.stopPropagation() }}>{job.outputDatasetName}</Link>
          <div className="br-path">{job.path}</div>
        </td>
        <td>{job.startedAt === null ? '--' : historyTime(job.startedAt)}</td>
        <td>
          {duration(job.startedAt, job.finishedAt)}
          {/* The capture's grey second line, and its absence in the other. */}
          <div className="br-typically">
            {median === undefined ? 'No previous runs' : `Typically ${formatSeconds(median)}`}
          </div>
        </td>
        <td>
          <span className="br-status">
            <i style={{ background: JOB_COLOUR[display] }} />
            {display}
          </span>
          {running && <div className="br-bar"><i /></div>}
        </td>
      </tr>
      {open && (
        <tr className="br-detail">
          <td colSpan={4}>
            <div className="br-jobtype">
              Job type: <span>SQL transform{job.specVersion === null ? '' : ` (v${String(job.specVersion)})`}</span>
            </div>
            {/* Only the steps our columns support — nothing here records a
                resource wait, so no `Waited for resources` step is invented. */}
            <div className="br-steps">
              <Step label="Started job" at={job.startedAt} done={job.startedAt !== null} />
              <Step label={display === 'Failed' ? 'Failed' : display === 'Canceled' ? 'Canceled' : 'Finished'}
                at={job.finishedAt}
                done={job.finishedAt !== null} running={job.startedAt !== null && job.finishedAt === null} />
            </div>
            {job.error !== null && <p className="br-error">{job.error}</p>}
          </td>
        </tr>
      )}
    </>
  )
}

function Step({ label, at, done, running }:
  { label: string; at: string | null; done: boolean; running?: boolean }) {
  return (
    <span className="br-step">
      <Icon icon={done ? 'tick-circle' : running === true ? 'refresh' : 'help'} size={14}
        intent={done ? Intent.SUCCESS : running === true ? Intent.PRIMARY : Intent.NONE} />
      <span className="br-step-label">{label}</span>
      <span className="br-step-at">{at === null ? '—' : when(at)}</span>
    </span>
  )
}

/** "This schedule will run when any of the following occur:" over one chip per
 *  trigger — and the cron form, which the newer capture shows as one chip. */
function ScheduleCard({ name, trigger, updatedAt, scheduleId }:
  { name: string; trigger: ScheduleTrigger | null; updatedAt: string | null; scheduleId: string }) {
  const { data: runs = [] } = useScheduleRuns(scheduleId)
  const leaves = trigger === null ? []
    : trigger.type === 'and' || trigger.type === 'or' ? trigger.triggers ?? [] : [trigger]
  const anyOf = trigger?.type !== 'and'

  return (
    <Card compact className="br-sched">
      <div className="br-sched-name">{name}</div>
      <div className="br-sched-head">When to build</div>
      <p className="br-sched-line">
        {leaves.length > 1
          ? `This schedule will run when ${anyOf ? 'any' : 'all'} of the following occur:`
          : 'This schedule will run:'}
      </p>
      <div className="br-chips">
        {leaves.map((t, i) => (
          <Tag key={i} minimal icon={t.type === 'time' ? 'time' : 'th'}>
            {t.type === 'time' ? `${t.cron ?? ''}${t.timezone === undefined ? '' : ` (${t.timezone})`}` : 'on a dataset update'}
          </Tag>
        ))}
      </div>
      {runs.length > 0 && (
        <>
          <div className="br-sched-head">Recent runs</div>
          <div className="br-dots">
            {runs.slice(0, 10).reverse().map((r) => (
              <i key={r.id} title={`${r.outcome} · ${when(r.ranAt)}`}
                style={{ background: r.outcome === 'Succeeded' ? '#238551' : r.outcome === 'Failed' ? '#cd4246' : '#d1980b' }} />
            ))}
          </div>
        </>
      )}
      {updatedAt !== null && (
        <p className="br-sched-foot">Last modified {historyTime(updatedAt)}</p>
      )}
      <Link to="/lineage" className="br-sched-link">Schedule</Link>
    </Card>
  )
}
