// Mind Portfolio — the org-director / owner equivalent of CommandHome.
// Answers "what needs the org now?" by rolling up every hotel in the org
// into a single signal strip + reuses the already-org-wide AutonomousPulse
// and AgentCycleHistory.

import { Card, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { usePortfolioSignals, type PortfolioHotelSignal } from './portfolio'
import { useCronHealthSummary, useAgentCycleHistory } from '@/features/monitor/hooks'
import type { AipTab } from './AIPShell'

export function PortfolioCommandHome({ onNavigate }: { onNavigate: (tab: AipTab) => void }) {
  const { data: hotels = [], isLoading } = usePortfolioSignals()

  const totals = hotels.reduce(
    (acc, h) => ({
      queue:     acc.queue     + h.queue_pending,
      approvals: acc.approvals + h.approvals_pending,
      cases:     acc.cases     + h.cases_open,
      auto24:    acc.auto24    + h.last_cycle_auto,
      queued24:  acc.queued24  + h.last_cycle_queued,
    }),
    { queue: 0, approvals: 0, cases: 0, auto24: 0, queued24: 0 },
  )

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Portfolio</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Org-wide rollup across {String(hotels.length)} hotel{hotels.length === 1 ? '' : 's'}.
            </p>
          </div>
        </header>

        {/* Aggregated signal strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PortfolioTotal label="Queued proposals" value={totals.queue}     icon="predictive-analysis" intent={totals.queue   > 0 ? Intent.PRIMARY : Intent.NONE} onClick={() => { onNavigate('queue') }} />
          <PortfolioTotal label="Pending approvals" value={totals.approvals} icon="warning-sign"        intent={totals.approvals > 0 ? Intent.WARNING : Intent.NONE} onClick={() => { onNavigate('approvals') }} />
          <PortfolioTotal label="Open cases"        value={totals.cases}    icon="folder-open"         intent={totals.cases   > 0 ? Intent.PRIMARY : Intent.NONE} onClick={() => { onNavigate('cases') }} />
          <PortfolioTotal label="Auto-exec last cycle" value={totals.auto24} icon="tick-circle"        intent={totals.auto24  > 0 ? Intent.SUCCESS : Intent.NONE} sub={`+ ${String(totals.queued24)} queued`} />
        </section>

        {/* Hotels at a glance */}
        <section className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hotels</h2>
          <Card compact className="!p-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Spinner size={SpinnerSize.SMALL} />Loading portfolio…
              </div>
            ) : hotels.length === 0 ? (
              <div className="px-4 py-4 text-xs text-muted-foreground">
                No hotels in scope. (Portfolio is admin/owner only; the underlying RPC also requires org scope.)
              </div>
            ) : (
              <ul className="divide-y">
                {hotels.map((h) => <PortfolioHotelRow key={h.hotel_id} h={h} onNavigate={onNavigate} />)}
              </ul>
            )}
          </Card>
        </section>

        {/* Already org-wide — reuse without re-aggregating */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AutonomousPulseInline />
          <AgentCycleSummaryInline />
        </section>
      </div>
    </div>
  )
}

function PortfolioTotal({ label, value, icon, intent, sub, onClick }: {
  label: string; value: number; icon: IconName; intent: Intent; sub?: string; onClick?: () => void
}) {
  const Wrapper = onClick ? 'button' : 'div'
  const accent =
    intent === Intent.DANGER  ? 'border-l-2 border-l-red-500' :
    intent === Intent.WARNING ? 'border-l-2 border-l-amber-400' :
    intent === Intent.PRIMARY ? 'border-l-2 border-l-primary' :
    intent === Intent.SUCCESS ? 'border-l-2 border-l-emerald-500' : ''
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'text-left p-3 rounded border bg-card transition-colors',
        onClick && 'hover:bg-muted/40 hover:border-foreground/20',
        value > 0 && accent,
      )}
    >
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>}
    </Wrapper>
  )
}

function PortfolioHotelRow({ h, onNavigate }: { h: PortfolioHotelSignal; onNavigate: (tab: AipTab) => void }) {
  const lastCycle = h.last_cycle_at ? new Date(h.last_cycle_at) : null
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-xs hover:bg-muted/30 transition-colors">
      <span className="flex-1 truncate font-medium">{h.hotel_name}</span>

      {h.queue_pending > 0 && (
        <button type="button" onClick={() => { onNavigate('queue') }} className="hover:underline">
          <Tag minimal intent={Intent.PRIMARY} className="!text-[10px]">{h.queue_pending} queued</Tag>
        </button>
      )}
      {h.approvals_pending > 0 && (
        <button type="button" onClick={() => { onNavigate('approvals') }} className="hover:underline">
          <Tag minimal intent={Intent.WARNING} className="!text-[10px]">{h.approvals_pending} approvals</Tag>
        </button>
      )}
      {h.cases_open > 0 && (
        <button type="button" onClick={() => { onNavigate('cases') }} className="hover:underline">
          <Tag minimal className="!text-[10px]">{h.cases_open} cases</Tag>
        </button>
      )}

      <span className="text-muted-foreground/70 tabular-nums shrink-0 w-44 text-right">
        {lastCycle
          ? `cycle ${formatDistanceToNow(lastCycle, { addSuffix: true })} · ${String(h.last_cycle_auto)} auto · ${String(h.last_cycle_queued)} queued`
          : 'no cycle yet'}
      </span>
    </li>
  )
}

function AutonomousPulseInline() {
  const { data, isLoading, isError } = useCronHealthSummary()
  if (isLoading) {
    return (
      <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Checking autonomous loop…
      </Card>
    )
  }
  if (isError || !data) {
    return <Card compact className="text-xs text-muted-foreground">Autonomous-loop status unavailable for this role.</Card>
  }
  const failing = data.jobs.filter((j) => j.consecutive_failures >= 2)
  const healthy = failing.length === 0 && data.open_critical === 0
  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="pulse" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Autonomous loop · org-wide</span>
        </div>
        <Tag minimal intent={healthy ? Intent.SUCCESS : failing.length > 0 ? Intent.DANGER : Intent.WARNING}>
          {healthy ? 'Healthy' : failing.length > 0 ? `${String(failing.length)} failing` : 'Attention'}
        </Tag>
      </div>
      <div className="px-4 py-3 text-xs text-muted-foreground">
        {data.jobs.length} jobs tracked · {data.open_critical} unacknowledged critical
      </div>
    </Card>
  )
}

function AgentCycleSummaryInline() {
  const { data, isLoading, isError } = useAgentCycleHistory(3)
  if (isLoading) {
    return (
      <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading agent cycles…
      </Card>
    )
  }
  if (isError || !data) {
    return <Card compact className="text-xs text-muted-foreground">Agent cycle history unavailable for this role.</Card>
  }
  const runs = data.runs
  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="history" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Agent cycles · last {String(runs.length || 3)}</span>
        </div>
      </div>
      {runs.length === 0 ? (
        <div className="px-4 py-3 text-xs text-muted-foreground">No agent cycles recorded yet.</div>
      ) : (
        <ul className="divide-y">
          {runs.map((r) => (
            <li key={r.ran_at} className="px-4 py-2 text-xs flex items-center gap-3">
              <span className="text-muted-foreground tabular-nums shrink-0 w-32">{formatDistanceToNow(new Date(r.ran_at), { addSuffix: true })}</span>
              <span className="flex-1 text-muted-foreground/80">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{r.auto_executed}</span> auto · <span className="text-amber-600 dark:text-amber-400 font-semibold tabular-nums">{r.queued}</span> queued · {r.hotels.length} hotel{r.hotels.length === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
