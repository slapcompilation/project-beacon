// Flywheel health — "is the system getting better?" One read-only Studio view that
// composes existing signals: decision calibration (does stated confidence match
// reality), the autonomous loop's recent runs, and per-agent reliability. No new
// backend — it reuses the calibration + monitor hooks and links to the deep pages.

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, HTMLSelect, Icon, Intent, NonIdealState, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { useDecisionCalibration, type CalibrationWindow } from '@/features/calibration/hooks'
import { useAgentCycleHistory, useCronHealthSummary } from '@/features/monitor/hooks'

const VERDICT: Record<string, { label: string; intent: Intent }> = {
  'well-calibrated':   { label: 'Well-calibrated', intent: Intent.SUCCESS },
  'overconfident':     { label: 'Overconfident',   intent: Intent.DANGER },
  'underconfident':    { label: 'Underconfident',  intent: Intent.WARNING },
  'insufficient-data': { label: 'Not enough data', intent: Intent.NONE },
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  )
}

export default function FlywheelPage() {
  const [windowDays, setWindowDays] = useState<CalibrationWindow>(90)
  const { calibration, isLoading: calLoading } = useDecisionCalibration(windowDays)
  const cycles = useAgentCycleHistory(8)
  const cron   = useCronHealthSummary()

  const overall = calibration?.overall
  const verdict = overall ? (VERDICT[overall.verdict] ?? VERDICT['insufficient-data']) : null
  const runs    = cycles.data?.runs ?? []
  const openCritical = cron.data?.open_critical ?? 0

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-4xl space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Flywheel</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Is the system getting better? Decision calibration, the autonomous loop, and per-agent reliability.
            </p>
          </div>
          <HTMLSelect
            value={windowDays}
            onChange={(e) => { setWindowDays(Number(e.currentTarget.value) as CalibrationWindow) }}
            options={[
              { value: 30, label: 'Last 30 days' },
              { value: 90, label: 'Last 90 days' },
              { value: 0,  label: 'All time' },
            ]}
          />
        </header>

        {/* ── Decision calibration ── */}
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Icon icon="timeline-line-chart" size={14} /> Decision calibration
            </h2>
            <Link to="/mind?aip=calibration" className="text-xs text-primary hover:underline">Full calibration →</Link>
          </div>
          {calLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Loading…</div>
          ) : !overall || !overall.sufficientData ? (
            <p className="text-xs text-muted-foreground">
              Not enough resolved decisions yet{overall ? ` (${String(overall.resolved)} scored)` : ''} — calibration sharpens as operators approve/reject more proposals.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-8">
              {verdict && <Tag size="large" intent={verdict.intent} minimal>{verdict.label}</Tag>}
              <Metric label="Decisions scored" value={String(overall.resolved)} />
              <Metric label="Calibration error (ECE)" value={`${String(Math.round(overall.ece * 100))}%`} sub="lower is better" />
              <Metric label="Brier" value={overall.brier.toFixed(3)} sub="lower is better" />
              <Metric label="Claimed vs actual" value={`${String(Math.round(overall.meanConfidence * 100))}% / ${String(Math.round(overall.accuracy * 100))}%`} sub="mean confidence / hit rate" />
            </div>
          )}
        </Card>

        {/* ── Autonomous loop ── */}
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Icon icon="pulse" size={14} /> Autonomous loop
              {openCritical > 0 && <Tag intent={Intent.DANGER} minimal>{String(openCritical)} critical</Tag>}
            </h2>
            <Link to="/monitor" className="text-xs text-primary hover:underline">Monitor →</Link>
          </div>
          {cycles.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Loading…</div>
          ) : runs.length === 0 ? (
            <p className="text-xs text-muted-foreground">The cycle hasn’t run yet. It sweeps at-risk stock, runs the agents, auto-executes confident proposals and queues the rest.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {runs.map((r) => (
                <div key={r.ran_at} className="flex items-center justify-between py-1.5 text-xs">
                  <span className="text-muted-foreground">{format(new Date(r.ran_at), 'MMM d, HH:mm')}</span>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">{String(r.auto_executed)} auto</span>
                    <span className="text-amber-600 dark:text-amber-400">{String(r.queued)} queued</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Per-agent reliability ── */}
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Icon icon="predictive-analysis" size={14} /> Per-agent reliability
          </h2>
          {!calibration || calibration.byAgent.length === 0 ? (
            <p className="text-xs text-muted-foreground">No per-agent calibration yet in this window.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {calibration.byAgent.map((s) => {
                const v = VERDICT[s.report.verdict] ?? VERDICT['insufficient-data']
                return (
                  <div key={s.key} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="font-medium">{s.key}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground tabular-nums">{String(s.report.resolved)} scored</span>
                      {s.report.sufficientData && (
                        <span className="text-muted-foreground tabular-nums">ECE {String(Math.round(s.report.ece * 100))}%</span>
                      )}
                      <Tag intent={v.intent} minimal className={cn('!text-[10px]')}>{v.label}</Tag>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {cron.data && (
          <p className="text-[11px] text-muted-foreground">
            Loop health evaluated {formatDistanceToNow(new Date(cron.data.evaluated_at), { addSuffix: true })}.
          </p>
        )}

        {!calibration && !calLoading && (
          <NonIdealState icon="pulse" title="No flywheel signal yet" description="Run the cycle and resolve some proposals to populate this view." />
        )}
      </div>
    </div>
  )
}
