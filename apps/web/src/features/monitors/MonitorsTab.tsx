// Monitors — the Studio surface where every detector's trigger is operator-tunable
// data, not hardcoded. The metric (deterministic) stays in code; the thresholds
// below are numbers the operator owns, edited with sliders or plain English, and
// honored everywhere the app detects. Expiry also has a typed effect (WRITE_OFF
// → Decisions); the others tune the surfacing band that feeds Signals + Decisions.

import { useEffect, useState, type ReactNode } from 'react'
import {
  Button, Callout, Card, Icon, InputGroup, Intent, NumericInput, Spinner, SpinnerSize, Switch, Tag,
} from '@blueprintjs/core'
import type { IconName } from '@blueprintjs/icons'
import { parseExpiryTuning, type OrgPolicy } from '@beacon/reality-graph'
import { useAuthStore } from '@/stores/auth.store'
import { useMonitorPolicy, useSetMonitors } from './hooks'
import { useExpiryMonitorSweep, type ExpiryScanResult } from './useExpiryMonitorSweep'

type Monitors = OrgPolicy['monitors']

function NumField({ label, value, onChange, min = 0, max, step = 1, disabled }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number; disabled: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <NumericInput value={value} min={min} max={max} stepSize={step} disabled={disabled} style={{ width: 90 }}
        onValueChange={(v) => { if (!Number.isNaN(v)) onChange(Math.max(min, max != null ? Math.min(max, v) : v)) }} />
    </label>
  )
}

function MonitorShell({ icon, title, enabled, effect, onToggle, canEdit, children }: {
  icon: IconName; title: string; enabled: boolean; effect: string; onToggle: (b: boolean) => void; canEdit: boolean; children: ReactNode
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Icon icon={icon} size={14} /> {title}
          <Tag minimal intent={enabled ? Intent.SUCCESS : Intent.NONE}>{enabled ? 'Active' : 'Off'}</Tag>
        </h2>
        <Switch checked={enabled} disabled={!canEdit} label="Enabled" className="!mb-0"
          onChange={(e) => { onToggle(e.currentTarget.checked) }} />
      </div>
      {children}
      <div className="text-[11px] text-muted-foreground">{effect}</div>
    </Card>
  )
}

export default function MonitorsTab() {
  const role = useAuthStore((s) => s.role)
  const canEdit = role === 'admin' || role === 'owner'
  const { data, isLoading } = useMonitorPolicy()
  const saved = data?.merged.monitors
  const setMonitors = useSetMonitors()
  const sweep = useExpiryMonitorSweep()

  const [draft, setDraft] = useState<Monitors | null>(null)
  const [nl, setNl] = useState('')
  const [nlNote, setNlNote] = useState<string | null>(null)
  const [scan, setScan] = useState<ExpiryScanResult | null>(null)

  useEffect(() => { if (saved && !draft) setDraft(saved) }, [saved, draft])

  if (isLoading || !draft) {
    return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Loading monitors…</div>
  }

  const dirty = saved != null && JSON.stringify(draft) !== JSON.stringify(saved)
  const patch = <K extends keyof Monitors>(key: K, p: Partial<Monitors[K]>) => {
    setDraft({ ...draft, [key]: { ...draft[key], ...p } }); setScan(null)
  }

  const applyNl = () => {
    const r = parseExpiryTuning(nl, draft.expiry)
    if (r.understood) { setDraft({ ...draft, expiry: r.rule }); setNlNote(`Applied to expiry: ${r.changed.join(', ')}. Review and Save.`); setNl(''); setScan(null) }
    else setNlNote("Didn't catch a change. Try: “set expiry to 10 days”, “ignore under €50”, “disable”.")
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 py-6 max-w-3xl space-y-5">
        <header>
          <h1 className="text-xl font-semibold">Monitors</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each monitor watches a deterministic metric and fires when its trigger crosses. The trigger is data you tune — no redeploy.
            Bands feed Signals and Decisions through the same gate as every agent.
          </p>
        </header>

        {/* Expiry — full monitor with a typed effect */}
        <MonitorShell icon="time" title="Expiry monitor" enabled={draft.expiry.enabled} canEdit={canEdit}
          effect="Effect — proposes WRITE_OFF → Decisions (always queued; write-offs never auto-execute)."
          onToggle={(b) => { patch('expiry', { enabled: b }) }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metric — days until expiry · € at risk</div>
          <div className="flex flex-wrap items-end gap-6">
            <NumField label="Fire within (days)" value={draft.expiry.threshold_days} max={365} step={1} disabled={!canEdit}
              onChange={(n) => { patch('expiry', { threshold_days: Math.round(n) }) }} />
            <NumField label="Ignore under (€)" value={draft.expiry.min_cost_at_risk} step={5} disabled={!canEdit}
              onChange={(n) => { patch('expiry', { min_cost_at_risk: n }) }} />
          </div>
          <Switch checked={draft.expiry.auto_propose} disabled={!canEdit} label="Auto-propose write-offs each cycle" className="!mb-0"
            onChange={(e) => { patch('expiry', { auto_propose: e.currentTarget.checked }) }} />
          <div className="pt-1 space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Adjust in plain English</span>
            <div className="flex gap-2">
              <InputGroup fill value={nl} disabled={!canEdit} placeholder="e.g. alert 10 days before expiry, ignore under €50"
                onChange={(e) => { setNl(e.currentTarget.value) }} onKeyDown={(e) => { if (e.key === 'Enter') applyNl() }} />
              <Button text="Apply" disabled={!canEdit || nl.trim().length === 0} onClick={applyNl} />
            </div>
            {nlNote && <p className="text-xs text-muted-foreground">{nlNote}</p>}
          </div>
        </MonitorShell>

        {/* Stockout — surfacing band; proposal path is restock_advisor */}
        <MonitorShell icon="trending-down" title="Stockout monitor" enabled={draft.stockout.enabled} canEdit={canEdit}
          effect="Effect — surfaces in Signals; the restock proposal path (restock_advisor) is unchanged."
          onToggle={(b) => { patch('stockout', { enabled: b }) }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metric — days until zero</div>
          <NumField label="Surface within (days)" value={draft.stockout.threshold_days} max={365} disabled={!canEdit}
            onChange={(n) => { patch('stockout', { threshold_days: Math.round(n) }) }} />
        </MonitorShell>

        {/* Waste anomaly */}
        <MonitorShell icon="flame" title="Waste monitor" enabled={draft.waste.enabled} canEdit={canEdit}
          effect="Effect — surfaces anomalies in Signals (investigate / PAR-adjust proposal coming)."
          onToggle={(b) => { patch('waste', { enabled: b }) }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metric — anomaly score (1–10)</div>
          <NumField label="Surface at score ≥" value={draft.waste.min_anomaly_score} max={10} disabled={!canEdit}
            onChange={(n) => { patch('waste', { min_anomaly_score: n }) }} />
        </MonitorShell>

        {/* Supplier risk */}
        <MonitorShell icon="shield" title="Supplier monitor" enabled={draft.supplier.enabled} canEdit={canEdit}
          effect="Effect — surfaces at-risk suppliers in Signals (re-rank / switch proposal coming)."
          onToggle={(b) => { patch('supplier', { enabled: b }) }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metric — reliability score (0–10, lower is worse)</div>
          <NumField label="Surface at score ≤" value={draft.supplier.max_reliability_score} max={10} disabled={!canEdit}
            onChange={(n) => { patch('supplier', { max_reliability_score: n }) }} />
        </MonitorShell>

        {!canEdit && <Callout intent={Intent.NONE} icon="lock">Read-only — an admin or owner can tune these monitors.</Callout>}

        <div className="flex items-center gap-2 sticky bottom-0 bg-background py-2">
          <Button intent={Intent.PRIMARY} text="Save" icon="tick" disabled={!canEdit || !dirty || setMonitors.isPending}
            loading={setMonitors.isPending}
            onClick={() => { setMonitors.mutate(draft, { onSuccess: () => { setNlNote('Saved.') } }) }} />
          <Button text="Run expiry scan now" icon="play" disabled={!draft.expiry.enabled || sweep.isPending} loading={sweep.isPending}
            onClick={() => { sweep.mutate(undefined, { onSuccess: (r) => { setScan(r) } }) }} />
          {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>}
          {setMonitors.isError && <span className="text-xs text-red-500">{setMonitors.error.message}</span>}
          {sweep.isError && <span className="text-xs text-red-500">{sweep.error.message}</span>}
        </div>

        {scan && (
          <Callout intent={scan.proposalsCreated > 0 ? Intent.PRIMARY : Intent.SUCCESS} icon={scan.proposalsCreated > 0 ? 'inbox' : 'tick-circle'}>
            Scanned {scan.scanned} batch{scan.scanned === 1 ? '' : 'es'} · {scan.fired} within trigger · {scan.proposalsCreated} write-off proposal{scan.proposalsCreated === 1 ? '' : 's'} queued in Decisions.
          </Callout>
        )}
      </div>
    </div>
  )
}
