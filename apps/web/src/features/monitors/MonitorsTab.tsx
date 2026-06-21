// Monitors — the Studio surface where a detector's trigger is operator-tunable
// data, not hardcoded. The metric (days until expiry, € at risk) is a
// deterministic tool; the threshold below is a number the operator owns, edited
// with sliders or plain English, and honored everywhere the app detects expiry.

import { useEffect, useState } from 'react'
import {
  Button, Callout, Card, Icon, InputGroup, Intent, NumericInput, Spinner, SpinnerSize, Switch, Tag,
} from '@blueprintjs/core'
import { parseExpiryTuning, type ExpiryMonitorConfig } from '@beacon/reality-graph'
import { useAuthStore } from '@/stores/auth.store'
import { useMonitorPolicy, useSetExpiryMonitor } from './hooks'
import { useExpiryMonitorSweep, type ExpiryScanResult } from './useExpiryMonitorSweep'

function eq(a: ExpiryMonitorConfig, b: ExpiryMonitorConfig): boolean {
  return a.enabled === b.enabled && a.threshold_days === b.threshold_days
    && a.min_cost_at_risk === b.min_cost_at_risk && a.auto_propose === b.auto_propose
}

export default function MonitorsTab() {
  const role = useAuthStore((s) => s.role)
  const canEdit = role === 'admin' || role === 'owner'
  const { data, isLoading } = useMonitorPolicy()
  const saved = data?.merged.monitors.expiry
  const setMonitor = useSetExpiryMonitor()
  const sweep = useExpiryMonitorSweep()

  const [draft, setDraft] = useState<ExpiryMonitorConfig | null>(null)
  const [nl, setNl] = useState('')
  const [nlNote, setNlNote] = useState<string | null>(null)
  const [scan, setScan] = useState<ExpiryScanResult | null>(null)

  useEffect(() => { if (saved && !draft) setDraft(saved) }, [saved, draft])

  if (isLoading || !draft) {
    return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Loading monitors…</div>
  }

  const dirty = saved != null && !eq(draft, saved)
  const set = (patch: Partial<ExpiryMonitorConfig>) => { setDraft({ ...draft, ...patch }); setScan(null) }

  const applyNl = () => {
    const r = parseExpiryTuning(nl, draft)
    if (r.understood) { setDraft(r.rule); setNlNote(`Applied: ${r.changed.join(', ')}. Review and Save.`); setNl(''); setScan(null) }
    else setNlNote("Didn't catch a change there. Try: “set expiry to 10 days”, “ignore under €50”, “disable”.")
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-3xl space-y-5">
        <header>
          <h1 className="text-xl font-semibold">Monitors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            A monitor watches a deterministic metric and fires a typed proposal when its trigger crosses.
            The trigger is data you tune — no redeploy. Fired proposals route to Decisions through the same gate as every agent.
          </p>
        </header>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Icon icon="time" size={14} /> Expiry monitor
              <Tag minimal intent={draft.enabled ? Intent.SUCCESS : Intent.NONE}>{draft.enabled ? 'Active' : 'Off'}</Tag>
            </h2>
            <Switch checked={draft.enabled} disabled={!canEdit} label="Enabled" className="!mb-0"
              onChange={(e) => { set({ enabled: e.currentTarget.checked }) }} />
          </div>

          <div className="text-xs text-muted-foreground">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Metric</span> — days until expiry · € at risk (deterministic tool)
          </div>

          <div className="flex flex-wrap items-end gap-6">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fire when within (days)</span>
              <NumericInput value={draft.threshold_days} min={0} max={365} stepSize={1} disabled={!canEdit} majorStepSize={7}
                onValueChange={(v) => { if (!Number.isNaN(v)) set({ threshold_days: Math.max(0, Math.min(365, Math.round(v))) }) }} style={{ width: 90 }} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Ignore under (€ at risk)</span>
              <NumericInput value={draft.min_cost_at_risk} min={0} stepSize={5} disabled={!canEdit}
                onValueChange={(v) => { if (!Number.isNaN(v)) set({ min_cost_at_risk: Math.max(0, v) }) }} style={{ width: 90 }} />
            </label>
          </div>

          <div className="text-xs text-muted-foreground pt-1">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Effect</span> — proposes <code>WRITE_OFF</code> → Decisions. Always queued for review (write-offs never auto-execute).
          </div>
          <Switch checked={draft.auto_propose} disabled={!canEdit} label="Auto-propose write-offs on each cycle" className="!mb-0"
            onChange={(e) => { set({ auto_propose: e.currentTarget.checked }) }} />

          {/* NL tuning */}
          <div className="pt-2 border-t border-border/50 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Adjust in plain English</span>
            <div className="flex gap-2">
              <InputGroup fill value={nl} disabled={!canEdit} placeholder="e.g. alert 10 days before expiry, ignore under €50"
                onChange={(e) => { setNl(e.currentTarget.value) }}
                onKeyDown={(e) => { if (e.key === 'Enter') applyNl() }} />
              <Button text="Apply" disabled={!canEdit || nl.trim().length === 0} onClick={applyNl} />
            </div>
            {nlNote && <p className="text-xs text-muted-foreground">{nlNote}</p>}
          </div>

          {!canEdit && <Callout intent={Intent.NONE} icon="lock">Read-only — an admin or owner can tune this monitor.</Callout>}

          <div className="flex items-center gap-2 pt-1">
            <Button intent={Intent.PRIMARY} text="Save" icon="tick" disabled={!canEdit || !dirty || setMonitor.isPending}
              loading={setMonitor.isPending}
              onClick={() => { setMonitor.mutate(draft, { onSuccess: () => { setNlNote('Saved.') } }) }} />
            <Button text="Run scan now" icon="play" disabled={!draft.enabled || sweep.isPending} loading={sweep.isPending}
              onClick={() => { sweep.mutate(undefined, { onSuccess: (r) => { setScan(r) } }) }} />
            {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            {setMonitor.isError && <span className="text-xs text-red-500">{setMonitor.error.message}</span>}
            {sweep.isError && <span className="text-xs text-red-500">{sweep.error.message}</span>}
          </div>

          {scan && (
            <Callout intent={scan.proposalsCreated > 0 ? Intent.PRIMARY : Intent.SUCCESS} icon={scan.proposalsCreated > 0 ? 'inbox' : 'tick-circle'}>
              Scanned {scan.scanned} batch{scan.scanned === 1 ? '' : 'es'} · {scan.fired} within trigger · {scan.proposalsCreated} write-off proposal{scan.proposalsCreated === 1 ? '' : 's'} queued in Decisions.
            </Callout>
          )}
        </Card>
      </div>
    </div>
  )
}
