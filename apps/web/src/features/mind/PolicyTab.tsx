// Mind → Policy — the operator-tunable autonomy knobs. Admin/owner only.
// Phase E1: this surface saves the document; callers honour it after Phase E2
// plumbs them. Until then we show a banner explaining the gap honestly.

import { useEffect, useMemo, useState } from 'react'
import {
  Button, Callout, Card, FormGroup, Icon, Intent, NumericInput, Spinner, SpinnerSize, Tag,
} from '@blueprintjs/core'
import { toast } from 'sonner'
import { useOrgPolicy, useSetOrgPolicy, DEFAULT_ORG_POLICY, type OrgPolicy } from './policy'

const KNOWN_ACTION_TYPES: ReadonlyArray<{ type: string; label: string; hint: string }> = [
  { type: 'REQUEST_RESTOCK', label: 'REQUEST_RESTOCK', hint: 'Auto-creates a pending restock request. V1 default 0.9.' },
  { type: 'TRANSFER_STOCK',  label: 'TRANSFER_STOCK',  hint: 'Lateral move between sister hotels. Off by default.' },
  { type: 'WRITE_OFF',       label: 'WRITE_OFF',       hint: 'Removes stock as waste. Off by default.' },
  { type: 'ADJUST_STOCK',    label: 'ADJUST_STOCK',    hint: 'Manual quantity correction. Off by default.' },
]

const KNOWN_AGENTS: ReadonlyArray<{ name: string; hint: string }> = [
  { name: 'restock_advisor',       hint: 'Per-hotel restock proposer. Overrides the REQUEST_RESTOCK floor for this agent.' },
  { name: 'waste_triage',          hint: 'Tags variants for write-off. Tighten to require very high confidence.' },
  { name: 'overstock_rebalancer',  hint: 'Per-hotel lateral move proposer.' },
  { name: 'org_overstock_balancer', hint: 'Org-level overstock sweep. Always queued in V1; override applies once auto-exec lands.' },
]

export function PolicyTab() {
  const { data, isLoading, isError } = useOrgPolicy()
  const setPolicy = useSetOrgPolicy()
  const [draft, setDraft] = useState<OrgPolicy>(DEFAULT_ORG_POLICY)

  useEffect(() => {
    if (data) setDraft(data.merged)
  }, [data])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(data?.merged), [draft, data])

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner size={SpinnerSize.SMALL} />Loading policy…
      </div>
    )
  }
  if (isError) {
    return (
      <div className="p-6">
        <Callout intent={Intent.WARNING} icon="warning-sign" title="Policy unavailable for this role">
          Mind → Policy is admin/owner only.
        </Callout>
      </div>
    )
  }

  const save = () => {
    setPolicy.mutate(draft, {
      onSuccess: () => { toast.success('Policy saved') },
      onError:   (err: Error) => { toast.error(err.message) },
    })
  }

  const reset = () => { setDraft(DEFAULT_ORG_POLICY) }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-4">

        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Policy</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Operator-tunable knobs governing the autonomous loop. Saved values become the org's overrides.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="minimal" onClick={reset} disabled={setPolicy.isPending}>Reset to defaults</Button>
            <Button intent={Intent.PRIMARY} onClick={save} loading={setPolicy.isPending} disabled={!dirty}>
              Save policy
            </Button>
          </div>
        </header>

        <Callout intent={Intent.SUCCESS} icon="endorsed" title="Live — saved values govern the autonomous loop">
          The operator-triggered cycle, per-variant advisor, org overstock sweep, promotion gate and reliability
          windows all read from this document. Edge cron picks changes up after redeploy.
        </Callout>

        {/* ── Auto-execution thresholds ─────────────────────────────────────── */}
        <Card compact>
          <SectionHeader icon="flag" title="Auto-execution thresholds" subtitle="Per-action-type confidence floor (0–1). Action types not listed never auto-execute." />
          <div className="space-y-3">
            {KNOWN_ACTION_TYPES.map((a) => {
              const current = draft.auto_execution.thresholds[a.type as keyof typeof draft.auto_execution.thresholds]
              const enabled = current != null
              return (
                <div key={a.type} className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Tag minimal className="font-mono !text-[10px]">{a.label}</Tag>
                      {enabled
                        ? <Tag minimal intent={Intent.SUCCESS}>auto-exec eligible</Tag>
                        : <Tag minimal>queue only</Tag>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{a.hint}</p>
                  </div>
                  <NumericInput
                    min={0} max={1} stepSize={0.05} minorStepSize={0.01}
                    value={current ?? ''}
                    onValueChange={(n) => {
                      const k = a.type as keyof typeof draft.auto_execution.thresholds
                      const valid = Number.isFinite(n) && n >= 0 && n <= 1
                      // Reset to default if blanked, else set the override.
                      const next = Object.fromEntries(
                        Object.entries(draft.auto_execution.thresholds).filter(([key]) => key !== k),
                      ) as typeof draft.auto_execution.thresholds
                      if (valid) next[k] = n
                      setDraft({ ...draft, auto_execution: { ...draft.auto_execution, thresholds: next } })
                    }}
                    placeholder="off"
                    className="w-24"
                  />
                </div>
              )
            })}
          </div>
        </Card>

        {/* ── Per-agent floor overrides ─────────────────────────────────────── */}
        <Card compact>
          <SectionHeader icon="user" title="Per-agent floor overrides" subtitle="Override the per-action-type floor for one specific agent. Leave blank to inherit the action-type floor." />
          <div className="space-y-3">
            {KNOWN_AGENTS.map((a) => {
              const overrides = draft.auto_execution.agent_overrides
              const current = a.name in overrides ? overrides[a.name] : undefined
              return (
                <div key={a.name} className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Tag minimal className="font-mono !text-[10px]">{a.name}</Tag>
                      {current != null
                        ? <Tag minimal intent={Intent.PRIMARY}>floor {current.toFixed(2)}</Tag>
                        : <Tag minimal>inherits</Tag>}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">{a.hint}</p>
                  </div>
                  <NumericInput
                    min={0} max={1} stepSize={0.05} minorStepSize={0.01}
                    value={current ?? ''}
                    onValueChange={(n) => {
                      const valid = Number.isFinite(n) && n >= 0 && n <= 1
                      const next = Object.fromEntries(
                        Object.entries(draft.auto_execution.agent_overrides).filter(([k]) => k !== a.name),
                      ) as Record<string, number>
                      if (valid) next[a.name] = n
                      setDraft({ ...draft, auto_execution: { ...draft.auto_execution, agent_overrides: next } })
                    }}
                    placeholder="inherit"
                    className="w-24"
                  />
                </div>
              )
            })}
          </div>
        </Card>

        {/* ── Promotion gate ────────────────────────────────────────────────── */}
        <Card compact>
          <SectionHeader icon="confirm" title="Promotion gate" subtitle="Minimum eval pass rate required to promote an agent to production." />
          <FormGroup label="production_pass_rate_floor (0–1)" inline>
            <NumericInput
              min={0} max={1} stepSize={0.05} minorStepSize={0.01}
              value={draft.promotion.production_pass_rate_floor}
              onValueChange={(n) => {
                if (Number.isFinite(n) && n >= 0 && n <= 1) {
                  setDraft({ ...draft, promotion: { production_pass_rate_floor: n } })
                }
              }}
              className="w-24"
            />
          </FormGroup>
        </Card>

        {/* ── Overstock + par + reliability windows ─────────────────────────── */}
        <Card compact>
          <SectionHeader icon="time" title="Heuristics + windows" subtitle="Sizing of the overstock sweep, par engine, and supplier reliability lookbacks." />
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="overstock.factor" helperText="current_stock > par × factor counts as overstock">
              <NumericInput
                min={1} stepSize={0.5} minorStepSize={0.1}
                value={draft.overstock.factor}
                onValueChange={(n) => { if (Number.isFinite(n) && n >= 1) setDraft({ ...draft, overstock: { factor: n } }) }}
                fill
              />
            </FormGroup>
            <FormGroup label="par.service_level (0–1)">
              <NumericInput
                min={0} max={1} stepSize={0.05} minorStepSize={0.01}
                value={draft.par.service_level}
                onValueChange={(n) => { if (Number.isFinite(n) && n >= 0 && n <= 1) setDraft({ ...draft, par: { ...draft.par, service_level: n } }) }}
                fill
              />
            </FormGroup>
            <FormGroup label="par.window_days">
              <NumericInput
                min={7} stepSize={7}
                value={draft.par.window_days}
                onValueChange={(n) => { if (Number.isFinite(n) && n >= 7) setDraft({ ...draft, par: { ...draft.par, window_days: Math.round(n) } }) }}
                fill
              />
            </FormGroup>
            <FormGroup label="supplier_reliability.window_days">
              <NumericInput
                min={14} stepSize={7}
                value={draft.supplier_reliability.window_days}
                onValueChange={(n) => { if (Number.isFinite(n) && n >= 14) setDraft({ ...draft, supplier_reliability: { window_days: Math.round(n) } }) }}
                fill
              />
            </FormGroup>
          </div>
        </Card>

        {/* ── Sweep caps ────────────────────────────────────────────────────── */}
        <Card compact>
          <SectionHeader icon="filter" title="Sweep caps" subtitle="Upper bounds on how many proposals a single run may produce." />
          <div className="grid grid-cols-2 gap-3">
            <FormGroup label="caps.max_variants_per_cycle">
              <NumericInput
                min={1} stepSize={1}
                value={draft.caps.max_variants_per_cycle}
                onValueChange={(n) => { if (Number.isFinite(n) && n >= 1) setDraft({ ...draft, caps: { ...draft.caps, max_variants_per_cycle: Math.round(n) } }) }}
                fill
              />
            </FormGroup>
            <FormGroup label="caps.max_proposals_per_sweep">
              <NumericInput
                min={1} stepSize={1}
                value={draft.caps.max_proposals_per_sweep}
                onValueChange={(n) => { if (Number.isFinite(n) && n >= 1) setDraft({ ...draft, caps: { ...draft.caps, max_proposals_per_sweep: Math.round(n) } }) }}
                fill
              />
            </FormGroup>
          </div>
        </Card>

      </div>
    </div>
  )
}

function SectionHeader({ icon, title, subtitle }: { icon: 'flag' | 'confirm' | 'time' | 'filter' | 'user'; title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Icon icon={icon} size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  )
}
