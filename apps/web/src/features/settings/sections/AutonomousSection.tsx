// Flow: configure what the system is allowed to do without human approval.
// Includes a live cron health panel so operators can see the autonomous
// loop's pulse — every number carries derived context (CLAUDE.md self-apply).

import { useState } from 'react'
import {
  Button, Callout, Card, FormGroup, Icon, InputGroup, Intent, Spinner, SpinnerSize, Switch, Tag,
} from '@blueprintjs/core'
import { cn } from '@/lib/utils'
import { getCurrencySymbol } from '@/lib/currency'
import { useActiveHotel, useUpdateAutonomousSettings } from '@/features/hotel/hooks'
import { useCronHealthSummary } from '@/features/monitor/hooks'
import { SectionHeader } from './_shared'

function CronHealthPanel() {
  const { data, isLoading, isError } = useCronHealthSummary()

  if (isLoading) {
    return (
      <Callout icon={<Spinner size={14} />} compact>
        Checking autonomous loop…
      </Callout>
    )
  }
  if (isError || !data) {
    return (
      <Callout intent={Intent.WARNING} icon="warning-sign" compact>
        Health summary unavailable for this role.
      </Callout>
    )
  }

  const cycle = data.jobs.find((j) => j.jobname === 'beacon-intelligence-cycle')
  const failingJobs = data.jobs.filter((j) => j.consecutive_failures >= 2)
  const overallHealthy = failingJobs.length === 0 && data.open_critical === 0

  const cycleStatus =
    cycle?.consecutive_failures && cycle.consecutive_failures >= 2 ? 'failing'
    : (cycle?.last_status === 'succeeded') ? 'healthy'
    : (cycle?.last_status === 'failed') ? 'degraded'
    : 'idle'

  const statusIntent =
    cycleStatus === 'healthy'  ? Intent.SUCCESS
    : cycleStatus === 'failing' ? Intent.DANGER
    : cycleStatus === 'degraded'? Intent.WARNING
    : Intent.NONE

  return (
    <Card compact className="!p-0 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon icon="pulse" size={14} className="text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Autonomous loop status
          </span>
        </div>
        <Tag intent={statusIntent} minimal>
          {cycleStatus === 'healthy'   && 'Healthy'}
          {cycleStatus === 'failing'   && `Failing (${String(cycle?.consecutive_failures ?? 0)} in a row)`}
          {cycleStatus === 'degraded'  && 'Last run failed'}
          {cycleStatus === 'idle'      && 'No runs yet'}
        </Tag>
      </div>

      <div className="px-3 py-2 space-y-1">
        {data.jobs.map((j) => {
          const last = j.last_run_at ? new Date(j.last_run_at) : null
          const ago = last ? Math.round((Date.now() - last.getTime()) / 60000) : null
          const labelMin = ago == null ? '—' : ago < 1 ? 'just now' : ago < 60 ? `${String(ago)}m ago` : `${String(Math.round(ago / 60))}h ago`
          const ok = j.last_status === 'succeeded'
          return (
            <div key={j.jobname} className="flex items-center gap-2 text-[11px] tabular-nums">
              <span
                className={cn(
                  'h-1 w-1 rounded-full inline-block flex-shrink-0',
                  ok ? 'bg-emerald-500' : j.last_status === 'failed' ? 'bg-red-500' : 'bg-muted-foreground/40',
                )}
              />
              <span className="font-mono text-muted-foreground truncate flex-1">{j.jobname}</span>
              <span className="text-muted-foreground/70 shrink-0">{j.schedule}</span>
              <span className={cn('shrink-0 w-16 text-right', ok ? 'text-foreground' : 'text-red-600 dark:text-red-400')}>
                {labelMin}
              </span>
            </div>
          )
        })}
      </div>

      {!overallHealthy && (
        <div className="px-3 py-2 border-t bg-red-50/60 dark:bg-red-950/20 flex items-start gap-2">
          <Icon icon="warning-sign" size={14} className="text-red-600 dark:text-red-400 mt-px flex-shrink-0" />
          <p className="text-[11px] text-red-700 dark:text-red-400 leading-relaxed">
            {data.open_critical > 0 && `${String(data.open_critical)} unacknowledged critical event${data.open_critical === 1 ? '' : 's'}. `}
            {failingJobs.length > 0 && `${String(failingJobs.length)} job${failingJobs.length === 1 ? '' : 's'} failing. `}
            Investigate via <code className="font-mono">cron.job_run_details</code> and <code className="font-mono">system_health_events</code>.
          </p>
        </div>
      )}
    </Card>
  )
}

export function AutonomousSection() {
  const hotel = useActiveHotel()
  const update = useUpdateAutonomousSettings()
  const sym = getCurrencySymbol(hotel?.currency ?? 'USD')

  const [threshold, setThreshold] = useState('')
  const [poEnabled, setPoEnabled] = useState<boolean | null>(null)
  const [tolerance, setTolerance] = useState('')

  const currentThreshold = hotel?.auto_approve_threshold ?? 0
  const currentPoEnabled = hotel?.auto_po_enabled ?? false
  const currentTolerance = hotel?.auto_invoice_tolerance_pct ?? 2

  const effectivePoEnabled = poEnabled ?? currentPoEnabled

  const handleSave = () => {
    const t = parseFloat(threshold || String(currentThreshold))
    const tol = parseFloat(tolerance || String(currentTolerance))
    if (isNaN(t) || isNaN(tol)) return
    update.mutate({
      auto_approve_threshold: t,
      auto_po_enabled: effectivePoEnabled,
      auto_invoice_tolerance_pct: tol,
    })
  }

  const isDirty = threshold !== '' || tolerance !== '' || poEnabled !== null

  if (!hotel) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading hotel…
      </div>
    )
  }

  return (
    <div>
      <SectionHeader
        title="Autonomous Operations"
        description="Configure what the system is allowed to do without human approval. All autonomous actions are fully auditable in the Flow Timeline."
      />
      <div className="space-y-6 max-w-sm">
        <FormGroup
          label="Auto-approve restock threshold"
          helperText={`Pending restock requests with estimated cost at or below this amount are auto-approved. Set to 0 to disable · Current: ${sym}${currentThreshold.toFixed(2)}${currentThreshold === 0 ? ' (disabled)' : ''}`}
        >
          <InputGroup
            type="number"
            min={0}
            step={5}
            leftElement={<span className="px-3 py-1 text-sm text-muted-foreground">{sym}</span>}
            placeholder={String(currentThreshold)}
            value={threshold}
            onChange={(e) => { setThreshold(e.target.value) }}
          />
        </FormGroup>

        <div className="flex items-center justify-between">
          <div className="flex-1 pr-3">
            <p className="text-sm font-medium">Auto-generate Purchase Orders</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              When 3+ approved restocks exist for the same supplier, automatically create a draft PO
            </p>
          </div>
          <Switch
            checked={effectivePoEnabled}
            onChange={(e) => { setPoEnabled(e.currentTarget.checked) }}
            className="!mb-0"
          />
        </div>

        <FormGroup
          label="Invoice auto-approve tolerance"
          helperText={`Invoices with discrepancy at or below this percentage are auto-approved after 3-way match · Current: ${String(currentTolerance)}%`}
        >
          <InputGroup
            type="number"
            min={0}
            max={100}
            step={0.5}
            rightElement={<span className="px-3 py-1 text-xs text-muted-foreground">%</span>}
            placeholder={String(currentTolerance)}
            value={tolerance}
            onChange={(e) => { setTolerance(e.target.value) }}
          />
        </FormGroup>

        <Button
          intent={Intent.PRIMARY}
          onClick={handleSave}
          disabled={!isDirty}
          loading={update.isPending}
        >
          Save autonomous settings
        </Button>

        <CronHealthPanel />

        <Callout intent={Intent.NONE} icon="info-sign" compact title="What's running">
          <p>Intelligence cycle (every 15 min): anomaly alerts, restock proposals, preemptive restocks, stale escalations, discrepancy detection, and the auto-approvals configured above.</p>
          <p>Event-driven triggers (real-time): critical stockouts, PO auto-close on full receipt, consumption-spike detection.</p>
          <p>Weekly: PAR optimization, supplier lead-time learning (Sun 4am UTC), per-variant alert threshold learning (Sun 4:30am UTC), price drift (Mon 6am UTC). Daily: POS variance (5am UTC), proposal-outcomes feedback flywheel (3am UTC).</p>
          <p>Health monitor (every 5 min): scans <code className="font-mono">cron.job_run_details</code>, opens <code className="font-mono">system_health_events</code> rows on failure streaks.</p>
        </Callout>
      </div>
    </div>
  )
}
