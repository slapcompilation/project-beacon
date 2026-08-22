// The Automate application: Overview and Automations, as both screenshots draw
// them — the app name, two tabs, and a primary New automation on the right.
//
// Read-only. "+ New automation" is deliberately absent: the creation wizard is
// five pages over condition-settings, effect-actions and effect-function, none
// of which are read, and a button that opens nothing is worse than none.
//
// The engine has been running on the minute hand since 493-496 with no screen
// at all. See readings/automate.md § The surface.
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button, Card, Checkbox, HTMLTable, Icon, InputGroup, Intent, NonIdealState, Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { NewAutomationDialog } from '@/features/automate/NewAutomationDialog'
import {
  CONDITION_META, EVENT_LABEL, STATUSES, STATUS_META, conditionSummary,
  latestByAutomation, statusOf, statusTag, useAutomationEvents, useAutomationRuns,
  useAutomations, useEffectKinds,
  type Automation, type AutomationEvent, type AutomationRun, type AutomationStatus,
} from '@/features/automate/api'

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

export default function AutomatePage() {
  const { id } = useParams<{ id?: string }>()
  return id ? <AutomationDetail id={id} /> : <AutomateHome />
}

function AutomateHome() {
  const [tab, setTab] = useState<'overview' | 'automations'>('overview')
  const [creating, setCreating] = useState(false)
  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-8 pt-5 flex items-end gap-4">
        <Icon icon="flash" size={18} className="text-amber-600 mb-2" />
        <h1 className="text-xl font-semibold mb-2">Automate</h1>
        <nav className="flex gap-4 ml-2">
          {(['overview', 'automations'] as const).map((t) => (
            <button key={t} type="button"
              className={t === tab ? 'oma-apptab is-active' : 'oma-apptab'}
              onClick={() => { setTab(t) }}>
              {t === 'overview' ? 'Overview' : 'Automations'}
            </button>
          ))}
        </nav>
        {/* The green primary both screenshots put top-right. */}
        <Button intent={Intent.SUCCESS} icon="add" className="ml-auto mb-2"
          onClick={() => { setCreating(true) }}>New automation</Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'overview' ? <OverviewTab /> : <AutomationsTab />}
      </div>
      {creating && <NewAutomationDialog onClose={() => { setCreating(false) }} />}
    </div>
  )
}

function OverviewTab() {
  const { data: automations = [] } = useAutomations()
  const { data: runs = [] } = useAutomationRuns()

  const paused = automations.filter((a) => a.paused).length
  // "failures within the last four weeks" — the page's own window.
  const cutoff = Date.now() - 28 * 24 * 3600 * 1000
  const failures = runs.filter((r) => r.outcome === 'failed' && new Date(r.ran_at).getTime() >= cutoff)
  const named = new Map(automations.map((a) => [a.id, a.display_name]))

  return (
    <div className="px-8 py-6 max-w-4xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Create and manage automations</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Automate is an application for setting up business automation. You can define conditions
          and effects. Conditions are checked continuously, and effects are executed automatically
          when the specified conditions were met.
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Icon icon="flash" size={13} className="text-amber-600" />
          <span className="text-sm font-semibold">Active automations</span>
          <Tag minimal className="tabular-nums">{automations.length - paused}</Tag>
        </div>
        {/* "For you — You receive notifications" is deliberately absent: the
            notification effect is executable=false here, so the card would
            always read zero for a feature we do not have. */}
        <div className="flex gap-3">
          <StatCard icon="user" label="Owned by you" hint="Executed on your behalf"
            value={automations.length} />
          <StatCard icon="pause" label="Paused" hint="Automation is not evaluated" value={paused} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Failures in last 4 weeks</h3>
        <Card compact className="!p-0">
          {failures.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">No failures.</p>
          ) : (
            <HTMLTable compact className="w-full text-xs">
              <thead><tr><th>Automation</th><th>Time</th><th>Errors</th></tr></thead>
              <tbody>
                {failures.slice(0, 20).map((r) => (
                  <tr key={r.id}>
                    <td>{named.get(r.automation_id) ?? r.automation_id}</td>
                    <td className="truncate">{when(r.ran_at)}</td>
                    <td className="text-red-600">{r.error ?? 'Failed'}</td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          )}
        </Card>
      </div>
    </div>
  )
}

function StatCard({ icon, label, hint, value }: {
  icon: IconName; label: string; hint: string; value: number
}) {
  return (
    <Card compact className="flex items-center gap-3 flex-1">
      <Icon icon={icon} size={16} className="text-muted-foreground" />
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </Card>
  )
}

function AutomationsTab() {
  const navigate = useNavigate()
  const { data: automations = [], isLoading } = useAutomations()
  const { data: runs = [] } = useAutomationRuns()
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<AutomationStatus[]>([])

  const latest = useMemo(() => latestByAutomation(runs), [runs])
  const withStatus = useMemo(
    () => automations.map((a) => ({ a, status: statusOf(a, latest.get(a.id)) })),
    [automations, latest])

  const counts = (s: AutomationStatus) => withStatus.filter((r) => r.status === s).length
  const q = query.trim().toLowerCase()
  const rows = withStatus.filter(({ a, status }) =>
    (picked.length === 0 || picked.includes(status)) &&
    (q === '' || `${a.display_name} ${a.description}`.toLowerCase().includes(q)))

  return (
    <div className="flex h-full">
      <aside className="oma-filter-pane">
        <div className="flex items-center gap-2 px-3 pt-3">
          <span className="text-sm font-semibold">Filters</span>
          <Button variant="minimal" size="small" intent="danger" className="ml-auto"
            disabled={picked.length === 0 && query === ''}
            onClick={() => { setPicked([]); setQuery('') }}>Clear all</Button>
        </div>
        <div className="p-3">
          <InputGroup leftIcon="search" placeholder="Search by name or description"
            value={query} onValueChange={setQuery} />
        </div>
        <div className="flex items-center gap-2 px-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Status</span>
          <Button variant="minimal" size="small" intent="danger" className="ml-auto"
            disabled={picked.length === 0} onClick={() => { setPicked([]) }}>Clear</Button>
        </div>
        <div className="px-3 pb-3">
          {STATUSES.map((s) => {
            const meta = STATUS_META[s]
            return (
              <div key={s} className="flex items-center gap-2" title={meta.hint}>
                <Checkbox className="mb-0 flex-1" checked={picked.includes(s)}
                  onChange={() => {
                    setPicked(picked.includes(s) ? picked.filter((x) => x !== s) : [...picked, s])
                  }}
                  labelElement={
                    <span className="inline-flex items-center gap-1.5">
                      <Icon icon={meta.icon as IconName} size={12} />
                      {meta.label}
                    </span>} />
                <span className="text-xs text-muted-foreground tabular-nums">{counts(s)}</span>
              </div>
            )
          })}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? null : automations.length === 0 ? (
          <NonIdealState icon="flash" title="No automations"
            description="The engine runs on the minute hand and evaluates every automation it finds. Authoring one is not built yet — the creation wizard is a separate slice." />
        ) : (
          <Card compact className="!p-0">
            <HTMLTable interactive compact className="w-full text-xs">
              <thead><tr><th>Name</th><th>Condition</th><th>Status</th><th>Creator</th></tr></thead>
              <tbody>
                {rows.map(({ a, status }) => {
                  const cm = CONDITION_META[a.condition.type]
                  const sm = STATUS_META[status]
                  return (
                    <tr key={a.id} onClick={() => { void navigate(`/automate/${a.id}`) }}>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="oma-cond-tile"><Icon icon={cm.icon as IconName} size={13} /></span>
                          <span>
                            <span className="text-primary font-medium block">{a.display_name}</span>
                            <span className="text-muted-foreground">{cm.label}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <Tag minimal icon={cm.icon as IconName}>{conditionSummary(a.condition)}</Tag>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5">
                          <Icon icon={sm.icon as IconName} size={12}
                            className={status === 'error' ? 'text-red-600' : status === 'paused' ? 'text-muted-foreground' : 'text-success'} />
                          <Tag minimal>{statusTag(status, a.condition)}</Tag>
                        </span>
                      </td>
                      <td className="text-muted-foreground">{a.owner_id ? 'Owner' : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </HTMLTable>
            {rows.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">No automations match.</p>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

/** The rail both screenshots draw: Overview, History, Execute, Telemetry. The
 *  last two are disabled — because hiding them would misdraw the application.
 *  Execute's reason changed in 620: it is not the missing settings, it is that
 *  the run ledger has a single writer and a manual run belongs in the queue. */
const RAIL = [
  { id: 'overview', label: 'Overview', icon: 'desktop', on: true },
  { id: 'history', label: 'History', icon: 'history', on: true },
  { id: 'execute', label: 'Execute', icon: 'flash', on: false,
    why: 'A manual run is an event the execution queue drains, and the run ledger has one writer. Waiting on the event log, not on this button.' },
  { id: 'telemetry', label: 'Telemetry', icon: 'timeline-bar-chart', on: false,
    why: 'No execution trace or flame chart exists here.' },
] as const

function AutomationDetail({ id }: { id: string }) {
  const navigate = useNavigate()
  const { data: automations = [] } = useAutomations()
  const { data: runs = [] } = useAutomationRuns()
  const { data: events = [] } = useAutomationEvents()
  const { data: kinds = [] } = useEffectKinds()
  const [pane, setPane] = useState<'overview' | 'history'>('overview')

  const a = automations.find((x) => x.id === id)
  if (!a) return <div className="p-8"><NonIdealState icon="flash" title="No such automation" /></div>
  const mine = runs.filter((r) => r.automation_id === a.id)
  const myEvents = events.filter((e) => e.automation_id === a.id)
  const cm = CONDITION_META[a.condition.type]

  return (
    <div className="flex h-full">
      <aside className="oma-filter-pane">
        <Button variant="minimal" size="small" icon="arrow-left" className="mb-2"
          onClick={() => { void navigate('/automate') }}>All automations</Button>
        <div className="flex items-center gap-2 px-3 py-2 border-t border-b">
          <span className="oma-cond-tile"><Icon icon={cm.icon as IconName} size={13} /></span>
          <span className="text-xs">
            <span className="text-primary font-medium block">{a.display_name}</span>
            <span className="text-muted-foreground">{cm.label}</span>
          </span>
        </div>
        <div className="p-2">
          {RAIL.map((r) => (
            <button key={r.id} type="button" disabled={!r.on}
              title={'why' in r ? r.why : undefined}
              className={r.id === pane ? 'oma-rail-item is-active' : 'oma-rail-item'}
              onClick={() => { if (r.id === 'overview' || r.id === 'history') setPane(r.id) }}>
              <Icon icon={r.icon as IconName} size={13} />
              <span>{r.label}</span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl">
        {pane === 'overview' ? (
          <>
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Condition</h3>
              <Card compact className="flex items-center gap-2 text-xs">
                <Icon icon={cm.icon as IconName} size={13} className="text-muted-foreground" />
                <span className="font-medium">{cm.label}</span>
                <Tag minimal className="ml-auto">{conditionSummary(a.condition)}</Tag>
              </Card>
            </section>

            <section className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Effects</h3>
                {/* "In sequential execution, if an effect fails, subsequent
                    effects in the sequence will not execute." */}
                <Tag minimal icon={a.execution === 'sequential' ? 'sort' : 'layout-grid'}
                  title={a.execution === 'sequential'
                    ? 'Run in order. A failure stops the sequence — even when a fallback handles it.'
                    : 'Effects execute independently; one failing does not affect the others.'}>
                  {a.execution}
                </Tag>
              </div>
              {a.automation_effects.length === 0 ? (
                <Card compact className="text-xs text-muted-foreground">
                  No effects — the condition is evaluated and nothing runs.
                </Card>
              ) : a.automation_effects.map((e) => {
                const k = kinds.find((x) => x.kind === e.kind)
                return (
                  <Card key={e.id} compact className="text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      {/* Only the orderable kinds take a place in the sequence;
                          a notification is marked instead of numbered. */}
                      {a.execution === 'sequential' && !e.fallback_for && k?.orderable && (
                        <span className="text-muted-foreground tabular-nums">{e.position + 1}.</span>
                      )}
                      <Icon icon="play" size={12} className="text-violet-500" />
                      <span className="font-medium">{e.kind}</span>
                      {k && !k.orderable && a.execution === 'sequential' && (
                        <Tag minimal title="Only action, logic and function effects can be ordered.">
                          not ordered
                        </Tag>
                      )}
                      {k && !k.executable && (
                        <Tag minimal intent="warning" title={k.note}>not executable</Tag>
                      )}
                      {e.fallback_for && <Tag minimal title="Runs after a non-retryable failure">fallback</Tag>}
                    </div>
                    {/* retry_count and retry_interval have been enforced since
                        543 and shown nowhere. "This must be between 1 and 5",
                        "must be less than 24 hours" — automate/retries. */}
                    {e.retry_count !== null && (
                      <div className="text-muted-foreground">
                        Retries {e.retry_count} time{e.retry_count === 1 ? '' : 's'}
                        {e.retry_interval ? `, every ${e.retry_interval}` : ''}
                      </div>
                    )}
                  </Card>
                )
              })}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Summary</h3>
              <Card compact className="text-xs space-y-1">
                <div><span className="text-muted-foreground">Scope</span> · {a.scope} scoped</div>
                {/* Not a status: an automation with auto-mute on is not muted,
                    it is one that will mute itself. statusOf reads `muted`. */}
                <div>
                  <span className="text-muted-foreground">Auto-mute</span> ·{' '}
                  {a.auto_mute ? 'after 80% of 30 events fail' : 'off'}
                </div>
                <div><span className="text-muted-foreground">Last run</span> · {when(a.last_run_at)}</div>
                {/* "configured to have an expiration date or to run
                    indefinitely" — the second is what NULL means. */}
                <div>
                  <span className="text-muted-foreground">Expires</span> ·{' '}
                  {a.expires_at ? when(a.expires_at) : 'Indefinitely'}
                </div>
                <div><span className="text-muted-foreground">Created</span> · {when(a.created_at)}</div>
                {a.description && <div className="pt-1">{a.description}</div>}
              </Card>
            </section>
          </>
        ) : (
          <section className="space-y-4">
            {/* Two halves of one thing, in the order the page describes them:
                "Select an event to view the full execution timeline". The event
                is the firing; the runs are its effects. 622 built the first. */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Event log</h3>
              <p className="text-xs text-muted-foreground">
                One row per firing, plus the metadata changes. Three of Foundry's ten types are
                absent because nothing here produces them — they need a threshold condition or a
                subscriber.
              </p>
              <Card compact className="!p-0">
                {myEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">No events yet.</p>
                ) : (
                  <HTMLTable compact className="w-full text-xs">
                    <thead><tr><th>Event</th><th>Time</th><th>Detail</th></tr></thead>
                    <tbody>{myEvents.map((e) => <EventRow key={e.id} event={e} />)}</tbody>
                  </HTMLTable>
                )}
              </Card>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Effect runs</h3>
              <p className="text-xs text-muted-foreground">What each firing executed.</p>
              <Card compact className="!p-0">
                {mine.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3">Nothing has run yet.</p>
                ) : (
                  <HTMLTable compact className="w-full text-xs">
                    <thead><tr><th>Outcome</th><th>Time</th><th>Attempt</th><th>Errors</th></tr></thead>
                    <tbody>{mine.map((r) => <RunRow key={r.id} run={r} />)}</tbody>
                  </HTMLTable>
                )}
              </Card>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

/** The event's own row. `detail` carries the failure message, which is where
 *  "View failure details in the automation's History tab" lands. */
function EventRow({ event }: { event: AutomationEvent }) {
  return (
    <tr>
      <td>
        <Tag minimal intent={event.event_type === 'evaluation_failed' ? Intent.DANGER : Intent.NONE}>
          {EVENT_LABEL[event.event_type]}
        </Tag>
      </td>
      <td className="text-muted-foreground">{new Date(event.occurred_at).toLocaleString()}</td>
      <td className="text-muted-foreground">{event.detail ?? '—'}</td>
    </tr>
  )
}

function RunRow({ run }: { run: AutomationRun }) {
  const tone = run.outcome === 'failed' ? 'danger'
    : run.outcome === 'succeeded' ? 'success'
      : run.outcome === 'awaiting_retry' ? 'warning' : 'none'
  return (
    <tr>
      <td><Tag minimal intent={tone}>{run.outcome.replace(/_/g, ' ')}</Tag></td>
      <td className="truncate">{when(run.ran_at)}</td>
      <td className="tabular-nums">
        {run.attempt}
        {run.next_attempt_at && (
          <span className="text-muted-foreground"> · next {when(run.next_attempt_at)}</span>
        )}
      </td>
      <td className="text-red-600">{run.error ?? ''}</td>
    </tr>
  )
}

export type { Automation }
