// The Monitoring View tab of the Data Health app (661-663), drawn from the
// captures: a view opens behind an "All monitoring views" back link with
// three tabs — Troubleshoot alerts, Manage monitors, Manage subscriptions —
// and an Alert summary of three colored dot-counts
// (monitoring-views/images/troubleshoot-alerts.png). Troubleshoot rows carry
// a severity dot, a Monitor or Check tag, the resource, the failure reason,
// a "Since …" age and a snooze bell; "Hide snoozed alerts" banners the count
// (monitoring-views/images/run-history-redirect.png).
import { useState } from 'react'
import {
  Button, Card, Dialog, DialogBody, DialogFooter, HTMLSelect, Icon, InputGroup,
  Intent, NonIdealState, Spinner, Switch, Tab, Tabs, Tag, TextArea,
} from '@blueprintjs/core'
import {
  RULE_META, SEVERITIES, useAddRule, useAddSubscriber, useCreateView,
  useDeleteRule, useLinkCheck, useMonitorAlerts, useMonitoringRules,
  useMonitoringRuleTypes, useMonitoringViews, usePrincipals, useRemoveSubscriber,
  useSnoozeAlert, useSnoozeRule, useSubscribers, useTargetCatalog,
  useUnlinkedChecks, useViewChecks,
  type MonitoringRule, type MonitorSeverity,
} from './api'
import { checkTypeLabel } from '@/features/dataHealth/api'

const SEV_LABEL: Record<MonitorSeverity, string> = { low: 'Low', medium: 'Medium', high: 'High' }

const SNOOZE_CHOICES = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '6 hours', minutes: 360 },
  { label: '1 day', minutes: 1440 },
]

function since(ts: string): string {
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86_400_000)
  if (days > 0) return `Since ${String(days)} day${days === 1 ? '' : 's'} ago`
  const hours = Math.floor((Date.now() - new Date(ts).getTime()) / 3_600_000)
  if (hours > 0) return `Since ${String(hours)} hour${hours === 1 ? '' : 's'} ago`
  const mins = Math.max(1, Math.floor((Date.now() - new Date(ts).getTime()) / 60_000))
  return `Since ${String(mins)} minute${mins === 1 ? '' : 's'} ago`
}

export function MonitoringPanel() {
  const { data: views = [], isLoading } = useMonitoringViews()
  const [viewId, setViewId] = useState<string | null>(null)
  const selected = views.find((v) => v.id === viewId) ?? null

  if (isLoading) return <Spinner />
  if (selected !== null) {
    return <ViewDetail viewId={selected.id} name={selected.name} rid={selected.rid}
      onBack={() => { setViewId(null) }} />
  }
  return <ViewList onOpen={setViewId} />
}

function ViewList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: views = [] } = useMonitoringViews()
  const { data: catalog } = useTargetCatalog()
  const create = useCreateView()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button intent={Intent.PRIMARY} icon="add" onClick={() => { setCreating(!creating) }}>
          New monitoring view
        </Button>
      </div>
      {creating && (
        <Card compact className="flex items-center gap-2 flex-wrap">
          <InputGroup placeholder="Name" value={name}
            onChange={(e) => { setName(e.currentTarget.value) }} />
          {/* "be sure to store it in a project accessible to potential subscribers" */}
          <HTMLSelect value={projectId} onChange={(e) => { setProjectId(e.currentTarget.value) }}>
            <option value="">Location (project)…</option>
            {(catalog?.project ?? []).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </HTMLSelect>
          <Button intent={Intent.PRIMARY} text="Create"
            disabled={name.trim() === '' || projectId === '' || create.isPending}
            onClick={() => {
              create.mutate({ name: name.trim(), projectId },
                { onSuccess: () => { setCreating(false); setName('') } })
            }} />
        </Card>
      )}
      {views.length === 0 && !creating ? (
        <NonIdealState icon="grouped-bar-chart" title="No monitoring views"
          description="A monitoring view collects monitoring rules and health checks for the group of subscribers who care about them." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {views.map((v) => (
            <Card key={v.id} interactive compact onClick={() => { onOpen(v.id) }}>
              <div className="flex items-center gap-2">
                <Icon icon="grouped-bar-chart" size={14} className="text-muted-foreground" />
                <span className="text-sm font-semibold truncate">{v.name}</span>
              </div>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{v.rid}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function ViewDetail({ viewId, name, rid, onBack }: {
  viewId: string
  name: string
  rid: string
  onBack: () => void
}) {
  const { data: alerts = [] } = useMonitorAlerts(viewId)
  const failing = alerts.filter((a) => a.status === 'failing')
  const count = (s: MonitorSeverity) => failing.filter((a) => a.severity === s).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="minimal" icon="arrow-left" text="All monitoring views" onClick={onBack} />
        <span className="text-sm font-semibold">{name}</span>
        <span className="font-mono text-[10px] text-muted-foreground truncate" title={rid}>{rid}</span>
        <span className="ml-auto flex items-center gap-2 text-xs">
          <span className="font-semibold">Alert summary</span>
          <span className="flex items-center gap-1"><span className="msev-dot msev-high" />{count('high')}</span>
          <span className="flex items-center gap-1"><span className="msev-dot msev-medium" />{count('medium')}</span>
          <span className="flex items-center gap-1"><span className="msev-dot msev-low" />{count('low')}</span>
        </span>
      </div>
      <Tabs id={`mv-${viewId}`} renderActiveTabPanelOnly>
        <Tab id="alerts" title="Troubleshoot alerts" panel={<TroubleshootAlerts viewId={viewId} />} />
        <Tab id="monitors" title="Manage monitors" panel={<ManageMonitors viewId={viewId} />} />
        <Tab id="subs" title="Manage subscriptions" panel={<ManageSubscriptions viewId={viewId} />} />
      </Tabs>
    </div>
  )
}

function TroubleshootAlerts({ viewId }: { viewId: string }) {
  const { data: alerts = [] } = useMonitorAlerts(viewId)
  const { data: checks = [] } = useViewChecks(viewId)
  const { data: catalog } = useTargetCatalog()
  const snooze = useSnoozeAlert()
  const [hideSnoozed, setHideSnoozed] = useState(false)
  const [snoozing, setSnoozing] = useState<string | null>(null)

  const now = Date.now()
  const isSnoozed = (until: string | null) => until !== null && new Date(until).getTime() > now
  const firing = alerts.filter((a) => a.status === 'failing')
  const shown = firing.filter((a) => !hideSnoozed || !isSnoozed(a.snoozed_until))
  const hiddenCount = firing.length - shown.length
  const failingChecks = checks.filter((c) => c.latest !== null && c.latest.status !== 'passed')

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Switch checked={hideSnoozed} label="Hide snoozed alerts" className="!mb-0"
          onChange={(e) => { setHideSnoozed(e.currentTarget.checked) }} />
      </div>
      {shown.length === 0 && failingChecks.length === 0 ? (
        <NonIdealState icon="tick-circle" title="No alerts"
          description="Nothing in this view is failing." />
      ) : (
        <Card compact className="!p-0">
          <div className="mv-alert-row mv-alert-head">
            <span>ALERT</span><span>RESOURCE</span><span>FAILURE REASON</span><span>REPORTED</span><span />
          </div>
          <ul className="divide-y divide-border/30">
            {shown.map((a) => {
              const meta = RULE_META[a.rule_type]
              const snoozed = isSnoozed(a.snoozed_until)
              const sev = a.severity ?? 'low'
              return (
                <li key={a.id} className="mv-alert-row">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className={`msev-dot msev-${sev}`} />
                    <span className="truncate">
                      <span className="text-xs font-medium">{meta?.label ?? a.rule_type}</span>
                      <span className="block text-[10px] text-muted-foreground">{a.severity !== null ? SEV_LABEL[a.severity] : ''}</span>
                    </span>
                    <Tag minimal className="!text-[9px]">Monitor</Tag>
                  </span>
                  <span className="text-xs truncate">{catalog?.names.get(a.target_id) ?? a.target_id}</span>
                  <span className="text-xs truncate" title={a.measured ?? undefined}>{a.measured ?? '—'}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {a.fired_at !== null ? since(a.fired_at) : '—'}
                    <span className="block text-[10px]">Last checked: {new Date(a.last_evaluated_at).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-1 justify-end">
                    {snoozed ? (
                      <Button variant="minimal" size="small" icon="notifications-snooze" intent={Intent.WARNING}
                        title={`Snoozed until ${new Date(a.snoozed_until ?? '').toLocaleString()}${a.snooze_reason !== null ? ` — ${a.snooze_reason}` : ''}`}
                        onClick={() => { snooze.mutate({ alertId: a.id, until: null, reason: null }) }} />
                    ) : (
                      <Button variant="minimal" size="small" icon="notifications" aria-label="Snooze alert"
                        onClick={() => { setSnoozing(a.id) }} />
                    )}
                  </span>
                </li>
              )
            })}
            {failingChecks.map((c) => (
              <li key={c.id} className="mv-alert-row">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`msev-dot ${c.latest?.severity === 'critical' ? 'msev-high' : 'msev-medium'}`} />
                  <span className="truncate">
                    <span className="text-xs font-medium">{checkTypeLabel(c.check_type)}</span>
                    <span className="block text-[10px] text-muted-foreground capitalize">{c.latest?.severity ?? c.severity}</span>
                  </span>
                  <Tag minimal className="!text-[9px]">Check</Tag>
                </span>
                <span className="text-xs truncate">{c.datasetName}</span>
                <span className="text-xs truncate" title={c.latest?.detail ?? undefined}>{c.latest?.measured ?? c.latest?.status ?? '—'}</span>
                <span className="text-[11px] text-muted-foreground">
                  {c.latest !== null ? since(c.latest.reported_at) : '—'}
                </span>
                <span />
              </li>
            ))}
          </ul>
          {hideSnoozed && hiddenCount > 0 && (
            <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-t border-border">
              {hiddenCount} snoozed alert{hiddenCount === 1 ? '' : 's'} hidden
            </p>
          )}
        </Card>
      )}
      {snoozing !== null && (
        <SnoozeDialog
          title="Snooze monitor alert"
          onClose={() => { setSnoozing(null) }}
          onSnooze={(until, reason) => {
            snooze.mutate({ alertId: snoozing, until, reason })
            setSnoozing(null)
          }} />
      )}
    </div>
  )
}

// The dialog's grammar: an until-time, a required reason, and the warning
// that monitor snoozes outlive re-fires (snooze-monitor-alert.png).
function SnoozeDialog({ title, onClose, onSnooze }: {
  title: string
  onClose: () => void
  onSnooze: (until: string, reason: string) => void
}) {
  const [minutes, setMinutes] = useState(60)
  const [reason, setReason] = useState('')
  return (
    <Dialog isOpen title={title} onClose={onClose}>
      <DialogBody>
        <div className="space-y-3">
          <label className="flex flex-col gap-1 text-xs">
            Suspend alert notifications for all users until…
            <HTMLSelect value={minutes}
              options={SNOOZE_CHOICES.map((c) => ({ value: c.minutes, label: c.label }))}
              onChange={(e) => { setMinutes(Number(e.currentTarget.value)) }} />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            Reason (required):
            <TextArea fill placeholder="Provide explanation for snoozing" value={reason}
              onChange={(e) => { setReason(e.currentTarget.value) }} />
          </label>
          <p className="text-[11px] text-muted-foreground">
            Monitor alerts stay snoozed even when re-firing — wait for the snooze to expire
            or manually unsnooze to resume notifications.
          </p>
        </div>
      </DialogBody>
      <DialogFooter actions={
        <>
          <Button text="Cancel" onClick={onClose} />
          <Button intent={Intent.PRIMARY} text="Snooze" disabled={reason.trim() === ''}
            onClick={() => {
              onSnooze(new Date(Date.now() + minutes * 60_000).toISOString(), reason.trim())
            }} />
        </>
      } />
    </Dialog>
  )
}

function ManageMonitors({ viewId }: { viewId: string }) {
  const { data: rules = [] } = useMonitoringRules(viewId)
  const { data: checks = [] } = useViewChecks(viewId)
  const { data: unlinked = [] } = useUnlinkedChecks(viewId)
  const { data: catalog } = useTargetCatalog()
  const del = useDeleteRule()
  const snooze = useSnoozeRule()
  const link = useLinkCheck()
  const [adding, setAdding] = useState(false)
  const [snoozing, setSnoozing] = useState<string | null>(null)
  const [linkId, setLinkId] = useState('')

  const scopeLabel = (r: MonitoringRule): string => {
    if (r.target_id !== null) return catalog?.names.get(r.target_id) ?? r.target_id
    if (r.scope_folder_id !== null) return `Folder: ${catalog?.names.get(r.scope_folder_id) ?? r.scope_folder_id}`
    return `Project: ${catalog?.names.get(r.scope_project_id ?? '') ?? r.scope_project_id ?? ''}`
  }

  return (
    <div className="space-y-3">
      <Card compact className="!p-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Monitoring rules</span>
          <Tag minimal className="!text-[10px]">{rules.length}</Tag>
          <Button size="small" variant="minimal" icon={adding ? 'cross' : 'add'} className="ml-auto"
            onClick={() => { setAdding(!adding) }}>
            {adding ? 'Cancel' : 'Add monitoring rules'}
          </Button>
        </div>
        {adding && <AddRuleForm viewId={viewId} onDone={() => { setAdding(false) }} />}
        {rules.length === 0 && !adding ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No monitoring rules yet. A rule covers an entire scope — resources added to the
            scope later are automatically covered.
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {rules.map((r) => {
              const meta = RULE_META[r.rule_type]
              const ruleSnoozed = r.snoozed_until !== null && new Date(r.snoozed_until).getTime() > Date.now()
              return (
                <li key={r.id} className="px-3 py-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium">{meta?.label ?? r.rule_type}</span>
                  <Tag minimal className="!text-[9px] capitalize">{r.scope_kind}</Tag>
                  <span className="text-[11px] text-muted-foreground truncate">{scopeLabel(r)}</span>
                  {r.time_window !== null && <Tag minimal icon="time" className="!text-[9px]">{r.time_window}</Tag>}
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {r.conditions.map((c) => (
                      <span key={c.severity} className="flex items-center gap-1">
                        <span className={`msev-dot msev-${c.severity}`} />
                        {meta?.comparator.replace('If value is ', '') ?? '≥'} {c.threshold}{meta?.unit === 'seconds' ? 's' : ''}
                      </span>
                    ))}
                  </span>
                  <span className="ml-auto flex items-center gap-1">
                    {ruleSnoozed ? (
                      <Button variant="minimal" size="small" icon="notifications-snooze" intent={Intent.WARNING}
                        title={`Snoozed until ${new Date(r.snoozed_until ?? '').toLocaleString()}${r.snooze_reason !== null ? ` — ${r.snooze_reason}` : ''}`}
                        onClick={() => { snooze.mutate({ ruleId: r.id, until: null, reason: null }) }} />
                    ) : (
                      <Button variant="minimal" size="small" icon="notifications" aria-label="Snooze rule"
                        title="Snooze — silences alerts across all targets of this rule"
                        onClick={() => { setSnoozing(r.id) }} />
                    )}
                    <Button variant="minimal" size="small" icon="cross" aria-label="Remove rule"
                      onClick={() => { del.mutate({ ruleId: r.id }) }} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {/* "select multiple datasets and choose the existing health checks you
          want to add" — link existing checks into the view. */}
      <Card compact className="!p-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Health checks</span>
          <Tag minimal className="!text-[10px]">{checks.length}</Tag>
          <span className="ml-auto flex items-center gap-1">
            <HTMLSelect value={linkId} onChange={(e) => { setLinkId(e.currentTarget.value) }}>
              <option value="">Add health check…</option>
              {unlinked.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.datasetName} — {checkTypeLabel(c.check_type)}
                </option>
              ))}
            </HTMLSelect>
            <Button size="small" icon="add" disabled={linkId === '' || link.isPending}
              onClick={() => { link.mutate({ checkId: linkId, viewId }); setLinkId('') }} />
          </span>
        </div>
        {checks.length === 0 ? (
          <p className="px-3 py-3 text-xs text-muted-foreground">
            No health checks in this view yet — add existing checks to group them here.
          </p>
        ) : (
          <ul className="divide-y divide-border/30">
            {checks.map((c) => (
              <li key={c.id} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                <span className="font-medium">{checkTypeLabel(c.check_type)}</span>
                <span className="text-muted-foreground truncate">{c.datasetName}</span>
                <Button variant="minimal" size="small" icon="cross" className="ml-auto" aria-label="Remove from view"
                  onClick={() => { link.mutate({ checkId: c.id, viewId: null }) }} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {snoozing !== null && (
        <SnoozeDialog
          title="Snooze monitor rule"
          onClose={() => { setSnoozing(null) }}
          onSnooze={(until, reason) => {
            snooze.mutate({ ruleId: snoozing, until, reason })
            setSnoozing(null)
          }} />
      )}
    </div>
  )
}

function AddRuleForm({ viewId, onDone }: { viewId: string; onDone: () => void }) {
  const { data: types = [] } = useMonitoringRuleTypes()
  const { data: catalog } = useTargetCatalog()
  const add = useAddRule()
  const [ruleType, setRuleType] = useState('consecutive_schedule_failures')
  const [scopeKind, setScopeKind] = useState<'single' | 'folder' | 'project'>('single')
  const [targetId, setTargetId] = useState('')
  const [windowMinutes, setWindowMinutes] = useState(60)
  const [thresholds, setThresholds] = useState<Record<MonitorSeverity, string>>({
    low: '', medium: '', high: '',
  })

  const meta = RULE_META[ruleType]
  const family = meta?.family ?? 'schedule'
  // the published scope availability, as the CHECK holds it
  const scopes: ('single' | 'folder' | 'project')[] =
    family === 'dataset' ? ['single', 'folder', 'project']
      : family === 'automation' ? ['single', 'project'] : ['single']
  const effScope = scopes.includes(scopeKind) ? scopeKind : 'single'
  const targets = effScope === 'folder' ? catalog?.folder
    : effScope === 'project' ? catalog?.project
      : catalog?.[family]
  const conditions = SEVERITIES
    .filter((s) => thresholds[s].trim() !== '')
    .map((s) => ({ severity: s, threshold: Number(thresholds[s]) }))

  return (
    <div className="px-3 py-2 border-b border-border space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <HTMLSelect value={ruleType} onChange={(e) => {
          setRuleType(e.currentTarget.value); setTargetId('')
        }}>
          {types.map((t) => <option key={t} value={t}>{RULE_META[t]?.label ?? t}</option>)}
        </HTMLSelect>
        <HTMLSelect value={effScope} onChange={(e) => {
          setScopeKind(e.currentTarget.value as 'single' | 'folder' | 'project'); setTargetId('')
        }}>
          {scopes.map((s) => <option key={s} value={s}>{s === 'single' ? 'Single' : s === 'folder' ? 'Folder' : 'Project'}</option>)}
        </HTMLSelect>
        <HTMLSelect value={targetId} onChange={(e) => { setTargetId(e.currentTarget.value) }}>
          <option value="">Select {effScope === 'single' ? family : effScope}…</option>
          {(targets ?? []).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </HTMLSelect>
        {meta?.windowed === true && (
          <label className="flex items-center gap-1 text-xs">
            Time window
            <HTMLSelect value={windowMinutes}
              options={[{ value: 60, label: '1 hour' }, { value: 360, label: '6 hours' }, { value: 1440, label: '1 day' }]}
              onChange={(e) => { setWindowMinutes(Number(e.currentTarget.value)) }} />
          </label>
        )}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">{meta?.comparator ?? ''}</span>
        {SEVERITIES.map((s) => (
          <label key={s} className="flex items-center gap-1 text-xs">
            <span className={`msev-dot msev-${s}`} />{SEV_LABEL[s]}
            <InputGroup className="health-num" size="small" placeholder={meta?.unit === 'seconds' ? 'seconds' : 'count'}
              value={thresholds[s]}
              onChange={(e) => { setThresholds({ ...thresholds, [s]: e.currentTarget.value }) }} />
          </label>
        ))}
        <Button intent={Intent.PRIMARY} size="small" text="Add rule"
          disabled={targetId === '' || conditions.length === 0 || add.isPending}
          onClick={() => {
            add.mutate({
              viewId, resourceType: family, ruleType, scopeKind: effScope,
              targetId: effScope === 'single' ? targetId : null,
              scopeFolderId: effScope === 'folder' ? targetId : null,
              scopeProjectId: effScope === 'project' ? targetId : null,
              timeWindow: meta?.windowed === true ? `${String(windowMinutes)} minutes` : null,
              conditions,
            }, { onSuccess: onDone })
          }} />
      </div>
    </div>
  )
}

function ManageSubscriptions({ viewId }: { viewId: string }) {
  const { data: subs = [] } = useSubscribers(viewId)
  const { data: principals } = usePrincipals()
  const addSub = useAddSubscriber()
  const removeSub = useRemoveSubscriber()
  const [principal, setPrincipal] = useState('')
  const [minSeverity, setMinSeverity] = useState<MonitorSeverity>('low')

  return (
    <Card compact className="!p-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subscribers</span>
        <Tag minimal className="!text-[10px]">{subs.length}</Tag>
        <span className="ml-auto flex items-center gap-1">
          <HTMLSelect value={principal} onChange={(e) => { setPrincipal(e.currentTarget.value) }}>
            <option value="">Add user or group…</option>
            {(principals?.users ?? []).map((u) => <option key={u.id} value={`u:${u.id}`}>{u.email}</option>)}
            {(principals?.groups ?? []).map((g) => <option key={g.id} value={`g:${g.id}`}>{g.name} (group)</option>)}
          </HTMLSelect>
          <HTMLSelect value={minSeverity}
            options={SEVERITIES.map((s) => ({ value: s, label: `${SEV_LABEL[s]} and above` }))}
            onChange={(e) => { setMinSeverity(e.currentTarget.value as MonitorSeverity) }} />
          <Button size="small" icon="add" disabled={principal === '' || addSub.isPending}
            onClick={() => {
              addSub.mutate({
                viewId,
                userId: principal.startsWith('u:') ? principal.slice(2) : null,
                groupId: principal.startsWith('g:') ? principal.slice(2) : null,
                minSeverity,
              })
              setPrincipal('')
            }} />
        </span>
      </div>
      {subs.length === 0 ? (
        <p className="px-3 py-3 text-xs text-muted-foreground">
          No subscribers yet. Subscribers need access to both this view and the monitored
          resources to receive alerts.
        </p>
      ) : (
        <ul className="divide-y divide-border/30">
          {subs.map((s) => (
            <li key={s.id} className="px-3 py-1.5 flex items-center gap-2 text-xs">
              <Icon icon={s.group_id !== null ? 'people' : 'person'} size={12} className="text-muted-foreground" />
              <span>{s.label}</span>
              <Tag minimal className="!text-[9px]">{SEV_LABEL[s.min_severity]} and above</Tag>
              <Button variant="minimal" size="small" icon="cross" className="ml-auto" aria-label="Remove subscriber"
                onClick={() => { removeSub.mutate({ id: s.id }) }} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
