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
import { classifyIntegrationHealth, parseExpiryTuning, type OrgPolicy } from '@beacon/reality-graph'
import { useAuthStore } from '@/stores/auth.store'
import { useMonitorPolicy, useSetMonitors } from './hooks'
import { aiTuneMonitors } from './aiTune'
import { useExpiryMonitorSweep, type ExpiryScanResult } from './useExpiryMonitorSweep'
import { useMonitorCaseSweep, type MonitorKind, type CaseSweepResult } from './useMonitorCaseSweep'
import { useSourceRegistry, freshnessIntent } from './useSourceRegistry'
import { useSourceHealthSweep } from './useSourceHealthSweep'

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

function CaseScanRow({ kind, enabled, running, result, onRun }: {
  kind: MonitorKind; enabled: boolean; running: MonitorKind | null; result: CaseSweepResult | null; onRun: (k: MonitorKind) => void
}) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button size="small" icon="play" text="Run scan now" disabled={!enabled || running !== null} loading={running === kind}
        onClick={() => { onRun(kind) }} />
      {result?.kind === kind && (
        <span className="text-xs text-muted-foreground">
          {result.fired} fired · {result.opened} case{result.opened === 1 ? '' : 's'} opened{result.reused > 0 ? ` · ${result.reused} existing` : ''}
        </span>
      )}
    </div>
  )
}

/** Registered sources (5.5/5.6). Foundry's shape: a source is a row, and its
 *  health is a freshness check over it — not a function per connector type.
 *
 *  The registry supplies the METRIC (data age, run age, backlog); the operator's
 *  SLA in org policy is still the TRIGGER, applied by the same
 *  classifyIntegrationHealth the per-connector readout used. Reading thresholds
 *  off source_freshness's built-in 24/48h would have traded config-as-data back
 *  for hardcoded numbers, which is the wrong direction. */
function SourceRegistryReadout({ enabled }: { enabled: boolean }) {
  const { data, isLoading, isError, error } = useSourceRegistry()
  const { data: policy } = useMonitorPolicy()
  const rule = policy?.merged.monitors.integration
  const sweep = useSourceHealthSweep()

  if (!enabled) return <p className="text-xs text-muted-foreground">Monitor off — sources aren&apos;t being checked.</p>
  if (isLoading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Reading the source registry…</div>
  }
  if (isError) return <p className="text-xs text-red-500">{error instanceof Error ? error.message : 'Failed to read registry'}</p>
  if (!data || data.length === 0) {
    return (
      <Callout intent={Intent.NONE} icon="database">
        No sources registered. A source is a row — where its rows land, what identifies them, and what they become — so registering one needs no deployment.
      </Callout>
    )
  }

  // A source with a backlog column is judged on how long its oldest unprocessed
  // row has waited; a live feed on how long since it last fed us.
  const hits = rule?.enabled
    ? data.map((s) => classifyIntegrationHealth({
        sourceKey:      s.api_name,
        label:          s.label,
        kind:           s.pending_count === null ? 'pos' : 'documents',
        lastActivityAt: s.data_changed_at,
        totalEvents:    0,
        pendingCount:   s.pending_count ?? undefined,
        oldestPendingAt: s.oldest_pending_at,
      }, rule)).sort((a, b) => b.urgency - a.urgency)
    : []

  const INTENT = { danger: Intent.DANGER, warning: Intent.WARNING, success: Intent.SUCCESS, none: Intent.NONE } as const
  const hours = (h: number | null) => h === null ? '—' : h < 48 ? `${String(Math.round(h))}h` : `${String(Math.round(h / 24))}d`
  const byName = new Map(hits.map((h) => [h.sourceKey, h]))
  const downCount = hits.filter((h) => h.status === 'down' || h.status === 'never').length

  return (
    <div className="divide-y divide-border rounded border">
      {data.map((s) => {
        const hit = byName.get(s.api_name)
        return (
          <div key={s.api_name} className="flex items-start justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="truncate text-sm font-medium">{s.label}</span>
                <Tag minimal intent={INTENT[freshnessIntent(s.verdict)]}>{s.verdict}</Tag>
                {hit && <Tag minimal intent={hit.status === 'down' ? Intent.DANGER : hit.status === 'stale' ? Intent.WARNING : Intent.NONE}>
                  vs your SLA: {hit.status}
                </Tag>}
                {!s.ontologized && <Tag minimal icon="help">not ontologized</Tag>}
                {s.deadLetters > 0 && <Tag minimal intent={Intent.DANGER} icon="inbox">{s.deadLetters} dead-lettered</Tag>}
              </div>
              {s.reconciliation && <div className="text-[11px] text-muted-foreground">{s.reconciliation}</div>}
              {hit && <div className="text-[11px] text-muted-foreground">{hit.detail}</div>}
            </div>
            <div className="shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
              <div>data <span className="font-semibold text-foreground">{hours(s.data_age_hours)}</span> old</div>
              <div>{s.last_run_at ? `ran ${hours(s.run_age_hours)} ago` : 'never ran'}</div>
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-2 px-3 py-2">
        <Button size="small" icon="notifications" loading={sweep.isPending}
          disabled={downCount === 0 || sweep.isPending}
          text={downCount > 0 ? `Notify me — ${String(downCount)} source${downCount === 1 ? '' : 's'} down` : 'All sources reporting'}
          onClick={() => { sweep.mutate() }} />
        {sweep.data && (
          <span className="text-xs text-muted-foreground">
            {sweep.data.raised > 0
              ? `${String(sweep.data.raised)} alert${sweep.data.raised === 1 ? '' : 's'} raised`
              : sweep.data.actionable > 0 ? 'Already alerted' : 'Nothing to alert'}
          </span>
        )}
        {sweep.isError && <span className="text-xs text-red-500">{sweep.error.message}</span>}
      </div>
    </div>
  )
}

export default function MonitorsTab() {
  const role = useAuthStore((s) => s.role)
  const canEdit = role === 'admin' || role === 'owner'
  const { data, isLoading } = useMonitorPolicy()
  const saved = data?.merged.monitors
  const setMonitors = useSetMonitors()
  const sweep = useExpiryMonitorSweep()
  const caseSweep = useMonitorCaseSweep()

  const [draft, setDraft] = useState<Monitors | null>(null)
  const [nl, setNl] = useState('')
  const [nlNote, setNlNote] = useState<string | null>(null)
  const [nlBusy, setNlBusy] = useState(false)
  const [scan, setScan] = useState<ExpiryScanResult | null>(null)
  const [caseRunning, setCaseRunning] = useState<MonitorKind | null>(null)
  const [caseResult, setCaseResult] = useState<CaseSweepResult | null>(null)
  const runCaseScan = (kind: MonitorKind) => {
    setCaseRunning(kind); setCaseResult(null)
    caseSweep.mutate(kind, { onSuccess: (r) => { setCaseResult(r) }, onSettled: () => { setCaseRunning(null) } })
  }

  useEffect(() => { if (saved && !draft) setDraft(saved) }, [saved, draft])

  if (isLoading || !draft) {
    return <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground"><Spinner size={SpinnerSize.SMALL} /> Loading monitors…</div>
  }

  const dirty = saved != null && JSON.stringify(draft) !== JSON.stringify(saved)
  const patch = <K extends keyof Monitors>(key: K, p: Partial<Monitors[K]>) => {
    setDraft({ ...draft, [key]: { ...draft[key], ...p } }); setScan(null)
  }

  // Heuristic first (instant, offline, expiry shapes); fall back to the LLM for
  // anything else and for the other monitors. Same signature either way.
  const applyNl = async () => {
    const fast = parseExpiryTuning(nl, draft.expiry)
    if (fast.understood) {
      setDraft({ ...draft, expiry: fast.rule }); setNlNote(`Applied: ${fast.changed.join(', ')}. Review and Save.`); setNl(''); setScan(null); return
    }
    setNlBusy(true); setNlNote(null)
    try {
      const r = await aiTuneMonitors(nl, draft)
      setDraft(r.monitors); setNlNote(`${r.summary} Review and Save.`); setNl(''); setScan(null)
    } catch (e) {
      setNlNote(`Couldn't interpret that (${e instanceof Error ? e.message : 'error'}). Try simpler phrasing.`)
    } finally { setNlBusy(false) }
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

        {/* Plain-English tuning across every monitor — heuristic-instant for
            common expiry phrasings, the LLM for anything else. */}
        <Card className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Icon icon="chat" size={12} /> Tune any monitor in plain English
          </span>
          <div className="flex gap-2">
            <InputGroup fill value={nl} disabled={!canEdit || nlBusy}
              placeholder="e.g. alert 10 days before expiry · only surface suppliers below 4 · disable waste alerts"
              onChange={(e) => { setNl(e.currentTarget.value) }}
              onKeyDown={(e) => { if (e.key === 'Enter') void applyNl() }} />
            <Button text="Apply" loading={nlBusy} disabled={!canEdit || nlBusy || nl.trim().length === 0} onClick={() => { void applyNl() }} />
          </div>
          {nlNote && <p className="text-xs text-muted-foreground">{nlNote}</p>}
        </Card>

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
          effect="Effect — opens a waste-investigation Case in Decisions when an anomaly fires."
          onToggle={(b) => { patch('waste', { enabled: b }) }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metric — anomaly score (1–10)</div>
          <NumField label="Surface at score ≥" value={draft.waste.min_anomaly_score} max={10} disabled={!canEdit}
            onChange={(n) => { patch('waste', { min_anomaly_score: n }) }} />
          <CaseScanRow kind="waste" enabled={draft.waste.enabled} running={caseRunning} result={caseResult} onRun={runCaseScan} />
        </MonitorShell>

        {/* Supplier risk */}
        <MonitorShell icon="shield" title="Supplier monitor" enabled={draft.supplier.enabled} canEdit={canEdit}
          effect="Effect — opens a supplier-risk review Case in Decisions (typed supplier link)."
          onToggle={(b) => { patch('supplier', { enabled: b }) }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metric — reliability score (0–10, lower is worse)</div>
          <NumField label="Surface at score ≤" value={draft.supplier.max_reliability_score} max={10} disabled={!canEdit}
            onChange={(n) => { patch('supplier', { max_reliability_score: n }) }} />
          <CaseScanRow kind="supplier" enabled={draft.supplier.enabled} running={caseRunning} result={caseResult} onRun={runCaseScan} />
        </MonitorShell>

        {/* Data integration — connector + ingestion-pipeline freshness. The
            metric is the age of each source's last activity (and the ingest
            backlog); the SLA below is the tunable trigger, replacing the old
            hardcoded 2h/24h in get_pms_health / get_pos_health. */}
        <MonitorShell icon="data-connection" title="Data integration" enabled={draft.integration.enabled} canEdit={canEdit}
          effect="Effect — surfaces connector + ingestion health below. A stale/down feed or a stalled pipeline is where lost data hides."
          onToggle={(b) => { patch('integration', { enabled: b }) }}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Metric — minutes since a connector last fed us · ingestion backlog age</div>
          <div className="flex flex-wrap items-end gap-6">
            <NumField label="Feed stale after (min)" value={draft.integration.warn_after_minutes} max={43200} step={30} disabled={!canEdit}
              onChange={(n) => { patch('integration', { warn_after_minutes: Math.round(n) }) }} />
            <NumField label="Feed down after (min)" value={draft.integration.down_after_minutes} max={43200} step={60} disabled={!canEdit}
              onChange={(n) => { patch('integration', { down_after_minutes: Math.round(n) }) }} />
            <NumField label="Ingest stalled after (min)" value={draft.integration.stuck_ingest_after_minutes} max={43200} step={30} disabled={!canEdit}
              onChange={(n) => { patch('integration', { stuck_ingest_after_minutes: Math.round(n) }) }} />
          </div>
          <SourceRegistryReadout enabled={draft.integration.enabled} />
        </MonitorShell>

        {!canEdit && <Callout intent={Intent.NONE} icon="lock">Read-only — an admin or owner can tune these monitors.</Callout>}

        <div className="flex items-center gap-2 sticky bottom-0 bg-background py-2">
          <Button intent={Intent.PRIMARY} text="Save" icon="tick" disabled={!canEdit || !dirty || setMonitors.isPending}
            loading={setMonitors.isPending}
            onClick={() => { setMonitors.mutate(draft, { onSuccess: () => { setNlNote('Saved.') } }) }} />
          <Button text="Preview what this catches" icon="eye-open" disabled={!draft.expiry.enabled || sweep.isPending} loading={sweep.isPending}
            onClick={() => { sweep.mutate(undefined, { onSuccess: (r) => { setScan(r) } }) }} />
          {dirty && <span className="text-xs text-amber-600 dark:text-amber-400">Unsaved changes</span>}
          {setMonitors.isError && <span className="text-xs text-red-500">{setMonitors.error.message}</span>}
          {sweep.isError && <span className="text-xs text-red-500">{sweep.error.message}</span>}
        </div>

        {scan && (
          <Callout intent={scan.wouldPropose > 0 ? Intent.PRIMARY : Intent.SUCCESS} icon={scan.wouldPropose > 0 ? 'inbox' : 'tick-circle'}>
            Scanned {scan.scanned} batch{scan.scanned === 1 ? '' : 'es'} · {scan.fired} within trigger ·{' '}
            {scan.wouldPropose} write-off proposal{scan.wouldPropose === 1 ? '' : 's'} on the next cycle.
            <span className="block text-[11px] text-muted-foreground mt-0.5">
              Preview only — nothing was written. Monitors raise proposals through the cycle, so they pass the
              same gate and constraints as everything else.
            </span>
          </Callout>
        )}
      </div>
    </div>
  )
}
