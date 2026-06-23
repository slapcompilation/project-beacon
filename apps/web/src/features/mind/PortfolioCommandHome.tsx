// Mind Portfolio — the org-director / owner equivalent of CommandHome.
// Answers "what needs the org now?" by rolling up every hotel in the org
// into a single signal strip + reuses the already-org-wide AutonomousPulse
// and AgentCycleHistory.

import { useState } from 'react'
import { Button, Card, Icon, Intent, Spinner, SpinnerSize, Tag } from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { usePortfolioSignals, type PortfolioHotelSignal } from './portfolio'
import { useCronHealthSummary, useAgentCycleHistory } from '@/features/monitor/hooks'
import { useOrgOverstockSweep, type OrgSweepResult } from '@/features/agents/useOrgOverstockSweep'
import { useAppStore } from '@/stores/app.store'
import type { AipTab } from './AIPShell'

export function PortfolioCommandHome({ onNavigate, onHopToHotel }: {
  onNavigate: (tab: AipTab) => void
  /** Override the drill-in. Default (Mind): switch scope + open the hotel's
   *  Command. Home passes its own so drilling stays on Home as that property. */
  onHopToHotel?: (hotelId: string) => void
}) {
  const { data: hotels = [], isLoading } = usePortfolioSignals()
  const sweep = useOrgOverstockSweep()
  const [lastSweep, setLastSweep] = useState<OrgSweepResult | null>(null)
  const enterHotelScope = useAppStore((s) => s.enterHotelScope)

  const hopToHotel = (hotelId: string) => {
    if (onHopToHotel) { onHopToHotel(hotelId); return }
    enterHotelScope(hotelId)
    onNavigate('command')
  }

  const runSweep = () => {
    sweep.mutate(undefined, {
      onSuccess: (r) => {
        setLastSweep(r)
        toast.success(`Sweep: ${String(r.proposalsCreated)} proposals across ${String(r.hotelsScanned)} hotel${r.hotelsScanned === 1 ? '' : 's'}`)
      },
      onError: (err: Error) => { toast.error(err.message) },
    })
  }

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
          <Button
            icon="exchange"
            intent={Intent.PRIMARY}
            onClick={runSweep}
            loading={sweep.isPending}
            disabled={hotels.length === 0}
          >
            Sweep overstock
          </Button>
        </header>

        {lastSweep && <OrgSweepSummary result={lastSweep} onNavigate={onNavigate} />}

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
          {isLoading ? (
            <Card compact className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size={SpinnerSize.SMALL} />Loading portfolio…
            </Card>
          ) : hotels.length === 0 ? (
            <Card compact className="text-xs text-muted-foreground">
              No hotels in scope. (Portfolio is admin/owner only; the underlying RPC also requires org scope.)
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {hotels.map((h) => (
                <OrgHotelTile
                  key={h.hotel_id}
                  h={h}
                  onHop={() => { hopToHotel(h.hotel_id) }}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          )}
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

function OrgHotelTile({ h, onHop, onNavigate }: {
  h: PortfolioHotelSignal
  onHop: () => void
  onNavigate: (tab: AipTab) => void
}) {
  const lastCycle = h.last_cycle_at ? new Date(h.last_cycle_at) : null
  const totalSignals = h.queue_pending + h.approvals_pending + h.cases_open
  const accent =
    h.approvals_pending > 0 ? 'border-l-2 border-l-amber-400' :
    h.queue_pending     > 0 ? 'border-l-2 border-l-primary'   :
    'border-l-2 border-l-emerald-500'
  return (
    <Card compact className={cn('!p-0 overflow-hidden', accent)}>
      <button
        type="button"
        onClick={onHop}
        className="flex w-full items-center justify-between px-3 py-2 border-b bg-muted/20 hover:bg-muted/40 transition-colors text-left"
        title="Open this hotel's Command home"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Icon icon="home" size={13} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{h.hotel_name}</span>
        </span>
        <Icon icon="arrow-right" size={12} className="text-muted-foreground/70 shrink-0" />
      </button>
      <div className="px-3 py-2.5 space-y-2">
        {totalSignals === 0 ? (
          <p className="text-[11px] text-muted-foreground">No open signals.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
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
          </div>
        )}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/80">
          <span>
            {lastCycle ? `cycle ${formatDistanceToNow(lastCycle, { addSuffix: true })}` : 'no cycle yet'}
          </span>
          {lastCycle && (
            <span className="tabular-nums">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{h.last_cycle_auto}</span> auto · <span className="text-amber-600 dark:text-amber-400 font-semibold">{h.last_cycle_queued}</span> queued
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

function OrgSweepSummary({ result, onNavigate }: { result: OrgSweepResult; onNavigate: (tab: AipTab) => void }) {
  const proposed = result.items.filter((i) => i.outcome === 'proposed')
  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="exchange" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Last sweep · org_overstock_balancer · {formatDistanceToNow(new Date(result.ranAt), { addSuffix: true })}
          </span>
        </div>
        {result.proposalsCreated > 0 && (
          <button type="button" onClick={() => { onNavigate('queue') }} className="text-[11px] text-primary hover:underline">
            Review {result.proposalsCreated} in queue →
          </button>
        )}
      </div>
      <div className="px-4 py-2 text-xs text-muted-foreground flex items-center gap-3">
        <span>{result.hotelsScanned} hotel{result.hotelsScanned === 1 ? '' : 's'} scanned</span>
        <span>·</span>
        <span>{result.variantsScanned} overstocked variants</span>
        <span>·</span>
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{result.proposalsCreated} proposals</span>
      </div>
      {proposed.length > 0 && (
        <ul className="divide-y max-h-48 overflow-y-auto">
          {proposed.slice(0, 10).map((i) => (
            <li key={i.proposalId ?? `${i.hotelId}-${i.variantId}`} className="px-4 py-1.5 text-xs flex items-center gap-2">
              <Tag minimal className="font-mono !text-[10px]">{i.actionType}</Tag>
              <span className="text-muted-foreground/80 flex-1 truncate">{i.variantName}</span>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">{i.hotelName}</span>
              {i.confidence != null && <span className="tabular-nums text-muted-foreground/70 shrink-0">{Math.round(i.confidence * 100)}%</span>}
            </li>
          ))}
        </ul>
      )}
    </Card>
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
